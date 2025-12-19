import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET - List all automation rules
export async function GET() {
    try {
        const rules = await db.automationRule.findMany({
            include: {
                emailTemplate: true,
                smsTemplate: true,
                _count: {
                    select: { queueItems: true }
                }
            },
            orderBy: { id: 'asc' }
        })

        return NextResponse.json({ success: true, rules })
    } catch (error) {
        console.error('Error fetching rules:', error)
        return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
    }
}

// POST - Create new automation rule
export async function POST(req: NextRequest) {
    try {
        const data = await req.json()

        const rule = await db.automationRule.create({
            data: {
                name: data.name,
                description: data.description,
                triggerType: data.triggerType,
                triggerStatus: data.triggerStatus,
                triggerSubStatus: data.triggerSubStatus,
                delayMinutes: data.delayMinutes || 0,
                scheduledHour: data.scheduledHour,
                emailTemplateId: data.emailTemplateId,
                smsTemplateId: data.smsTemplateId,
                cancelOnStatus: data.cancelOnStatus,
                cancelOnSubStatus: data.cancelOnSubStatus,
                requireApproval: data.requireApproval ?? true,
                isActive: data.isActive ?? true,
                sortOrder: data.sortOrder || 0,
            }
        })

        return NextResponse.json({ success: true, rule })
    } catch (error) {
        console.error('Error creating rule:', error)
        return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
    }
}

// PUT - Update automation rule
export async function PUT(req: NextRequest) {
    try {
        const data = await req.json()
        const { id, ...updateData } = data

        if (!id) {
            return NextResponse.json({ success: false, error: 'Rule ID required' }, { status: 400 })
        }

        const rule = await db.automationRule.update({
            where: { id: Number(id) },
            data: updateData
        })

        return NextResponse.json({ success: true, rule })
    } catch (error) {
        console.error('Error updating rule:', error)
        return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
    }
}

// DELETE - Delete automation rule
export async function DELETE(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url)
        const id = searchParams.get('id')

        if (!id) {
            return NextResponse.json({ success: false, error: 'Rule ID required' }, { status: 400 })
        }

        await db.automationRule.delete({
            where: { id: Number(id) }
        })

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Error deleting rule:', error)
        return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
    }
}
