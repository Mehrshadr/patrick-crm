import { NextRequest, NextResponse } from 'next/server'
import { sendSms, testSmsConnection } from '@/lib/sms'

// POST - Send an SMS
export async function POST(request: NextRequest) {
    try {
        const { to, body } = await request.json()

        if (!to || !body) {
            return NextResponse.json(
                { success: false, error: 'to and body are required' },
                { status: 400 }
            )
        }

        const result = await sendSms(to, body)
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
