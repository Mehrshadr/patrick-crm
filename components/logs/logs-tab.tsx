"use client"

import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
    Zap, Mail, MessageSquare, User, Settings,
    RefreshCw, Filter, Clock
} from 'lucide-react'

interface ActivityLogEntry {
    id: number
    category: string
    action: string
    entityType?: string
    entityId?: number
    entityName?: string
    description: string
    details?: string
    userId?: string
    userName?: string
    createdAt: string
}

const CATEGORY_CONFIG: Record<string, { label: string; icon: any; color: string }> = {
    AUTOMATION: { label: 'Automation', icon: Zap, color: 'bg-indigo-100 text-indigo-700 border-indigo-300' },
    COMMUNICATION: { label: 'Communication', icon: Mail, color: 'bg-purple-100 text-purple-700 border-purple-300' },
    LEAD: { label: 'Lead', icon: User, color: 'bg-blue-100 text-blue-700 border-blue-300' },
    EMAIL: { label: 'Email', icon: Mail, color: 'bg-purple-100 text-purple-700 border-purple-300' },
    SMS: { label: 'SMS', icon: MessageSquare, color: 'bg-green-100 text-green-700 border-green-300' },
    SYSTEM: { label: 'System', icon: Settings, color: 'bg-slate-100 text-slate-700 border-slate-300' },
}

const ACTION_COLORS: Record<string, string> = {
    CREATED: 'bg-emerald-100 text-emerald-700',
    UPDATED: 'bg-amber-100 text-amber-700',
    DELETED: 'bg-red-100 text-red-700',
    SENT: 'bg-blue-100 text-blue-700',
    EXECUTED: 'bg-indigo-100 text-indigo-700',
    FAILED: 'bg-red-100 text-red-700',
}

export function LogsTab() {
    const [logs, setLogs] = useState<ActivityLogEntry[]>([])
    const [loading, setLoading] = useState(true)
    const [categoryFilter, setCategoryFilter] = useState<string>('__ALL__')

    useEffect(() => {
        fetchLogs()
    }, [categoryFilter])

    async function fetchLogs() {
        setLoading(true)
        try {
            const params = new URLSearchParams()
            if (categoryFilter !== '__ALL__') params.set('category', categoryFilter)

            const res = await fetch(`/api/activity-logs?${params}`).then(r => r.json())
            if (res.success) {
                setLogs(res.logs)
            }
        } catch (e) {
            console.error('Failed to fetch logs:', e)
        }
        setLoading(false)
    }

    function formatTime(dateStr: string) {
        const date = new Date(dateStr)
        const now = new Date()
        const diffMs = now.getTime() - date.getTime()
        const diffMins = Math.floor(diffMs / 60000)
        const diffHours = Math.floor(diffMins / 60)
        const diffDays = Math.floor(diffHours / 24)

        if (diffMins < 1) return 'Just now'
        if (diffMins < 60) return `${diffMins}m ago`
        if (diffHours < 24) return `${diffHours}h ago`
        if (diffDays < 7) return `${diffDays}d ago`
        return date.toLocaleDateString()
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Activity Logs</h2>
                    <p className="text-muted-foreground">Track all system activities and changes.</p>
                </div>
                <Button variant="outline" onClick={fetchLogs} disabled={loading}>
                    <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                    Refresh
                </Button>
            </div>

            {/* Filters */}
            <Card>
                <CardContent className="p-4">
                    <div className="flex items-center gap-4">
                        <Filter className="h-4 w-4 text-slate-500" />
                        <span className="text-sm font-medium">Filter by:</span>
                        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                            <SelectTrigger className="w-[180px]">
                                <SelectValue placeholder="Category" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="__ALL__">All Categories</SelectItem>
                                {Object.entries(CATEGORY_CONFIG).map(([key, config]) => (
                                    <SelectItem key={key} value={key}>
                                        {config.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </CardContent>
            </Card>

            {/* Logs List */}
            {loading ? (
                <div className="flex justify-center p-12 text-slate-500">Loading logs...</div>
            ) : logs.length === 0 ? (
                <Card className="border-dashed">
                    <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                        <Clock className="h-10 w-10 text-slate-300 mb-4" />
                        <h3 className="font-semibold text-lg">No logs yet</h3>
                        <p className="text-slate-500 max-w-sm mt-1">
                            Activity will appear here as you use the system.
                        </p>
                    </CardContent>
                </Card>
            ) : (
                <ScrollArea className="h-[600px]">
                    <div className="space-y-2">
                        {logs.map((log) => {
                            const categoryConf = CATEGORY_CONFIG[log.category] || CATEGORY_CONFIG.SYSTEM

                            // Use action-specific icon for COMMUNICATION category
                            let Icon = categoryConf.icon
                            let iconBg = categoryConf.color.split(' ')[0]
                            let iconColor = categoryConf.color.split(' ')[1]

                            if (log.category === 'COMMUNICATION') {
                                if (log.action.includes('SMS')) {
                                    Icon = MessageSquare
                                    iconBg = 'bg-green-100'
                                    iconColor = 'text-green-600'
                                } else if (log.action.includes('EMAIL')) {
                                    Icon = Mail
                                    iconBg = 'bg-purple-100'
                                    iconColor = 'text-purple-600'
                                }
                            }

                            return (
                                <Card key={log.id} className="hover:shadow-sm transition-shadow">
                                    <CardContent className="p-4 flex items-start gap-4">
                                        <div className={`p-2 rounded-lg ${iconBg}`}>
                                            <Icon className={`h-4 w-4 ${iconColor}`} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <Badge variant="outline" className={`text-xs ${categoryConf.color}`}>
                                                    {categoryConf.label}
                                                </Badge>
                                                <Badge variant="outline" className={`text-xs ${ACTION_COLORS[log.action] || ''}`}>
                                                    {log.action}
                                                </Badge>
                                                {log.entityName && (
                                                    <span className="text-sm font-medium">{log.entityName}</span>
                                                )}
                                            </div>
                                            <p className="text-sm text-slate-600 mt-1">{log.description}</p>
                                            <div className="flex items-center gap-4 text-xs text-slate-400 mt-2">
                                                <span>{formatTime(log.createdAt)}</span>
                                                {log.userName && <span>by {log.userName}</span>}
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            )
                        })}
                    </div>
                </ScrollArea>
            )}
        </div>
    )
}
