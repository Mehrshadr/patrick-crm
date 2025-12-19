import { Lead } from "@/app/actions"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Check, Mail, Phone, Calendar, Search, FileText, X, MessageSquare } from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

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
            desc: log.content.replace(/<[^>]*>?/gm, ''), // Strip HTML for preview
            fullContent: log.content
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
        fullContent: `Lead initialized.`
    })

    // Sort by date desc
    events.sort((a, b) => b.timestamp - a.timestamp)

    return (
        <div className="relative border-l border-slate-200 ml-3 space-y-6 pb-4">
            <TooltipProvider>
                {events.map((event, i) => (
                    <div key={i} className="mb-6 relative pl-6 group">
                        <span className={`absolute -left-3 flex h-6 w-6 items-center justify-center rounded-full ${event.color} ring-4 ring-white`}>
                            <event.icon className="h-3 w-3" />
                        </span>

                        <div className="flex flex-col">
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <div className="cursor-help">
                                        <span className="text-sm font-semibold hover:text-indigo-600 transition-colors">{event.title}</span>
                                        <div className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{event.desc}</div>
                                        {event.date && <span className="text-[10px] text-slate-400 mt-1 block">{event.date}</span>}
                                    </div>
                                </TooltipTrigger>
                                <TooltipContent side="left" className="max-w-[300px]">
                                    <p className="font-semibold mb-1">{event.title}</p>
                                    <div className="text-xs opacity-90" dangerouslySetInnerHTML={{ __html: event.fullContent }} />
                                    <div className="text-[10px] text-slate-400 mt-2 border-t pt-1">{event.date}</div>
                                </TooltipContent>
                            </Tooltip>
                        </div>
                    </div>
                ))}
            </TooltipProvider>
        </div>
    )
}
