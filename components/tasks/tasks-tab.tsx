"use client"

import { useState, useEffect, useMemo } from "react"
import { format, isToday, isPast, isFuture, isTomorrow, startOfDay, endOfDay } from "date-fns"
import {
    CheckSquare, Plus, Calendar as CalendarIcon, Search, MoreHorizontal,
    Trash2, CheckCircle2, Circle, ArrowUp, ArrowDown, ArrowUpDown,
    Clock, AlertCircle, X, SlidersHorizontal, User, Users
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table"
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem,
    DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuCheckboxItem
} from "@/components/ui/dropdown-menu"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { TaskDialog } from "./task-dialog"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

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
    createdById?: number
}

type SortColumn = 'title' | 'status' | 'priority' | 'dueDate'
type SortDirection = 'asc' | 'desc'
type DateFilter = 'all' | 'today' | 'upcoming' | 'overdue'

export function TasksTab() {
    const [tasks, setTasks] = useState<Task[]>([])
    const [loading, setLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState("")
    const [statusFilter, setStatusFilter] = useState<string[]>(["PENDING"])
    const [priorityFilter, setPriorityFilter] = useState<string[]>([])
    const [dateFilter, setDateFilter] = useState<DateFilter>('today')
    const [onlyMine, setOnlyMine] = useState(true)
    const [dialogOpen, setDialogOpen] = useState(false)
    const [editingTask, setEditingTask] = useState<Task | null>(null)
    const [sortColumn, setSortColumn] = useState<SortColumn>('dueDate')
    const [sortDirection, setSortDirection] = useState<SortDirection>('asc')

    useEffect(() => {
        fetchTasks()
    }, [onlyMine])

    async function fetchTasks() {
        setLoading(true)
        try {
            const params = new URLSearchParams()
            if (onlyMine) params.set('onlyMine', 'true')
            const res = await fetch(`/api/tasks?${params}`)
            const data = await res.json()
            if (Array.isArray(data)) {
                setTasks(data)
            } else {
                setTasks([])
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
            fetchTasks()
        }
    }

    async function deleteTask(id: number) {
        if (!confirm("Delete this task?")) return
        setTasks(prev => prev.filter(t => t.id !== id))
        try {
            await fetch(`/api/tasks/${id}`, { method: "DELETE" })
            toast.success("Task deleted")
        } catch (error) {
            toast.error("Failed to delete")
            fetchTasks()
        }
    }

    // Filtering and sorting
    const filteredTasks = useMemo(() => {
        let result = [...tasks]

        // Date filter
        if (dateFilter !== 'all') {
            result = result.filter(t => {
                const dueDate = new Date(t.dueDate)
                const today = startOfDay(new Date())
                const todayEnd = endOfDay(new Date())

                switch (dateFilter) {
                    case 'today':
                        return dueDate >= today && dueDate <= todayEnd
                    case 'upcoming':
                        return dueDate > todayEnd
                    case 'overdue':
                        return dueDate < today && t.status === 'PENDING'
                    default:
                        return true
                }
            })
        }

        // Status filter
        if (statusFilter.length > 0) {
            result = result.filter(t => statusFilter.includes(t.status))
        }

        // Priority filter
        if (priorityFilter.length > 0) {
            result = result.filter(t => priorityFilter.includes(t.priority))
        }

        // Search
        if (searchQuery) {
            result = result.filter(t =>
                t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                t.lead?.name.toLowerCase().includes(searchQuery.toLowerCase())
            )
        }

        // Sort
        result.sort((a, b) => {
            let aVal: any, bVal: any
            switch (sortColumn) {
                case 'title':
                    aVal = a.title.toLowerCase()
                    bVal = b.title.toLowerCase()
                    break
                case 'status':
                    aVal = a.status
                    bVal = b.status
                    break
                case 'priority':
                    const priorityOrder = { HIGH: 0, NORMAL: 1, LOW: 2 }
                    aVal = priorityOrder[a.priority]
                    bVal = priorityOrder[b.priority]
                    break
                case 'dueDate':
                    aVal = new Date(a.dueDate).getTime()
                    bVal = new Date(b.dueDate).getTime()
                    break
            }
            if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1
            if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1
            return 0
        })

        return result
    }, [tasks, searchQuery, statusFilter, priorityFilter, dateFilter, sortColumn, sortDirection])

    function toggleSort(column: SortColumn) {
        if (sortColumn === column) {
            setSortDirection(d => d === 'asc' ? 'desc' : 'asc')
        } else {
            setSortColumn(column)
            setSortDirection('asc')
        }
    }

    // Stats
    const stats = {
        total: tasks.length,
        pending: tasks.filter(t => t.status === 'PENDING').length,
        completed: tasks.filter(t => t.status === 'COMPLETED').length,
        overdue: tasks.filter(t => t.status === 'PENDING' && isPast(new Date(t.dueDate)) && !isToday(new Date(t.dueDate))).length
    }

    function getStatusBadge(status: string) {
        switch (status) {
            case 'COMPLETED':
                return <Badge className="bg-emerald-100 text-emerald-700 border-0">Done</Badge>
            case 'CANCELLED':
                return <Badge variant="secondary" className="text-muted-foreground">Cancelled</Badge>
            default:
                return <Badge className="bg-blue-100 text-blue-700 border-0">Todo</Badge>
        }
    }

    function getPriorityBadge(priority: string) {
        switch (priority) {
            case 'HIGH':
                return <Badge variant="destructive" className="text-[10px] px-1.5">High</Badge>
            case 'LOW':
                return <Badge variant="outline" className="text-[10px] px-1.5 text-muted-foreground">Low</Badge>
            default:
                return null
        }
    }

    function getDueDateDisplay(dueDate: string, status: string) {
        const date = new Date(dueDate)
        const isOverdue = status === 'PENDING' && isPast(date) && !isToday(date)

        if (isToday(date)) {
            return <span className="text-blue-600 font-medium">Today, {format(date, 'h:mm a')}</span>
        }
        if (isOverdue) {
            return <span className="text-red-600 font-medium">{format(date, 'MMM d')} (Overdue)</span>
        }
        return <span className="text-muted-foreground">{format(date, 'MMM d, h:mm a')}</span>
    }

    const SortButton = ({ column, label }: { column: SortColumn, label: string }) => (
        <Button
            variant="ghost"
            size="sm"
            className="-ml-3 h-8 data-[state=open]:bg-accent"
            onClick={() => toggleSort(column)}
        >
            {label}
            {sortColumn === column ? (
                sortDirection === 'asc' ? <ArrowUp className="ml-1 h-3 w-3" /> : <ArrowDown className="ml-1 h-3 w-3" />
            ) : (
                <ArrowUpDown className="ml-1 h-3 w-3 opacity-50" />
            )}
        </Button>
    )

    return (
        <div className="h-full flex flex-col overflow-hidden">
            {/* Header */}
            <div className="shrink-0 p-4 border-b space-y-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <CheckSquare className="h-5 w-5 text-muted-foreground" />
                        <div>
                            <h1 className="text-lg font-semibold">Tasks</h1>
                            <p className="text-xs text-muted-foreground">
                                {stats.pending} pending · {stats.completed} completed
                                {stats.overdue > 0 && <span className="text-red-600"> · {stats.overdue} overdue</span>}
                            </p>
                        </div>
                    </div>

                    {/* My Tasks / All Tasks Toggle */}
                    <Button
                        variant={onlyMine ? "secondary" : "outline"}
                        size="sm"
                        className="h-8 gap-1.5"
                        onClick={() => setOnlyMine(!onlyMine)}
                    >
                        {onlyMine ? <User className="h-3 w-3" /> : <Users className="h-3 w-3" />}
                        {onlyMine ? 'My Tasks' : 'All Tasks'}
                    </Button>
                </div>

                {/* Date Filter Tabs */}
                <Tabs value={dateFilter} onValueChange={(v) => setDateFilter(v as DateFilter)}>
                    <TabsList className="h-8">
                        <TabsTrigger value="today" className="text-xs h-7 px-3">Today</TabsTrigger>
                        <TabsTrigger value="upcoming" className="text-xs h-7 px-3">Upcoming</TabsTrigger>
                        <TabsTrigger value="overdue" className="text-xs h-7 px-3">
                            Overdue
                            {stats.overdue > 0 && (
                                <Badge variant="destructive" className="ml-1.5 h-4 px-1 text-[10px]">{stats.overdue}</Badge>
                            )}
                        </TabsTrigger>
                        <TabsTrigger value="all" className="text-xs h-7 px-3">All</TabsTrigger>
                    </TabsList>
                </Tabs>

                {/* Toolbar */}
                <div className="flex items-center gap-2 flex-wrap">
                    {/* Search */}
                    <div className="relative flex-1 min-w-[200px] max-w-sm">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search tasks..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-8 h-9"
                        />
                        {searchQuery && (
                            <Button
                                variant="ghost"
                                size="icon"
                                className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6"
                                onClick={() => setSearchQuery("")}
                            >
                                <X className="h-3 w-3" />
                            </Button>
                        )}
                    </div>

                    {/* Status Filter */}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm" className="h-9">
                                <SlidersHorizontal className="h-3 w-3 mr-1.5" />
                                Status
                                {statusFilter.length > 0 && (
                                    <Badge variant="secondary" className="ml-1.5 px-1.5 text-[10px]">{statusFilter.length}</Badge>
                                )}
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start">
                            <DropdownMenuCheckboxItem
                                checked={statusFilter.includes('PENDING')}
                                onCheckedChange={(checked) => {
                                    setStatusFilter(prev => checked ? [...prev, 'PENDING'] : prev.filter(s => s !== 'PENDING'))
                                }}
                            >
                                <Circle className="h-3 w-3 mr-2 text-blue-500" />
                                Pending
                            </DropdownMenuCheckboxItem>
                            <DropdownMenuCheckboxItem
                                checked={statusFilter.includes('COMPLETED')}
                                onCheckedChange={(checked) => {
                                    setStatusFilter(prev => checked ? [...prev, 'COMPLETED'] : prev.filter(s => s !== 'COMPLETED'))
                                }}
                            >
                                <CheckCircle2 className="h-3 w-3 mr-2 text-emerald-500" />
                                Completed
                            </DropdownMenuCheckboxItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => setStatusFilter([])}>
                                Clear filters
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>

                    {/* Priority Filter */}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm" className="h-9">
                                <AlertCircle className="h-3 w-3 mr-1.5" />
                                Priority
                                {priorityFilter.length > 0 && (
                                    <Badge variant="secondary" className="ml-1.5 px-1.5 text-[10px]">{priorityFilter.length}</Badge>
                                )}
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start">
                            <DropdownMenuCheckboxItem
                                checked={priorityFilter.includes('HIGH')}
                                onCheckedChange={(checked) => {
                                    setPriorityFilter(prev => checked ? [...prev, 'HIGH'] : prev.filter(s => s !== 'HIGH'))
                                }}
                            >
                                <ArrowUp className="h-3 w-3 mr-2 text-red-500" />
                                High
                            </DropdownMenuCheckboxItem>
                            <DropdownMenuCheckboxItem
                                checked={priorityFilter.includes('NORMAL')}
                                onCheckedChange={(checked) => {
                                    setPriorityFilter(prev => checked ? [...prev, 'NORMAL'] : prev.filter(s => s !== 'NORMAL'))
                                }}
                            >
                                <ArrowUpDown className="h-3 w-3 mr-2 text-muted-foreground" />
                                Normal
                            </DropdownMenuCheckboxItem>
                            <DropdownMenuCheckboxItem
                                checked={priorityFilter.includes('LOW')}
                                onCheckedChange={(checked) => {
                                    setPriorityFilter(prev => checked ? [...prev, 'LOW'] : prev.filter(s => s !== 'LOW'))
                                }}
                            >
                                <ArrowDown className="h-3 w-3 mr-2 text-muted-foreground" />
                                Low
                            </DropdownMenuCheckboxItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => setPriorityFilter([])}>
                                Clear filters
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>

                    <div className="flex-1" />

                    <Button onClick={() => { setEditingTask(null); setDialogOpen(true) }} size="sm" className="h-9">
                        <Plus className="h-4 w-4 mr-1" />
                        <span className="hidden sm:inline">New Task</span>
                        <span className="sm:hidden">Add</span>
                    </Button>
                </div>
            </div>

            {/* Table */}
            <div className="flex-1 overflow-auto">
                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <CheckSquare className="h-8 w-8 text-muted-foreground animate-pulse" />
                    </div>
                ) : filteredTasks.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                        <div className="bg-muted/50 rounded-2xl p-8 mb-4 border-2 border-dashed">
                            <CheckSquare className="h-12 w-12 text-muted-foreground/50 mx-auto mb-3" />
                            <p className="text-muted-foreground font-medium">No tasks found</p>
                            <p className="text-muted-foreground/60 text-sm mt-1">
                                {searchQuery || statusFilter.length || priorityFilter.length
                                    ? "Try adjusting your filters"
                                    : "Create your first task"}
                            </p>
                        </div>
                        <Button
                            onClick={() => { setEditingTask(null); setDialogOpen(true) }}
                            variant="outline"
                        >
                            <Plus className="h-4 w-4 mr-1" />
                            Create Task
                        </Button>
                    </div>
                ) : (
                    <Table>
                        <TableHeader className="sticky top-0 z-10 bg-background">
                            <TableRow>
                                <TableHead className="w-[40px]"></TableHead>
                                <TableHead><SortButton column="title" label="Task" /></TableHead>
                                <TableHead className="w-[100px] hidden sm:table-cell"><SortButton column="status" label="Status" /></TableHead>
                                <TableHead className="w-[80px] hidden md:table-cell"><SortButton column="priority" label="Priority" /></TableHead>
                                <TableHead className="w-[140px]"><SortButton column="dueDate" label="Due Date" /></TableHead>
                                <TableHead className="w-[40px]"></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredTasks.map((task) => (
                                <TableRow
                                    key={task.id}
                                    className={cn(
                                        "group cursor-pointer",
                                        task.status === 'COMPLETED' && "opacity-60"
                                    )}
                                    onClick={() => { setEditingTask(task); setDialogOpen(true) }}
                                >
                                    <TableCell onClick={(e) => e.stopPropagation()}>
                                        <button
                                            onClick={() => toggleTaskStatus(task)}
                                            className={cn(
                                                "w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors",
                                                task.status === 'COMPLETED'
                                                    ? "bg-emerald-500 border-emerald-500 text-white"
                                                    : "border-muted-foreground/30 hover:border-emerald-500"
                                            )}
                                        >
                                            {task.status === 'COMPLETED' && (
                                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                                </svg>
                                            )}
                                        </button>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex flex-col">
                                            <span className={cn(
                                                "font-medium text-sm",
                                                task.status === 'COMPLETED' && "line-through text-muted-foreground"
                                            )}>
                                                {task.title}
                                            </span>
                                            {task.lead && (
                                                <span className="text-xs text-muted-foreground">{task.lead.name}</span>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell className="hidden sm:table-cell">
                                        {getStatusBadge(task.status)}
                                    </TableCell>
                                    <TableCell className="hidden md:table-cell">
                                        {getPriorityBadge(task.priority)}
                                    </TableCell>
                                    <TableCell className="text-xs">
                                        {getDueDateDisplay(task.dueDate, task.status)}
                                    </TableCell>
                                    <TableCell onClick={(e) => e.stopPropagation()}>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 opacity-0 group-hover:opacity-100"
                                                >
                                                    <MoreHorizontal className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem onClick={() => { setEditingTask(task); setDialogOpen(true) }}>
                                                    Edit
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => toggleTaskStatus(task)}>
                                                    {task.status === 'COMPLETED' ? 'Re-open' : 'Complete'}
                                                </DropdownMenuItem>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem
                                                    className="text-destructive"
                                                    onClick={() => deleteTask(task.id)}
                                                >
                                                    <Trash2 className="h-4 w-4 mr-2" />
                                                    Delete
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                )}
            </div>

            {/* Footer */}
            <div className="shrink-0 p-3 border-t bg-muted/30">
                <p className="text-xs text-muted-foreground text-center">
                    {filteredTasks.length} of {tasks.length} tasks
                </p>
            </div>

            {/* Dialog */}
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
