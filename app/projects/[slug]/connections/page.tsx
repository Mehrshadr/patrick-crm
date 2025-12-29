"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import { Settings, Plus, Plug2, Trash2, Check, RefreshCw, Eye, EyeOff, ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbSeparator } from "@/components/ui/breadcrumb"
import Link from "next/link"

interface Connector {
    type: string
    name: string
    category: string
    icon: string
    description: string
    configFields: { name: string; label: string; type: string; required: boolean }[]
}

interface Connection {
    id: number
    connectorType: string
    name: string
    icon: string | null
    isActive: boolean
    createdAt: string
}

interface Project {
    id: number
    name: string
    slug: string
}

export default function ConnectionsSettingsPage() {
    const params = useParams()
    const slug = params.slug as string

    const [project, setProject] = useState<Project | null>(null)
    const [connections, setConnections] = useState<Connection[]>([])
    const [connectors, setConnectors] = useState<Connector[]>([])
    const [loading, setLoading] = useState(true)
    const [dialogOpen, setDialogOpen] = useState(false)
    const [selectedConnector, setSelectedConnector] = useState<Connector | null>(null)
    const [formData, setFormData] = useState<Record<string, string>>({})
    const [connectionName, setConnectionName] = useState("")
    const [saving, setSaving] = useState(false)
    const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({})

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

            // Get connections and connectors
            const connRes = await fetch(`/api/jarvis/connections?projectId=${projData.id}`)
            const connData = await connRes.json()
            if (connRes.ok) {
                setConnections(connData.connections || [])
                setConnectors(connData.connectors || [])
            }
        } catch (e: any) {
            toast.error(e.message || "Failed to load data")
        } finally {
            setLoading(false)
        }
    }

    function openAddDialog(connector: Connector) {
        setSelectedConnector(connector)
        setConnectionName(`${connector.name}`)
        setFormData({})
        setDialogOpen(true)
    }

    async function saveConnection() {
        if (!selectedConnector || !project || !connectionName.trim()) return
        setSaving(true)
        try {
            const res = await fetch("/api/jarvis/connections", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    projectId: project.id,
                    connectorType: selectedConnector.type,
                    name: connectionName,
                    credentials: formData
                })
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error)

            toast.success("Connection added!")
            setDialogOpen(false)
            fetchData()
        } catch (e: any) {
            toast.error(e.message || "Failed to save")
        } finally {
            setSaving(false)
        }
    }

    async function deleteConnection(id: number) {
        if (!confirm("Delete this connection?")) return
        try {
            await fetch(`/api/jarvis/connections/${id}`, { method: "DELETE" })
            setConnections(prev => prev.filter(c => c.id !== id))
            toast.success("Connection deleted")
        } catch (e) {
            toast.error("Failed to delete")
        }
    }

    const getConnectorInfo = (type: string) => connectors.find(c => c.type === type)

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
                            <span className="text-foreground font-medium">Connections</span>
                        </BreadcrumbItem>
                    </BreadcrumbList>
                </Breadcrumb>

                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-gradient-to-br from-slate-500 to-slate-600 rounded-lg">
                            <Plug2 className="h-5 w-5 text-white" />
                        </div>
                        <div>
                            <h1 className="text-lg font-semibold">API Connections</h1>
                            <p className="text-xs text-muted-foreground">Connect external services for Jarvis automations</p>
                        </div>
                    </div>

                    <Link href={`/projects/${slug}/jarvis`}>
                        <Button variant="outline" size="sm">
                            <ArrowLeft className="h-4 w-4 mr-1" />
                            Back to Jarvis
                        </Button>
                    </Link>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto p-4 space-y-6">
                {/* Active Connections */}
                <div>
                    <h2 className="text-sm font-medium mb-3">Active Connections ({connections.length})</h2>
                    {connections.length === 0 ? (
                        <div className="border rounded-lg p-6 text-center text-muted-foreground">
                            No connections yet. Add a connection below.
                        </div>
                    ) : (
                        <div className="grid gap-3 md:grid-cols-2">
                            {connections.map(conn => {
                                const info = getConnectorInfo(conn.connectorType)
                                return (
                                    <Card key={conn.id} className="group">
                                        <CardHeader className="pb-2">
                                            <div className="flex items-start justify-between">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xl">{conn.icon || info?.icon}</span>
                                                    <div>
                                                        <CardTitle className="text-sm">{conn.name}</CardTitle>
                                                        <CardDescription className="text-xs">{info?.name}</CardDescription>
                                                    </div>
                                                </div>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-7 w-7 opacity-0 group-hover:opacity-100 text-destructive"
                                                    onClick={() => deleteConnection(conn.id)}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </CardHeader>
                                        <CardContent className="pb-3">
                                            <Badge variant={conn.isActive ? "default" : "secondary"} className="text-[10px]">
                                                <Check className="h-3 w-3 mr-1" />
                                                Connected
                                            </Badge>
                                        </CardContent>
                                    </Card>
                                )
                            })}
                        </div>
                    )}
                </div>

                {/* Available Connectors */}
                <div>
                    <h2 className="text-sm font-medium mb-3">Available Connectors</h2>
                    <div className="grid gap-2 md:grid-cols-3">
                        {connectors.filter(c => c.category !== "trigger" || c.type !== "webhook").map(connector => {
                            const alreadyConnected = connections.some(c => c.connectorType === connector.type)
                            return (
                                <button
                                    key={connector.type}
                                    onClick={() => openAddDialog(connector)}
                                    className="flex items-center gap-3 p-3 border rounded-lg hover:bg-muted text-left transition-colors disabled:opacity-50"
                                    disabled={alreadyConnected && ['facebook_leads', 'gravity_forms', 'webhook'].includes(connector.type)}
                                >
                                    <span className="text-2xl">{connector.icon}</span>
                                    <div className="flex-1 min-w-0">
                                        <div className="text-sm font-medium">{connector.name}</div>
                                        <div className="text-xs text-muted-foreground truncate">{connector.description}</div>
                                    </div>
                                    <Plus className="h-4 w-4 text-muted-foreground" />
                                </button>
                            )
                        })}
                    </div>
                </div>
            </div>

            {/* Add Connection Dialog */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <span className="text-xl">{selectedConnector?.icon}</span>
                            Add {selectedConnector?.name}
                        </DialogTitle>
                        <DialogDescription>{selectedConnector?.description}</DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                        <div>
                            <Label>Connection Name</Label>
                            <Input
                                value={connectionName}
                                onChange={e => setConnectionName(e.target.value)}
                                placeholder="e.g. Main Monday Board"
                            />
                        </div>

                        {selectedConnector?.configFields.map(field => (
                            <div key={field.name}>
                                <Label>{field.label} {field.required && <span className="text-red-500">*</span>}</Label>
                                <div className="relative">
                                    <Input
                                        type={field.type === "password" && !showPasswords[field.name] ? "password" : "text"}
                                        value={formData[field.name] || ""}
                                        onChange={e => setFormData({ ...formData, [field.name]: e.target.value })}
                                        placeholder={field.type === "password" ? "••••••••" : ""}
                                    />
                                    {field.type === "password" && (
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                                            onClick={() => setShowPasswords({ ...showPasswords, [field.name]: !showPasswords[field.name] })}
                                        >
                                            {showPasswords[field.name] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                        </Button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                        <Button onClick={saveConnection} disabled={saving || !connectionName.trim()}>
                            {saving && <RefreshCw className="h-4 w-4 mr-1 animate-spin" />}
                            Add Connection
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
