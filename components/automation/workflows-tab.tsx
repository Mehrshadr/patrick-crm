
"use client"

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Plus, Play, Clock, MessageSquare, Mail, MoreVertical, Trash2, Edit2, Zap } from 'lucide-react'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { WorkflowBuilder } from './workflow-builder'
import { toast } from 'sonner'

export function WorkflowsTab() {
    const [workflows, setWorkflows] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [isCreating, setIsCreating] = useState(false)
    const [selectedWorkflowId, setSelectedWorkflowId] = useState<number | null>(null)

    useEffect(() => {
        fetchWorkflows()
    }, [])

    async function fetchWorkflows() {
        setLoading(true)
        try {
            const res = await fetch('/api/workflows').then(r => r.json())
            if (res.success) {
                setWorkflows(res.workflows)
            }
        } catch (e) {
            console.error('Failed to fetch workflows', e)
            toast.error('Failed to load workflows')
        }
        setLoading(false)
    }

    async function toggleWorkflow(id: number, currentStatus: boolean) {
        // Optimistic update
        setWorkflows(workflows.map(w => w.id === id ? { ...w, isActive: !currentStatus } : w))

        try {
            await fetch(`/api/workflows/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ isActive: !currentStatus })
            })
        } catch (e) {
            toast.error('Failed to update status')
            fetchWorkflows() // Revert
        }
    }

    async function deleteWorkflow(id: number) {
        if (!confirm('Are you sure you want to delete this workflow?')) return

        try {
            const res = await fetch(`/api/workflows/${id}`, { method: 'DELETE' }).then(r => r.json())
            if (res.success) {
                toast.success('Workflow deleted')
                setWorkflows(workflows.filter(w => w.id !== id))
            } else {
                throw new Error(res.error)
            }
        } catch (e) {
            toast.error('Failed to delete workflow')
        }
    }

    if (isCreating || selectedWorkflowId) {
        return (
            <WorkflowBuilder
                workflowId={selectedWorkflowId}
                onClose={() => {
                    setIsCreating(false)
                    setSelectedWorkflowId(null)
                    fetchWorkflows()
                }}
            />
        )
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Automation Workflows</h2>
                    <p className="text-muted-foreground">Manage your automated sequences and triggers.</p>
                </div>
                <Button onClick={() => setIsCreating(true)}>
                    <Plus className="mr-2 h-4 w-4" /> New Workflow
                </Button>
            </div>

            {loading ? (
                <div className="flex justify-center p-12">Loading...</div>
            ) : workflows.length === 0 ? (
                <Card className="border-dashed">
                    <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                        <div className="rounded-full bg-slate-100 p-3 mb-4">
                            <Zap className="h-6 w-6 text-slate-500" />
                        </div>
                        <h3 className="font-semibold text-lg">No workflows yet</h3>
                        <p className="text-slate-500 max-w-sm mt-1 mb-4">
                            Create your first automation workflow to nurture leads automatically.
                        </p>
                        <Button onClick={() => setIsCreating(true)}>Create Workflow</Button>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid grid-cols-1 gap-6">
                    {workflows.map((workflow) => (
                        <div
                            key={workflow.id}
                            className="bg-white border rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-200 group"
                        >
                            <div className="flex flex-col lg:flex-row lg:items-center">
                                {/* Left side: Icon & Title */}
                                <div className="p-6 flex-1 flex items-start gap-5">
                                    <div className={`mt-1 p-3 rounded-xl transition-colors duration-200 ${workflow.isActive
                                            ? 'bg-blue-50 text-blue-600 ring-1 ring-blue-100'
                                            : 'bg-slate-100 text-slate-400 ring-1 ring-slate-200'
                                        }`}>
                                        <Zap className="h-6 w-6" />
                                    </div>
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-3">
                                            <h3
                                                className="text-lg font-semibold text-slate-900 group-hover:text-blue-600 transition-colors cursor-pointer"
                                                onClick={() => setSelectedWorkflowId(workflow.id)}
                                            >
                                                {workflow.name}
                                            </h3>
                                            <Badge
                                                variant="secondary"
                                                className={`text-[10px] uppercase tracking-wider font-bold py-0.5 px-2 ${workflow.isActive
                                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                                                        : 'bg-slate-100 text-slate-500 border-slate-200'
                                                    }`}
                                            >
                                                {workflow.isActive ? 'Active' : 'Paused'}
                                            </Badge>
                                        </div>
                                        {workflow.description && (
                                            <p className="text-sm text-slate-500 max-w-2xl line-clamp-1">{workflow.description}</p>
                                        )}
                                        <div className="flex items-center gap-4 pt-2">
                                            <div className="flex items-center gap-1.5 text-xs font-medium text-slate-400">
                                                <div className={`w-2 h-2 rounded-full ${workflow.pipelineStage ? 'bg-indigo-400' : 'bg-slate-300'}`} />
                                                {workflow.pipelineStage || 'General'}
                                            </div>
                                            <Separator orientation="vertical" className="h-3 mx-1 bg-slate-200" />
                                            <div className="flex items-center gap-1.5 text-xs font-medium text-slate-400">
                                                <Clock className="w-3.5 h-3.5" />
                                                {workflow._count?.steps || 0} steps
                                            </div>
                                            <Separator orientation="vertical" className="h-3 mx-1 bg-slate-200" />
                                            <div className="flex items-center gap-1.5 text-xs font-medium text-slate-400">
                                                {workflow.executionMode === 'AUTO' ? (
                                                    <Zap className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                                                ) : (
                                                    <Play className="w-3.5 h-3.5 text-blue-500 fill-blue-500" />
                                                )}
                                                {workflow.executionMode === 'AUTO' ? 'Auto-Trigger' : 'Manual Run'}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Right side: Controls */}
                                <div className="px-6 pb-6 lg:pb-0 lg:py-6 flex items-center justify-between lg:justify-end gap-6 bg-slate-50/50 lg:bg-transparent border-t lg:border-t-0">
                                    <div className="flex items-center gap-3">
                                        <span className={`text-xs font-bold uppercase tracking-widest ${workflow.isActive ? 'text-blue-600' : 'text-slate-400'}`}>
                                            {workflow.isActive ? 'Enabled' : 'Disabled'}
                                        </span>
                                        <Switch
                                            checked={workflow.isActive}
                                            onCheckedChange={() => toggleWorkflow(workflow.id, workflow.isActive)}
                                            className="data-[state=checked]:bg-blue-600"
                                        />
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-9 w-9 text-slate-500 hover:text-blue-600 hover:bg-blue-50"
                                            onClick={() => setSelectedWorkflowId(workflow.id)}
                                        >
                                            <Edit2 className="h-4 w-4" />
                                        </Button>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-9 w-9 text-slate-500">
                                                    <MoreVertical className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" className="w-48">
                                                <DropdownMenuItem onClick={() => setSelectedWorkflowId(workflow.id)}>
                                                    <Edit2 className="mr-2 h-4 w-4" /> Edit Sequence
                                                </DropdownMenuItem>
                                                <Separator className="my-1" />
                                                <DropdownMenuItem
                                                    className="text-red-600 focus:bg-red-50 focus:text-red-700"
                                                    onClick={() => deleteWorkflow(workflow.id)}
                                                >
                                                    <Trash2 className="mr-2 h-4 w-4" /> Delete Permanently
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}


const Separator = ({ className, orientation = "horizontal" }: { className?: string, orientation?: "horizontal" | "vertical" }) => (
    <div className={`${className} ${orientation === "horizontal" ? "w-full h-px" : "w-px h-full"}`} />
)
