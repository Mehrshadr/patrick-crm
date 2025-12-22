
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

        // Fast forward: Set nextNurtureAt to 1 minute ago
        const now = new Date()
        const oneMinuteAgo = new Date(now.getTime() - 60000)

        const updatedLead = await db.lead.update({
            where: { id: leadId },
            data: { nextNurtureAt: oneMinuteAgo }
        })

        // Log to lead's activity timeline
        await db.log.create({
            data: {
                leadId,
                type: 'USER_ACTION',
                status: 'FAST_FORWARD',
                title: 'Automation Fast-Forwarded',
                content: 'User manually skipped the delay timer to trigger the next automation step immediately',
                stage: 'Automation'
            }
        })

        return NextResponse.json({ success: true, lead: updatedLead })
    } catch (e: any) {
        console.error('Error advancing timer:', e)
        return NextResponse.json({ success: false, error: e.message }, { status: 500 })
    }
}
