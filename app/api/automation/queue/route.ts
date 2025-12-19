import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET - List queue items (pending approvals)
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url)
        const leadId = searchParams.get('leadId')
        const status = searchParams.get('status') || 'PENDING'

        const where: any = { status }
        if (leadId) where.leadId = Number(leadId)

        const queue = await db.automationQueue.findMany({
            where,
            include: {
                lead: {
                    select: { id: true, name: true, email: true, website: true }
                },
                rule: {
                    include: {
                        emailTemplate: true,
                        smsTemplate: true
                    }
                }
            },
            orderBy: { scheduledAt: 'asc' }
        })

        return NextResponse.json({ success: true, queue })
    } catch (error) {
        console.error('Error fetching queue:', error)
        return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
    }
}

// POST - Add to queue (trigger automation)
export async function POST(req: NextRequest) {
    try {
        const data = await req.json()

        const queueItem = await db.automationQueue.create({
            data: {
                leadId: data.leadId,
                ruleId: data.ruleId,
                status: data.status || 'PENDING',
                scheduledAt: new Date(data.scheduledAt || Date.now()),
            }
        })

        return NextResponse.json({ success: true, queueItem })
    } catch (error) {
        console.error('Error adding to queue:', error)
        return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
    }
}

// PUT - Approve or update queue item
export async function PUT(req: NextRequest) {
    try {
        const data = await req.json()
        const { id, action, userEmail } = data

        if (!id) {
            return NextResponse.json({ success: false, error: 'Queue ID required' }, { status: 400 })
        }

        let updateData: any = {}

        if (action === 'approve') {
            updateData = {
                status: 'APPROVED',
                approvedBy: userEmail,
                approvedAt: new Date()
            }
        } else if (action === 'cancel') {
            updateData = {
                status: 'CANCELLED',
                cancelledAt: new Date(),
                cancelReason: data.reason || 'Manually cancelled'
            }
        } else if (action === 'execute') {
            updateData = {
                status: 'EXECUTED',
                executedAt: new Date()
            }
        }

        const queueItem = await db.automationQueue.update({
            where: { id: Number(id) },
            data: updateData,
            include: {
                lead: true,
                rule: {
                    include: {
                        emailTemplate: true,
                        smsTemplate: true
                    }
                }
            }
        })

        // If approved or auto-execute, create log entries
        if (action === 'approve' || action === 'execute') {
            // Log email
            if (queueItem.rule.emailTemplate) {
                await db.log.create({
                    data: {
                        leadId: queueItem.leadId,
                        type: 'EMAIL',
                        stage: queueItem.rule.name,
                        status: 'SENT',
                        title: queueItem.rule.emailTemplate.subject || queueItem.rule.name,
                        content: populateTemplate(queueItem.rule.emailTemplate.body, queueItem.lead),
                        userEmail: userEmail,
                        userName: userEmail?.split('@')[0]
                    }
                })
            }

            // Log SMS
            if (queueItem.rule.smsTemplate) {
                await db.log.create({
                    data: {
                        leadId: queueItem.leadId,
                        type: 'SMS',
                        stage: queueItem.rule.name,
                        status: 'SENT',
                        title: `SMS: ${queueItem.rule.name}`,
                        content: populateTemplate(queueItem.rule.smsTemplate.body, queueItem.lead),
                        userEmail: userEmail,
                        userName: userEmail?.split('@')[0]
                    }
                })
            }

            // Update execution time
            await db.automationQueue.update({
                where: { id: queueItem.id },
                data: { status: 'EXECUTED', executedAt: new Date() }
            })
        }

        return NextResponse.json({ success: true, queueItem })
    } catch (error) {
        console.error('Error updating queue item:', error)
        return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
    }
}

// Helper to populate template variables
function populateTemplate(template: string, lead: any): string {
    return template
        .replace(/\{name\}/g, lead.name || '')
        .replace(/\{website\}/g, lead.website || '')
        .replace(/\{email\}/g, lead.email || '')
        .replace(/\{phone\}/g, lead.phone || '')
}

// DELETE - Remove from queue
export async function DELETE(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url)
        const id = searchParams.get('id')

        if (!id) {
            return NextResponse.json({ success: false, error: 'Queue ID required' }, { status: 400 })
        }

        await db.automationQueue.delete({
            where: { id: Number(id) }
        })

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Error deleting queue item:', error)
        return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
    }
}
