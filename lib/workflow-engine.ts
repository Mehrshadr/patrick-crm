import { db } from './db'
import { sendEmail } from './email'
import { sendSms } from './sms'
import { logActivity } from './activity'
import { calculateNextNurture } from './nurture-logic'

interface ProcessWorkflowOptions {
    workflowId: number
    leadId: number
    accessToken?: string
    refreshToken?: string
    userEmail?: string
    userName?: string
    triggeredBy?: string
    resumeFromStep?: number
    existingExecutionId?: number
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

export async function processWorkflow(options: ProcessWorkflowOptions) {
    let { workflowId, leadId, accessToken, refreshToken, userEmail, userName, triggeredBy = 'SYSTEM', resumeFromStep, existingExecutionId } = options;

    try {
        // 1. Get Lead and Workflow Details
        const lead = await db.lead.findUnique({ where: { id: leadId } })
        if (!lead) {
            console.error('Lead not found for execution', { leadId, workflowId })
            return { success: false, error: 'Lead not found' }
        }

        // Fallback: If no tokens provided (e.g. Cron), try to fetch System Tokens
        if (!accessToken || !refreshToken) {
            try {
                const t1 = await db.appSettings.findUnique({ where: { key: 'SYSTEM_GOOGLE_ACCESS_TOKEN' } })
                const t2 = await db.appSettings.findUnique({ where: { key: 'SYSTEM_GOOGLE_REFRESH_TOKEN' } })
                if (t1?.value && t2?.value) {
                    accessToken = t1.value;
                    refreshToken = t2.value;
                    console.log("[WorkflowEngine] Using System Tokens for execution")
                }
            } catch (e) {
                console.error("Failed to fetch system tokens", e)
            }
        }

        const workflow = await db.workflow.findUnique({
            where: { id: workflowId },
            include: { steps: { orderBy: { order: 'asc' }, include: { template: true } } }
        })

        if (!lead || !workflow) {
            console.error('Lead or Workflow not found for execution', { leadId, workflowId })
            return { success: false, error: 'Lead or Workflow not found' }
        }

        console.log(`Executing workflow ${workflow.name} for lead: ${lead.name} (ID: ${lead.id})`)
        console.log(`Lead Contact Info - Email: ${lead.email}, Phone: ${lead.phone}`)

        // 2. Create OR Reuse workflow execution record
        let execution: any = null
        if (existingExecutionId) {
            execution = await db.workflowExecution.findUnique({ where: { id: existingExecutionId } })
        }

        if (!execution) {
            // CRITICAL: Prevent duplicate executions. Cancel any existing ACTIVE workflows for this lead.
            const existingActive = await db.workflowExecution.findMany({
                where: {
                    leadId,
                    status: 'ACTIVE'
                }
            })
            if (existingActive.length > 0) {
                console.log(`[WorkflowEngine] Cancelling ${existingActive.length} existing active executions for lead ${leadId}`)
                await db.workflowExecution.updateMany({
                    where: { leadId, status: 'ACTIVE' },
                    data: { status: 'CANCELLED', cancelReason: 'New workflow started', cancelledAt: new Date() }
                })
            }

            execution = await db.workflowExecution.create({
                data: {
                    workflowId,
                    leadId,
                    status: 'ACTIVE',
                    startDate: new Date(),
                }
            })
            // Log the start
            await db.workflowLog.create({
                data: {
                    executionId: execution.id,
                    status: 'SUCCESS',
                    message: `Workflow "${workflow.name}" started for ${lead.name} (${triggeredBy})`,
                }
            })
            await logActivity({
                category: 'AUTOMATION',
                action: 'WORKFLOW_STARTED',
                entityType: 'LEAD',
                entityId: leadId,
                entityName: lead.name || 'Unknown',
                description: `Workflow "${workflow.name}" triggered (${triggeredBy})`,
                details: { workflowId, executionId: execution.id }
            })
        } else {
            // Resuming
            console.log(`Resuming workflow ${workflow.name} at step ${resumeFromStep}`)
            await db.workflowLog.create({
                data: {
                    executionId: execution.id,
                    status: 'INFO',
                    message: `Workflow Resumed at step ${resumeFromStep} (${triggeredBy})`,
                }
            })
        }

        const steps = workflow.steps
        const startIndex = resumeFromStep || 0

        // 3. Simple loop to process steps
        for (let i = startIndex; i < steps.length; i++) {
            const step = steps[i]
            const rawConfig = typeof step.config === 'string' ? JSON.parse(step.config) : step.config

            // Merge actual template content if linked (fixes stale content issue)
            const template = (step as any).template
            const effectiveConfig = {
                ...rawConfig,
                subject: template?.subject || rawConfig.subject,
                body: template?.body || rawConfig.body,
                // For SMS steps, the content is also in 'body'
            }

            // Replace template variables in config strings
            const config = {
                ...effectiveConfig,
                body: replaceTemplateVariables(effectiveConfig.body, lead),
                subject: replaceTemplateVariables(effectiveConfig.subject, lead),
                smsBody: replaceTemplateVariables(effectiveConfig.smsBody, lead),
            }


            if (step.type === 'DELAY' || step.type === 'SMART_DELAY') { // Handle SMART_DELAY too if typed
                // Calculate the next nurture time
                let nextNurtureAt: Date | null = null
                let logMessage = ''

                // Check for Smart Delay Configuration
                const isSmart = step.type === 'SMART_DELAY' ||
                    config.type === 'SMART' ||
                    (config.delayType && config.delayType.toString().startsWith('SMART'))

                if (isSmart) {
                    let targetStage = 1 // Default

                    if (config.delayType === 'SMART_STAGE_2') targetStage = 2
                    else if (config.delayType === 'SMART_STAGE_3') targetStage = 3
                    else if (config.smartStage) targetStage = parseInt(config.smartStage)

                    // Note: calculateNextNurture(createdAt, currentStage)
                    // If we are scheduling Stage 2, it means we are currently at Stage 1 (or just finished it).
                    // So we pass currentStage = targetStage - 1.

                    const currentStage = Math.max(1, targetStage - 1)
                    const res = calculateNextNurture(lead.createdAt, currentStage)

                    if (res) {
                        nextNurtureAt = res.scheduleAt
                        logMessage = `Smart Delay (Stage ${targetStage}) until ${nextNurtureAt.toLocaleString()}`
                    } else {
                        logMessage = `Smart Delay failed (No schedule returned), falling back to standard delay.`
                    }
                }

                // Fallback / Standard Logic
                if (!nextNurtureAt) {
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
                    nextNurtureAt = new Date(now.getTime() + delayMs)
                    logMessage = `Waiting ${duration} ${unit}. Next action at ${nextNurtureAt.toLocaleString()}`
                }

                // Determine next step name for status
                const nextStepName = steps[i + 1]?.name || 'Next Step'

                // Update lead with next nurture time
                // NOTE: We do NOT update automationStatus here. It will keep the last completed action.
                // The UI checks nextNurtureAt to show "waiting" state.
                await db.lead.update({
                    where: { id: leadId },
                    data: {
                        nextNurtureAt,
                        nurtureStage: i, // Track this DELAY step as the resume point
                    }
                })

                await db.workflowLog.create({
                    data: {
                        executionId: execution.id,
                        stepId: step.id,
                        status: 'INFO',
                        message: logMessage,
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

                console.log(`[Workflow] Stopped at Delay step ${i}. Resuming at ${nextNurtureAt}`)
                // STOP execution here. Resumed later via Cron.
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
                            title: res.success ? `${workflow.name}: SMS Sent` : `${workflow.name}: SMS Failed`,
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
                    console.log(`[WorkflowEngine v1.4.2-DEBUG] Step: ${step.name}, Recipient Email: "${recipientEmail}"`)

                    if (!recipientEmail || recipientEmail.length < 5) {
                        throw new Error(`Recipient email address required or invalid: "${recipientEmail}"`)
                    }

                    // Fetch global signature
                    const signatureSetting = await db.appSettings.findUnique({ where: { key: 'email_signature' } })
                    const signature = signatureSetting?.value || ''

                    // Handle signature: 
                    // 1. Replace {signature} token if present
                    // 2. OR append signature at end if "includeSignature" checkbox is true
                    let bodyWithSignature = config.body.replace(/{signature}/g, signature)
                    if (config.includeSignature !== false && !config.body.includes('{signature}')) {
                        bodyWithSignature = config.body + '<br/><br/>' + signature
                    }

                    // Determine Sender Name and Reply-To
                    // Priority: Step Config > Session User > Default
                    const customSenderName = config.senderName
                    const customReplyTo = config.replyTo

                    // Fallback to System Email if User Email is missing (e.g. Cron)
                    const baseEmail = userEmail || process.env.GMAIL_USER

                    // Fallback for Sender Name (Cron has no userName)
                    let defaultSenderName = 'Patrick CRM' // Default
                    try {
                        const sName = await db.appSettings.findUnique({ where: { key: 'default_sender_name' } })
                        if (sName?.value) defaultSenderName = sName.value
                    } catch (e) { }

                    const finalSenderName = customSenderName || userName || defaultSenderName;
                    const finalReplyTo = customReplyTo || baseEmail;

                    // Format sender: "Name <email>"
                    // If running automatically (no userName) or if baseEmail is missing, 
                    // we send ONLY the name. lib/email.ts will append <me> (the authenticated user).
                    // This ensures the Display Name is preserved by Gmail even if the email config string is tricky.
                    const isAutomated = !userName;
                    const fromAddress = (isAutomated || !baseEmail)
                        ? (finalSenderName || "Patrick CRM")
                        : (finalSenderName ? `"${finalSenderName}" <${baseEmail}>` : baseEmail);

                    console.log(`[WorkflowEngine v1.4.2-DEBUG] Sending email. From: ${fromAddress}, Reply-To: ${finalReplyTo}`)

                    const res = await sendEmail({
                        to: recipientEmail,
                        subject: config.subject,
                        html: bodyWithSignature,
                        from: fromAddress,
                        replyTo: finalReplyTo
                    }, (accessToken && refreshToken) ? { accessToken, refreshToken } : undefined)

                    if (!res.success) {
                        throw new Error(res.error || 'Email sending failed')
                    }

                    await db.workflowLog.create({
                        data: {
                            executionId: execution.id,
                            stepId: step.id,
                            status: 'SUCCESS',
                            message: `Email sent to ${lead.email}`,
                        }
                    })

                    // Update Status
                    await db.lead.update({
                        where: { id: leadId },
                        data: { automationStatus: `${step.name} Done` }
                    })

                    // Also log to lead's log table for display in lead dialog
                    await db.log.create({
                        data: {
                            leadId,
                            type: 'EMAIL',
                            status: res.success ? 'SENT' : 'FAILED',
                            title: res.success ? `${workflow.name}: ${config.subject}` : `${workflow.name}: Email Failed`,
                            content: config.body,
                            stage: workflow.pipelineStage || 'Automation'
                        }
                    })

                    await logActivity({
                        category: 'EMAIL',
                        action: res.success ? 'SENT' : 'FAILED',
                        entityType: 'LEAD',
                        entityId: leadId,
                        entityName: lead.name || 'Unknown',
                        description: res.success
                            ? `📧 Email "${config.subject}" sent to ${lead.email}`
                            : `❌ Email failed: ${res.error}`,
                        details: JSON.stringify({
                            workflow: workflow.name,
                            step: step.name,
                            to: lead.email,
                            subject: config.subject,
                            from: fromAddress,
                            bodyPreview: config.body?.substring(0, 200) + '...'
                        })
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
                            category: 'SMS',
                            action: smsRes.success ? 'SENT' : 'FAILED',
                            entityType: 'LEAD',
                            entityId: leadId,
                            entityName: lead.name || 'Unknown',
                            description: smsRes.success
                                ? `📱 SMS sent to ${lead.phone}`
                                : `❌ SMS failed to ${lead.phone}`,
                            details: JSON.stringify({
                                workflow: workflow.name,
                                step: step.name,
                                to: lead.phone,
                                message: config.smsBody?.substring(0, 200) + '...'
                            })
                        })

                        // Also log SMS to lead's timeline
                        await db.log.create({
                            data: {
                                leadId,
                                type: 'SMS',
                                status: smsRes.success ? 'SENT' : 'FAILED',
                                title: smsRes.success ? `${workflow.name}: SMS Sent (Dual)` : `${workflow.name}: SMS Failed (Dual)`,
                                content: config.smsBody,
                                stage: workflow.pipelineStage || 'Automation'
                            }
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
                // Critical: Stop execution on error to prevent cascading failures or duplicate sends
                return { success: false, error: stepError.message }
            }
        }

        return { success: true, executionId: execution.id }
    } catch (error: any) {
        console.error('Error in workflow engine:', error)
        return { success: false, error: error.message }
    }
}
