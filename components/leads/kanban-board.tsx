"use client"

import { Lead, updateLead, LeadUpdateValues } from "@/app/actions"
import { getStageForStatus, PipelineStage, STAGE_CONFIG, getFriendlyStatusLabel } from "@/lib/status-mapping"
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd"
import { useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { format } from "date-fns"
import { LeadActions } from "./lead-actions"
import { toast } from "sonner"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Zap } from "lucide-react"
import { FileText, ClipboardList } from "lucide-react"
import { useSession } from "next-auth/react"

import { LeadDialog } from "./lead-dialog"

// SubStatus color helper
const getSubStatusColor = (sub: string | null | undefined) => {
    if (!sub) return "bg-slate-100 text-slate-700"
    const s = sub.toLowerCase()
    if (s.includes("done") || s.includes("received") || s.includes("won") || s.includes("data collected")) return "bg-emerald-600 text-white"
    if (s.includes("ghosted") || s.includes("lost")) return "bg-slate-500 text-white"
    if (s.includes("scheduled") || s.includes("booked")) return "bg-blue-600 text-white"
    if (s.includes("rescheduled")) return "bg-orange-500 text-white"
    if (s.includes("thinking") || s.includes("reviewing")) return "bg-indigo-500 text-white"
    if (s.includes("proposal") || s.includes("audit")) return "bg-purple-600 text-white"
    return "bg-slate-800 text-white"
}

interface KanbanBoardProps {
    leads: Lead[]
}

const STAGE_TO_OUTCOME_MAP: Record<string, Partial<LeadUpdateValues>> = {
    // Legacy maps removed, rely on direct stage updates
}

