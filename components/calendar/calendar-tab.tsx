"use client"

import { useState, useEffect } from 'react'
import { useSession, signIn } from 'next-auth/react'
import { Calendar } from '@/components/ui/calendar'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { RefreshCw, CalendarDays, Clock, MapPin, Users, ExternalLink, Video, ChevronRight } from 'lucide-react'
import { format, isSameDay, startOfMonth, endOfMonth, addMonths, isBefore, isAfter, startOfDay } from 'date-fns'
import { cn } from '@/lib/utils'

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

    // Filter Logic
    const today = startOfDay(new Date())
    const selectedDateEvents = events.filter(event => isSameDay(new Date(event.start), selectedDate))

    // Sort events by time
    const sortedEvents = [...events].sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())

    // Categorize for sidebar
    const upcomingEvents = sortedEvents.filter(e => isAfter(new Date(e.start), new Date()))
    const pastEvents = sortedEvents.filter(e => isBefore(new Date(e.start), new Date()))

    const eventDates = events.map(e => new Date(e.start))

    if (!accessToken) {
        return (
            <div className="flex flex-col items-center justify-center h-[600px] text-center bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                <div className="bg-white p-6 rounded-full shadow-sm mb-6">
                    <CalendarDays className="h-12 w-12 text-blue-600" />
                </div>
                <h3 className="text-2xl font-bold mb-3 text-slate-900">Sync Your Calendar</h3>
                <p className="text-slate-500 max-w-md mb-8 leading-relaxed">
                    Connect your Google Calendar to automatically track meetings with leads.
                    We'll identify booked calls and update lead statuses automatically.
                </p>
                <Button
                    onClick={() => signIn('google')}
                    size="lg"
                    className="bg-blue-600 hover:bg-blue-700 text-white gap-2 pl-4 pr-6"
                >
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                        <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                        <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                        <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                        <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                    </svg>
                    Sign in with Google
                </Button>
            </div>
        )
    }

    return (
        <div className="flex flex-col lg:flex-row gap-8 h-[calc(100vh-140px)]">
            {/* Main Calendar Area */}
            <div className="flex-1 flex flex-col gap-6">
                <Card className="flex-1 shadow-sm border-slate-200 overflow-hidden flex flex-col">
                    <CardHeader className="flex flex-row items-center justify-between pb-4 border-b bg-slate-50/50 px-6">
                        <div>
                            <CardTitle className="text-xl font-bold flex items-center gap-2">
                                <CalendarDays className="h-5 w-5 text-blue-600" />
                                {format(currentMonth, 'MMMM yyyy')}
                            </CardTitle>
                            <CardDescription>Select a date to view details</CardDescription>
                        </div>
                        <Button variant="outline" size="sm" onClick={fetchEvents} disabled={loading} className="gap-2 bg-white">
                            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
                            {loading ? 'Syncing...' : 'Sync Now'}
                        </Button>
                    </CardHeader>
                    <CardContent className="p-0 bg-white">
                        <Calendar
                            mode="single"
                            selected={selectedDate}
                            onSelect={(date) => date && setSelectedDate(date)}
                            onMonthChange={setCurrentMonth}
                            className="p-6 w-full flex justify-center"
                            classNames={{
                                months: "flex w-full flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
                                month: "space-y-4 w-full flex flex-col",
                                caption: "flex justify-center pt-1 relative items-center mb-6",
                                caption_label: "text-2xl font-bold text-slate-800",
                                nav: "space-x-1 flex items-center absolute right-0",
                                nav_button: "h-9 w-9 bg-transparent p-0 opacity-50 hover:opacity-100 border rounded-lg hover:bg-slate-100",
                                table: "w-full border-collapse h-full",
                                head_row: "flex w-full mb-2",
                                head_cell: "text-slate-400 rounded-md w-full font-medium text-[0.8rem] uppercase tracking-wider text-center",
                                row: "flex w-full mt-2",
                                cell: "h-20 w-full text-center text-sm p-0 m-0 relative [&:has([aria-selected])]:bg-slate-50 first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
                                day: "h-full w-full p-0 font-normal aria-selected:opacity-100 hover:bg-slate-50 rounded-lg transition-all flex flex-col items-center justify-center gap-1 data-[selected]:bg-slate-900 data-[selected]:text-white data-[selected]:hover:bg-slate-800 data-[selected]:shadow-md",
                                day_today: "bg-slate-50 text-slate-900 font-bold border-2 border-slate-200",
                                day_outside: "text-slate-300 opacity-50",
                                day_disabled: "text-slate-300 opacity-50",
                                day_hidden: "invisible",
                            }}
                            modifiers={{ hasEvent: eventDates }}
                            modifiersClassNames={{
                                hasEvent: "font-bold relative after:content-[''] after:absolute after:bottom-2 after:w-1.5 after:h-1.5 after:bg-indigo-500 after:rounded-full"
                            }}
                        />
                    </CardContent>
                </Card>
            </div>

            {/* Sidebar / Agenda */}
            <div className="w-full lg:w-[400px] flex flex-col gap-6">
                <Card className="flex-1 shadow-md border-slate-200 bg-white/50 backdrop-blur-sm flex flex-col overflow-hidden">
                    <Tabs defaultValue="selected" className="w-full flex-1 flex flex-col">
                        <div className="px-6 pt-6 pb-2">
                            <TabsList className="w-full grid grid-cols-2 bg-slate-100 p-1 rounded-xl">
                                <TabsTrigger value="selected" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">
                                    {format(selectedDate, 'MMM d')}
                                </TabsTrigger>
                                <TabsTrigger value="upcoming" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">
                                    Upcoming
                                </TabsTrigger>
                            </TabsList>
                        </div>

                        <CardContent className="flex-1 p-0 overflow-hidden">
                            <ScrollArea className="h-full max-h-[500px]">
                                <TabsContent value="selected" className="m-0 p-4 space-y-4 min-h-[400px]">
                                    <div className="px-2 pb-2">
                                        <h4 className="text-sm font-medium text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                            <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                                            Agenda for {format(selectedDate, 'MMMM do')}
                                        </h4>
                                    </div>
                                    {selectedDateEvents.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center py-12 text-center text-slate-400 border-2 border-dashed border-slate-100 rounded-xl bg-slate-50/50">
                                            <Clock className="h-10 w-10 mb-3 opacity-20" />
                                            <p className="font-medium text-sm">No events scheduled</p>
                                            <p className="text-xs mt-1">Enjoy your free time!</p>
                                        </div>
                                    ) : (
                                        selectedDateEvents.map(event => <EventCard key={event.id} event={event} />)
                                    )}
                                </TabsContent>
                                <TabsContent value="upcoming" className="m-0 p-4 space-y-4 min-h-[400px]">
                                    <div className="px-2 pb-2">
                                        <h4 className="text-sm font-medium text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                            <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                                            Upcoming Events
                                        </h4>
                                    </div>
                                    {upcomingEvents.length === 0 ? (
                                        <div className="text-center py-12 text-slate-400">No upcoming events</div>
                                    ) : (
                                        upcomingEvents.map(event => <EventCard key={event.id} event={event} showDate />)
                                    )}
                                </TabsContent>
                            </ScrollArea>
                        </CardContent>
                    </Tabs>
                </Card>
            </div>
        </div>
    )
}

