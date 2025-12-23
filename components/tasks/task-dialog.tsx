
"use client"

import { useState, useEffect, useMemo } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import { CalendarIcon, Loader2, Search, AlertCircle, AlertTriangle, Minus, Clock, User } from "lucide-react"
import { format, addMinutes, setHours, setMinutes } from "date-fns"
import { toast } from "sonner"
import { Task } from "./tasks-tab"

const formSchema = z.object({
    title: z.string().min(1, "Title is required"),
    description: z.string().optional(),
    dueDate: z.date(),
    time: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format (HH:MM)"),
    priority: z.enum(["LOW", "NORMAL", "HIGH"]),
    leadId: z.string().optional()
})

interface TaskDialogProps {
    initialData?: Task | null
    onSuccess: () => void
}

// Quick time options
const TIME_OPTIONS = [
    "09:00", "09:30", "10:00", "10:30", "11:00", "11:30",
    "12:00", "12:30", "13:00", "13:30", "14:00", "14:30",
    "15:00", "15:30", "16:00", "16:30", "17:00", "17:30",
    "18:00", "18:30", "19:00", "19:30", "20:00"
]

export function TaskDialog({ initialData, onSuccess }: TaskDialogProps) {
    const [leads, setLeads] = useState<any[]>([])
    const [loadingLeads, setLoadingLeads] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const [leadSearch, setLeadSearch] = useState("")

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            title: initialData?.title || "",
            description: initialData?.description || "",
            dueDate: initialData ? new Date(initialData.dueDate) : new Date(),
            time: initialData ? format(new Date(initialData.dueDate), 'HH:mm') : "09:00",
            priority: initialData?.priority || "NORMAL",
            leadId: initialData?.lead?.id.toString() || undefined
        }
    })

    useEffect(() => {
        async function fetchLeads() {
            setLoadingLeads(true)
            try {
                const res = await fetch("/api/leads")
                const data = await res.json()
                if (data.leads) {
                    setLeads(data.leads)
                }
            } catch (e) {
                console.error("Failed to fetch leads", e)
            } finally {
                setLoadingLeads(false)
            }
        }
        fetchLeads()
    }, [])

    const filteredLeads = useMemo(() => {
        if (!leadSearch.trim()) return leads
        return leads.filter(l =>
            l.name?.toLowerCase().includes(leadSearch.toLowerCase()) ||
            l.email?.toLowerCase().includes(leadSearch.toLowerCase())
        )
    }, [leads, leadSearch])

    const selectedLead = useMemo(() => {
        const id = form.watch("leadId")
        return leads.find(l => l.id.toString() === id) || null
    }, [leads, form.watch("leadId")])

    async function onSubmit(values: z.infer<typeof formSchema>) {
        setSubmitting(true)
        try {
            const date = new Date(values.dueDate)
            const [hours, minutes] = values.time.split(':')
            date.setHours(parseInt(hours), parseInt(minutes))

            const payload = {
                title: values.title,
                description: values.description,
                dueDate: date.toISOString(),
                priority: values.priority,
                leadId: values.leadId ? parseInt(values.leadId) : null
            }

            const url = initialData ? `/api/tasks/${initialData.id}` : "/api/tasks"
            const method = initialData ? "PATCH" : "POST"

            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            })

            if (!res.ok) throw new Error("Failed to save task")

            toast.success(initialData ? "Task updated" : "Task created")
            onSuccess()
        } catch (error) {
            toast.error("Failed to save task")
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                {/* Title */}
                <FormField
                    control={form.control}
                    name="title"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Task Title</FormLabel>
                            <FormControl>
                                <Input placeholder="e.g. Follow up with client" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                {/* Date & Time - Side by Side */}
                <div className="grid grid-cols-2 gap-3">
                    <FormField
                        control={form.control}
                        name="dueDate"
                        render={({ field }) => (
                            <FormItem className="flex flex-col">
                                <FormLabel>Due Date</FormLabel>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <FormControl>
                                            <Button
                                                variant="outline"
                                                className={cn(
                                                    "w-full justify-start text-left font-normal",
                                                    !field.value && "text-muted-foreground"
                                                )}
                                            >
                                                <CalendarIcon className="mr-2 h-4 w-4" />
                                                {field.value ? format(field.value, "MMM d, yyyy") : <span>Pick date</span>}
                                            </Button>
                                        </FormControl>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0" align="start">
                                        <Calendar
                                            mode="single"
                                            selected={field.value}
                                            onSelect={field.onChange}
                                            initialFocus
                                        />
                                    </PopoverContent>
                                </Popover>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    {/* Time Picker - Native Select */}
                    <FormField
                        control={form.control}
                        name="time"
                        render={({ field }) => (
                            <FormItem className="flex flex-col">
                                <FormLabel>Time</FormLabel>
                                <FormControl>
                                    <select
                                        value={field.value}
                                        onChange={(e) => field.onChange(e.target.value)}
                                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                    >
                                        {TIME_OPTIONS.map(time => (
                                            <option key={time} value={time}>{time}</option>
                                        ))}
                                    </select>
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>

                {/* Priority - Icon Based */}
                <FormField
                    control={form.control}
                    name="priority"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Priority</FormLabel>
                            <div className="flex gap-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className={cn(
                                        "flex-1 gap-2",
                                        field.value === "LOW" && "bg-green-50 border-green-300 text-green-700"
                                    )}
                                    onClick={() => field.onChange("LOW")}
                                >
                                    <Minus className="h-4 w-4" />
                                    Low
                                </Button>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className={cn(
                                        "flex-1 gap-2",
                                        field.value === "NORMAL" && "bg-slate-100 border-slate-300 text-slate-700"
                                    )}
                                    onClick={() => field.onChange("NORMAL")}
                                >
                                    <AlertTriangle className="h-4 w-4" />
                                    Normal
                                </Button>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className={cn(
                                        "flex-1 gap-2",
                                        field.value === "HIGH" && "bg-red-50 border-red-300 text-red-700"
                                    )}
                                    onClick={() => field.onChange("HIGH")}
                                >
                                    <AlertCircle className="h-4 w-4" />
                                    High
                                </Button>
                            </div>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                {/* Link to Lead - With Search */}
                <FormField
                    control={form.control}
                    name="leadId"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Link to Lead (Optional)</FormLabel>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <FormControl>
                                        <Button
                                            variant="outline"
                                            className="w-full justify-start text-left font-normal"
                                        >
                                            <User className="mr-2 h-4 w-4" />
                                            {selectedLead?.name || "Select lead..."}
                                        </Button>
                                    </FormControl>
                                </PopoverTrigger>
                                <PopoverContent className="w-[280px] p-0" align="start">
                                    <div className="p-2 border-b">
                                        <div className="relative">
                                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                            <Input
                                                placeholder="Search leads..."
                                                value={leadSearch}
                                                onChange={(e) => setLeadSearch(e.target.value)}
                                                className="pl-8 h-9"
                                            />
                                        </div>
                                    </div>
                                    <ScrollArea className="h-[200px]">
                                        <div className="p-1">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="w-full justify-start font-normal text-muted-foreground"
                                                onClick={() => {
                                                    field.onChange(undefined)
                                                    setLeadSearch("")
                                                }}
                                            >
                                                None
                                            </Button>
                                            {filteredLeads.map(lead => (
                                                <Button
                                                    key={lead.id}
                                                    variant="ghost"
                                                    size="sm"
                                                    className={cn(
                                                        "w-full justify-start font-normal",
                                                        field.value === lead.id.toString() && "bg-slate-100"
                                                    )}
                                                    onClick={() => {
                                                        field.onChange(lead.id.toString())
                                                        setLeadSearch("")
                                                    }}
                                                >
                                                    <span className="truncate">{lead.name}</span>
                                                    {lead.email && (
                                                        <span className="ml-auto text-xs text-muted-foreground truncate max-w-[100px]">
                                                            {lead.email}
                                                        </span>
                                                    )}
                                                </Button>
                                            ))}
                                            {filteredLeads.length === 0 && (
                                                <div className="p-4 text-center text-sm text-muted-foreground">
                                                    No leads found
                                                </div>
                                            )}
                                        </div>
                                    </ScrollArea>
                                </PopoverContent>
                            </Popover>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                {/* Description */}
                <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Notes</FormLabel>
                            <FormControl>
                                <Textarea
                                    placeholder="Additional details..."
                                    className="resize-none h-20"
                                    {...field}
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                {/* Actions */}
                <div className="flex justify-end pt-2">
                    <Button type="submit" disabled={submitting}>
                        {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {initialData ? "Update Task" : "Create Task"}
                    </Button>
                </div>
            </form>
        </Form>
    )
}