export function KanbanBoard({ leads: initialLeads }: KanbanBoardProps) {
    const { data: session } = useSession()
    const [leads, setLeads] = useState(initialLeads)
    const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
    const [isDialogOpen, setIsDialogOpen] = useState(false)

    // Sync state with props when router.refresh() happens
    useMemo(() => {
        setLeads(initialLeads)
    }, [initialLeads])

    const columns = useMemo(() => {
        const cols: Record<PipelineStage, Lead[]> = {
            "New": [],
            "Meeting1": [],
            "Audit": [],
            "Meeting2": [],
            "Meeting3": [],
            "Won": [],
            "Lost": []
        }

        leads.forEach(lead => {
            const stage = getStageForStatus(lead.status)
            if (cols[stage]) cols[stage].push(lead)
            else cols["New"].push(lead) // Fallback
        })
        return cols
    }, [leads])

    const onDragEnd = async (result: DropResult) => {
        const { destination, source, draggableId } = result

        if (!destination) return

        if (
            destination.droppableId === source.droppableId &&
            destination.index === source.index
        ) {
            return
        }

        const startStage = source.droppableId as PipelineStage
        const finishStage = destination.droppableId as PipelineStage

        // Find lead
        const lead = leads.find(l => String(l.id) === draggableId)
        if (!lead) return

        // Optimistic Update
        const targetConfig = STAGE_CONFIG[finishStage];
        // When moving to a new stage, default to no subStatus or the first one?
        // Let's default to empty string so user sees they need to select one, OR the first one.
        // The prompt implies: "Fresh In" -> "Meeting 1".
        // Let's set subStatus to null/empty string to indicate "Just arrived in this stage".
        // OR better: if there's a "Scheduled" subStatus, maybe?
        // Let's stick to empty string for safety so no wrong assumption is made.
        const newSubStatus = "";

        // 1. Optimistic UI Update
        const updatedLeads = leads.map(l => {
            if (String(l.id) === draggableId) {
                return { ...l, status: finishStage, subStatus: newSubStatus }
            }
            return l
        })
        setLeads(updatedLeads)

        // 2. Prepare Server Update Logic
        let updateData: LeadUpdateValues = {
            status: finishStage,
            subStatus: newSubStatus
        }

        try {
            await updateLead(lead.id, updateData, session?.user)
            toast.success(`Moved to ${STAGE_CONFIG[finishStage].label}`)
        } catch (e) {
            toast.error("Failed to update stage")
            setLeads(initialLeads) // Revert
        }
    }

    const handleCardClick = (lead: Lead) => {
        setSelectedLead(lead)
        setIsDialogOpen(true)
    }

    return (
        <DragDropContext onDragEnd={onDragEnd}>
            <div className="flex gap-4 pb-4 overflow-x-auto" style={{ height: 'calc(100vh - 220px)' }}>
                {Object.entries(STAGE_CONFIG).map(([stage, config]) => (
                    <div key={stage} className="w-[300px] flex-shrink-0 flex flex-col bg-slate-50/50 rounded-lg border overflow-hidden" style={{ maxHeight: '100%' }}>
                        <div className={`p-3 border-b ${config.color.split(" ")[0]} rounded-t-lg`}>
                            <h3 className={`font-semibold text-sm ${config.color.split(" ")[2]}`}>{config.label}</h3>
                            <span className="text-xs opacity-70">{columns[stage as PipelineStage].length} leads</span>
                        </div>
                        <Droppable droppableId={stage}>
                            {(provided) => (
                                <ScrollArea className="flex-1 h-full">
                                    <div className="p-2">
                                        <div
                                            {...provided.droppableProps}
                                            ref={provided.innerRef}
                                            className="space-y-2 min-h-[100px]"
                                        >
                                            {columns[stage as PipelineStage].map((lead, index) => (
                                                <Draggable key={lead.id} draggableId={String(lead.id)} index={index}>
                                                    {(provided) => (
                                                        <Card
                                                            ref={provided.innerRef}
                                                            {...provided.draggableProps}
                                                            {...provided.dragHandleProps}
                                                            className="cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow"
                                                        >
                                                            <CardHeader className="p-3 pb-1">
                                                                <div className="flex justify-between items-center">
                                                                    <div
                                                                        className="cursor-pointer hover:underline flex-1"
                                                                        onClick={() => handleCardClick(lead)}
                                                                    >
                                                                        <CardTitle className="text-base font-bold leading-tight">{lead.name}</CardTitle>
                                                                        {lead.website && (
                                                                            <div className="text-xs text-muted-foreground mt-0.5 truncate max-w-[180px]">
                                                                                {lead.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                                                                            </div>
                                                                        )}
                                                                        {/* Quality & Business Type with emojis */}
                                                                        <div className="flex gap-1 mt-1">
                                                                            {lead.quality && (
                                                                                <span className={`text-[10px] ${lead.quality === 'Hot' ? 'text-red-600' : lead.quality === 'Warm' ? 'text-orange-500' : 'text-blue-500'}`}>
                                                                                    {lead.quality === 'Hot' ? '🔥' : lead.quality === 'Warm' ? '☀️' : '❄️'} {lead.quality}
                                                                                </span>
                                                                            )}
                                                                            {lead.businessType && (
                                                                                <span className={`text-[10px] ${lead.businessType === 'Service' ? 'text-indigo-600' : 'text-emerald-600'}`}>
                                                                                    {lead.businessType === 'Service' ? '🛠️' : '📦'} {lead.businessType}
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                    <LeadActions lead={lead} />
                                                                </div>
                                                            </CardHeader>
                                                            <CardContent
                                                                className="px-3 py-2 cursor-pointer"
                                                                onClick={() => handleCardClick(lead)}
                                                            >
                                                                <div className="flex items-center gap-1 flex-wrap">
                                                                    <Badge className={`text-[10px] px-1.5 py-0 h-4 border-0 ${getSubStatusColor(lead.subStatus)}`}>
                                                                        {getFriendlyStatusLabel(lead.status, lead.subStatus)}
                                                                    </Badge>
                                                                    {/* Audit/Proposal Link Indicators */}
                                                                    {(lead as any).links?.some((l: any) => l.type === 'Audit Link') && (
                                                                        <span title="Has Audit" className="text-purple-600"><FileText className="h-3 w-3" /></span>
                                                                    )}
                                                                    {(lead as any).links?.some((l: any) => l.type === 'Proposal Link') && (
                                                                        <span title="Has Proposal" className="text-teal-600"><ClipboardList className="h-3 w-3" /></span>
                                                                    )}
                                                                    {/* Confirmed Meeting Badge */}
                                                                    {(lead as any).nextMeetingAt && new Date((lead as any).nextMeetingAt) > new Date() && (
                                                                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 bg-red-50 text-red-700 border-red-200 font-medium">
                                                                            📅 {format(new Date((lead as any).nextMeetingAt), "MMM d, h:mm a")}
                                                                        </Badge>
                                                                    )}
                                                                </div>
                                                                {/* Last Automation Badge */}
                                                                {lead.nurtureStage > 0 && (
                                                                    <div className="mt-1.5">
                                                                        <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 bg-amber-50 text-amber-700 border-amber-200">
                                                                            <Zap className="h-2.5 w-2.5 mr-0.5" />
                                                                            Seq {lead.nurtureStage}
                                                                        </Badge>
                                                                    </div>
                                                                )}

                                                                {/* Next Nurture Countdown */}
                                                                {lead.nextNurtureAt && new Date(lead.nextNurtureAt) > new Date() && (
                                                                    <div className="mt-1.5">
                                                                        <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 bg-indigo-50 text-indigo-700 border-indigo-200">
                                                                            ⏱️ Next: {format(new Date(lead.nextNurtureAt), "MMM d, h:mm a")}
                                                                        </Badge>
                                                                    </div>
                                                                )}
                                                            </CardContent>
                                                        </Card>
                                                    )}
                                                </Draggable>
                                            ))}
                                            {provided.placeholder}
                                        </div>
                                    </div>
                                </ScrollArea>
                            )}
                        </Droppable>
                    </div>
                ))}
            </div>

            <LeadDialog
                open={isDialogOpen}
                onOpenChange={setIsDialogOpen}
                lead={selectedLead}
            />
        </DragDropContext >
    )
}
