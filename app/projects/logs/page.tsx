'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useUserAccess } from '@/lib/user-access'
import {
    Activity,
    Send,
    Search,
    Trash2,
    Upload,
    Plus,
    User,
    Calendar,
    Filter,
    FileText,
    Link as LinkIcon,
    Image as ImageIcon,
    LayoutGrid
} from 'lucide-react'

interface LogEntry {
    id: number
    category: string
    action: string
    description: string
    details: string
    userId: string | null
    userName: string | null
    projectId: number | null
    project: { name: string; domain: string | null } | null
    createdAt: string
}

const categoryIcons: Record<string, any> = {
    'CONTENT_FACTORY': FileText,
    'LINK_INDEXING': Send,
    'LINK_BUILDING': LinkIcon,
    'IMAGE_FACTORY': ImageIcon,
    'SYSTEM': Activity
}

const categoryColors: Record<string, string> = {
    'CONTENT_FACTORY': 'bg-blue-100 text-blue-800',
    'LINK_INDEXING': 'bg-green-100 text-green-800',
    'LINK_BUILDING': 'bg-purple-100 text-purple-800',
    'IMAGE_FACTORY': 'bg-pink-100 text-pink-800',
    'SYSTEM': 'bg-gray-100 text-gray-800'
}

export default function ProjectLogsPage() {
    const { role, loading: accessLoading } = useUserAccess()
    const isSuperAdmin = role === 'SUPER_ADMIN'
    const [logs, setLogs] = useState<LogEntry[]>([])
    const [projects, setProjects] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [selectedProject, setSelectedProject] = useState<string>('all')
    const [selectedCategory, setSelectedCategory] = useState<string>('all')

    useEffect(() => {
        if (!accessLoading && isSuperAdmin) {
            fetchProjects()
            fetchLogs()
        }
    }, [accessLoading, isSuperAdmin, selectedProject, selectedCategory])

    async function fetchProjects() {
        try {
            const res = await fetch('/api/seo/projects')
            if (res.ok) {
                const data = await res.json()
                setProjects(data)
            }
        } catch (error) {
            console.error('Failed to fetch projects', error)
        }
    }

    async function fetchLogs() {
        setLoading(true)
        try {
            const params = new URLSearchParams()
            if (selectedProject !== 'all') params.append('projectId', selectedProject)
            if (selectedCategory !== 'all') params.append('category', selectedCategory)
            // Exclude Patrick CRM categories from SEO Activity Logs
            params.append('exclude', 'AUTOMATION,LEAD,EMAIL,SMS,SYSTEM,COMMUNICATION,MEETING,CALENDAR')

            const res = await fetch(`/api/activity-logs?${params.toString()}`)
            if (res.ok) {
                const data = await res.json()
                setLogs(data.logs || [])
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

    if (accessLoading) return <div className="p-6">Loading access...</div>

    if (!isSuperAdmin) {
        return (
            <div className="p-6 text-center text-muted-foreground">
                <p>Access Restricted to Super Admins</p>
            </div>
        )
    }

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
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
                </div>

                {/* Filters */}
                <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4 text-muted-foreground" />
                    <Select value={selectedProject} onValueChange={setSelectedProject}>
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="All Projects" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Projects</SelectItem>
                            {projects.map(p => (
                                <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                        <SelectTrigger className="w-[160px]">
                            <SelectValue placeholder="All Categories" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Categories</SelectItem>
                            <SelectItem value="CONTENT_FACTORY">Content Factory</SelectItem>
                            <SelectItem value="LINK_INDEXING">Link Indexing</SelectItem>
                            <SelectItem value="LINK_BUILDING">Link Building</SelectItem>
                            <SelectItem value="IMAGE_FACTORY">Image Factory</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* Logs List */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">Recent Activity</CardTitle>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="p-6 space-y-4">
                            <div className="h-8 bg-muted rounded w-48 animate-pulse"></div>
                            <div className="h-64 bg-muted rounded animate-pulse"></div>
                        </div>
                    ) : logs.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">
                            <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
                            <p>No activity logs found</p>
                        </div>
                    ) : (
                        <ScrollArea className="h-[600px]">
                            <div className="space-y-3">
                                {logs.map((log) => {
                                    const Icon = categoryIcons[log.category] || Activity
                                    const colorClass = categoryColors[log.category] || 'bg-gray-100 text-gray-800'

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
                                                    {log.project ? (
                                                        <Badge variant="outline" className="text-xs">
                                                            {log.project.name}
                                                        </Badge>
                                                    ) : (
                                                        <Badge variant="secondary" className="text-xs">Global</Badge>
                                                    )}
                                                    <Badge variant="secondary" className="text-[10px] font-normal">
                                                        {log.category.replace('_', ' ')}
                                                    </Badge>
                                                    <span className="text-xs text-muted-foreground ml-auto">
                                                        {log.action}
                                                    </span>
                                                </div>
                                                <p className="text-sm font-medium">{log.description}</p>

                                                <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                                                    <span className="flex items-center gap-1">
                                                        <User className="h-3 w-3" />
                                                        {log.userName || log.userId || 'System'}
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
