
"use client"

import { useState, useEffect } from "react"
import { format, isToday, isTomorrow, isPast, isFuture } from "date-fns"
import { CheckSquare, Plus, Calendar as CalendarIcon, Filter, Search, MoreHorizontal, Trash2, CheckCircle2, Circle, Pencil, X } from "lucide-react"
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

    // Stats
    const stats = {
        total: tasks.length,
        pending: tasks.filter(t => t.status === 'PENDING').length,
        completed: tasks.filter(t => t.status === 'COMPLETED').length,
        overdue: overdueTasks.length
    }

    const [showSearch, setShowSearch] = useState(false)

    return (
        <div className="flex flex-col h-[calc(100vh-140px)] gap-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Tabs value={filter} onValueChange={(v: any) => setFilter(v)}>
                        <TabsList>
                            <TabsTrigger value="all">All</TabsTrigger>
                            <TabsTrigger value="pending">Pending</TabsTrigger>
                            <TabsTrigger value="completed">Completed</TabsTrigger>
                        </TabsList>
                    </Tabs>
                </div>

                <div className="flex items-center gap-2">
                    {showSearch ? (
                        <div className="flex items-center gap-2">
                            <Input
                                placeholder="Search tasks..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-48 h-9"
                                autoFocus
                            />
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-9 w-9"
                                onClick={() => { setShowSearch(false); setSearchQuery("") }}
                            >
                                <X className="h-4 w-4" />
                            </Button>
                        </div>
                    ) : (
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9"
                            onClick={() => setShowSearch(true)}
                        >
                            <Search className="h-4 w-4" />
                        </Button>
                    )}

                    <Button onClick={() => { setEditingTask(null); setDialogOpen(true) }} size="sm">
                        <Plus className="h-4 w-4 mr-1" />
                        New Task
                    </Button>
                </div>
            </div>

            {/* Stats - Compact */}
            <div className="grid grid-cols-4 gap-3">
                <Card className="border-slate-200">
                    <CardContent className="p-3 flex items-center justify-between">
                        <div>
                            <p className="text-xs text-muted-foreground">Total</p>
                            <p className="text-lg font-bold">{stats.total}</p>
                        </div>
                        <CheckSquare className="h-4 w-4 text-muted-foreground" />
                    </CardContent>
                </Card>
                <Card className="border-blue-200 bg-blue-50/50">
                    <CardContent className="p-3 flex items-center justify-between">
                        <div>
                            <p className="text-xs text-blue-600">Pending</p>
                            <p className="text-lg font-bold text-blue-700">{stats.pending}</p>
                        </div>
                        <Circle className="h-4 w-4 text-blue-500" />
                    </CardContent>
                </Card>
                <Card className="border-green-200 bg-green-50/50">
                    <CardContent className="p-3 flex items-center justify-between">
                        <div>
                            <p className="text-xs text-green-600">Completed</p>
                            <p className="text-lg font-bold text-green-700">{stats.completed}</p>
                        </div>
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                    </CardContent>
                </Card>
                <Card className="border-red-200 bg-red-50/50">
                    <CardContent className="p-3 flex items-center justify-between">
                        <div>
                            <p className="text-xs text-red-600">Overdue</p>
                            <p className="text-lg font-bold text-red-700">{stats.overdue}</p>
                        </div>
                        <CalendarIcon className="h-4 w-4 text-red-500" />
                    </CardContent>
                </Card>
            </div>

            {/* Task Lists */}
            <div className="flex-1 overflow-auto space-y-6 pr-1">
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                        <div className="bg-slate-100 rounded-full p-4 mb-4">
                            <CheckSquare className="h-8 w-8 text-slate-400 animate-pulse" />
                        </div>
                        <p className="text-slate-500 font-medium">Loading tasks...</p>
                    </div>
                ) : filteredTasks.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                        <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-2xl p-8 mb-4 border-2 border-dashed border-slate-200">
                            <CheckSquare className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                            <p className="text-slate-600 font-semibold text-lg">No tasks found</p>
                            <p className="text-slate-400 text-sm mt-1">Create your first task to get started</p>
                        </div>
                        <Button
                            onClick={() => { setEditingTask(null); setDialogOpen(true) }}
                            variant="outline"
                            className="gap-2 border-slate-300 hover:border-blue-500 hover:text-blue-600"
                        >
                            <Plus className="h-4 w-4" />
                            Create Task
                        </Button>
                    </div>
                ) : (
                    <>
                        {filter === 'pending' && overdueTasks.length > 0 && (
                            <TaskGroup title="Overdue" tasks={overdueTasks} variant="danger" onToggle={toggleTaskStatus} onEdit={(t: Task) => { setEditingTask(t); setDialogOpen(true) }} onDelete={deleteTask} />
                        )}

                        <TaskGroup title="Today" tasks={todayTasks} variant="primary" onToggle={toggleTaskStatus} onEdit={(t: Task) => { setEditingTask(t); setDialogOpen(true) }} onDelete={deleteTask} />

                        <TaskGroup title="Upcoming" tasks={upcomingTasks} variant="default" onToggle={toggleTaskStatus} onEdit={(t: Task) => { setEditingTask(t); setDialogOpen(true) }} onDelete={deleteTask} />
                    </>
                )}
            </div>

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="sm:max-w-md">
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
        danger: {
            header: "from-red-500 to-rose-600",
            text: "text-red-700",
            bg: "bg-red-50/50",
            border: "border-red-100",
            badge: "bg-red-100 text-red-700"
        },
        primary: {
            header: "from-blue-500 to-indigo-600",
            text: "text-blue-700",
            bg: "bg-blue-50/50",
            border: "border-blue-100",
            badge: "bg-blue-100 text-blue-700"
        },
        default: {
            header: "from-slate-500 to-slate-600",
            text: "text-slate-700",
            bg: "bg-slate-50/50",
            border: "border-slate-100",
            badge: "bg-slate-100 text-slate-700"
        }
    }

    const colorScheme = colors[variant as keyof typeof colors]

    return (
        <div className="space-y-3">
            {/* Section Header */}
            <div className="flex items-center gap-3">
                <div className={cn("h-1 w-12 rounded-full bg-gradient-to-r", colorScheme.header)} />
                <h3 className={cn("font-bold text-base uppercase tracking-wide", colorScheme.text)}>
                    {title}
                </h3>
                <Badge variant="secondary" className={cn("text-xs font-semibold", colorScheme.badge)}>
                    {tasks.length}
                </Badge>
            </div>

            {/* Task Cards */}
            <div className="grid gap-3">
                {tasks.map((task: Task) => (
                    <Card
                        key={task.id}
                        className={cn(
                            "group hover:shadow-lg hover:scale-[1.01] transition-all duration-200 border-l-4",
                            task.status === 'COMPLETED'
                                ? "opacity-60 bg-slate-50/50 border-l-green-400"
                                : cn("bg-white/80 backdrop-blur-sm", colorScheme.border.replace('border-', 'border-l-'))
                        )}
                    >
                        <CardContent className="p-5">
                            <div className="flex items-start gap-4">
                                {/* Checkbox */}
                                <button
                                    onClick={() => onToggle(task)}
                                    className={cn(
                                        "mt-0.5 h-6 w-6 rounded-full border-2 flex items-center justify-center transition-all duration-200 shrink-0",
                                        task.status === 'COMPLETED'
                                            ? "bg-gradient-to-br from-green-500 to-emerald-600 border-green-500 text-white shadow-lg shadow-green-500/30"
                                            : "border-slate-300 hover:border-blue-500 hover:scale-110"
                                    )}
                                >
                                    {task.status === 'COMPLETED' && <CheckCircle2 className="h-4 w-4" />}
                                </button>

                                {/* Content */}
                                <div className="flex-1 min-w-0 space-y-2">
                                    <div className={cn(
                                        "font-semibold text-base leading-tight",
                                        task.status === 'COMPLETED' && "line-through text-slate-500"
                                    )}>
                                        {task.title}
                                    </div>

                                    {task.description && (
                                        <p className="text-sm text-slate-600 line-clamp-2 leading-relaxed">
                                            {task.description}
                                        </p>
                                    )}

                                    {/* Metadata */}
                                    <div className="flex items-center gap-3 flex-wrap">
                                        <div className="flex items-center gap-1.5 text-xs text-slate-500 bg-slate-100 px-2.5 py-1 rounded-md">
                                            <CalendarIcon className="h-3.5 w-3.5" />
                                            <span className="font-medium">{format(new Date(task.dueDate), 'MMM d, h:mm a')}</span>
                                        </div>

                                        {task.lead && (
                                            <div className="flex items-center gap-1.5 text-xs text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-md font-medium">
                                                <span className="w-2 h-2 rounded-full bg-indigo-500" />
                                                {task.lead.name}
                                            </div>
                                        )}

                                        {task.priority !== 'NORMAL' && (
                                            <Badge
                                                variant="outline"
                                                className={cn(
                                                    "text-xs font-bold border-2",
                                                    task.priority === 'HIGH'
                                                        ? "text-red-600 border-red-300 bg-red-50"
                                                        : "text-amber-600 border-amber-300 bg-amber-50"
                                                )}
                                            >
                                                {task.priority}
                                            </Badge>
                                        )}
                                    </div>
                                </div>

                                {/* Actions */}
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-slate-100"
                                        >
                                            <MoreHorizontal className="h-4 w-4" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="w-32">
                                        <DropdownMenuItem onClick={() => onEdit(task)} className="cursor-pointer">
                                            <Pencil className="h-3.5 w-3.5 mr-2" />
                                            Edit
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                            onClick={() => onDelete(task.id)}
                                            className="text-red-600 cursor-pointer focus:text-red-600"
                                        >
                                            <Trash2 className="h-3.5 w-3.5 mr-2" />
                                            Delete
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    )
}
