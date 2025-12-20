
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
                <div className="grid grid-cols-1 gap-4">
                    {workflows.map((workflow) => (
                        <Card key={workflow.id} className="hover:shadow-md transition-shadow">
                            <CardContent className="p-6 flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className={`p-3 rounded-lg ${workflow.isActive ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                                        <Zap className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-lg hover:underline cursor-pointer" onClick={() => setSelectedWorkflowId(workflow.id)}>
                                            {workflow.name}
                                        </h3>
                                        <p className="text-sm text-slate-500 mb-2">
                                            {workflow.pipelineStage
                                                ? `📍 ${workflow.pipelineStage}`
                                                : '🌐 General'
                                            }
                                        </p>
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <Badge
                                                variant="outline"
                                                className={`text-xs ${workflow.executionMode === 'AUTO' ? 'bg-green-50 text-green-700 border-green-300' : 'bg-amber-50 text-amber-700 border-amber-300'}`}
                                            >
                                                {workflow.executionMode === 'AUTO' ? '⚡ Auto' : '👆 Manual'}
                                            </Badge>
                                            <Badge variant="outline" className="font-normal text-xs">
                                                {workflow.triggerType === 'ON_STATUS_CHANGE' ? 'Status Change' : 'Manual Only'}
                                            </Badge>
                                            <span className="text-xs text-slate-400">
                                                {workflow._count?.steps || 0} steps
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-4">
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm text-slate-500">{workflow.isActive ? 'On' : 'Off'}</span>
                                        <Switch
                                            checked={workflow.isActive}
                                            onCheckedChange={() => toggleWorkflow(workflow.id, workflow.isActive)}
                                        />
                                    </div>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="icon">
                                                <MoreVertical className="h-4 w-4" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuItem onClick={() => setSelectedWorkflowId(workflow.id)}>
                                                <Edit2 className="mr-2 h-4 w-4" /> Edit
                                            </DropdownMenuItem>
                                            <DropdownMenuItem className="text-red-600" onClick={() => deleteWorkflow(workflow.id)}>
                                                <Trash2 className="mr-2 h-4 w-4" /> Delete
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    )
}
