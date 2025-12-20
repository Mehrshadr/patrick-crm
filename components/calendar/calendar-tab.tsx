"use client"

import { useState, useEffect } from 'react'
import { useSession, signIn } from 'next-auth/react'
import { Calendar } from '@/components/ui/calendar'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { RefreshCw, CalendarDays, Clock, MapPin, Users, ExternalLink } from 'lucide-react'
import { format, isSameDay, startOfMonth, endOfMonth, addMonths } from 'date-fns'

interface CalendarEvent {
    id: string
    title: string
    description?: string
    start: string
    end: string
    attendees?: string[]
    location?: string
    htmlLink?: string
}

export function CalendarTab() {
    const { data: session } = useSession()
    const [selectedDate, setSelectedDate] = useState<Date>(new Date())
    const [currentMonth, setCurrentMonth] = useState<Date>(new Date())
    const [events, setEvents] = useState<CalendarEvent[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const accessToken = (session as any)?.accessToken

    useEffect(() => {
        if (accessToken) {
            fetchEvents()
        }
    }, [session, currentMonth])

    async function fetchEvents() {
        if (!accessToken) return

        setLoading(true)
        setError(null)

        try {
            const timeMin = startOfMonth(currentMonth).toISOString()
            const timeMax = endOfMonth(addMonths(currentMonth, 1)).toISOString()

            const res = await fetch(`/api/calendar?timeMin=${timeMin}&timeMax=${timeMax}`)
            const data = await res.json()

            if (data.success) {
                setEvents(data.events)
            } else {
                setError(data.error || 'Failed to fetch events')
            }
        } catch (e) {
            setError('Failed to connect to calendar')
        }
        setLoading(false)
    }

    // Get events for selected date
    const selectedDateEvents = events.filter(event =>
        isSameDay(new Date(event.start), selectedDate)
    )

    // Get dates that have events (for highlighting)
    const eventDates = events.map(e => new Date(e.start))

    // Check if auth is configured
    if (!accessToken) {
        return (
            <div className="flex flex-col items-center justify-center h-[400px] text-center">
                <CalendarDays className="h-16 w-16 text-slate-300 mb-4" />
                <h3 className="text-xl font-semibold mb-2">Connect Your Calendar</h3>
                <p className="text-slate-500 max-w-md mb-4">
                    Sign in with Google to sync your calendar events and see your meetings here.
                </p>
                <Button
                    onClick={() => signIn('google')}
                    className="bg-indigo-600 hover:bg-indigo-700"
                >
                    Sign in with Google
                </Button>
                <p className="text-xs text-slate-400 mt-4">
                    Make sure Calendar API is enabled in Google Cloud Console.
                </p>
            </div>
        )
    }

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Calendar View */}
            <Card className="lg:col-span-2">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-lg">
                        {format(currentMonth, 'MMMM yyyy')}
                    </CardTitle>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={fetchEvents}
                        disabled={loading}
                    >
                        <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                        Sync
                    </Button>
                </CardHeader>
                <CardContent>
                    <Calendar
                        mode="single"
                        selected={selectedDate}
                        onSelect={(date) => date && setSelectedDate(date)}
                        onMonthChange={setCurrentMonth}
                        className="rounded-md border"
                        modifiers={{
                            hasEvent: eventDates
                        }}
                        modifiersStyles={{
                            hasEvent: {
                                fontWeight: 'bold',
                                textDecoration: 'underline',
                                textDecorationColor: '#6366f1'
                            }
                        }}
                    />
                    {error && (
                        <p className="text-red-500 text-sm mt-4 text-center">{error}</p>
                    )}
                </CardContent>
            </Card>

            {/* Events Sidebar */}
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-lg flex items-center gap-2">
                        <CalendarDays className="h-5 w-5" />
                        {format(selectedDate, 'EEEE, MMM d')}
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {selectedDateEvents.length === 0 ? (
                        <div className="text-center py-8 text-slate-500">
                            <p className="text-sm">No events on this day</p>
                        </div>
                    ) : (
                        <ScrollArea className="h-[400px]">
                            <div className="space-y-4">
                                {selectedDateEvents.map((event) => (
                                    <div
                                        key={event.id}
                                        className="p-3 bg-slate-50 rounded-lg border hover:border-indigo-300 transition-colors"
                                    >
                                        <div className="flex items-start justify-between">
                                            <h4 className="font-medium text-sm">{event.title}</h4>
                                            {event.htmlLink && (
                                                <a
                                                    href={event.htmlLink}
                                                    target="_blank"
                                                    className="text-slate-400 hover:text-indigo-600"
                                                >
                                                    <ExternalLink className="h-4 w-4" />
                                                </a>
                                            )}
                                        </div>

                                        <div className="flex items-center gap-2 text-xs text-slate-500 mt-2">
                                            <Clock className="h-3 w-3" />
                                            <span>
                                                {format(new Date(event.start), 'h:mm a')} - {format(new Date(event.end), 'h:mm a')}
                                            </span>
                                        </div>

                                        {event.location && (
                                            <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
                                                <MapPin className="h-3 w-3" />
                                                <span className="truncate">{event.location}</span>
                                            </div>
                                        )}

                                        {event.attendees && event.attendees.length > 0 && (
                                            <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
                                                <Users className="h-3 w-3" />
                                                <span>{event.attendees.length} attendee(s)</span>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </ScrollArea>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
