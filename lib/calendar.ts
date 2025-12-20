import { google, calendar_v3 } from 'googleapis'

const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.NEXTAUTH_URL
)

interface CalendarEvent {
    id: string
    title: string
    description?: string
    start: Date
    end: Date
    attendees?: string[]
    location?: string
    htmlLink?: string
}

export async function getCalendarEvents(
    accessToken: string,
    options?: {
        timeMin?: Date
        timeMax?: Date
        maxResults?: number
        refreshToken?: string // Add refresh token support
    }
): Promise<CalendarEvent[]> {
    oauth2Client.setCredentials({
        access_token: accessToken,
        refresh_token: options?.refreshToken
    })

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client })

    try {
        const response = await calendar.events.list({
            calendarId: 'primary',
            timeMin: (options?.timeMin || new Date()).toISOString(),
            timeMax: options?.timeMax?.toISOString(),
            maxResults: options?.maxResults || 50,
            singleEvents: true,
            orderBy: 'startTime'
        })

        const events = response.data.items || []

        return events.map((event): CalendarEvent => ({
            id: event.id || '',
            title: event.summary || 'No Title',
            description: event.description || undefined,
            start: new Date(event.start?.dateTime || event.start?.date || ''),
            end: new Date(event.end?.dateTime || event.end?.date || ''),
            attendees: event.attendees?.map(a => a.email || '').filter(Boolean),
            location: event.location || undefined,
            htmlLink: event.htmlLink || undefined
        }))
    } catch (error: any) {
        console.error('Failed to fetch calendar events:', error.message)
        return []
    }
}

// Get today's events
export async function getTodayEvents(accessToken: string): Promise<CalendarEvent[]> {
    const now = new Date()
    const endOfDay = new Date(now)
    endOfDay.setHours(23, 59, 59, 999)

    return getCalendarEvents(accessToken, {
        timeMin: now,
        timeMax: endOfDay
    })
}

// Get upcoming week events
export async function getWeekEvents(accessToken: string): Promise<CalendarEvent[]> {
    const now = new Date()
    const nextWeek = new Date(now)
    nextWeek.setDate(nextWeek.getDate() + 7)

    return getCalendarEvents(accessToken, {
        timeMin: now,
        timeMax: nextWeek,
        maxResults: 100
    })
}
