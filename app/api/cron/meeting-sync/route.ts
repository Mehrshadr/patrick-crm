import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCalendarEvents } from '@/lib/calendar'
import { logActivity } from '@/lib/activity'

export const dynamic = 'force-dynamic'

const CRON_SECRET = process.env.CRON_SECRET || 'patrick-cron-secret-2024'

export async function GET(request: NextRequest) {
    try {
        // Validate CRON_SECRET for security
        const authHeader = request.headers.get('authorization')
        const querySecret = request.nextUrl.searchParams.get('secret')
        const isValidSecret = (authHeader === `Bearer ${CRON_SECRET}`) || (querySecret === CRON_SECRET)

        if (!isValidSecret) {
            console.log('[MeetingSync] Unauthorized access attempt')
            return NextResponse.json(
                { success: false, error: 'Unauthorized: Invalid cron secret' },
                { status: 401 }
            )
        }

        console.log('[MeetingSync] Starting...')

        // 1. Fetch System Calendar Tokens (preferring Mehrdad's calendar tokens)
        let accessToken: string | undefined
        let refreshToken: string | undefined

        // First try dedicated CALENDAR tokens (from Mehrdad@)
        const calTokens = await db.appSettings.findMany({
            where: { key: { in: ['SYSTEM_CALENDAR_ACCESS_TOKEN', 'SYSTEM_CALENDAR_REFRESH_TOKEN'] } }
        })
        accessToken = calTokens.find((t: { key: string; value: string }) => t.key === 'SYSTEM_CALENDAR_ACCESS_TOKEN')?.value
        refreshToken = calTokens.find((t: { key: string; value: string }) => t.key === 'SYSTEM_CALENDAR_REFRESH_TOKEN')?.value

        // Fallback to legacy tokens if calendar-specific tokens not found
        if (!accessToken || !refreshToken) {
            const legacyTokens = await db.appSettings.findMany({
                where: { key: { in: ['SYSTEM_GOOGLE_ACCESS_TOKEN', 'SYSTEM_GOOGLE_REFRESH_TOKEN'] } }
            })
            accessToken = accessToken || legacyTokens.find((t: { key: string; value: string }) => t.key === 'SYSTEM_GOOGLE_ACCESS_TOKEN')?.value
            refreshToken = refreshToken || legacyTokens.find((t: { key: string; value: string }) => t.key === 'SYSTEM_GOOGLE_REFRESH_TOKEN')?.value
        }

        if (!accessToken || !refreshToken) {
            console.log('[MeetingSync] No system tokens found. Skipping.')
            return NextResponse.json({ success: false, error: 'No system tokens' }, { status: 401 })
        }


        // 2. Fetch Events for next 30 days (Look further ahead)
        const now = new Date()
        const nextThirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

        const events = await getCalendarEvents(accessToken, {
            refreshToken,
            timeMin: now,
            timeMax: nextThirtyDays
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

            // Cast lead to any to avoid TS error on server where Prisma client isn't updated yet
            const leadAny = lead as any;

            // Status Protection: Don't revert 'Won' or 'Lost' leads
            const PROTECTED_STATUSES = ['Won', 'Lost', 'Bad Fit']

            if (PROTECTED_STATUSES.includes(lead.status)) continue

            // LOGIC: Handle Meeting Types based on Duration
            if (durationMinutes >= 45) {
                // LONG MEETING (60m Strategy/Proposal Call)
                // Rule: DON'T change the pipeline stage
                // Rule: Set subStatus to "Scheduled" or "Rescheduled" based on history

                // Determine if this is a reschedule:
                // - If subStatus is already "Scheduled", "Rescheduled", "No Show", or similar → it's a Reschedule
                // - If lead already had a meeting before (nextMeetingAt was set or subStatus indicates previous scheduling)
                const schedulingHistory = ['Scheduled', 'Rescheduled', 'No Show']
                const hadPreviousMeeting = schedulingHistory.includes(leadAny.subStatus) || leadAny.nextMeetingAt

                const newSubStatus = hadPreviousMeeting ? 'Rescheduled' : 'Scheduled'
                const description = `${durationMinutes}min meeting detected → subStatus: ${newSubStatus} (pipeline unchanged)`

                console.log(`[MeetingSync] Long meeting for ${lead.email}: ${description}`)

                // Update Lead - Only subStatus and nextMeetingAt, NOT the pipeline status
                await db.lead.update({
                    where: { id: lead.id },
                    data: {
                        subStatus: newSubStatus,
                        nextMeetingAt: nextEvent.start,
                    } as any
                })

                // Activity Log
                await logActivity({
                    category: 'MEETING',
                    action: 'MEETING_BOOKED',
                    entityType: 'LEAD',
                    entityId: lead.id,
                    entityName: (lead.name || lead.email) || undefined,
                    description: description,
                })

                // Timeline Log
                await db.log.create({
                    data: {
                        leadId: lead.id,
                        type: 'MEETING',
                        status: 'BOOKED',
                        title: `Meeting ${newSubStatus}`,
                        content: `System detected a ${durationMinutes}min meeting on ${nextEvent.start.toLocaleString()}. SubStatus → ${newSubStatus}. Pipeline unchanged.`,
                        stage: lead.status, // Keep current stage
                        meta: JSON.stringify({
                            eventId: nextEvent.id,
                            startTime: nextEvent.start,
                            topic: nextEvent.title
                        })
                    }
                })

                updatedCount++

            } else {
                // SHORT MEETING (15min Discovery Call) - Keep existing Meeting1 logic
                const targetStage = 'Meeting1'
                const description = '15min Discovery Call Detected'

                const isStatusChange = lead.status !== targetStage

                if (isStatusChange || !leadAny.nextMeetingAt) {
                    console.log(`[MeetingSync] Updating lead ${lead.email} to ${targetStage} (${description})`)

                    // Update Lead (full status change for Meeting 1)
                    await db.lead.update({
                        where: { id: lead.id },
                        data: {
                            status: targetStage,
                            subStatus: 'Scheduled',
                            nextMeetingAt: nextEvent.start,
                            nextNurtureAt: null
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
                            description: `Meeting detected: ${description}. Status → ${targetStage}`,
                        })

                        // Timeline Log
                        await db.log.create({
                            data: {
                                leadId: lead.id,
                                type: 'MEETING',
                                status: 'BOOKED',
                                title: `${targetStage} Confirmed`,
                                content: `System detected a ${durationMinutes}min meeting on ${nextEvent.start.toLocaleString()}. Status → ${targetStage}.`,
                                stage: targetStage,
                                meta: JSON.stringify({
                                    eventId: nextEvent.id,
                                    startTime: nextEvent.start,
                                    topic: nextEvent.title
                                })
                            }
                        })
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
                    lte: nextThirtyDays
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
