import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: idStr } = await params
        const leadId = parseInt(idStr)

        if (isNaN(leadId)) {
            return NextResponse.json({ success: false, error: 'Invalid ID' }, { status: 400 })
        }

        // Find and cancel all active workflow executions for this lead
        const activeExecutions = await db.workflowExecution.findMany({
            where: {
                leadId,
                status: 'ACTIVE'
            },
            include: {
                workflow: true
            }
        })

        if (activeExecutions.length === 0) {
            return NextResponse.json({ success: false, error: 'No active automation found' }, { status: 404 })
        }

        // Cancel all active executions
        for (const execution of activeExecutions) {
            // Get the last completed step to show in automationStatus
            const lastLog = await db.workflowLog.findFirst({
                where: {
                    executionId: execution.id,
                    status: 'SUCCESS'
                },
                orderBy: { createdAt: 'desc' }
            })

            await db.workflowExecution.update({
                where: { id: execution.id },
                data: {
                    status: 'CANCELLED',
                    cancelReason: 'Manually stopped by user',
                    cancelledAt: new Date()
                }
            })

            await db.workflowLog.create({
                data: {
                    executionId: execution.id,
                    status: 'INFO',
                    message: 'Workflow manually stopped by user'
                }
            })

            // Log to lead's activity timeline
            await db.log.create({
                data: {
                    leadId,
                    type: 'USER_ACTION',
                    status: 'STOPPED',
                    title: `Automation Stopped: ${execution.workflow?.name || 'Unknown'}`,
                    content: `User manually stopped the workflow "${execution.workflow?.name || 'Unknown'}" at step ${lastLog?.message || 'N/A'}`,
                    stage: 'Automation'
                }
            })
        }

        // Update lead to clear nurture schedule and show stopped status
        const lead = await db.lead.update({
            where: { id: leadId },
            data: {
                nextNurtureAt: null,
                automationStatus: 'Stopped'
            }
        })

        return NextResponse.json({
            success: true,
            lead,
            stoppedCount: activeExecutions.length
        })

    } catch (e: any) {
        console.error('Error stopping automation:', e)
        return NextResponse.json({ success: false, error: e.message }, { status: 500 })
    }
}
