import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { processWorkflow } from '@/lib/workflow-engine'

export const dynamic = 'force-dynamic' // Ensure it runs dynamically

export async function GET(request: NextRequest) {
    try {
        // Optional: Add secret validation here if using Vercel Cron
        // const authHeader = request.headers.get('authorization');
        // if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) { ... }

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

            console.log(`[Cron] Resuming execution ${execution.id} for lead ${lead.name} from step ${nextStepIndex}`)

            // Clear the schedule first to prevent double-processing if engine fails
            // But ideally engine clears it. Engine updates it if there is ANOTHER delay.
            // If the engine finishes or fails, we might get stuck loop if we don't clear?
            // Engine updates 'nextNurtureAt' ONLY if it hits another DELAY.
            // If it finishes, it doesn't clear 'nextNurtureAt'.
            // So we should probably clear it here or verify engine clears it.
            // The engine does NOT clear it upon completion in my code?
            // Checking code...
            // "return { success: true, executionId: execution.id }"
            // It does not clear nextNurtureAt upon completion.
            // So if I don't clear it, and engine finishes, next run will pick it up again?
            // Yes.
            // So I MUST clear it before processing or explicitly handle completion status.

            // Let's clear it just before processing.
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
