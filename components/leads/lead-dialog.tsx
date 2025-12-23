"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Clock, Mail, MessageSquare, ChevronRight, CheckCircle2, Timer, Pencil, Plus, Link as LinkIcon, ExternalLink, Trash2, Zap, Play, Loader2, Eye, EyeOff, StopCircle, FastForward } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { LeadTimeline } from "./lead-timeline"
import { STAGE_CONFIG, PipelineStage, getStageForStatus } from "@/lib/status-mapping"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Lead, createLead, updateLead, getLeadLogs, addLink, getLinks } from "@/app/actions"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"

const formSchema = z.object({
    name: z.string().min(2),
    phone: z.string().min(2),
    email: z.string().email().optional().or(z.literal("")),
    website: z.string().optional(),
    quality: z.string().optional(),
    businessType: z.string().optional(),
    status: z.string().optional(),
    subStatus: z.string().optional(),
})

interface LeadDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    lead?: Lead | null
}

export function LeadDialog({ open, onOpenChange, lead }: LeadDialogProps) {
    const router = useRouter()
    const { data: session } = useSession()
    const [logs, setLogs] = useState<any[]>([])
    const [links, setLinks] = useState<any[]>([])
    const [notes, setNotes] = useState<any[]>([])
    const [isEditing, setIsEditing] = useState(false)
    const [isAddingLink, setIsAddingLink] = useState(false)
    const [isAddingNote, setIsAddingNote] = useState(false)
    const [linkType, setLinkType] = useState("Meeting Recording")
    const [linkUrl, setLinkUrl] = useState("")
    const [linkTitle, setLinkTitle] = useState("")
    const [noteContent, setNoteContent] = useState("")
    const [noteStage, setNoteStage] = useState("")
    const [suggestedWorkflows, setSuggestedWorkflows] = useState<any[]>([])
    const [runningWorkflow, setRunningWorkflow] = useState<number | null>(null)
    const [sendingSms, setSendingSms] = useState(false)
    const [sendingEmail, setSendingEmail] = useState(false)
    // Compose dialog states
    const [showSmsCompose, setShowSmsCompose] = useState(false)
    const [showEmailCompose, setShowEmailCompose] = useState(false)
    const [smsMessage, setSmsMessage] = useState('')
    const [emailSubject, setEmailSubject] = useState('')
    const [emailBody, setEmailBody] = useState('')
    const [emailSenderName, setEmailSenderName] = useState('')
    const [emailReplyTo, setEmailReplyTo] = useState('')
    const [emailIncludeSignature, setEmailIncludeSignature] = useState(true)
    const [emailPreview, setEmailPreview] = useState(false)
    const [signature, setSignature] = useState('')
    const [isFastForwarding, setIsFastForwarding] = useState(false)

    // Available variables for SMS/Email templates
    const getAvailableVariables = () => {
        const auditLink = links.find((l: any) => l.type === 'AUDIT' || l.type === 'Audit Link')?.url || ''
        const proposalLink = links.find((l: any) => l.type === 'PROPOSAL' || l.type === 'Proposal Link')?.url || ''
        const recordingLink = links.find((l: any) => l.type === 'RECORDING' || l.type === 'Meeting Recording')?.url || ''

        return [
            { key: '{name}', label: 'Name', value: lead?.name || '' },
            { key: '{first_name}', label: 'First Name', value: (lead?.name || '').split(' ')[0] },
            { key: '{email}', label: 'Email', value: lead?.email || '' },
            { key: '{phone}', label: 'Phone', value: lead?.phone || '' },
            { key: '{website}', label: 'Website', value: lead?.website || '' },
            { key: '{audit_link}', label: 'Audit Link', value: auditLink },
            { key: '{proposal_link}', label: 'Proposal Link', value: proposalLink },
            { key: '{recording_link}', label: 'Recording Link', value: recordingLink },
        ]
    }

    // Replace variables in text
    const replaceVariables = (text: string) => {
        let result = text
        getAvailableVariables().forEach(v => {
            result = result.replace(new RegExp(v.key.replace(/[{}]/g, '\\$&'), 'g'), v.value)
        })
        return result
    }

    // Insert variable at cursor position
    const insertVariable = (variable: string, setter: React.Dispatch<React.SetStateAction<string>>, currentValue: string) => {
        setter(currentValue + variable)
    }

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            name: "",
            phone: "",
            email: "",
            website: "",
        },
    })

    useEffect(() => {
        // Reset form when dialog opens for new lead (no lead prop)
        if (open && !lead) {
            form.reset({
                name: "",
                phone: "",
                email: "",
                website: "",
                quality: "",
                businessType: "",
                status: "New",
                subStatus: "",
            })
            setLogs([])
            setLinks([])
            setNotes([])
            setSuggestedWorkflows([])
            setIsEditing(true)
            return
        }

        if (lead) {
            form.reset({
                name: lead.name || "",
                phone: lead.phone || "",
                email: lead.email || "",
                website: lead.website || "",
                quality: lead.quality || "",
                businessType: lead.businessType || "",
                status: getStageForStatus(lead.status || "New"),
                subStatus: lead.subStatus || "",
            })
            // Fetch logs, links & notes
            getLeadLogs(lead.id).then(setLogs)
            getLinks(lead.id).then(setLinks)
            fetch(`/api/notes?leadId=${lead.id}`).then(r => r.json()).then(d => setNotes(d.notes || []))
            // Fetch signature for email compose
            fetch('/api/settings?key=email_signature').then(r => r.json()).then(d => {
                if (d.success && d.setting) setSignature(d.setting.value || '')
            })
            // Fetch suggested workflows for this lead's status
            fetchSuggestedWorkflows(lead.status, lead.subStatus ?? undefined)
            setIsEditing(false)
        }
    }, [open, lead, form])

    async function onSubmit(values: z.infer<typeof formSchema>) {
        try {
            if (lead) {
                await updateLead(lead.id, values, session?.user)
                toast.success("Lead updated")
            } else {
                await createLead(values)
                toast.success("Lead created")
            }
            onOpenChange(false)
            setIsEditing(false)
            router.refresh()
        } catch (error) {
            toast.error("Something went wrong")
        }
    }

    async function fetchSuggestedWorkflows(status?: string, subStatus?: string) {
        if (!status || !lead) return
        try {
            // Fetch workflows AND executions for this lead
            const [wfRes, execRes] = await Promise.all([
                fetch('/api/workflows').then(r => r.json()),
                fetch(`/api/workflow-executions?leadId=${lead.id}`).then(r => r.json())
            ])

            if (wfRes.success) {
                // Get IDs of workflows that have already been executed for this lead
                const executedWorkflowIds = new Set(
                    (execRes.executions || []).map((e: any) => e.workflowId)
                )

                // Filter workflows that match this lead's status AND haven't been executed
                const matching = wfRes.workflows.filter((w: any) => {
                    if (!w.isActive) return false
                    // Don't suggest if already executed for this lead
                    if (executedWorkflowIds.has(w.id)) return false

                    // Match by execution mode MANUAL or if trigger matches status
                    const matchesTrigger = w.triggerType === 'ON_STATUS_CHANGE' &&
                        w.triggerStatus === status &&
                        (!w.triggerSubStatus || w.triggerSubStatus === subStatus)
                    const matchesPipeline = !w.pipelineStage || w.pipelineStage === status
                    // Show if: MANUAL mode OR matches trigger
                    return w.executionMode === 'MANUAL' || matchesTrigger || matchesPipeline
                })
                setSuggestedWorkflows(matching)
            }
        } catch (e) {
            console.error('Failed to fetch workflows:', e)
        }
    }

    async function runWorkflow(workflowId: number) {
        if (!lead) return
        setRunningWorkflow(workflowId)
        try {
            // Basic validation Check
            if (!lead.email && !lead.phone) {
                toast.error('Lead must have an email or phone number to run automation')
                setRunningWorkflow(null)
                return
            }

            const res = await fetch('/api/workflow-executions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ workflowId, leadId: lead.id })
            }).then(r => r.json())

            if (res.success) {
                toast.success('Workflow started!')
                // Remove from suggestions
                setSuggestedWorkflows(suggestedWorkflows.filter(w => w.id !== workflowId))
            } else {
                toast.error('Failed to start workflow: ' + (res.error || 'Unknown error'))
            }
        } catch (e) {
            toast.error('Error starting workflow')
        }
        setRunningWorkflow(null)
    }

    async function sendSmsToLead() {
        if (!lead?.phone) {
            toast.error('No phone number for this lead')
            return
        }
        setSendingSms(true)
        try {
            const message = `Hi ${lead.name || 'there'}! This is a message from Patrick CRM.`
            const res = await fetch('/api/send-sms', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ to: lead.phone, body: message })
            }).then(r => r.json())

            if (res.success) {
                toast.success('SMS sent successfully!')
            } else {
                toast.error('Failed to send SMS: ' + (res.error || 'Unknown error'))
            }
        } catch (e) {
            toast.error('Error sending SMS')
        }
        setSendingSms(false)
    }

    async function sendEmailToLead() {
        if (!lead?.email) {
            toast.error('No email address for this lead')
            return
        }
        setSendingEmail(true)
        try {
            const res = await fetch('/api/send-email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    to: lead.email,
                    subject: `Hello from Patrick CRM`,
                    html: `<p>Hi ${lead.name || 'there'},</p><p>This is a test email from Patrick CRM.</p>`
                })
            }).then(r => r.json())

            if (res.success) {
                toast.success('Email sent successfully!')
            } else {
                toast.error('Failed to send email: ' + (res.error || 'Unknown error'))
            }
        } catch (e) {
            toast.error('Error sending email')
        }
        setSendingEmail(false)
    }

    // Color Helper
    const getSubStatusColor = (sub: string) => {
        if (!sub) return "bg-white text-slate-600 border-slate-200"
        const s = sub.toLowerCase()
        if (s.includes("done") || s.includes("received") || s.includes("won")) return "bg-emerald-600 text-white border-emerald-600"
        if (s.includes("ghosted") || s.includes("lost")) return "bg-slate-500 text-white border-slate-500"
        if (s.includes("scheduled") || s.includes("booked")) return "bg-blue-600 text-white border-blue-600"
        if (s.includes("rescheduled")) return "bg-orange-500 text-white border-orange-500"
        if (s.includes("thinking") || s.includes("reviewing")) return "bg-indigo-500 text-white border-indigo-500"
        if (s.includes("proposal") || s.includes("audit")) return "bg-purple-600 text-white border-purple-600"

        return "bg-slate-800 text-white border-slate-800"
    }

    async function handleAddLink() {
        if (!lead) {
            toast.error("Please save the lead first.")
            return
        }
        if (!linkUrl) {
            toast.error("Please enter a URL.")
            return
        }

        let title = linkTitle
        if (!title) {
            if (linkType === 'Audit Link') title = 'Audit Doc'
            else if (linkType === 'Proposal Link') title = 'Proposal Doc'
            else title = 'Meeting Recording'
        }

        // Map UI link types to database enum values
        let dbType = 'RECORDING'
        if (linkType === 'Audit Link') dbType = 'AUDIT'
        else if (linkType === 'Proposal Link') dbType = 'PROPOSAL'

        try {
            const response = await fetch('/api/links', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ leadId: lead.id, type: dbType, title, url: linkUrl })
            })
            const res = await response.json()

            if (res.success && res.link) {
                setLinks([res.link, ...links])
                setIsAddingLink(false)
                setLinkUrl("")
                setLinkTitle("")
                toast.success("Link attached")
            } else {
                toast.error("Failed to add link: " + (res.error || "Unknown error"))
            }
        } catch (error) {
            console.error("Link add error:", error)
            toast.error("Error adding link")
        }
    }

    async function handleFastForward() {
        if (!lead) return
        setIsFastForwarding(true)
        try {
            // 1. Advance Timer
            const res = await fetch(`/api/leads/${lead.id}/advance-timer`, { method: 'POST' }).then(r => r.json())
            if (res.success) {
                toast.success('Timer advanced! Triggering Cron...')

                // 2. Trigger Cron
                const cronRes = await fetch('/api/cron').then(r => r.json())
                if (cronRes.success) {
                    toast.success(`Cron executed: ${cronRes.processed} processed`)
                    router.refresh()
                    // Optional: Close dialog to refresh deeply or refetch logs?
                    // We can just refetch logs if we stayed open, but router.refresh needs time
                } else {
                    toast.error('Cron failed')
                }
            } else {
                toast.error('Failed to advance timer')
            }
        } catch (e) {
            toast.error('Error during fast forward')
        }
        setIsFastForwarding(false)
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[90vw] h-[85vh] flex flex-col p-0 gap-0">
                <div className="flex items-center justify-between p-4 border-b bg-white sticky top-0 z-10">
                    <div>
                        <DialogTitle className="text-lg font-bold">{lead?.name || 'New Lead'}</DialogTitle>
                        <DialogDescription className="text-xs text-slate-500">Manage details, automation, and history.</DialogDescription>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
                        <Button size="sm" type="submit" form="lead-form">Save Changes</Button>
                    </div>
                </div>

                <div className="flex-1 overflow-hidden p-8 grid grid-cols-1 lg:grid-cols-12 gap-10">
                    {/* Left Panel: Info + Automation (8 cols) */}
                    <div className="lg:col-span-8 border-r pr-8 overflow-y-auto flex flex-col gap-8">

                        {/* Automation Status - Debug Only */}
                        {lead?.nextNurtureAt && (
                            <div className="p-4 bg-amber-50 rounded-lg border border-amber-200 animate-in fade-in slide-in-from-top-2">
                                <h3 className="font-semibold text-sm text-amber-900 flex items-center gap-2 mb-2">
                                    <Timer className="h-4 w-4" />
                                    Automation Scheduled
                                </h3>
                                <div className="flex items-center justify-between">
                                    <div className="text-amber-800 text-xs">
                                        Next action due: <strong>{new Date(lead.nextNurtureAt).toLocaleString()}</strong>
                                    </div>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="bg-white hover:bg-amber-100 text-amber-700 h-7 text-xs border-amber-300"
                                        onClick={handleFastForward}
                                        disabled={isFastForwarding}
                                    >
                                        {isFastForwarding ? <Loader2 className="h-3 w-3 animate-spin" /> : <Zap className="h-3 w-3 mr-1" />}
                                        Run Now (Debug)
                                    </Button>
                                </div>
                            </div>
                        )}


                        {/* Section 1: Lead Information */}
                        <div>
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="font-semibold text-lg flex items-center gap-3">
                                    <span className="bg-slate-100 p-2 rounded-md"><UserIcon className="h-5 w-5 text-slate-700" /></span>
                                    Lead Information
                                </h3>
                                <Button variant="ghost" size="icon" onClick={() => setIsEditing(!isEditing)} title="Edit Contact Info">
                                    <Pencil className="h-4 w-4 text-slate-500" />
                                </Button>
                            </div>

                            <Form {...form}>
                                <form id="lead-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                                    <div className="grid grid-cols-2 gap-6">
                                        {/* Name */}
                                        <FormField
                                            control={form.control}
                                            name="name"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Name</FormLabel>
                                                    {isEditing ? (
                                                        <FormControl>
                                                            <Input placeholder="John Doe" {...field} />
                                                        </FormControl>
                                                    ) : (
                                                        <div className="text-sm font-medium py-2 px-1">{field.value}</div>
                                                    )}
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        {/* Email with Send button */}
                                        <FormField
                                            control={form.control}
                                            name="email"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Email</FormLabel>
                                                    {isEditing ? (
                                                        <FormControl>
                                                            <Input placeholder="john@example.com" {...field} />
                                                        </FormControl>
                                                    ) : (
                                                        <div className="flex items-center gap-2">
                                                            <div className="text-sm font-medium py-2 px-1 flex-1">{field.value || "-"}</div>
                                                            {lead?.email && (
                                                                <Button
                                                                    type="button"
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="h-7 w-7 bg-purple-50 hover:bg-purple-100 text-purple-600"
                                                                    onClick={() => { setEmailBody(`Hi ${lead?.name || 'there'},\n\n`); setShowEmailCompose(true); }}
                                                                    title="Send Email"
                                                                >
                                                                    <Mail className="h-3.5 w-3.5" />
                                                                </Button>
                                                            )}
                                                        </div>
                                                    )}
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-6">
                                        {/* Website */}
                                        <FormField
                                            control={form.control}
                                            name="website"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Website</FormLabel>
                                                    {isEditing ? (
                                                        <FormControl>
                                                            <Input placeholder="example.com" {...field} />
                                                        </FormControl>
                                                    ) : (
                                                        <div className="text-sm font-medium py-2 px-1">{field.value || "-"}</div>
                                                    )}
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />

                                        {/* Phone with SMS button */}
                                        <FormField
                                            control={form.control}
                                            name="phone"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Phone</FormLabel>
                                                    {isEditing ? (
                                                        <FormControl>
                                                            <Input placeholder="+1234567890" {...field} />
                                                        </FormControl>
                                                    ) : (
                                                        <div className="flex items-center gap-2">
                                                            <div className="text-sm font-medium py-2 px-1 flex-1">{field.value || "-"}</div>
                                                            {lead?.phone && (
                                                                <Button
                                                                    type="button"
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="h-7 w-7 bg-green-50 hover:bg-green-100 text-green-600"
                                                                    onClick={() => { setSmsMessage(`Hi ${lead?.name || 'there'}!\n\n`); setShowSmsCompose(true); }}
                                                                    title="Send SMS"
                                                                >
                                                                    <MessageSquare className="h-3.5 w-3.5" />
                                                                </Button>
                                                            )}
                                                        </div>
                                                    )}
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <FormField
                                            control={form.control}
                                            name="quality"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel className="block mb-2">Lead Quality</FormLabel>
                                                    <div className="flex gap-2">
                                                        {['Hot', 'Warm', 'Cold'].map((q) => (
                                                            <div
                                                                key={q}
                                                                onClick={() => field.onChange(q)}
                                                                className={`cursor-pointer px-4 py-2 rounded-lg border text-sm font-medium transition-all ${field.value === q
                                                                    ? (q === 'Hot' ? 'bg-red-500 text-white border-red-500' : q === 'Warm' ? 'bg-orange-400 text-white border-orange-400' : 'bg-blue-500 text-white border-blue-500')
                                                                    : 'bg-white text-slate-600 hover:bg-slate-50'
                                                                    }`}
                                                            >
                                                                {q === 'Hot' ? '🔥' : q === 'Warm' ? '☀️' : '❄️'} {q}
                                                            </div>
                                                        ))}
                                                    </div>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={form.control}
                                            name="businessType"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel className="block mb-2">Type</FormLabel>
                                                    <div className="flex gap-2">
                                                        {['Service', 'Product'].map((t) => (
                                                            <div
                                                                key={t}
                                                                onClick={() => field.onChange(t)}
                                                                className={`cursor-pointer px-4 py-2 rounded-lg border text-sm font-medium transition-all ${field.value === t
                                                                    ? 'bg-slate-800 text-white border-slate-800'
                                                                    : 'bg-white text-slate-600 hover:bg-slate-50'
                                                                    }`}
                                                            >
                                                                {t === 'Service' ? '🛠️' : '📦'} {t}
                                                            </div>
                                                        ))}
                                                    </div>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    </div>

                                    <div className="space-y-4 rounded-lg bg-slate-50 p-4 border">
                                        <FormField
                                            control={form.control}
                                            name="status"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel className="flex justify-between">
                                                        <span>Pipeline Stage</span>
                                                        <span className="text-xs font-normal text-muted-foreground">Main Status</span>
                                                    </FormLabel>
                                                    <Select
                                                        onValueChange={(val) => {
                                                            field.onChange(val);
                                                            form.setValue("subStatus", "");
                                                        }}
                                                        defaultValue={field.value}
                                                        value={field.value}
                                                    >
                                                        <FormControl>
                                                            <SelectTrigger className="bg-white">
                                                                <SelectValue placeholder="Select Stage" />
                                                            </SelectTrigger>
                                                        </FormControl>
                                                        <SelectContent>
                                                            {Object.entries(STAGE_CONFIG).map(([key, config]) => (
                                                                <SelectItem key={key} value={key}>
                                                                    <div className="flex items-center gap-2">
                                                                        <div className={`w-2 h-2 rounded-full ${config.color.split(' ')[0].replace('bg-', 'bg-')}`} />
                                                                        {config.label}
                                                                    </div>
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />

                                        <FormField
                                            control={form.control}
                                            name="subStatus"
                                            render={({ field }) => {
                                                const currentStage = form.watch("status") as PipelineStage || "New";
                                                const config = STAGE_CONFIG[currentStage];
                                                const options = config?.subStatuses || [];
                                                const isOther = field.value && !options.includes(field.value) && field.value !== "";

                                                return (
                                                    <FormItem>
                                                        <FormLabel className="flex justify-between">
                                                            <span>Current Status</span>
                                                            <span className="text-xs font-normal text-muted-foreground">What's happening now?</span>
                                                        </FormLabel>
                                                        <FormControl>
                                                            <div className="flex flex-wrap gap-2">
                                                                {options.map((option) => (
                                                                    <div
                                                                        key={option}
                                                                        onClick={() => field.onChange(option === field.value ? "" : option)}
                                                                        className={`
                                                                            cursor-pointer px-3 py-1.5 rounded-full text-xs font-medium border transition-all flex items-center gap-1
                                                                            ${field.value === option
                                                                                ? getSubStatusColor(option)
                                                                                : "bg-white text-slate-600 border-slate-200 hover:border-indigo-300 hover:bg-slate-50"
                                                                            }
                                                                        `}
                                                                    >
                                                                        {field.value === option && <CheckCircle2 className="h-3 w-3" />}
                                                                        {option}
                                                                    </div>
                                                                ))}
                                                                {isOther && (
                                                                    <div className="bg-indigo-600 text-white px-3 py-1.5 rounded-full text-xs font-medium border border-indigo-600 flex items-center gap-1">
                                                                        <Pencil className="h-3 w-3" />
                                                                        Custom
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </FormControl>

                                                        {((field.value === "Other") || isOther) && (
                                                            <div className="mt-2">
                                                                <Input
                                                                    placeholder="Type custom status..."
                                                                    value={field.value === "Other" ? "" : field.value}
                                                                    onChange={(e) => field.onChange(e.target.value)}
                                                                    className="bg-white h-8 text-sm"
                                                                />
                                                            </div>
                                                        )}
                                                        <FormMessage />
                                                    </FormItem>
                                                )
                                            }}
                                        />
                                    </div>

                                    {/* Links Section - Inline Design */}
                                    <div className="mt-2 flex flex-col gap-2">
                                        {/* Links List */}
                                        {links.length > 0 && (
                                            <div className="flex flex-col gap-1 pl-1">
                                                {links.map((link: any) => (
                                                    <div key={link.id} className="flex items-center gap-2 group p-1 hover:bg-slate-50 rounded">
                                                        <a
                                                            href={link.url}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="text-xs text-indigo-600 hover:underline truncate flex items-center gap-2 flex-1"
                                                            title={link.url}
                                                        >
                                                            <LinkIcon className="h-3 w-3 text-slate-400 group-hover:text-indigo-500" />
                                                            <span className="font-semibold text-slate-700">{link.title || link.type}</span>
                                                            <span className="text-slate-300 mx-1">•</span>
                                                            <span className="text-slate-400 font-normal truncate flex-1">{link.url}</span>
                                                            <ExternalLink className="h-3 w-3 text-slate-300 opacity-0 group-hover:opacity-100" />
                                                        </a>
                                                        <button
                                                            type="button"
                                                            className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-100 rounded text-red-500"
                                                            onClick={async (e) => {
                                                                e.preventDefault();
                                                                if (!confirm('Delete this link?')) return;
                                                                const res = await fetch(`/api/links?id=${link.id}`, { method: 'DELETE' }).then(r => r.json());
                                                                if (res.success) {
                                                                    setLinks(links.filter((l: any) => l.id !== link.id));
                                                                    toast.success('Link deleted');
                                                                }
                                                            }}
                                                        >
                                                            <Trash2 className="h-3 w-3" />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {!isAddingLink ? (
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                className="w-fit h-6 text-xs text-slate-500 hover:text-indigo-600 px-2 -ml-2 flex items-center gap-1"
                                                onClick={() => setIsAddingLink(true)}
                                            >
                                                <Plus className="h-3 w-3" /> Add Link
                                            </Button>
                                        ) : (
                                            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 animate-in slide-in-from-top-1">
                                                <div className="text-xs font-semibold text-slate-700 mb-2">New Link</div>
                                                <div className="grid grid-cols-2 gap-2 mb-2">
                                                    <Select value={linkType} onValueChange={setLinkType}>
                                                        <SelectTrigger className="h-8 text-xs bg-white">
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="Meeting Recording">Meeting Recording</SelectItem>
                                                            <SelectItem value="Audit Link">Audit Link</SelectItem>
                                                            <SelectItem value="Proposal Link">Proposal Link</SelectItem>
                                                        </SelectContent>
                                                    </Select>

                                                    {linkType === 'Meeting Recording' && (
                                                        <Select value={linkTitle} onValueChange={setLinkTitle}>
                                                            <SelectTrigger className="h-8 text-xs bg-white">
                                                                <SelectValue placeholder="Select Meeting..." />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="Meeting 1">Meeting 1</SelectItem>
                                                                <SelectItem value="Meeting 2">Meeting 2</SelectItem>
                                                                <SelectItem value="Meeting 3">Meeting 3</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    )}
                                                </div>

                                                <div className="flex gap-2">
                                                    <Input
                                                        placeholder="https://..."
                                                        value={linkUrl}
                                                        onChange={e => setLinkUrl(e.target.value)}
                                                        className="h-8 text-xs bg-white flex-1"
                                                    />
                                                </div>

                                                <div className="flex justify-end gap-2 mt-2">
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-7 text-xs"
                                                        onClick={() => setIsAddingLink(false)}
                                                    >
                                                        Cancel
                                                    </Button>
                                                    <Button
                                                        type="button"
                                                        size="sm"
                                                        className="h-7 text-xs bg-indigo-600 hover:bg-indigo-700"
                                                        onClick={(e) => {
                                                            e.preventDefault();
                                                            e.stopPropagation();
                                                            handleAddLink();
                                                        }}
                                                    >
                                                        Attach Link
                                                    </Button>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Notes Section - Timestamped */}
                                    <div className="mt-4 flex flex-col gap-2">
                                        <div className="text-sm font-medium">Notes</div>

                                        {/* Notes List */}
                                        {notes.length > 0 && (
                                            <div className="flex flex-col gap-2 max-h-[200px] overflow-y-auto">
                                                {notes.map((note: any) => (
                                                    <div key={note.id} className="bg-slate-50 p-2 rounded-lg border text-sm group">
                                                        <div className="flex justify-between items-start">
                                                            <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
                                                                {note.stage && <span className="bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded text-xs font-medium">{note.stage}</span>}
                                                                <span>{new Date(note.createdAt).toLocaleString()}</span>
                                                            </div>
                                                            <button
                                                                type="button"
                                                                className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-100 rounded text-red-500"
                                                                onClick={async () => {
                                                                    if (!confirm('Delete this note?')) return;
                                                                    const res = await fetch(`/api/notes?id=${note.id}`, { method: 'DELETE' }).then(r => r.json());
                                                                    if (res.success) {
                                                                        setNotes(notes.filter((n: any) => n.id !== note.id));
                                                                        toast.success('Note deleted');
                                                                    }
                                                                }}
                                                            >
                                                                <Trash2 className="h-3 w-3" />
                                                            </button>
                                                        </div>
                                                        <div className="text-slate-700 whitespace-pre-wrap">{note.content}</div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {!isAddingNote ? (
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                className="w-fit h-6 text-xs text-slate-500 hover:text-indigo-600 px-2 -ml-2 flex items-center gap-1"
                                                onClick={() => setIsAddingNote(true)}
                                            >
                                                <Plus className="h-3 w-3" /> Add Note
                                            </Button>
                                        ) : (
                                            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                                                <div className="mb-2">
                                                    <Select value={noteStage} onValueChange={setNoteStage}>
                                                        <SelectTrigger className="h-8 text-xs bg-white w-full">
                                                            <SelectValue placeholder="Select stage (optional)..." />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="Meeting 1">Meeting 1</SelectItem>
                                                            <SelectItem value="Meeting 2">Meeting 2</SelectItem>
                                                            <SelectItem value="Meeting 3">Meeting 3</SelectItem>
                                                            <SelectItem value="Other">Other</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                                <Textarea
                                                    placeholder="Write your note..."
                                                    value={noteContent}
                                                    onChange={e => setNoteContent(e.target.value)}
                                                    className="min-h-[80px] text-sm bg-white"
                                                />
                                                <div className="flex justify-end gap-2 mt-2">
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-7 text-xs"
                                                        onClick={() => { setIsAddingNote(false); setNoteContent(""); setNoteStage(""); }}
                                                    >
                                                        Cancel
                                                    </Button>
                                                    <Button
                                                        type="button"
                                                        size="sm"
                                                        className="h-7 text-xs bg-indigo-600 hover:bg-indigo-700"
                                                        onClick={async () => {
                                                            if (!lead || !noteContent) return;
                                                            const res = await fetch('/api/notes', {
                                                                method: 'POST',
                                                                headers: { 'Content-Type': 'application/json' },
                                                                body: JSON.stringify({ leadId: lead.id, stage: noteStage || null, content: noteContent })
                                                            }).then(r => r.json());
                                                            if (res.success && res.note) {
                                                                setNotes([res.note, ...notes]);
                                                                setIsAddingNote(false);
                                                                setNoteContent("");
                                                                setNoteStage("");
                                                                toast.success("Note added");
                                                            } else {
                                                                toast.error("Failed to add note");
                                                            }
                                                        }}
                                                    >
                                                        Save Note
                                                    </Button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </form>
                            </Form>
                        </div>

                        <div className="pt-8 border-t">
                            <h3 className="font-semibold text-lg mb-6 flex items-center gap-3">
                                <span className="bg-indigo-100 text-indigo-600 p-2 rounded-md"><Clock className="h-5 w-5" /></span>
                                Automation Hub
                            </h3>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="bg-slate-50 border rounded-xl p-6 shadow-sm h-fit">
                                    <div className="text-xs font-semibold uppercase text-slate-500 mb-2">Up Next</div>
                                    {lead?.nextNurtureAt ? (
                                        <div>
                                            <div className="flex items-center gap-2 text-indigo-700 font-bold text-lg">
                                                <Timer className="h-5 w-5" />
                                                <Countdown date={lead.nextNurtureAt} />
                                            </div>
                                            <div className="text-sm text-slate-600 mt-1">
                                                Scheduled for: {new Date(lead.nextNurtureAt).toLocaleString()}
                                            </div>
                                            <div className="mt-2 text-sm bg-indigo-100 text-indigo-700 px-2 py-1 rounded inline-block">
                                                Stage {lead.nurtureStage ? lead.nurtureStage + 1 : 1}
                                            </div>
                                            <div className="flex gap-2 mt-3">
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="text-xs h-7 bg-white hover:bg-amber-50 hover:text-amber-700 hover:border-amber-300"
                                                    onClick={handleFastForward}
                                                >
                                                    <FastForward className="h-3 w-3 mr-1" />
                                                    Fast Forward
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="text-xs h-7 bg-white hover:bg-red-50 hover:text-red-700 hover:border-red-300"
                                                    onClick={async () => {
                                                        if (!lead || !confirm('Stop this automation? This cannot be undone.')) return;
                                                        const res = await fetch(`/api/leads/${lead.id}/stop-automation`, { method: 'POST' }).then(r => r.json());
                                                        if (res.success) {
                                                            toast.success('Automation stopped');
                                                            router.refresh();
                                                        } else {
                                                            toast.error('Failed to stop: ' + (res.error || 'Unknown error'));
                                                        }
                                                    }}
                                                >
                                                    <StopCircle className="h-3 w-3 mr-1" />
                                                    Stop
                                                </Button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="text-slate-500 text-sm">All automation caught up.</div>
                                    )}
                                </div>

                                <div className="space-y-2">
                                    <div className="text-xs font-semibold uppercase text-slate-500">Execution Log</div>
                                    <div className="max-h-[200px] overflow-y-auto space-y-2 pr-1">
                                        {logs.filter(l => ['EMAIL', 'SMS'].includes(l.type)).length === 0 && <div className="text-sm text-slate-400 italic">No automated actions sent yet.</div>}

                                        {logs.filter(l => ['EMAIL', 'SMS'].includes(l.type)).map((log: any) => (
                                            <Popover key={log.id}>
                                                <PopoverTrigger asChild>
                                                    <div className="group border rounded-lg p-2.5 hover:bg-slate-50 cursor-pointer transition-colors flex items-center gap-3 bg-white">
                                                        <div className={`p-1.5 rounded-md ${log.type === 'EMAIL' ? 'bg-purple-100 text-purple-600' : 'bg-green-100 text-green-600'}`}>
                                                            {log.type === 'EMAIL' ? <Mail className="h-3.5 w-3.5" /> : <MessageSquare className="h-3.5 w-3.5" />}
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="font-medium text-sm truncate">{log.title}</div>
                                                            <div className="text-xs text-slate-400">{new Date(log.createdAt).toLocaleString()}</div>
                                                        </div>
                                                        <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-slate-500 flex-shrink-0" />
                                                    </div>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-[400px] max-h-[400px] overflow-y-auto">
                                                    <div className="text-sm font-semibold mb-2 border-b pb-2">{log.title}</div>
                                                    <div className="text-sm text-slate-600 whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: log.content }} />
                                                </PopoverContent>
                                            </Popover>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Section: Automation Suggestions */}
                        {lead && suggestedWorkflows.length > 0 && (
                            <div className="mt-10 pt-8 border-t">
                                <div className="flex items-center justify-between mb-6">
                                    <div className="flex items-center gap-3">
                                        <div className="bg-blue-100 p-2.5 rounded-xl">
                                            <Zap className="h-5 w-5 text-blue-600 fill-blue-500" />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-lg text-slate-800">Suggested Sequences</h3>
                                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Available automations for this stage</p>
                                        </div>
                                    </div>
                                    <Badge variant="secondary" className="bg-blue-50 text-blue-600 border-blue-100">{suggestedWorkflows.length} Found</Badge>
                                </div>
                                <div className="grid grid-cols-1 gap-3">
                                    {suggestedWorkflows.map((workflow) => (
                                        <div
                                            key={workflow.id}
                                            className="group flex items-center justify-between p-4 bg-white rounded-2xl border-2 border-slate-50 hover:border-blue-200 transition-all duration-300 shadow-sm hover:shadow-md"
                                        >
                                            <div className="flex items-center gap-4">
                                                <div className="p-2.5 rounded-xl bg-slate-50 text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
                                                    <Play className="h-5 w-5 fill-current" />
                                                </div>
                                                <div>
                                                    <p className="font-bold text-slate-900 leading-tight mb-0.5">{workflow.name}</p>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
                                                            {workflow._count?.steps || 0} STEPS
                                                        </span>
                                                        <Separator orientation="vertical" className="h-2 bg-slate-200" />
                                                        <span className="text-[10px] font-extrabold uppercase tracking-widest text-blue-500">
                                                            {workflow.pipelineStage || 'GENERAL'}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                            <Button
                                                size="sm"
                                                onClick={() => runWorkflow(workflow.id)}
                                                disabled={runningWorkflow === workflow.id}
                                                className={`h-9 px-5 rounded-xl shadow-lg shadow-blue-100 border-none transition-all duration-300 ${runningWorkflow === workflow.id
                                                    ? 'bg-slate-100 text-slate-400'
                                                    : 'bg-blue-600 hover:bg-black text-white'
                                                    }`}
                                            >
                                                {runningWorkflow === workflow.id ? (
                                                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" />
                                                ) : (
                                                    <Zap className="h-3.5 w-3.5 mr-2" />
                                                )}
                                                {runningWorkflow === workflow.id ? 'Running...' : 'Run Automation'}
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                    </div>

                    <div className="lg:col-span-4 overflow-y-auto pl-2 border-l">
                        <h3 className="font-semibold text-lg mb-6 flex items-center gap-3">
                            <span className="bg-slate-100 p-2 rounded-md"><ScrollText className="h-5 w-5 text-slate-700" /></span>
                            History & Activity
                        </h3>
                        {lead && <LeadTimeline lead={lead} logs={logs} />}
                    </div>
                </div>
            </DialogContent>

            {/* SMS Compose Dialog */}
            <Dialog open={showSmsCompose} onOpenChange={setShowSmsCompose}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <MessageSquare className="h-5 w-5 text-green-600" />
                            Send SMS to {lead?.name}
                        </DialogTitle>
                        <DialogDescription>Send a text message to {lead?.phone}</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 pt-4">
                        <div>
                            <div className="flex items-center justify-between mb-1">
                                <Label>Message</Label>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button variant="outline" size="sm" className="h-6 text-xs gap-1">
                                            <Plus className="h-3 w-3" /> Insert Variable
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-48 p-1" align="end">
                                        <div className="text-xs font-medium text-muted-foreground px-2 py-1">Variables</div>
                                        {getAvailableVariables().map(v => (
                                            <button
                                                key={v.key}
                                                className="w-full text-left px-2 py-1.5 text-sm hover:bg-slate-100 rounded flex justify-between items-center"
                                                onClick={() => insertVariable(v.key, setSmsMessage, smsMessage)}
                                            >
                                                <span>{v.label}</span>
                                                <code className="text-xs text-muted-foreground">{v.key}</code>
                                            </button>
                                        ))}
                                    </PopoverContent>
                                </Popover>
                            </div>
                            <Textarea
                                value={smsMessage}
                                onChange={(e) => setSmsMessage(e.target.value)}
                                placeholder="Type your SMS message... Use {name}, {audit_link}, etc."
                                className="h-[150px] mt-1"
                            />
                            <p className="text-xs text-slate-400 mt-1">{smsMessage.length} characters</p>
                        </div>
                        <div className="flex justify-end gap-2">
                            <Button variant="outline" onClick={() => setShowSmsCompose(false)}>Cancel</Button>
                            <Button
                                className="bg-green-600 hover:bg-green-700"
                                disabled={sendingSms || !smsMessage.trim()}
                                onClick={async () => {
                                    if (!lead?.phone) return;
                                    setSendingSms(true);
                                    try {
                                        const finalMessage = replaceVariables(smsMessage);
                                        const res = await fetch('/api/send-sms', {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({ to: lead.phone, body: finalMessage, leadId: lead.id, leadName: lead.name })
                                        }).then(r => r.json());
                                        if (res.success) {
                                            toast.success('SMS sent successfully!');
                                            setShowSmsCompose(false);
                                            setSmsMessage('');
                                            // Refresh logs
                                            getLeadLogs(lead.id).then(setLogs);
                                        } else {
                                            toast.error('Failed to send SMS: ' + (res.error || 'Unknown error'));
                                        }
                                    } catch (e) {
                                        toast.error('Error sending SMS');
                                    }
                                    setSendingSms(false);
                                }}
                            >
                                {sendingSms ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <MessageSquare className="h-4 w-4 mr-2" />}
                                Send SMS
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Email Compose Dialog */}
            <Dialog open={showEmailCompose} onOpenChange={setShowEmailCompose}>
                <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Mail className="h-5 w-5 text-purple-600" />
                            Send Email to {lead?.name}
                        </DialogTitle>
                        <DialogDescription>Compose and send an email to {lead?.email}</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 pt-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label className="text-xs">Sender Name</Label>
                                <Input
                                    value={emailSenderName}
                                    onChange={(e) => setEmailSenderName(e.target.value)}
                                    placeholder="e.g., Mehrdad from Mehrana"
                                    className="mt-1"
                                />
                            </div>
                            <div>
                                <Label className="text-xs">Reply-To</Label>
                                <Input
                                    value={emailReplyTo}
                                    onChange={(e) => setEmailReplyTo(e.target.value)}
                                    placeholder="e.g., support@mehrana.agency"
                                    className="mt-1"
                                />
                            </div>
                        </div>
                        <div>
                            <Label className="text-xs">Subject</Label>
                            <Input
                                value={emailSubject}
                                onChange={(e) => setEmailSubject(e.target.value)}
                                placeholder="Email subject..."
                                className="mt-1"
                            />
                        </div>
                        <div>
                            <div className="flex items-center justify-between mb-1">
                                <Label className="text-xs">Body</Label>
                                <div className="flex items-center gap-3">
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <Button variant="outline" size="sm" className="h-6 text-xs gap-1">
                                                <Plus className="h-3 w-3" /> Insert Variable
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-48 p-1" align="end">
                                            <div className="text-xs font-medium text-muted-foreground px-2 py-1">Variables</div>
                                            {getAvailableVariables().map(v => (
                                                <button
                                                    key={v.key}
                                                    className="w-full text-left px-2 py-1.5 text-sm hover:bg-slate-100 rounded flex justify-between items-center"
                                                    onClick={() => insertVariable(v.key, setEmailBody, emailBody)}
                                                >
                                                    <span>{v.label}</span>
                                                    <code className="text-xs text-muted-foreground">{v.key}</code>
                                                </button>
                                            ))}
                                        </PopoverContent>
                                    </Popover>
                                    <label className="flex items-center gap-2 text-xs cursor-pointer">
                                        <Checkbox
                                            checked={emailIncludeSignature}
                                            onCheckedChange={(checked) => setEmailIncludeSignature(checked as boolean)}
                                        />
                                        Include Signature
                                    </label>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setEmailPreview(!emailPreview)}
                                        className="h-6 text-xs gap-1"
                                    >
                                        {emailPreview ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                                        {emailPreview ? 'Edit' : 'Preview'}
                                    </Button>
                                </div>
                            </div>
                            {emailPreview ? (
                                <div
                                    className="border rounded-lg p-4 min-h-[200px] bg-white prose prose-sm max-w-none"
                                    dangerouslySetInnerHTML={{
                                        __html: emailBody.replace(/\n/g, '<br/>') +
                                            (emailIncludeSignature ? '<br/><br/>' + (signature || '<em class="text-gray-400">[Signature]</em>') : '')
                                    }}
                                />
                            ) : (
                                <Textarea
                                    value={emailBody}
                                    onChange={(e) => setEmailBody(e.target.value)}
                                    placeholder="Write your email here..."
                                    className="h-[200px] mt-1"
                                />
                            )}
                        </div>
                        <div className="flex justify-end gap-2">
                            <Button variant="outline" onClick={() => setShowEmailCompose(false)}>Cancel</Button>
                            <Button
                                className="bg-purple-600 hover:bg-purple-700"
                                disabled={sendingEmail || !emailSubject.trim() || !emailBody.trim()}
                                onClick={async () => {
                                    if (!lead?.email) return;
                                    setSendingEmail(true);
                                    try {
                                        const finalSubject = replaceVariables(emailSubject);
                                        const processedBody = replaceVariables(emailBody);
                                        const finalBody = emailIncludeSignature ? processedBody + '<br/><br/>' + signature : processedBody;
                                        const res = await fetch('/api/send-email', {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({
                                                to: lead.email,
                                                subject: finalSubject,
                                                html: finalBody.replace(/\n/g, '<br/>'),
                                                from: emailSenderName || undefined,
                                                replyTo: emailReplyTo || undefined,
                                                leadId: lead.id,
                                                leadName: lead.name
                                            })
                                        }).then(r => r.json());
                                        if (res.success) {
                                            toast.success('Email sent successfully!');
                                            setShowEmailCompose(false);
                                            setEmailSubject('');
                                            setEmailBody('');
                                            // Refresh logs
                                            getLeadLogs(lead.id).then(setLogs);
                                        } else {
                                            toast.error('Failed to send email: ' + (res.error || 'Unknown error'));
                                        }
                                    } catch (e) {
                                        toast.error('Error sending email');
                                    }
                                    setSendingEmail(false);
                                }}
                            >
                                {sendingEmail ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Mail className="h-4 w-4 mr-2" />}
                                Send Email
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </Dialog>
    )
}

function UserIcon({ className }: { className?: string }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
    )
}

function ScrollText({ className }: { className?: string }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M15 12h-5" /><path d="M15 8h-5" /><path d="M19 17V5a2 2 0 0 0-2-2H4" /><path d="M8 21h12a2 2 0 0 0 2-2v-1a1 1 0 0 0-1-1H11a1 1 0 0 0-1 1v1a2 2 0 0 0 2 2Z" /></svg>
    )
}

function Countdown({ date }: { date: Date | string }) {
    const [text, setText] = useState("")

    useEffect(() => {
        const target = new Date(date)
        const update = () => {
            const now = new Date()
            const diff = target.getTime() - now.getTime()

            if (diff <= 0) {
                setText("Processing...")
                return
            }

            const hours = Math.floor(diff / (1000 * 60 * 60))
            const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
            const seconds = Math.floor((diff % (1000 * 60)) / 1000)

            setText(`${hours}h ${minutes}m ${seconds}s`)
        }

        update()
        const interval = setInterval(update, 1000)
        return () => clearInterval(interval)
    }, [date])

    return <span>{text}</span>
}
