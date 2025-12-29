"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { Bot, Plus, Zap, MoreHorizontal, Play, Pause, Trash2, ChevronRight, RefreshCw, Activity } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu"
import { toast } from "sonner"
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbSeparator } from "@/components/ui/breadcrumb"

interface JarvisFlow {
    id: number
    name: string
    description: string | null
    isActive: boolean
    webhookId: string | null
    createdAt: string
    updatedAt: string
    _count: {
        executions: number
    }
}

interface Project {
    id: number
    name: string
    slug: string
}

export default function JarvisPage() {
    const params = useParams()
    const router = useRouter()
    const slug = params.slug as string

    const [project, setProject] = useState<Project | null>(null)
    const [flows, setFlows] = useState<JarvisFlow[]>([])
    const [loading, setLoading] = useState(true)
    const [createDialogOpen, setCreateDialogOpen] = useState(false)
    const [newFlowName, setNewFlowName] = useState("")
    const [newFlowDescription, setNewFlowDescription] = useState("")
    const [creating, setCreating] = useState(false)

    useEffect(() => {
        fetchData()
    }, [slug])

    async function fetchData() {
        setLoading(true)
        try {
            // Get project
            const projRes = await fetch(`/api/seo/projects/by-slug/${slug}`)
            const projData = await projRes.json()
            if (!projRes.ok) throw new Error(projData.error)
            setProject(projData)

            // Get flows
            const flowsRes = await fetch(`/api/jarvis/flows?projectId=${projData.id}`)
            const flowsData = await flowsRes.json()
            if (flowsRes.ok && flowsData.flows) {
                setFlows(flowsData.flows)
            }
        } catch (e: any) {
            toast.error(e.message || "Failed to load data")
        } finally {
            setLoading(false)
        }
    }

    async function createFlow() {
        if (!newFlowName.trim() || !project) return
        setCreating(true)
        try {
            const res = await fetch("/api/jarvis/flows", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    projectId: project.id,
                    name: newFlowName,
                    description: newFlowDescription || null
                })
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error)

            toast.success("Flow created!")
            setCreateDialogOpen(false)
            setNewFlowName("")
            setNewFlowDescription("")
            router.push(`/projects/${slug}/jarvis/${data.id}`)
        } catch (e: any) {
            toast.error(e.message || "Failed to create flow")
        } finally {
            setCreating(false)
        }
    }

    async function toggleFlowActive(flow: JarvisFlow) {
        try {
            const res = await fetch(`/api/jarvis/flows/${flow.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ isActive: !flow.isActive })
            })
            if (!res.ok) throw new Error("Failed to update")
            setFlows(prev => prev.map(f => f.id === flow.id ? { ...f, isActive: !f.isActive } : f))
            toast.success(flow.isActive ? "Flow paused" : "Flow activated")
        } catch (e) {
            toast.error("Failed to update flow")
        }
    }

    async function deleteFlow(id: number) {
        if (!confirm("Delete this flow? This cannot be undone.")) return
        try {
            await fetch(`/api/jarvis/flows/${id}`, { method: "DELETE" })
            setFlows(prev => prev.filter(f => f.id !== id))
            toast.success("Flow deleted")
        } catch (e) {
            toast.error("Failed to delete")
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full">
                <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        )
    }

    return (
        <div className="h-full flex flex-col overflow-hidden">
            {/* Header */}
            <div className="shrink-0 p-4 border-b space-y-3">
                {/* Breadcrumb */}
                <Breadcrumb>
                    <BreadcrumbList>
                        <BreadcrumbItem>
                            <BreadcrumbLink href="/projects">Projects</BreadcrumbLink>
                        </BreadcrumbItem>
                        <BreadcrumbSeparator />
                        <BreadcrumbItem>
                            <BreadcrumbLink href={`/projects/${slug}`}>{project?.name}</BreadcrumbLink>
                        </BreadcrumbItem>
                        <BreadcrumbSeparator />
                        <BreadcrumbItem>
                            <span className="text-foreground font-medium">Jarvis</span>
                        </BreadcrumbItem>
                    </BreadcrumbList>
                </Breadcrumb>

                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-gradient-to-br from-violet-500 to-purple-600 rounded-lg">
                            <Bot className="h-5 w-5 text-white" />
                        </div>
                        <div>
                            <h1 className="text-lg font-semibold">Jarvis</h1>
                            <p className="text-xs text-muted-foreground">Automation flows for {project?.name}</p>
                        </div>
                    </div>

                    <Button onClick={() => setCreateDialogOpen(true)}>
                        <Plus className="h-4 w-4 mr-1" />
                        New Flow
                    </Button>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto p-4">
                {flows.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                        <div className="bg-gradient-to-br from-violet-50 to-purple-100 rounded-2xl p-8 mb-4 border-2 border-dashed border-violet-200">
                            <Zap className="h-12 w-12 text-violet-400 mx-auto mb-3" />
                            <p className="text-muted-foreground font-medium">No automation flows yet</p>
                            <p className="text-muted-foreground/60 text-sm mt-1">Create your first flow to automate tasks</p>
                        </div>
                        <Button onClick={() => setCreateDialogOpen(true)} variant="outline">
                            <Plus className="h-4 w-4 mr-1" />
                            Create Flow
                        </Button>
                    </div>
                ) : (
                    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                        {flows.map(flow => (
                            <Card key={flow.id} className="group hover:border-violet-300 transition-colors cursor-pointer"
                                onClick={() => router.push(`/projects/${slug}/jarvis/${flow.id}`)}>
                                <CardHeader className="pb-2">
                                    <div className="flex items-start justify-between">
                                        <div className="flex items-center gap-2">
                                            <div className={`p-1.5 rounded ${flow.isActive ? 'bg-green-100' : 'bg-muted'}`}>
                                                <Zap className={`h-4 w-4 ${flow.isActive ? 'text-green-600' : 'text-muted-foreground'}`} />
                                            </div>
                                            <div>
                                                <CardTitle className="text-sm">{flow.name}</CardTitle>
                                                {flow.description && (
                                                    <CardDescription className="text-xs line-clamp-1">{flow.description}</CardDescription>
                                                )}
                                            </div>
                                        </div>

                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
                                                <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100">
                                                    <MoreHorizontal className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); toggleFlowActive(flow) }}>
                                                    {flow.isActive ? <Pause className="h-4 w-4 mr-2" /> : <Play className="h-4 w-4 mr-2" />}
                                                    {flow.isActive ? 'Pause' : 'Activate'}
                                                </DropdownMenuItem>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem className="text-destructive" onClick={(e) => { e.stopPropagation(); deleteFlow(flow.id) }}>
                                                    <Trash2 className="h-4 w-4 mr-2" />
                                                    Delete
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>
                                </CardHeader>
                                <CardContent className="pb-3">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <Badge variant={flow.isActive ? "default" : "secondary"} className="text-[10px]">
                                                {flow.isActive ? 'Active' : 'Paused'}
                                            </Badge>
                                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                                                <Activity className="h-3 w-3" />
                                                {flow._count?.executions || 0} runs
                                            </span>
                                        </div>
                                        <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </div>

            {/* Create Dialog */}
            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Create New Flow</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div>
                            <Label>Name</Label>
                            <Input
                                value={newFlowName}
                                onChange={e => setNewFlowName(e.target.value)}
                                placeholder="e.g. Facebook to Monday"
                            />
                        </div>
                        <div>
                            <Label>Description (optional)</Label>
                            <Textarea
                                value={newFlowDescription}
                                onChange={e => setNewFlowDescription(e.target.value)}
                                placeholder="What does this flow do?"
                                className="resize-none h-20"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
                        <Button onClick={createFlow} disabled={creating || !newFlowName.trim()}>
                            {creating && <RefreshCw className="h-4 w-4 mr-1 animate-spin" />}
                            Create
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
