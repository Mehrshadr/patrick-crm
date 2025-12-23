
"use client"

import { useState, useEffect } from "react"
import { format, isToday, isTomorrow, isPast, isFuture } from "date-fns"
import { CheckSquare, Plus, Calendar as CalendarIcon, Filter, Search, MoreHorizontal, Trash2, CheckCircle2, Circle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { TaskDialog } from "./task-dialog"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

export interface Task {
    id: number
    title: string
    description?: string
    dueDate: string
    status: "PENDING" | "COMPLETED" | "CANCELLED"
    priority: "LOW" | "NORMAL" | "HIGH"
    lead?: {
        id: number
        name: string
    }
}

export function TasksTab() {
    const [tasks, setTasks] = useState<Task[]>([])
    const [loading, setLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState("")
    const [filter, setFilter] = useState<"all" | "pending" | "completed">("pending")
    const [dialogOpen, setDialogOpen] = useState(false)
    const [editingTask, setEditingTask] = useState<Task | null>(null)

    useEffect(() => {
        fetchTasks()
    }, [])

    async function fetchTasks() {
        setLoading(true)
        try {
            const res = await fetch("/api/tasks")
            const data = await res.json()
            if (Array.isArray(data)) {
                setTasks(data)
            } else {
                setTasks([])
                console.error("Tasks API returned non-array:", data)
            }
        } catch (error) {
            toast.error("Failed to fetch tasks")
            setTasks([])
        } finally {
            setLoading(false)
        }
    }

    async function toggleTaskStatus(task: Task) {
        const newStatus = task.status === "COMPLETED" ? "PENDING" : "COMPLETED"
        // Optimistic update
        setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: newStatus } : t))

        try {
            await fetch(`/api/tasks/${task.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: newStatus })
            })
            toast.success(newStatus === "COMPLETED" ? "Task completed!" : "Task re-opened")
        } catch (error) {
            toast.error("Failed to update task")
            fetchTasks() // Revert
        }
    }

    async function deleteTask(id: number) {
        if (!confirm("Are you sure you want to delete this task?")) return

        setTasks(prev => prev.filter(t => t.id !== id))
        try {
            await fetch(`/api/tasks/${id}`, {
                method: "DELETE"
            })
            toast.success("Task deleted")
        } catch (error) {
            toast.error("Failed to delete task")
            fetchTasks()
        }
    }

    const filteredTasks = tasks.filter(task => {
        if (filter === "pending" && task.status !== "PENDING") return false
        if (filter === "completed" && task.status !== "COMPLETED") return false
        if (searchQuery && !task.title.toLowerCase().includes(searchQuery.toLowerCase())) return false
        return true
    })

    // Grouping
    const todayTasks = filteredTasks.filter(t => isToday(new Date(t.dueDate)))
    const overdueTasks = filteredTasks.filter(t => isPast(new Date(t.dueDate)) && !isToday(new Date(t.dueDate)) && t.status === "PENDING")
    const upcomingTasks = filteredTasks.filter(t => isFuture(new Date(t.dueDate)))

    return (
        <div className="flex flex-col h-[calc(100vh-140px)] gap-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 bg-white p-2 rounded-lg border shadow-sm flex-1 max-w-md">
                    <Search className="h-4 w-4 text-slate-400" />
                    <Input
                        placeholder="Search tasks..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="border-none shadow-none focus-visible:ring-0 h-auto p-0"
                    />
                </div>

                <div className="flex items-center gap-2">
                    <Tabs value={filter} onValueChange={(v: any) => setFilter(v)} className="bg-slate-100 p-1 rounded-lg">
                        <TabsList>
                            <TabsTrigger value="all">All</TabsTrigger>
                            <TabsTrigger value="pending">Pending</TabsTrigger>
                            <TabsTrigger value="completed">Completed</TabsTrigger>
                        </TabsList>
                    </Tabs>

                    <Button onClick={() => { setEditingTask(null); setDialogOpen(true) }} className="gap-2">
                        <Plus className="h-4 w-4" />
                        New Task
                    </Button>
                </div>
            </div>

            <div className="flex-1 overflow-auto space-y-8 pr-2">
                {loading ? (
                    <div className="text-center py-10 text-slate-400">Loading tasks...</div>
                ) : (
                    <>
                        {filter === 'pending' && overdueTasks.length > 0 && (
                            <TaskGroup title="Overdue" tasks={overdueTasks} variant="danger" onToggle={toggleTaskStatus} onEdit={(t) => { setEditingTask(t); setDialogOpen(true) }} onDelete={deleteTask} />
                        )}

                        <TaskGroup title="Today" tasks={todayTasks} variant="primary" onToggle={toggleTaskStatus} onEdit={(t) => { setEditingTask(t); setDialogOpen(true) }} onDelete={deleteTask} />

                        <TaskGroup title="Upcoming" tasks={upcomingTasks} variant="default" onToggle={toggleTaskStatus} onEdit={(t) => { setEditingTask(t); setDialogOpen(true) }} onDelete={deleteTask} />

                        {/* If filtering all/completed, just show list or handle differently? */}
                        {filter !== 'pending' && filteredTasks.length === 0 && (
                            <div className="text-center py-10 text-slate-400">No tasks found</div>
                        )}
                    </>
                )}
            </div>

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingTask ? 'Edit Task' : 'New Task'}</DialogTitle>
                    </DialogHeader>
                    <TaskDialog
                        initialData={editingTask}
                        onSuccess={() => {
                            setDialogOpen(false)
                            fetchTasks()
                        }}
                    />
                </DialogContent>
            </Dialog>
        </div>
    )
}

function TaskGroup({ title, tasks, variant = "default", onToggle, onEdit, onDelete }: any) {
    if (tasks.length === 0) return null

    const colors = {
        danger: "text-red-600 bg-red-50 border-red-200",
        primary: "text-blue-600 bg-blue-50 border-blue-200",
        default: "text-slate-600 bg-slate-50 border-slate-200"
    }

    return (
        <div className="space-y-3">
            <h3 className={cn("font-medium text-sm flex items-center gap-2 px-2 py-1 rounded-md w-fit", colors[variant as keyof typeof colors])}>
                {title}
                <Badge variant="secondary" className="bg-white/50 text-inherit border-none h-5 px-1.5 min-w-[1.5rem]">{tasks.length}</Badge>
            </h3>

            <div className="grid gap-2">
                {tasks.map((task: Task) => (
                    <Card key={task.id} className={cn("group hover:shadow-md transition-all", task.status === 'COMPLETED' && "opacity-60 bg-slate-50")}>
                        <CardContent className="p-4 flex items-start gap-4">
                            <button
                                onClick={() => onToggle(task)}
                                className={cn("mt-1 h-5 w-5 rounded-full border-2 flex items-center justify-center transition-colors",
                                    task.status === 'COMPLETED' ? "bg-green-500 border-green-500 text-white" : "border-slate-300 hover:border-blue-500"
                                )}
                            >
                                {task.status === 'COMPLETED' && <CheckCircle2 className="h-3.5 w-3.5" />}
                            </button>

                            <div className="flex-1 space-y-1">
                                <div className={cn("font-medium text-sm", task.status === 'COMPLETED' && "line-through text-slate-500")}>
                                    {task.title}
                                </div>
                                {task.description && (
                                    <div className="text-xs text-slate-500 line-clamp-2">{task.description}</div>
                                )}
                                <div className="flex items-center gap-3 text-xs text-slate-400 mt-2">
                                    <div className="flex items-center gap-1">
                                        <CalendarIcon className="h-3 w-3" />
                                        <span>{format(new Date(task.dueDate), 'MMM d, h:mm a')}</span>
                                    </div>
                                    {task.lead && (
                                        <div className="flex items-center gap-1 text-indigo-500 bg-indigo-50 px-1.5 py-0.5 rounded">
                                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                                            {task.lead.name}
                                        </div>
                                    )}
                                    {task.priority !== 'NORMAL' && (
                                        <Badge variant="outline" className={cn("h-5 text-[10px]", task.priority === 'HIGH' ? "text-red-500 border-red-200 bg-red-50" : "text-slate-500")}>
                                            {task.priority}
                                        </Badge>
                                    )}
                                </div>
                            </div>

                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => onEdit(task)}>Edit</DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => onDelete(task.id)} className="text-red-600">Delete</DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    )
}
