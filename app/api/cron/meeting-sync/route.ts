import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCalendarEvents } from '@/lib/calendar'
import { logActivity } from '@/lib/activity'

export const dynamic = 'force-dynamic'

export async function GET() {
    try {
        console.log('[MeetingSync] Starting...')

        // 1. Fetch System Calendar Tokens (preferring Mehrdad's calendar tokens)
        let accessToken: string | undefined
        let refreshToken: string | undefined

        // First try dedicated CALENDAR tokens (from Mehrdad@)
        const calTokens = await db.appSettings.findMany({
            where: { key: { in: ['SYSTEM_CALENDAR_ACCESS_TOKEN', 'SYSTEM_CALENDAR_REFRESH_TOKEN'] } }
        })
        accessToken = calTokens.find(t => t.key === 'SYSTEM_CALENDAR_ACCESS_TOKEN')?.value
        refreshToken = calTokens.find(t => t.key === 'SYSTEM_CALENDAR_REFRESH_TOKEN')?.value

        // Fallback to legacy tokens if calendar-specific tokens not found
        if (!accessToken || !refreshToken) {
            const legacyTokens = await db.appSettings.findMany({
                where: { key: { in: ['SYSTEM_GOOGLE_ACCESS_TOKEN', 'SYSTEM_GOOGLE_REFRESH_TOKEN'] } }
            })
            accessToken = accessToken || legacyTokens.find(t => t.key === 'SYSTEM_GOOGLE_ACCESS_TOKEN')?.value
            refreshToken = refreshToken || legacyTokens.find(t => t.key === 'SYSTEM_GOOGLE_REFRESH_TOKEN')?.value
        }

        if (!accessToken || !refreshToken) {
            console.log('[MeetingSync] No system tokens found. Skipping.')
            return NextResponse.json({ success: false, error: 'No system tokens' }, { status: 401 })
        }


        // 2. Fetch Events for next 14 days (Look further ahead)
        const now = new Date()
        const nextTwoWeeks = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000)

        const events = await getCalendarEvents(accessToken, {
            refreshToken,
            timeMin: now,
            timeMax: nextTwoWeeks
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
            // Find the SPECIFIC event that matched this lead
            // (We found the lead because an event had their email, now let's find WHICH event)
            const leadEvents = events.filter(e => e.attendees?.some(att => att.toLowerCase() === lead.email?.toLowerCase()))

            if (leadEvents.length === 0) continue

            // Take the earliest upcoming meeting
            const nextEvent = leadEvents[0] // Events are sorted by start time
            // Calculate Duration in Minutes
            const durationMs = nextEvent.end.getTime() - nextEvent.start.getTime()
            const durationMinutes = Math.floor(durationMs / (1000 * 60))

            let targetStage = 'Meeting1' // Default
            let description = '15min Discovery Call Detected'

            // LOGIC: Differentiate Meeting Types based on Duration and History
            if (durationMinutes >= 45) {
                // It's a Strategy Call (60m usually)
                // Decide if M2 or M3 based on history
                // "If they had a Meeting 2 Outcome (Done, Rescheduled, etc), this is likely M3"
                if (lead.meeting2Outcome && lead.meeting2Outcome !== '') {
                    targetStage = 'Meeting3'
                    description = `60min Proposal Call Detected (History: M2 ${lead.meeting2Outcome})`
                } else {
                    targetStage = 'Meeting2'
                    description = '60min Strategy Call Detected'
                }
            } else {
                // < 45 mins -> Likely the 15min Intro (Meeting 1)
                targetStage = 'Meeting1'
            }

            // Status Protection: Don't revert 'Won' or 'Lost' leads
            const PROTECTED_STATUSES = ['Won', 'Lost', 'Bad Fit']

            // Should we update? 
            // - If status is NOT protected
            // - AND (Current Status is different OR nextMeetingAt is not set)
            // Actually, we should always update the nextMeetingAt time even if status doesn't change

            if (!PROTECTED_STATUSES.includes(lead.status)) {
                // Determine if we need to log a major status change
                const isStatusChange = lead.status !== targetStage

                // Cast lead to any to avoid TS error on server where Prisma client isn't updated yet
                const leadAny = lead as any;
                if (isStatusChange || !leadAny.nextMeetingAt) {
                    console.log(`[MeetingSync] Updating lead ${lead.email} to ${targetStage} (${description})`)

                    // Update Lead
                    await db.lead.update({
                        where: { id: lead.id },
                        data: {
                            status: targetStage,
                            subStatus: 'Scheduled',
                            nextMeetingAt: nextEvent.start, // Store the exact time
                            nextNurtureAt: null // Clear any pending nurture
                        } as any
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
                                cancelReason: `Meeting Detected: ${description}`,
                                cancelledAt: new Date()
                            }
                        })
                    }

                    // Activity Log
                    if (isStatusChange) {
                        await logActivity({
                            category: 'MEETING',
                            action: 'MEETING_BOOKED',
                            entityType: 'LEAD',
                            entityId: lead.id,
                            entityName: (lead.name || lead.email) || undefined,
                            description: `Meeting detected: ${description}. Status -> ${targetStage}`,
                        })

                        // Timeline Log
                        await db.log.create({
                            data: {
                                leadId: lead.id,
                                type: 'MEETING',
                                status: 'BOOKED',
                                title: `${targetStage} Confirmed`,
                                content: `System detected a ${durationMinutes}min meeting on ${nextEvent.start.toLocaleString()}. Updates status to ${targetStage}.`,
                                stage: targetStage,
                                meta: JSON.stringify({
                                    eventId: nextEvent.id,
                                    startTime: nextEvent.start,
                                    topic: nextEvent.title
                                })
                            }
                        })
                    } else {
                        // Just update time, maybe silent log?
                        // No need to spam logs if just updating time
                    }

                    updatedCount++
                }
            }
        }

        // 6. Detect Cancellations
        // Find leads who THINK they have a meeting in the fetched window, but don't anymore.
        const trackedLeads = await db.lead.findMany({
            where: {
                nextMeetingAt: {
                    gte: now,
                    lte: nextTwoWeeks
                }
            }
        })

        let cancelledCount = 0
        for (const L of trackedLeads) {
            // Check if L's email appears in ANY event in 'events'
            const hasMeeting = events.some(e => e.attendees?.some(att => att.toLowerCase() === L.email?.toLowerCase()))

            if (!hasMeeting) {
                // Meeting disappeared!
                console.log(`[MeetingSync] Cancellation detected for ${L.email}. Clearing status.`)

                await db.lead.update({
                    where: { id: L.id },
                    data: {
                        nextMeetingAt: null,
                        meetingId: null,
                        subStatus: L.subStatus === 'Scheduled' ? null : L.subStatus, // Clear 'Scheduled' tag, keep others if weird
                    } as any
                })

                // We don't change the Stage back automatically (too risky), 
                // but removing 'Scheduled' + Date Badge effectively "un-confirms" is visually.
                cancelledCount++
            }
        }

        return NextResponse.json({
            success: true,
            eventsFound: events.length,
            leadsMatched: leads.length,
            leadsUpdated: updatedCount,
            cancellations: cancelledCount
        })

    } catch (error: any) {
        console.error('[MeetingSync] Error:', error)
        return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }
}
