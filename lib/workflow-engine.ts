import { db } from './db'
import { sendEmail } from './email'
import { sendSms } from './sms'
import { logActivity } from './activity'

interface ProcessWorkflowOptions {
    workflowId: number
    leadId: number
    accessToken?: string
    refreshToken?: string
    triggeredBy?: string
}

export async function processWorkflow({
    workflowId,
    leadId,
    accessToken,
    refreshToken,
    triggeredBy = 'SYSTEM'
}: ProcessWorkflowOptions) {
    try {
        // 1. Get Lead and Workflow Details
        const lead = await db.lead.findUnique({ where: { id: leadId } })
        const workflow = await db.workflow.findUnique({
            where: { id: workflowId },
            include: { steps: { orderBy: { order: 'asc' } } }
        })

        if (!lead || !workflow) {
            console.error('Lead or Workflow not found for execution', { leadId, workflowId })
            return { success: false, error: 'Lead or Workflow not found' }
        }

        // 2. Create workflow execution record
        const execution = await db.workflowExecution.create({
            data: {
                workflowId,
                leadId,
                status: 'ACTIVE',
                startDate: new Date(),
            }
        })

        const steps = workflow.steps

        // Log the start in workflow logs
        await db.workflowLog.create({
            data: {
                executionId: execution.id,
                status: 'SUCCESS',
                message: `Workflow "${workflow.name}" started for ${lead.name} (${triggeredBy})`,
            }
        })

        // Log in system-wide Activity Log
        await logActivity({
            category: 'AUTOMATION',
            action: 'WORKFLOW_STARTED',
            entityType: 'LEAD',
            entityId: leadId,
            entityName: lead.name || 'Unknown',
            description: `Workflow "${workflow.name}" triggered (${triggeredBy})`,
            details: { workflowId, executionId: execution.id }
        })

        // 3. Simple loop to process immediate steps until a DELAY
        for (let i = 0; i < steps.length; i++) {
            const step = steps[i]
            const config = typeof step.config === 'string' ? JSON.parse(step.config) : step.config

            if (step.type === 'DELAY') {
                // Calculate the next nurture time based on delay config
                const now = new Date()
                let delayMs = 0
                const duration = parseInt(config.fixedDuration || '1')
                const unit = config.fixedUnit || 'hours'

                switch (unit) {
                    case 'minutes': delayMs = duration * 60 * 1000; break
                    case 'hours': delayMs = duration * 60 * 60 * 1000; break
                    case 'days': delayMs = duration * 24 * 60 * 60 * 1000; break
                    default: delayMs = duration * 60 * 60 * 1000 // default hours
                }

                const nextNurtureAt = new Date(now.getTime() + delayMs)

                // Update lead with next nurture time and current step index
                await db.lead.update({
                    where: { id: leadId },
                    data: {
                        nextNurtureAt,
                        nurtureStage: i, // Track which step we're waiting on
                    }
                })

                await db.workflowLog.create({
                    data: {
                        executionId: execution.id,
                        stepId: step.id,
                        status: 'INFO',
                        message: `Waiting ${duration} ${unit}. Next action at ${nextNurtureAt.toLocaleString()}`,
                    }
                })

                await logActivity({
                    category: 'AUTOMATION',
                    action: 'DELAY_STARTED',
                    entityType: 'LEAD',
                    entityId: leadId,
                    entityName: lead.name || 'Unknown',
                    description: `Next nurture scheduled for ${nextNurtureAt.toLocaleString()}`,
                })

                break
            }

            try {
                if (step.type === 'SMS' && lead.phone) {
                    const res = await sendSms(lead.phone, config.body)
                    await db.workflowLog.create({
                        data: {
                            executionId: execution.id,
                            stepId: step.id,
                            status: res.success ? 'SUCCESS' : 'FAILED',
                            message: res.success ? `SMS sent to ${lead.phone}` : `SMS failed: ${res.error}`,
                        }
                    })
                    await logActivity({
                        category: 'COMMUNICATION',
                        action: res.success ? 'SMS_SENT' : 'SMS_FAILED',
                        entityType: 'LEAD',
                        entityId: leadId,
                        entityName: lead.name || 'Unknown',
                        description: res.success ? `SMS sent to ${lead.phone}` : `SMS failed: ${res.error}`,
                    })
                }

                if (step.type === 'EMAIL' && lead.email) {
                    const res = await sendEmail({
                        to: lead.email,
                        subject: config.subject,
                        html: config.body,
                    }, (accessToken && refreshToken) ? { accessToken, refreshToken } : undefined)

                    await db.workflowLog.create({
                        data: {
                            executionId: execution.id,
                            stepId: step.id,
                            status: res.success ? 'SUCCESS' : 'FAILED',
                            message: res.success ? `Email sent to ${lead.email}` : `Email failed: ${res.error}`,
                        }
                    })
                    await logActivity({
                        category: 'COMMUNICATION',
                        action: res.success ? 'EMAIL_SENT' : 'EMAIL_FAILED',
                        entityType: 'LEAD',
                        entityId: leadId,
                        entityName: lead.name || 'Unknown',
                        description: res.success ? `Email "${config.subject}" sent to ${lead.email}` : `Email failed: ${res.error}`,
                    })

                    // Handle dual SMS if configured
                    if (config.sendSmsAlso && lead.phone && config.smsBody) {
                        const smsRes = await sendSms(lead.phone, config.smsBody)
                        await db.workflowLog.create({
                            data: {
                                executionId: execution.id,
                                stepId: step.id,
                                status: smsRes.success ? 'SUCCESS' : 'FAILED',
                                message: smsRes.success ? `Follow-up SMS sent to ${lead.phone}` : `Follow-up SMS failed`,
                            }
                        })
                        await logActivity({
                            category: 'COMMUNICATION',
                            action: smsRes.success ? 'SMS_SENT' : 'SMS_FAILED',
                            entityType: 'LEAD',
                            entityId: leadId,
                            entityName: lead.name || 'Unknown',
                            description: smsRes.success ? `Follow-up SMS sent to ${lead.phone}` : `Follow-up SMS failed`,
                        })
                    }
                }
            } catch (stepError: any) {
                console.error(`Error in step ${step.id}:`, stepError)
                await db.workflowLog.create({
                    data: {
                        executionId: execution.id,
                        stepId: step.id,
                        status: 'FAILED',
                        message: `Step failed: ${stepError.message}`,
                    }
                })
            }
        }

        return { success: true, executionId: execution.id }
    } catch (error: any) {
        console.error('Error in workflow engine:', error)
        return { success: false, error: error.message }
    }
}