function EventCard({ event, showDate = false }: { event: CalendarEvent, showDate?: boolean }) {
    const isMeeting = (event.attendees?.length || 0) > 0 || (event.htmlLink && event.htmlLink.includes('meet.google'))

    return (
        <div className="group relative bg-white rounded-xl border border-slate-200 p-4 shadow-sm hover:shadow-md hover:border-blue-300 transition-all duration-200 cursor-default overflow-hidden">
            {/* Decorative Strip */}
            <div className={cn("absolute left-0 top-0 bottom-0 w-1", isMeeting ? "bg-blue-500" : "bg-slate-300")} />

            <div className="pl-3">
                {showDate && (
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                        {format(new Date(event.start), 'EEEE, MMM do')}
                    </div>
                )}

                <div className="flex items-start justify-between gap-3 mb-2">
                    <h4 className="font-bold text-slate-800 text-sm leading-tight line-clamp-2">
                        {event.title || '(No Title)'}
                    </h4>
                    {event.htmlLink && (
                        <a href={event.htmlLink} target="_blank" className="text-slate-400 hover:text-blue-600 transition-colors p-1 hover:bg-blue-50 rounded-md">
                            <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                    )}
                </div>

                <div className="space-y-1.5">
                    <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                        <Clock className="h-3.5 w-3.5 text-slate-400" />
                        <span>
                            {format(new Date(event.start), 'h:mm a')} - {format(new Date(event.end), 'h:mm a')}
                        </span>
                    </div>

                    {isMeeting && (
                        <div className="flex items-center gap-2 text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded w-fit">
                            <Video className="h-3 w-3" />
                            <span>Meeting</span>
                        </div>
                    )}

                    {event.location && (
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                            <MapPin className="h-3.5 w-3.5 text-slate-400" />
                            <span className="truncate max-w-[200px]">{event.location}</span>
                        </div>
                    )}

                    {event.attendees && event.attendees.length > 0 && (
                        <div className="flex items-center gap-[-4px] pt-1">
                            {event.attendees.slice(0, 3).map((att, i) => (
                                <div key={i} className="h-6 w-6 rounded-full bg-slate-100 border-2 border-white flex items-center justify-center text-[8px] font-bold text-slate-600 uppercase" title={att}>
                                    {att[0]}
                                </div>
                            ))}
                            {event.attendees.length > 3 && (
                                <div className="h-6 w-6 rounded-full bg-slate-100 border-2 border-white flex items-center justify-center text-[8px] font-bold text-slate-600">
                                    +{event.attendees.length - 3}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
