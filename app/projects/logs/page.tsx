'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
    Activity,
    Send,
    Search,
    Trash2,
    Upload,
    Plus,
    User,
    Calendar
} from 'lucide-react'

interface LogEntry {
    id: number
    action: string
    details: string
    userId: number | null
    userName: string | null
    projectId: number
    projectName: string
    createdAt: string
}

const actionIcons: Record<string, any> = {
    'INDEX': Send,
    'CHECK_STATUS': Search,
    'DELETE': Trash2,
    'IMPORT': Upload,
    'ADD': Plus,
}

const actionColors: Record<string, string> = {
    'INDEX': 'bg-green-100 text-green-800',
    'CHECK_STATUS': 'bg-blue-100 text-blue-800',
    'DELETE': 'bg-red-100 text-red-800',
    'IMPORT': 'bg-purple-100 text-purple-800',
    'ADD': 'bg-yellow-100 text-yellow-800',
}

export default function ProjectLogsPage() {
    const [logs, setLogs] = useState<LogEntry[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        fetchLogs()
    }, [])

    async function fetchLogs() {
        try {
            const res = await fetch('/api/seo/logs')
            if (res.ok) {
                const data = await res.json()
                setLogs(data)
            }
        } catch (error) {
            console.error('Failed to fetch logs:', error)
        } finally {
            setLoading(false)
        }
    }

    function formatDate(dateStr: string) {
        const date = new Date(dateStr)
        const now = new Date()
        const isToday = date.toDateString() === now.toDateString()

        if (isToday) {
            return 'Today, ' + date.toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit'
            })
        }

        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        })
    }

    if (loading) {
        return (
            <div className="p-6">
                <div className="animate-pulse space-y-4">
                    <div className="h-8 bg-muted rounded w-48"></div>
                    <div className="h-64 bg-muted rounded"></div>
                </div>
            </div>
        )
    }

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                        <Link href="/projects" className="hover:text-foreground">Projects</Link>
                        <span>/</span>
                        <span className="text-foreground">Activity Logs</span>
                    </div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <Activity className="h-6 w-6" />
                        Activity Logs
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        Recent activity across all projects
                    </p>
                </div>
            </div>

            {/* Logs List */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">Recent Activity</CardTitle>
                </CardHeader>
                <CardContent>
                    {logs.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">
                            <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
                            <p>No activity logs yet</p>
                        </div>
                    ) : (
                        <ScrollArea className="h-[600px]">
                            <div className="space-y-3">
                                {logs.map((log) => {
                                    const Icon = actionIcons[log.action] || Activity
                                    const colorClass = actionColors[log.action] || 'bg-gray-100 text-gray-800'

                                    return (
                                        <div
                                            key={log.id}
                                            className="flex items-start gap-4 p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                                        >
                                            <div className={`p-2 rounded ${colorClass}`}>
                                                <Icon className="h-4 w-4" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <Badge variant="outline" className="text-xs">
                                                        {log.projectName}
                                                    </Badge>
                                                    <span className="text-xs text-muted-foreground">
                                                        {log.action}
                                                    </span>
                                                </div>
                                                <p className="text-sm truncate">{log.details}</p>
                                                <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                                                    <span className="flex items-center gap-1">
                                                        <User className="h-3 w-3" />
                                                        {log.userName || 'System'}
                                                    </span>
                                                    <span className="flex items-center gap-1">
                                                        <Calendar className="h-3 w-3" />
                                                        {formatDate(log.createdAt)}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </ScrollArea>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
