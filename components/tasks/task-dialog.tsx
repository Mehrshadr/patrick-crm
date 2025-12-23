
"use client"

import { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { cn } from "@/lib/utils"
import { CalendarIcon, Loader2, Search } from "lucide-react"
import { format } from "date-fns"
import { toast } from "sonner"
import { Task } from "./tasks-tab"

const formSchema = z.object({
    title: z.string().min(1, "Title is required"),
    description: z.string().optional(),
    dueDate: z.date(),
    time: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format (HH:MM)"),
    priority: z.enum(["LOW", "NORMAL", "HIGH"]),
    leadId: z.string().optional() // We'll store ID as string in form
})

interface TaskDialogProps {
    initialData?: Task | null
    onSuccess: () => void
}

export function TaskDialog({ initialData, onSuccess }: TaskDialogProps) {
    const [leads, setLeads] = useState<any[]>([])
    const [loadingLeads, setLoadingLeads] = useState(false)
    const [submitting, setSubmitting] = useState(false)

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
        // Fetch leads for the dropdown
        async function fetchLeads() {
            setLoadingLeads(true)
            try {
                // We might need a lightweight endpoint for lead search, but GET /api/leads works for now if not too large
                // Or use a search param
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

    async function onSubmit(values: z.infer<typeof formSchema>) {
        setSubmitting(true)
        try {
            // Combine date and time
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
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                    control={form.control}
                    name="title"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Title</FormLabel>
                            <FormControl>
                                <Input placeholder="Follow up with..." {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <div className="grid grid-cols-2 gap-4">
                    <FormField
                        control={form.control}
                        name="dueDate"
                        render={({ field }) => (
                            <FormItem className="flex flex-col">
                                <FormLabel>Date</FormLabel>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <FormControl>
                                            <Button
                                                variant={"outline"}
                                                className={cn(
                                                    "w-full pl-3 text-left font-normal",
                                                    !field.value && "text-muted-foreground"
                                                )}
                                            >
                                                {field.value ? (
                                                    format(field.value, "PPP")
                                                ) : (
                                                    <span>Pick a date</span>
                                                )}
                                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
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

                    <FormField
                        control={form.control}
                        name="time"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Time</FormLabel>
                                <FormControl>
                                    <Input type="time" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <FormField
                        control={form.control}
                        name="priority"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Priority</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select priority" />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        <SelectItem value="LOW">Low</SelectItem>
                                        <SelectItem value="NORMAL">Normal</SelectItem>
                                        <SelectItem value="HIGH">High</SelectItem>
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    <FormField
                        control={form.control}
                        name="leadId"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Link to Lead (Optional)</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl>
                                        <SelectTrigger>
                                            <SelectValue placeholder={initialData?.lead?.name || "Select lead"} />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        {/* We might filter or limit this list if it's huge */}
                                        <div className="max-h-[200px] overflow-y-auto">
                                            {leads.map(lead => (
                                                <SelectItem key={lead.id} value={lead.id.toString()}>
                                                    {lead.name}
                                                </SelectItem>
                                            ))}
                                            {leads.length === 0 && (
                                                <div className="p-2 text-sm text-center text-muted-foreground">No leads found</div>
                                            )}
                                        </div>
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>

                <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Description</FormLabel>
                            <FormControl>
                                <Textarea placeholder="Details..." {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <div className="flex justify-end gap-2 pt-2">
                    <Button type="submit" disabled={submitting}>
                        {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Save Task
                    </Button>
                </div>
            </form>
        </Form>
    )
}
