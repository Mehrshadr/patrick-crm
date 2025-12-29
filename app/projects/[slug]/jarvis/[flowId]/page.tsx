"use client"

import { useState, useEffect, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import {
    ReactFlow,
    Controls,
    Background,
    addEdge,
    useNodesState,
    useEdgesState,
    Handle,
    Position,
    BackgroundVariant,
    type Node,
    type Edge,
    type OnConnect,
    type NodeProps
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"
import { Bot, Save, ArrowLeft, Zap, Globe, RefreshCw, Settings, Webhook } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbSeparator } from "@/components/ui/breadcrumb"
import { cn } from "@/lib/utils"

// Node data type
interface NodeData extends Record<string, unknown> {
    label: string
    type: string
}

// Node types
const CONNECTOR_TYPES = [
    { type: "webhook", label: "Webhook", icon: Webhook, color: "bg-blue-500", category: "trigger" },
    { type: "http", label: "HTTP Request", icon: Globe, color: "bg-orange-500", category: "action" },
    { type: "monday", label: "Monday.com", icon: "M", color: "bg-red-500", category: "action" },
    { type: "mailchimp", label: "Mailchimp", icon: "MC", color: "bg-yellow-500", category: "action" },
]

// Custom Node Components
function TriggerNode({ data, selected }: NodeProps<Node<NodeData>>) {
    const connector = CONNECTOR_TYPES.find(c => c.type === data.type)
    const IconComp = typeof connector?.icon === 'string' ? null : connector?.icon || Zap

    return (
        <div className={cn(
            "px-4 py-3 rounded-lg border-2 bg-white shadow-sm min-w-[150px]",
            selected ? "border-violet-500 ring-2 ring-violet-200" : "border-gray-200"
        )}>
            <div className="flex items-center gap-2">
                <div className={cn("p-1.5 rounded flex items-center justify-center", connector?.color || "bg-blue-500")}>
                    {typeof connector?.icon === 'string' ? (
                        <span className="text-xs font-bold text-white">{connector.icon}</span>
                    ) : IconComp ? (
                        <IconComp className="h-4 w-4 text-white" />
                    ) : null}
                </div>
                <div>
                    <div className="text-xs text-muted-foreground">Trigger</div>
                    <div className="text-sm font-medium">{data.label}</div>
                </div>
            </div>
            <Handle type="source" position={Position.Bottom} className="!bg-violet-500 !w-3 !h-3" />
        </div>
    )
}

function ActionNode({ data, selected }: NodeProps<Node<NodeData>>) {
    const connector = CONNECTOR_TYPES.find(c => c.type === data.type)
    const IconComp = typeof connector?.icon === 'string' ? null : connector?.icon || Settings

    return (
        <div className={cn(
            "px-4 py-3 rounded-lg border-2 bg-white shadow-sm min-w-[150px]",
            selected ? "border-violet-500 ring-2 ring-violet-200" : "border-gray-200"
        )}>
            <Handle type="target" position={Position.Top} className="!bg-violet-500 !w-3 !h-3" />
            <div className="flex items-center gap-2">
                <div className={cn("p-1.5 rounded flex items-center justify-center", connector?.color || "bg-gray-500")}>
                    {typeof connector?.icon === 'string' ? (
                        <span className="text-xs font-bold text-white">{connector.icon}</span>
                    ) : IconComp ? (
                        <IconComp className="h-4 w-4 text-white" />
                    ) : null}
                </div>
                <div>
                    <div className="text-xs text-muted-foreground">Action</div>
                    <div className="text-sm font-medium">{data.label}</div>
                </div>
            </div>
            <Handle type="source" position={Position.Bottom} className="!bg-violet-500 !w-3 !h-3" />
        </div>
    )
}

const nodeTypes = {
    trigger: TriggerNode,
    action: ActionNode
}

interface FlowData {
    id: number
    name: string
    description: string | null
    webhookId: string | null
    isActive: boolean
    nodes: string
    edges: string
    project: {
        id: number
        name: string
        slug: string
    }
}

export default function FlowEditorPage() {
    const params = useParams()
    const router = useRouter()
    const slug = params.slug as string
    const flowId = params.flowId as string

    const [flow, setFlow] = useState<FlowData | null>(null)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [nodes, setNodes, onNodesChange] = useNodesState<Node<NodeData>>([])
    const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])

    useEffect(() => {
        fetchFlow()
    }, [flowId])

    async function fetchFlow() {
        setLoading(true)
        try {
            const res = await fetch(`/api/jarvis/flows/${flowId}`)
            const data = await res.json()
            if (!res.ok) throw new Error(data.error)

            setFlow(data)
            setNodes(JSON.parse(data.nodes || "[]"))
            setEdges(JSON.parse(data.edges || "[]"))
        } catch (e: any) {
            toast.error(e.message || "Failed to load flow")
        } finally {
            setLoading(false)
        }
    }

    const onConnect: OnConnect = useCallback((connection) => {
        setEdges(eds => addEdge({ ...connection, animated: true }, eds))
    }, [setEdges])

    async function saveFlow() {
        if (!flow) return
        setSaving(true)
        try {
            const res = await fetch(`/api/jarvis/flows/${flow.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ nodes, edges })
            })
            if (!res.ok) throw new Error("Failed to save")
            toast.success("Flow saved!")
        } catch (e) {
            toast.error("Failed to save flow")
        } finally {
            setSaving(false)
        }
    }

    function addNode(type: string, label: string, category: string) {
        const newNode: Node<NodeData> = {
            id: `${category}-${Date.now()}`,
            type: category,
            position: { x: 250, y: 100 + nodes.length * 120 },
            data: { label, type }
        }
        setNodes(nds => [...nds, newNode])
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
            <div className="shrink-0 p-3 border-b bg-background flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Button variant="ghost" size="icon" onClick={() => router.push(`/projects/${slug}/jarvis`)}>
                        <ArrowLeft className="h-4 w-4" />
                    </Button>

                    <Breadcrumb>
                        <BreadcrumbList>
                            <BreadcrumbItem>
                                <BreadcrumbLink href={`/projects/${slug}/jarvis`}>Jarvis</BreadcrumbLink>
                            </BreadcrumbItem>
                            <BreadcrumbSeparator />
                            <BreadcrumbItem>
                                <span className="text-foreground font-medium">{flow?.name}</span>
                            </BreadcrumbItem>
                        </BreadcrumbList>
                    </Breadcrumb>
                </div>

                <div className="flex items-center gap-2">
                    {flow?.webhookId && (
                        <code className="text-xs bg-muted px-2 py-1 rounded">
                            /api/jarvis/webhook/{flow.webhookId}
                        </code>
                    )}
                    <Button variant="outline" size="sm" onClick={saveFlow} disabled={saving}>
                        {saving ? <RefreshCw className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
                        Save
                    </Button>
                </div>
            </div>

            {/* Main Area */}
            <div className="flex-1 flex">
                {/* Sidebar - Node Palette */}
                <div className="w-48 border-r bg-muted/30 p-3 space-y-3">
                    <div>
                        <div className="text-xs font-medium text-muted-foreground mb-2">Triggers</div>
                        {CONNECTOR_TYPES.filter(c => c.category === "trigger").map(conn => {
                            const IconComp = typeof conn.icon === 'string' ? null : conn.icon
                            return (
                                <button
                                    key={conn.type}
                                    onClick={() => addNode(conn.type, conn.label, "trigger")}
                                    className="w-full flex items-center gap-2 p-2 rounded hover:bg-muted text-left text-sm"
                                >
                                    <div className={cn("p-1 rounded flex items-center justify-center", conn.color)}>
                                        {typeof conn.icon === 'string' ? (
                                            <span className="text-[10px] font-bold text-white">{conn.icon}</span>
                                        ) : IconComp ? (
                                            <IconComp className="h-3 w-3 text-white" />
                                        ) : null}
                                    </div>
                                    {conn.label}
                                </button>
                            )
                        })}
                    </div>

                    <div>
                        <div className="text-xs font-medium text-muted-foreground mb-2">Actions</div>
                        {CONNECTOR_TYPES.filter(c => c.category === "action").map(conn => {
                            const IconComp = typeof conn.icon === 'string' ? null : conn.icon
                            return (
                                <button
                                    key={conn.type}
                                    onClick={() => addNode(conn.type, conn.label, "action")}
                                    className="w-full flex items-center gap-2 p-2 rounded hover:bg-muted text-left text-sm"
                                >
                                    <div className={cn("p-1 rounded flex items-center justify-center", conn.color)}>
                                        {typeof conn.icon === 'string' ? (
                                            <span className="text-[10px] font-bold text-white">{conn.icon}</span>
                                        ) : IconComp ? (
                                            <IconComp className="h-3 w-3 text-white" />
                                        ) : null}
                                    </div>
                                    {conn.label}
                                </button>
                            )
                        })}
                    </div>
                </div>

                {/* React Flow Canvas */}
                <div className="flex-1">
                    <ReactFlow
                        nodes={nodes}
                        edges={edges}
                        onNodesChange={onNodesChange}
                        onEdgesChange={onEdgesChange}
                        onConnect={onConnect}
                        nodeTypes={nodeTypes}
                        fitView
                        proOptions={{ hideAttribution: true }}
                    >
                        <Controls />
                        <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
                    </ReactFlow>
                </div>
            </div>
        </div>
    )
}
