import { NextRequest, NextResponse } from 'next/server'
import { sendEmail, testEmailConnection } from '@/lib/email'
import { auth } from '@/lib/auth'

// POST - Send an email
export async function POST(request: NextRequest) {
    try {
        const { to, subject, html, from, replyTo } = await request.json()
        const session = await auth()
        const accessToken = (session as any)?.accessToken
        const refreshToken = (session as any)?.refreshToken

        if (!to || !subject || !html) {
            return NextResponse.json(
                { success: false, error: 'to, subject, and html are required' },
                { status: 400 }
            )
        }

        // Try OAuth first, then fall back to app password
        const tokens = (accessToken && refreshToken) ? { accessToken, refreshToken } : undefined
        const result = await sendEmail({ to, subject, html, from, replyTo }, tokens)
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
