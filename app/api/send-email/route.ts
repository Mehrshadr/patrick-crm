import { NextRequest, NextResponse } from 'next/server'
import { sendEmail, testEmailConnection } from '@/lib/email'

// POST - Send an email
export async function POST(request: NextRequest) {
    try {
        const { to, subject, html, from, replyTo } = await request.json()

        if (!to || !subject || !html) {
            return NextResponse.json(
                { success: false, error: 'to, subject, and html are required' },
                { status: 400 }
            )
        }

        const result = await sendEmail({ to, subject, html, from, replyTo })
        return NextResponse.json(result)
    } catch (error: any) {
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        )
    }
}

// GET - Test email connection
export async function GET() {
    const isConnected = await testEmailConnection()
    return NextResponse.json({
        success: true,
        connected: isConnected,
        message: isConnected ? 'Email is configured and working' : 'Email is not configured or has invalid credentials'
    })
}
