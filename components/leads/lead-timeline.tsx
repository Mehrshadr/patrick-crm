import { Lead } from "@/app/actions"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Check, Mail, Phone, Calendar, Search, FileText, X, MessageSquare } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

interface LeadTimelineProps {
    lead: Lead
    logs?: any[]
}

export function LeadTimeline({ lead, logs = [] }: LeadTimelineProps) {
    const events = []

    // 1. Logs (Real History)
    logs.forEach(log => {
        let icon = FileText
        let color = "bg-slate-100 text-slate-600"

        if (log.type === 'STATUS_CHANGE') {
            icon = Check
            color = "bg-indigo-100 text-indigo-600"
        } else if (log.type === 'EMAIL') {
            icon = Mail
            color = "bg-blue-100 text-blue-600"
        } else if (log.type === 'SMS') {
            icon = MessageSquare
            color = "bg-green-100 text-green-600"
        }

        events.push({
            title: log.title,
            date: new Date(log.createdAt).toLocaleString(),
            timestamp: new Date(log.createdAt).getTime(),
            icon: icon,
            color: color,
            desc: log.content.replace(/<[^>]*>?/gm, '').substring(0, 50) + '...',
            fullContent: log.content,
            type: log.type,
            user: log.userName
        })
    })

    // 2. Created (Legacy/Base)
    events.push({
        title: "Lead Created",
        date: lead.createdAt ? new Date(lead.createdAt).toLocaleString() : "Initial Entry",
        timestamp: lead.createdAt ? new Date(lead.createdAt).getTime() : 0,
        icon: Check,
        color: "bg-green-100 text-green-600",
        desc: `Added to system`,
        fullContent: `Lead initialized.`,
        type: 'SYSTEM',
        user: null
    })

    // Sort by date desc
    events.sort((a, b) => b.timestamp - a.timestamp)

    return (
        <div className="relative border-l border-slate-200 ml-3 space-y-6 pb-4">
            {events.map((event, i) => (
                <div key={i} className="mb-6 relative pl-6 group">
                    <span className={`absolute -left-3 flex h-6 w-6 items-center justify-center rounded-full ${event.color} ring-4 ring-white`}>
                        <event.icon className="h-3 w-3" />
                    </span>

                    <div className="flex flex-col">
                        <Popover>
                            <PopoverTrigger asChild>
                                <div className="cursor-pointer hover:bg-slate-50 p-2 -ml-2 rounded-md transition-colors">
                                    <span className="text-sm font-semibold text-slate-900 group-hover:text-indigo-600 transition-colors">{event.title}</span>
                                    <div className="text-xs text-slate-500 line-clamp-1 mt-0.5">{event.desc}</div>
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className="text-[10px] text-slate-400">{event.date}</span>
                                        {event.user && <span className="text-[10px] text-slate-400">• by {event.user}</span>}
                                    </div>
                                </div>
                            </PopoverTrigger>
                            <PopoverContent align="start" className="w-[400px] max-h-[400px] overflow-y-auto shadow-lg">
                                <div className="space-y-4">
                                    <div className="border-b pb-2">
                                        <div className="font-semibold text-base">{event.title}</div>
                                        <div className="text-xs text-slate-400 mt-1">{event.date}</div>
                                    </div>

                                    <div>
                                        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Message Content</div>
                                        <div className="text-sm bg-slate-50 p-3 rounded-md border text-slate-700 whitespace-pre-wrap font-mono prose prose-sm max-w-none"
                                            dangerouslySetInnerHTML={{ __html: event.fullContent }}
                                        />
                                    </div>

                                    {(event.type === 'EMAIL' || event.type === 'SMS') && (
                                        <div className="flex gap-2">
                                            <Badge variant="outline">{event.type}</Badge>
                                            {event.user && <Badge variant="secondary">Sent by {event.user}</Badge>}
                                        </div>
                                    )}
                                </div>
                            </PopoverContent>
                        </Popover>
                    </div>
                </div>
            ))}
        </div>
    )
}
