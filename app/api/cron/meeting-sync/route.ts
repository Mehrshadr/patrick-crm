import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCalendarEvents } from '@/lib/calendar'
import { logActivity } from '@/lib/activity'

export const dynamic = 'force-dynamic'

export async function GET() {
    try {
        console.log('[MeetingSync] Starting...')

        // 1. Fetch System Tokens
        const t1 = await db.appSettings.findUnique({ where: { key: 'SYSTEM_GOOGLE_ACCESS_TOKEN' } })
        const t2 = await db.appSettings.findUnique({ where: { key: 'SYSTEM_GOOGLE_REFRESH_TOKEN' } })

        if (!t1?.value || !t2?.value) {
            console.log('[MeetingSync] No system tokens found. Skipping.')
            return NextResponse.json({ success: false, error: 'No system tokens' }, { status: 401 })
        }

        const accessToken = t1.value
        const refreshToken = t2.value

        // 2. Fetch Events for next 7 days
        const now = new Date()
        const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)

        const events = await getCalendarEvents(accessToken, {
            refreshToken,
            timeMin: now,
            timeMax: nextWeek
        })

        console.log(`[MeetingSync] Found ${events.length} upcoming events`)

        // 3. Extract Attendees
        const attendeeEmails = new Set<string>()
        events.forEach(e => {
            if (e.attendees) {
                e.attendees.forEach(email => attendeeEmails.add(email.toLowerCase()))
            }
        })

        if (attendeeEmails.size === 0) {
            return NextResponse.json({ success: true, message: 'No attendees found' })
        }

        // 4. Match with Leads
        const leads = await db.lead.findMany({
            where: {
                email: { in: Array.from(attendeeEmails) }
            }
        })

        console.log(`[MeetingSync] Matched ${leads.length} leads in upcoming meetings`)

        let updatedCount = 0

        // 5. Update Status & Cancel Automation
        for (const lead of leads) {
            // Only update if not already booked or won/lost
            // We want to catch standard pipeline statuses like 'New Lead', 'Discussion', etc.
            const PROTECTED_STATUSES = ['Meeting Booked', 'Won', 'Lost', 'Bad Fit']

            if (!PROTECTED_STATUSES.includes(lead.status)) {
                console.log(`[MeetingSync] Updating lead ${lead.email} to Meeting Booked`)

                // Update Lead
                await db.lead.update({
                    where: { id: lead.id },
                    data: {
                        status: 'Meeting Booked',
                        nextNurtureAt: null // Clear any pending nurture
                    }
                })

                // Cancel Active Automations
                const activeWorkflows = await db.workflowExecution.findMany({
                    where: { leadId: lead.id, status: 'ACTIVE' }
                })

                if (activeWorkflows.length > 0) {
                    await db.workflowExecution.updateMany({
                        where: { leadId: lead.id, status: 'ACTIVE' },
                        data: {
                            status: 'CANCELLED',
                            cancelReason: 'Meeting Detected in Calendar',
                            cancelledAt: new Date()
                        }
                    })
                    console.log(`[MeetingSync] Cancelled ${activeWorkflows.length} workflows for ${lead.email}`)
                }

                // Log Activity
                await logActivity({
                    category: 'MEETING',
                    action: 'MEETING_BOOKED',
                    entityType: 'LEAD',
                    entityId: lead.id,
                    entityName: lead.name || lead.email,
                    description: 'Meeting detected in calendar. Automation cancelled.',
                })

                // Also Timeline Log
                await db.log.create({
                    data: {
                        leadId: lead.id,
                        type: 'MEETING',
                        status: 'BOOKED',
                        title: 'Meeting Detected',
                        content: 'System detected a meeting on the calendar. Status updated and automation paused.',
                        stage: 'Meeting Booked'
                    }
                })

                updatedCount++
            }
        }

        return NextResponse.json({
            success: true,
            eventsFound: events.length,
            leadsMatched: leads.length,
            leadsUpdated: updatedCount
        })

    } catch (error: any) {
        console.error('[MeetingSync] Error:', error)
        return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }
}
