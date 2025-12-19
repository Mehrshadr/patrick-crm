"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Mail, MessageSquare, Zap, CheckCircle2, XCircle, Clock, RefreshCw, Filter, User } from "lucide-react"
import { format } from "date-fns"

interface Log {
    id: number
    leadId: number
    type: string
    stage: string | null
    status: string
    title: string
    content: string
    meta: string | null
    createdAt: string
    lead: {
        id: number
        name: string
        email: string | null
        website: string | null
    }
}

export function ExecutionsTab() {
    const [logs, setLogs] = useState<Log[]>([])
    const [loading, setLoading] = useState(true)
    const [filterType, setFilterType] = useState<string>("all")
    const [filterStatus, setFilterStatus] = useState<string>("all")

    const fetchLogs = async () => {
        setLoading(true)
        try {
            const params = new URLSearchParams()
            if (filterType !== "all") params.set("type", filterType)
            if (filterStatus !== "all") params.set("status", filterStatus)

            const res = await fetch(`/api/logs?${params.toString()}`)
            const data = await res.json()
            setLogs(data.logs || [])
        } catch (error) {
            console.error("Failed to fetch logs:", error)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchLogs()
    }, [filterType, filterStatus])

    const getTypeIcon = (type: string) => {
        switch (type) {
            case "EMAIL": return <Mail className="h-4 w-4" />
            case "SMS": return <MessageSquare className="h-4 w-4" />
            case "SYSTEM": return <Zap className="h-4 w-4" />
            default: return <Zap className="h-4 w-4" />
        }
    }

    const getTypeColor = (type: string) => {
        switch (type) {
            case "EMAIL": return "bg-blue-100 text-blue-700"
            case "SMS": return "bg-green-100 text-green-700"
            case "SYSTEM": return "bg-purple-100 text-purple-700"
            default: return "bg-slate-100 text-slate-700"
        }
    }

    const getStatusIcon = (status: string) => {
        switch (status) {
            case "SENT": return <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            case "FAILED": return <XCircle className="h-4 w-4 text-red-500" />
            case "PENDING": return <Clock className="h-4 w-4 text-amber-500" />
            default: return <Clock className="h-4 w-4 text-slate-400" />
        }
    }

    const getStatusBadge = (status: string) => {
        switch (status) {
            case "SENT": return "bg-emerald-100 text-emerald-700"
            case "FAILED": return "bg-red-100 text-red-700"
            case "PENDING": return "bg-amber-100 text-amber-700"
            default: return "bg-slate-100 text-slate-700"
        }
    }

    return (
        <div className="space-y-4">
            {/* Filters */}
            <div className="flex items-center gap-4 p-4 bg-white rounded-lg border">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Type:</span>
                    <Select value={filterType} onValueChange={setFilterType}>
                        <SelectTrigger className="w-[120px] h-8">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All</SelectItem>
                            <SelectItem value="EMAIL">📧 Email</SelectItem>
                            <SelectItem value="SMS">💬 SMS</SelectItem>
                            <SelectItem value="SYSTEM">⚡ System</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Status:</span>
                    <Select value={filterStatus} onValueChange={setFilterStatus}>
                        <SelectTrigger className="w-[120px] h-8">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All</SelectItem>
                            <SelectItem value="SENT">✅ Sent</SelectItem>
                            <SelectItem value="PENDING">⏳ Pending</SelectItem>
                            <SelectItem value="FAILED">❌ Failed</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <Button variant="outline" size="sm" onClick={fetchLogs} className="ml-auto">
                    <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
                    Refresh
                </Button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-4 gap-4">
                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center gap-2">
                            <div className="p-2 bg-blue-100 rounded-lg">
                                <Mail className="h-5 w-5 text-blue-600" />
                            </div>
                            <div>
                                <div className="text-2xl font-bold">{logs.filter(l => l.type === "EMAIL").length}</div>
                                <div className="text-xs text-muted-foreground">Emails</div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center gap-2">
                            <div className="p-2 bg-green-100 rounded-lg">
                                <MessageSquare className="h-5 w-5 text-green-600" />
                            </div>
                            <div>
                                <div className="text-2xl font-bold">{logs.filter(l => l.type === "SMS").length}</div>
                                <div className="text-xs text-muted-foreground">SMS</div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center gap-2">
                            <div className="p-2 bg-emerald-100 rounded-lg">
                                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                            </div>
                            <div>
                                <div className="text-2xl font-bold">{logs.filter(l => l.status === "SENT").length}</div>
                                <div className="text-xs text-muted-foreground">Sent</div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center gap-2">
                            <div className="p-2 bg-red-100 rounded-lg">
                                <XCircle className="h-5 w-5 text-red-600" />
                            </div>
                            <div>
                                <div className="text-2xl font-bold">{logs.filter(l => l.status === "FAILED").length}</div>
                                <div className="text-xs text-muted-foreground">Failed</div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Log List */}
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-lg flex items-center gap-2">
                        <Zap className="h-5 w-5 text-amber-500" />
                        Execution History
                        <span className="text-sm font-normal text-muted-foreground">({logs.length} executions)</span>
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <ScrollArea className="h-[500px]">
                        {loading ? (
                            <div className="flex items-center justify-center py-10">
                                <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                            </div>
                        ) : logs.length === 0 ? (
                            <div className="text-center py-10 text-muted-foreground">
                                <Zap className="h-10 w-10 mx-auto mb-2 opacity-20" />
                                <p>No executions yet</p>
                                <p className="text-sm">Automations will show up here</p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {logs.map((log) => (
                                    <div key={log.id} className="flex items-start gap-3 p-3 hover:bg-slate-50 rounded-lg border transition-colors">
                                        {/* Type Icon */}
                                        <div className={`p-2 rounded-lg ${getTypeColor(log.type)}`}>
                                            {getTypeIcon(log.type)}
                                        </div>

                                        {/* Content */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="font-medium text-sm">{log.title}</span>
                                                {log.stage && (
                                                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                                                        {log.stage}
                                                    </Badge>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                <User className="h-3 w-3" />
                                                <span className="font-medium">{log.lead?.name || 'Unknown'}</span>
                                                {log.lead?.email && (
                                                    <>
                                                        <span>•</span>
                                                        <span className="truncate">{log.lead.email}</span>
                                                    </>
                                                )}
                                            </div>
                                            {log.content && (
                                                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                                    {log.content.replace(/<[^>]*>/g, '').substring(0, 150)}...
                                                </p>
                                            )}
                                        </div>

                                        {/* Status & Time */}
                                        <div className="flex flex-col items-end gap-1">
                                            <div className="flex items-center gap-1">
                                                {getStatusIcon(log.status)}
                                                <Badge className={`text-[10px] px-1.5 py-0 h-4 border-0 ${getStatusBadge(log.status)}`}>
                                                    {log.status}
                                                </Badge>
                                            </div>
                                            <span className="text-[10px] text-muted-foreground">
                                                {format(new Date(log.createdAt), "MMM d, HH:mm")}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </ScrollArea>
                </CardContent>
            </Card>
        </div>
    )
}
