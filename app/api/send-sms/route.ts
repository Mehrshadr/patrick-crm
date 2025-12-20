import { NextRequest, NextResponse } from 'next/server'
import { sendSms, testSmsConnection } from '@/lib/sms'
import { db } from '@/lib/db'
import { auth } from '@/lib/auth'

// POST - Send an SMS
export async function POST(request: NextRequest) {
    try {
        const { to, body, leadId, leadName } = await request.json()
        const session = await auth()

        if (!to || !body) {
            return NextResponse.json(
                { success: false, error: 'to and body are required' },
                { status: 400 }
            )
        }

        const result = await sendSms(to, body)

        // Log to activity log
        await db.activityLog.create({
            data: {
                category: 'SMS',
                action: 'SMS_SENT',
                entityType: leadId ? 'LEAD' : undefined,
                entityId: leadId || undefined,
                entityName: leadName || undefined,
                description: `SMS sent to ${to}`,
                details: body.substring(0, 200),
                userId: session?.user?.id || undefined,
                userName: session?.user?.name || undefined,
            }
        })

        // Also log to Log for the lead card
        if (leadId) {
            await db.log.create({
                data: {
                    leadId,
                    type: 'SMS',
                    status: 'SENT',
                    title: `Manual SMS to ${to}`,
                    content: body,
                    userEmail: session?.user?.email || null,
                    userName: session?.user?.name || null,
                }
            })
        }

        return NextResponse.json(result)
    } catch (error: any) {
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        )
    }
}

// GET - Test SMS connection
export async function GET() {
    const isConnected = await testSmsConnection()
    return NextResponse.json({
        success: true,
        connected: isConnected,
        message: isConnected ? 'Twilio is configured and working' : 'Twilio is not configured or has invalid credentials'
    })
}
