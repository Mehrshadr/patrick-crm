import { NextRequest, NextResponse } from 'next/server'
import { sendEmail, testEmailConnection } from '@/lib/email'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'

// POST - Send an email
export async function POST(request: NextRequest) {
    try {
        const { to, subject, html, from, replyTo, leadId, leadName } = await request.json()
        const session = await auth()
        const accessToken = (session as any)?.accessToken
        const refreshToken = (session as any)?.refreshToken

        if (!to || !subject || !html) {
            return NextResponse.json(
                { success: false, error: 'to, subject, and html are required' },
                { status: 400 }
            )
        }

        // Pass from directly - lib/email.ts will format it properly with the authenticated email
        const fromHeader = from || undefined;

        const tokens = (accessToken && refreshToken) ? { accessToken, refreshToken } : undefined
        const result = await sendEmail({
            to,
            subject,
            html,
            from: fromHeader,
            replyTo
        }, tokens)

        // Log to activity log
        await db.activityLog.create({
            data: {
                category: 'EMAIL',
                action: 'EMAIL_SENT',
                entityType: leadId ? 'LEAD' : undefined,
                entityId: leadId || undefined,
                entityName: leadName || undefined,
                description: `Email "${subject}" sent to ${to}`,
                details: html.substring(0, 500),
                userId: session?.user?.id || undefined,
                userName: session?.user?.name || undefined,
            }
        })

        // Also log to Log for the lead card
        if (leadId) {
            await db.log.create({
                data: {
                    leadId,
                    type: 'EMAIL',
                    status: 'SENT',
                    title: `Email: ${subject}`,
                    content: html,
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

// GET - Test email connection
export async function GET() {
    const isConnected = await testEmailConnection()
    return NextResponse.json({
        success: true,
        connected: isConnected,
        message: isConnected ? 'Email is configured and working' : 'Email is not configured or has invalid credentials'
    })
}
