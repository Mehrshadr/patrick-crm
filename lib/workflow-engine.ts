import { db } from './db'
import { sendEmail } from './email'
import { sendSms } from './sms'
import { logActivity } from './activity'

interface ProcessWorkflowOptions {
    workflowId: number
    leadId: number
    accessToken?: string
    refreshToken?: string
    userEmail?: string
    userName?: string
    triggeredBy?: string
}

// Helper to replace template variables with lead data
function replaceTemplateVariables(text: string, lead: any): string {
    if (!text) return text

    return text
        .replace(/\{name\}/gi, lead.name || '')
        .replace(/\{first_name\}/gi, (lead.name || '').split(' ')[0] || '')
        .replace(/\{phone\}/gi, lead.phone || '')
        .replace(/\{email\}/gi, lead.email || '')
        .replace(/\{website\}/gi, lead.website || '')
        .replace(/\{status\}/gi, lead.status || '')
        .replace(/\{stage\}/gi, lead.stage || '')
        .replace(/\{business_type\}/gi, lead.businessType || '')
        .replace(/\{quality\}/gi, lead.quality || '')
}

export async function processWorkflow({
    workflowId,
    leadId,
    accessToken,
    refreshToken,
    userEmail,
    userName,
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

        console.log(`Executing workflow ${workflow.name} for lead: ${lead.name} (ID: ${lead.id})`)
        console.log(`Lead Contact Info - Email: ${lead.email}, Phone: ${lead.phone}`)

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
            const rawConfig = typeof step.config === 'string' ? JSON.parse(step.config) : step.config

            // Replace template variables in config strings
            const config = {
                ...rawConfig,
                body: replaceTemplateVariables(rawConfig.body, lead),
                subject: replaceTemplateVariables(rawConfig.subject, lead),
                smsBody: replaceTemplateVariables(rawConfig.smsBody, lead),
            }


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
                if (step.type === 'SMS') {
                    if (!lead.phone) {
                        throw new Error(`Recipient phone number required for step: ${step.name}`)
                    }
                    const res = await sendSms(lead.phone, config.body)
                    await db.workflowLog.create({
                        data: {
                            executionId: execution.id,
                            stepId: step.id,
                            status: res.success ? 'SUCCESS' : 'FAILED',
                            message: res.success ? `SMS sent to ${lead.phone}` : `SMS failed: ${res.error}`,
                        }
                    })
                    // Also log to lead's log table for display in lead dialog
                    await db.log.create({
                        data: {
                            leadId,
                            type: 'SMS',
                            status: res.success ? 'SENT' : 'FAILED',
                            title: res.success ? 'SMS Sent (Automation)' : 'SMS Failed',
                            content: config.body,
                            stage: workflow.pipelineStage || 'Automation'
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

                if (step.type === 'EMAIL') {
                    const recipientEmail = (lead.email || '').trim()
                    console.log(`[WorkflowEngine v1.4.1-DEBUG] Step: ${step.name}, Recipient Email: "${recipientEmail}"`)

                    if (!recipientEmail || recipientEmail.length < 5) {
                        throw new Error(`Recipient email address required or invalid: "${recipientEmail}"`)
                    }

                    // Fetch global signature
                    const signatureSetting = await db.appSettings.findUnique({ where: { key: 'email_signature' } })
                    const signature = signatureSetting?.value || ''

                    // Inject signature into body
                    const bodyWithSignature = config.body.replace(/{signature}/g, signature)

                    // Format sender: "Name <email>"
                    const fromAddress = userEmail
                        ? (userName ? `"${userName}" <${userEmail}>` : userEmail)
                        : undefined

                    const res = await sendEmail({
                        to: recipientEmail,
                        subject: config.subject,
                        html: bodyWithSignature,
                        from: fromAddress,
                        replyTo: userEmail
                    }, (accessToken && refreshToken) ? { accessToken, refreshToken } : undefined)

                    await db.workflowLog.create({
                        data: {
                            executionId: execution.id,
                            stepId: step.id,
                            status: res.success ? 'SUCCESS' : 'FAILED',
                            message: res.success ? `Email sent to ${lead.email}` : `Email failed: ${res.error}`,
                        }
                    })
                    // Also log to lead's log table for display in lead dialog
                    await db.log.create({
                        data: {
                            leadId,
                            type: 'EMAIL',
                            status: res.success ? 'SENT' : 'FAILED',
                            title: res.success ? `Email: ${config.subject}` : 'Email Failed',
                            content: config.body,
                            stage: workflow.pipelineStage || 'Automation'
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
