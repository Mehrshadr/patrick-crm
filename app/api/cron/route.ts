import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { processWorkflow } from '@/lib/workflow-engine'

export const dynamic = 'force-dynamic' // Ensure it runs dynamically

const CRON_SECRET = process.env.CRON_SECRET || 'patrick-cron-secret-2024'

export async function GET(request: NextRequest) {
    try {
        // Validate CRON_SECRET for security
        const authHeader = request.headers.get('authorization')
        const querySecret = request.nextUrl.searchParams.get('secret')
        const isValidSecret = (authHeader === `Bearer ${CRON_SECRET}`) || (querySecret === CRON_SECRET)

        if (!isValidSecret) {
            console.log('[Cron] Unauthorized access attempt')
            return NextResponse.json(
                { success: false, error: 'Unauthorized: Invalid cron secret' },
                { status: 401 }
            )
        }

        console.log('[Cron] Starting automation check...')

        // Find active executions where the lead is ready for the next step
        const readyExecutions = await db.workflowExecution.findMany({
            where: {
                status: 'ACTIVE',
                lead: {
                    nextNurtureAt: {
                        lte: new Date(), // Time passed
                        not: null        // Has a scheduled time
                    }
                }
            },
            include: {
                lead: true,
                workflow: true
            }
        })

        console.log(`[Cron] Found ${readyExecutions.length} ready executions.`)

        const results = []

        for (const execution of readyExecutions) {
            const lead = execution.lead
            if (!lead || lead.nurtureStage === null) continue

            // The 'nurtureStage' holds the index of the last processed step (the Delay step)
            // So we want to resume from the next step
            const nextStepIndex = lead.nurtureStage + 1
            const delayStepIndex = lead.nurtureStage

            // Get the workflow steps to check cancel conditions
            const workflow = await db.workflow.findUnique({
                where: { id: execution.workflowId },
                include: { steps: { orderBy: { order: 'asc' } } }
            })

            if (workflow && workflow.steps[delayStepIndex]) {
                const delayStep = workflow.steps[delayStepIndex]
                const config = typeof delayStep.config === 'string' ? JSON.parse(delayStep.config) : delayStep.config

                const cancelOnStatuses = config.cancelOnStatuses || []
                const cancelOnSubStatuses = config.cancelOnSubStatuses || []

                // Check if lead's current status/subStatus matches cancel conditions
                const shouldCancel = cancelOnStatuses.includes(lead.status) ||
                    (lead.subStatus && cancelOnSubStatuses.includes(lead.subStatus))

                if (shouldCancel) {
                    console.log(`[Cron] Cancelling execution ${execution.id} - lead ${lead.name} status matches cancel conditions (${lead.status}/${lead.subStatus})`)

                    await db.workflowExecution.update({
                        where: { id: execution.id },
                        data: {
                            status: 'CANCELLED',
                            cancelReason: `Status matched cancel condition: ${lead.status}${lead.subStatus ? ' - ' + lead.subStatus : ''}`,
                            cancelledAt: new Date()
                        }
                    })

                    await db.lead.update({
                        where: { id: lead.id },
                        data: {
                            nextNurtureAt: null,
                            automationStatus: `Cancelled (${lead.status})`
                        }
                    })

                    results.push({
                        lead: lead.name,
                        success: true,
                        cancelled: true,
                        reason: `Status: ${lead.status}/${lead.subStatus}`
                    })

                    continue // Skip to next execution
                }
            }

            console.log(`[Cron] Resuming execution ${execution.id} for lead ${lead.name} from step ${nextStepIndex}`)

            // Clear the schedule first to prevent double-processing
            await db.lead.update({
                where: { id: lead.id },
                data: { nextNurtureAt: null }
            })

            const res = await processWorkflow({
                workflowId: execution.workflowId,
                leadId: lead.id,
                existingExecutionId: execution.id,
                resumeFromStep: nextStepIndex,
                triggeredBy: 'CRON_JOB'
            })

            // If workflow finished (res.success and no new nextNurtureAt set by engine), mark execution as COMPLETED?
            // Engine update lead.nextNurtureAt if stopped at another delay.

            // Check lead again to see if it was re-scheduled
            const updatedLead = await db.lead.findUnique({ where: { id: lead.id } })

            if (updatedLead && !updatedLead.nextNurtureAt) {
                // No future nurture scheduled -> Workflow Complete?
                // We should check if we processed all steps.
                // Or simply update execution status.
                await db.workflowExecution.update({
                    where: { id: execution.id },
                    data: { status: 'COMPLETED', completedAt: new Date() }
                })
                await db.workflowLog.create({
                    data: {
                        executionId: execution.id,
                        status: 'SUCCESS',
                        message: 'Workflow Completed',
                    }
                })
            }

            results.push({
                lead: lead.name,
                success: res.success,
                step: nextStepIndex
            })
        }

        return NextResponse.json({
            success: true,
            runAt: new Date(),
            processed: results.length,
            results
        })

    } catch (error: any) {
        console.error('[Cron] Error:', error)
        return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }
}
