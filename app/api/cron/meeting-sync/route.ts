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
            timeMax: nextThirtyDays,
            showDeleted: true  // Include cancelled events to detect cancellations
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

            // Calculate Duration from first event (for initial filtering)
            const firstEvent = leadEvents[0] // Events are sorted by start time
            const durationMs = firstEvent.end.getTime() - firstEvent.start.getTime()
            const durationMinutes = Math.floor(durationMs / (1000 * 60))

            // Cast lead to any to avoid TS error on server where Prisma client isn't updated yet
            const leadAny = lead as any;

            // Status Protection: Don't revert 'Won' or 'Lost' leads
            const PROTECTED_STATUSES = ['Won', 'Lost', 'Bad Fit']

            if (PROTECTED_STATUSES.includes(lead.status)) {
                console.log(`[MeetingSync] Skipping ${lead.email} - protected status: ${lead.status}`)
                continue
            }

            // ========== CHECK FOR CANCELLED EVENTS FIRST ==========
            // Find the first NON-CANCELLED event for this lead
            const activeEvents = leadEvents.filter(e => e.eventStatus !== 'cancelled')
            const cancelledEvents = leadEvents.filter(e => e.eventStatus === 'cancelled')

            // If ALL events are cancelled, mark the lead as Cancelled
            if (activeEvents.length === 0 && cancelledEvents.length > 0) {
                const cancelledEvent = cancelledEvents[0]

                // Only update if currently scheduled
                const scheduledStatuses = ['Scheduled', 'Rescheduled']
                if (scheduledStatuses.includes(leadAny.subStatus)) {
                    console.log(`[MeetingSync] CANCELLED: ${lead.email} - meeting was cancelled`)

                    await db.lead.update({
                        where: { id: lead.id },
                        data: {
                            subStatus: 'Cancelled',
                            nextMeetingAt: null  // Clear the meeting time
                        } as any
                    })

                    // Activity Log
                    await logActivity({
                        category: 'MEETING',
                        action: 'MEETING_CANCELLED',
                        entityType: 'LEAD',
                        entityId: lead.id,
                        entityName: (lead.name || lead.email) || undefined,
                        description: `Meeting cancelled: "${cancelledEvent.title}"`,
                    })

                    // Timeline Log
                    await db.log.create({
                        data: {
                            leadId: lead.id,
                            type: 'MEETING',
                            status: 'CANCELLED',
                            title: 'Meeting Cancelled',
                            content: `Meeting "${cancelledEvent.title}" was cancelled. SubStatus → Cancelled.`,
                            stage: lead.status,
                            meta: JSON.stringify({
                                eventId: cancelledEvent.id,
                                originalTime: cancelledEvent.start,
                                topic: cancelledEvent.title
                            })
                        }
                    })

                    updatedCount++
                }
                continue // Skip further processing for this lead
            }

            // Use the first active (non-cancelled) event
            const nextEvent = activeEvents.length > 0 ? activeEvents[0] : leadEvents[0]

            // ========== NEW MEETING LOGIC ==========
            // Duration thresholds
            const isShortMeeting = durationMinutes <= 30  // 15-30 min = Discovery/Data Gathering
            const isLongMeeting = durationMinutes >= 45   // 45-60 min = Audit Reveal / Proposal

            // Current state
            const currentStage = lead.status
            const currentSubStatus = leadAny.subStatus

            console.log(`[MeetingSync] Processing ${lead.email}: ${durationMinutes}min meeting, stage=${currentStage}, subStatus=${currentSubStatus}`)

            // Determine target stage and subStatus
            let targetStage = currentStage
            let newSubStatus = 'Scheduled'
            let shouldProcess = false

            if (isShortMeeting) {
                // 15-min Discovery Call Logic
                if (currentStage === 'New') {
                    // Fresh lead → Move to Meeting1 (Data Gathering)
                    targetStage = 'Meeting1'
                    newSubStatus = 'Scheduled'
                    shouldProcess = true
                } else if (currentStage === 'Meeting1') {
                    // Already in Meeting1 → Check for No Show
                    if (currentSubStatus === 'No Show') {
                        newSubStatus = 'Rescheduled'
                    } else {
                        newSubStatus = 'Scheduled'
                    }
                    shouldProcess = true
                }
                // Other stages: short meetings are not processed

            } else if (isLongMeeting) {
                // 60-min Strategy/Proposal Call Logic
                if (currentStage === 'Audit') {
                    // From Audit Lab → Move to Meeting2 (Audit Reveal)
                    targetStage = 'Meeting2'
                    newSubStatus = 'Scheduled'
                    shouldProcess = true
                } else if (currentStage === 'Meeting2') {
                    // Already in Meeting2 → Check for No Show
                    if (currentSubStatus === 'No Show') {
                        newSubStatus = 'Rescheduled'
                    } else {
                        newSubStatus = 'Scheduled'
                    }
                    shouldProcess = true
                } else if (currentStage === 'Meeting3') {
                    // Already in Meeting3 (Proposal Session) → Check for No Show
                    if (currentSubStatus === 'No Show') {
                        newSubStatus = 'Rescheduled'
                    } else {
                        newSubStatus = 'Scheduled'
                    }
                    shouldProcess = true
                }
                // Other stages: long meetings are not processed
            }

            // Skip if not applicable
            if (!shouldProcess) {
                console.log(`[MeetingSync] Skipping ${lead.email} - ${durationMinutes}min meeting not applicable for stage ${currentStage}`)
                continue
            }

            // Check if already synced (same stage, subStatus, and meeting time)
            const existingMeetingTime = leadAny.nextMeetingAt ? new Date(leadAny.nextMeetingAt).getTime() : null
            const newMeetingTime = nextEvent.start.getTime()
            const isStageChange = currentStage !== targetStage
            const isSubStatusChange = currentSubStatus !== newSubStatus
            const isMeetingTimeChange = existingMeetingTime !== newMeetingTime

            // Skip if nothing changed
            if (!isStageChange && !isSubStatusChange && !isMeetingTimeChange) {
                console.log(`[MeetingSync] Skipping ${lead.email} - already synced`)
                continue
            }

            // Apply update
            console.log(`[MeetingSync] Updating ${lead.email}: ${currentStage}→${targetStage}, subStatus→${newSubStatus}, meeting at ${nextEvent.start.toISOString()}`)

            await db.lead.update({
                where: { id: lead.id },
                data: {
                    status: targetStage,
                    subStatus: newSubStatus,
                    nextMeetingAt: nextEvent.start,
                    nextNurtureAt: null // Clear nurture when meeting is scheduled
                } as any
            })

            // Cancel Active Automations if status changed
            if (isStageChange) {
                const activeWorkflows = await db.workflowExecution.findMany({
                    where: { leadId: lead.id, status: 'ACTIVE' }
                })

                if (activeWorkflows.length > 0) {
                    await db.workflowExecution.updateMany({
                        where: { leadId: lead.id, status: 'ACTIVE' },
                        data: {
                            status: 'CANCELLED',
                            cancelReason: `Meeting Detected: ${durationMinutes}min meeting scheduled`,
                            cancelledAt: new Date()
                        }
                    })
                    console.log(`[MeetingSync] Cancelled ${activeWorkflows.length} active workflows for ${lead.email}`)
                }
            }

            // Activity Log
            const description = isStageChange
                ? `${durationMinutes}min meeting detected. Stage: ${currentStage} → ${targetStage}. SubStatus: ${newSubStatus}`
                : `${durationMinutes}min meeting detected. SubStatus: ${newSubStatus}. Stage unchanged.`

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
                    content: `System detected a ${durationMinutes}min meeting on ${nextEvent.start.toLocaleString()}. ${isStageChange ? `Stage: ${currentStage} → ${targetStage}. ` : ''}SubStatus: ${newSubStatus}.`,
                    stage: targetStage,
                    meta: JSON.stringify({
                        eventId: nextEvent.id,
                        startTime: nextEvent.start,
                        topic: nextEvent.title,
                        duration: durationMinutes,
                        previousStage: currentStage,
                        previousSubStatus: currentSubStatus
                    })
                }
            })

            updatedCount++
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
