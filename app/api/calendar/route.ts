import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getCalendarEvents } from '@/lib/calendar'

export async function GET(request: NextRequest) {
    try {
        const session = await auth()
        const accessToken = (session as any)?.accessToken

        if (!accessToken) {
            return NextResponse.json(
                { success: false, error: 'Not authenticated or no calendar access' },
                { status: 401 }
            )
        }

        const { searchParams } = new URL(request.url)
        const timeMin = searchParams.get('timeMin')
        const timeMax = searchParams.get('timeMax')

        const events = await getCalendarEvents(accessToken, {
            timeMin: timeMin ? new Date(timeMin) : undefined,
            timeMax: timeMax ? new Date(timeMax) : undefined,
            maxResults: 100
        })

        return NextResponse.json({ success: true, events })
    } catch (error: any) {
        console.error('Calendar API error:', error)
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        )
    }
}
