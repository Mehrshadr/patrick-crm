"use client"

import React, { useState, useEffect, use } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Checkbox } from "@/components/ui/checkbox"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { Label } from "@/components/ui/label"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import {
    ArrowLeft,
    Plus,
    Trash2,
    Play,
    ExternalLink,
    CheckCircle2,
    XCircle,
    ChevronDown,
    Search,
    Loader2,
    Clock,
    Undo2,
    FileText,
} from "lucide-react"
import { toast } from "sonner"

interface KeywordLog {
    id: number
    pageUrl: string
    pageTitle: string | null
    anchorId: string | null
    status: string
    message: string | null
    createdAt: string
}

interface Keyword {
    id: number
    keyword: string
    targetUrl: string
    pageTypes: string | null
    onlyFirst: boolean
    onlyFirstP: boolean
    isEnabled: boolean
    linksCreated: number
    logs?: KeywordLog[]
    _count?: { logs: number }
}

interface Log {
    id: number
    pageUrl: string
    pageTitle: string | null
    anchorId: string | null
    status: string
    message: string | null
    createdAt: string
    keyword: { keyword: string; targetUrl: string }
}

interface DiscoveredPageType {
    id: number
    typeName: string
    count: number
}

// Fallback static types (used if no crawl data exists)
const DEFAULT_PAGE_TYPES = [
    { value: 'service', label: 'Service' },
    { value: 'blog', label: 'Blog' },
    { value: 'landing', label: 'Landing' },
    { value: 'page', label: 'Page' },
]

export default function LinkBuildingPage({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = use(params)
    const [projectId, setProjectId] = useState<string | null>(null)
    const [keywords, setKeywords] = useState<Keyword[]>([])
    const [logs, setLogs] = useState<Log[]>([])
    const [loading, setLoading] = useState(true)
    const [project, setProject] = useState<{ name: string; domain: string | null } | null>(null)
    const [logsOpen, setLogsOpen] = useState(false)
    const [pluginLogs, setPluginLogs] = useState<string>('')
    const [logsLoading, setLogsLoading] = useState(false)

    // Fetch plugin logs when dialog opens
    useEffect(() => {
        if (logsOpen) {
            fetchPluginLogs()
        }
    }, [logsOpen])

    const fetchPluginLogs = async () => {
        if (!projectId) return
        setLogsLoading(true)
        try {
            const res = await fetch(`/api/seo/link-building/logs?projectId=${projectId}`)
            if (res.ok) {
                const data = await res.json()
                if (data.logs) {
                    setPluginLogs(data.logs)
                } else {
                    setPluginLogs('No logs found or empty response.')
                }
            } else {
                setPluginLogs('Failed to fetch logs.')
            }
        } catch (e) {
            setPluginLogs('Error fetching logs.')
        } finally {
            setLogsLoading(false)
        }
    }

    // New keyword form
    const [newKeyword, setNewKeyword] = useState('')
    const [newUrl, setNewUrl] = useState('')
    const [newPageTypes, setNewPageTypes] = useState<string[]>(['blog'])
    const [crawling, setCrawling] = useState(false)
    const [discoveredPageTypes, setDiscoveredPageTypes] = useState<DiscoveredPageType[]>([])
    const [expandedKeywords, setExpandedKeywords] = useState<Set<number>>(new Set())

    // Settings
    const [showSettings, setShowSettings] = useState(false)
    const [cmsUsername, setCmsUsername] = useState('')
    const [cmsAppPassword, setCmsAppPassword] = useState('')
    const [cmsApiKey, setCmsApiKey] = useState('')
    const [savingSettings, setSavingSettings] = useState(false)
    const [running, setRunning] = useState(false)
    const [runResult, setRunResult] = useState<{ linked: number; processed: number } | null>(null)
    const [selectedKeywords, setSelectedKeywords] = useState<number[]>([])
    const [selectedLogs, setSelectedLogs] = useState<number[]>([]) // Selected pending logs for processing
    const [expandedLogs, setExpandedLogs] = useState<Set<number>>(new Set()) // Expand to show existing backlinks
    const [pageBacklinks, setPageBacklinks] = useState<Record<number, { links: any[]; loading: boolean }>>({}) // Cache backlinks per log

    // Autonomous Mode State
    const [scanStatus, setScanStatus] = useState<'idle' | 'init' | 'scanning' | 'complete'>('idle')
    const [scanProgress, setScanProgress] = useState({ current: 0, total: 0 })
    const [processStatus, setProcessStatus] = useState<'idle' | 'processing' | 'paused'>('idle')
    const [processProgress, setProcessProgress] = useState({ current: 0, total: 0 })
    const [pendingCount, setPendingCount] = useState(0)

    // Stats Dashboard
    const [showStats, setShowStats] = useState(true)
    const [stats, setStats] = useState<{
        totalLinks: number
        linksThisWeek: number
        pendingCount: number
        skippedCount: number
        successRate: number
        topKeywords: { id: number; keyword: string; targetUrl: string; linksCreated: number }[]
    } | null>(null)

    useEffect(() => {
        fetchData()
    }, [slug])

    async function fetchData() {
        setLoading(true)
        try {
            // Fetch project info by slug
            const projectRes = await fetch(`/api/seo/projects/by-slug/${slug}`)
            if (!projectRes.ok) {
                toast.error('Project not found')
                setLoading(false)
                return
            }
            const projectData = await projectRes.json()
            const pid = String(projectData.id)
            setProjectId(pid)
            setProject(projectData)

            // Fetch keywords
            const kwRes = await fetch(`/api/seo/link-building/keywords?projectId=${pid}`)
            if (kwRes.ok) {
                const data = await kwRes.json()
                setKeywords(data.keywords || [])
            }

            // Fetch recent logs
            const logsRes = await fetch(`/api/seo/link-building/logs?projectId=${pid}&limit=20`)
            if (logsRes.ok) {
                const data = await logsRes.json()
                setLogs(data.logs || [])
            }

            // Fetch settings
            const settingsRes = await fetch(`/api/seo/projects/${pid}/settings`)
            if (settingsRes.ok) {
                const data = await settingsRes.json()
                if (data.settings) {
                    setCmsUsername(data.settings.cmsUsername || '')
                    setCmsAppPassword(data.settings.cmsAppPassword || '')
                    setCmsApiKey(data.settings.cmsApiKey || '')
                }
            }

            // Fetch discovered page types
            const typesRes = await fetch(`/api/seo/link-building/crawl?projectId=${pid}`)
            if (typesRes.ok) {
                const data = await typesRes.json()
                setDiscoveredPageTypes(data.pageTypes || [])
            }

            // Fetch stats
            const statsRes = await fetch(`/api/seo/link-building/stats?projectId=${pid}`)
            if (statsRes.ok) {
                const statsData = await statsRes.json()
                setStats(statsData)
            }
        } catch (e) {
            toast.error('Failed to load data')
        }

        setLoading(false)
    }

    async function handleScan() {
        if (!project?.domain || keywords.length === 0) return

        setScanStatus('init')
        setScanProgress({ current: 0, total: 0 })

        try {
            // 1. Get Pages
            const initRes = await fetch('/api/seo/link-building/scan', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'init', projectId })
            })

            if (!initRes.ok) {
                const errData = await initRes.json().catch(() => ({}))
                throw new Error(errData.error || 'Failed to init scan')
            }
            const { pages } = await initRes.json()

            setScanStatus('scanning')
            setScanProgress({ current: 0, total: pages.length })

            // 2. Batch Scan
            const batchSize = 3 // Concurrent requests
            let processed = 0

            // Function to scan single page
            const scanPage = async (page: any) => {
                try {
                    await fetch('/api/seo/link-building/scan', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            action: 'scan_page',
                            projectId,
                            pageId: page.id,
                            pageUrl: page.url,
                            pageTitle: page.title,
                            pageType: page.type, // Pass page type for keyword filtering
                            keywordIds: selectedKeywords.length ? selectedKeywords : undefined
                        })
                    })
                } catch (e) {
                    console.error('Scan error', page.id)
                } finally {
                    processed++
                    setScanProgress(prev => ({ ...prev, current: processed }))
                }
            }

            // Loop batches
            for (let i = 0; i < pages.length; i += batchSize) {
                const chunk = pages.slice(i, i + batchSize)
                await Promise.all(chunk.map(scanPage))
            }

            setScanStatus('complete')
            toast.success('Scan complete')
            await fetchData() // Refresh keywords with logs

        } catch (e: any) {
            toast.error(e.message || 'Scan failed')
            setScanStatus('idle')
        }
    }

    async function handleProcessQueue() {
        setProcessStatus('processing')
        try {
            let logIds: number[] = []

            // If specific logs are selected, use those
            if (selectedLogs.length > 0) {
                logIds = selectedLogs
            } else {
                // Otherwise fetch all pending logs
                const logsRes = await fetch(`/api/seo/link-building/logs?projectId=${projectId}&status=pending&limit=500`)
                if (!logsRes.ok) throw new Error('Failed to fetch queue')
                const { logs } = await logsRes.json()

                if (logs.length === 0) {
                    toast.info('No pending items')
                    setProcessStatus('idle')
                    return
                }
                logIds = logs.map((l: any) => l.id)
            }

            setProcessProgress({ current: 0, total: logIds.length })

            // Batch Process
            const batchSize = 5
            let processed = 0

            for (let i = 0; i < logIds.length; i += batchSize) {
                const chunk = logIds.slice(i, i + batchSize)

                await fetch('/api/seo/link-building/process', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ projectId, logIds: chunk })
                })

                processed += chunk.length
                setProcessProgress(prev => ({ ...prev, current: processed }))
            }

            toast.success('Processing complete')
            setSelectedLogs([]) // Clear selection
            fetchData()

        } catch (e) {
            toast.error('Processing failed')
        }
        setProcessStatus('idle')
    }

    async function handleCrawl() {
        setCrawling(true)
        try {
            const res = await fetch('/api/seo/link-building/crawl', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ projectId })
            })
            if (res.ok) {
                const data = await res.json()
                setDiscoveredPageTypes(data.pageTypes || [])
                toast.success(`Crawled ${data.totalPages} pages`)
            } else {
                const errData = await res.json().catch(() => ({}))
                toast.error(errData.error || 'Crawl failed')
            }
        } catch (e) {
            toast.error('Crawl failed')
        }
        setCrawling(false)
    }

    function toggleKeywordExpanded(keywordId: number) {
        setExpandedKeywords(prev => {
            const next = new Set(prev)
            if (next.has(keywordId)) {
                next.delete(keywordId)
            } else {
                next.add(keywordId)
            }
            return next
        })
    }

    async function addKeyword() {
        if (!newKeyword.trim() || !newUrl.trim()) {
            toast.error('Keyword and URL required')
            return
        }

        try {
            const res = await fetch('/api/seo/link-building/keywords', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectId: parseInt(projectId!),
                    keyword: newKeyword.trim(),
                    targetUrl: newUrl.trim(),
                    pageTypes: newPageTypes
                })
            })

            if (res.ok) {
                toast.success('Keyword added')
                setNewKeyword('')
                setNewUrl('')
                fetchData()
            } else {
                const err = await res.json()
                toast.error(err.error || 'Failed to add keyword')
            }
        } catch (e) {
            toast.error('Failed to add keyword')
        }
    }

    async function toggleKeyword(id: number, enabled: boolean) {
        try {
            await fetch(`/api/seo/link-building/keywords/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ isEnabled: enabled })
            })
            setKeywords(keywords.map(k => k.id === id ? { ...k, isEnabled: enabled } : k))
        } catch (e) {
            toast.error('Failed to update')
        }
    }

    async function deleteKeyword(id: number) {
        if (!confirm('Delete this keyword?')) return

        try {
            await fetch(`/api/seo/link-building/keywords/${id}`, { method: 'DELETE' })
            setKeywords(keywords.filter(k => k.id !== id))
            toast.success('Keyword deleted')
        } catch (e) {
            toast.error('Failed to delete')
        }
    }

    async function handleRun() {
        if (keywords.length === 0) {
            toast.error('Add keywords first')
            return
        }
        if (!cmsApiKey && (!cmsUsername || !cmsAppPassword)) {
            toast.error('Configure WordPress settings first (API Key or Username/Password)')
            setShowSettings(true)
            return
        }

        setRunning(true)
        setRunResult(null)
        try {
            const res = await fetch('/api/seo/link-building/run', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ projectId: parseInt(projectId!) })
            })

            if (res.ok) {
                const data = await res.json()
                setRunResult(data.results)
                toast.success(`Linked ${data.results?.linked || 0} times across ${data.results?.processed || 0} pages`)
                fetchData() // Refresh logs
            } else {
                const err = await res.json()
                toast.error(err.error || 'Run failed')
            }
        } catch (e) {
            toast.error('Run failed')
        }
        setRunning(false)
    }

    // Toggle log expansion and fetch backlinks
    async function toggleLogExpand(logId: number, pageId: number) {
        const newExpanded = new Set(expandedLogs)
        if (newExpanded.has(logId)) {
            newExpanded.delete(logId)
        } else {
            newExpanded.add(logId)
            // Fetch backlinks if not cached
            if (!pageBacklinks[logId]) {
                setPageBacklinks(prev => ({ ...prev, [logId]: { links: [], loading: true } }))
                try {
                    const res = await fetch('/api/seo/link-building/backlinks', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ action: 'get_backlinks', projectId, pageId })
                    })
                    if (res.ok) {
                        const data = await res.json()
                        setPageBacklinks(prev => ({ ...prev, [logId]: { links: data.links || [], loading: false } }))
                    } else {
                        setPageBacklinks(prev => ({ ...prev, [logId]: { links: [], loading: false } }))
                    }
                } catch (e) {
                    setPageBacklinks(prev => ({ ...prev, [logId]: { links: [], loading: false } }))
                }
            }
        }
        setExpandedLogs(newExpanded)
    }

    // Remove a backlink from page
    async function removeBacklink(logId: number, pageId: number, linkId: string) {
        if (!confirm('Remove this link?')) return
        try {
            const res = await fetch('/api/seo/link-building/backlinks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'remove_link', projectId, pageId, linkId })
            })
            if (res.ok) {
                toast.success('Link removed')
                // Refresh backlinks cache if it exists
                setPageBacklinks(prev => {
                    if (!prev[logId]) return prev // No cache to update
                    return {
                        ...prev,
                        [logId]: {
                            ...prev[logId],
                            links: prev[logId].links.filter((l: any) => l.id !== linkId)
                        }
                    }
                })
                fetchData() // Refresh logs to update status
            } else {
                toast.error('Failed to remove link')
            }
        } catch (e) {
            toast.error('Failed to remove link')
        }
    }

    if (loading) {
        return <div className="p-6 text-center text-slate-500">Loading...</div>
    }

    return (
        <div className="h-[calc(100vh-64px)] flex flex-col overflow-hidden">
            {/* Header - Fixed */}
            <div className="shrink-0 p-4 border-b space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex flex-col gap-1">
                        {/* Breadcrumb */}
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Link href="/projects" className="hover:text-foreground">
                                Projects
                            </Link>
                            <span>/</span>
                            <Link href={`/projects/${slug}`} className="hover:text-foreground">
                                {project?.name}
                            </Link>
                            <span>/</span>
                            <span className="text-foreground font-semibold">Link Building</span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                            {project?.domain || 'No domain'} · {keywords.length} keywords
                        </p>
                    </div>
                    <div className="flex gap-2 items-center flex-wrap">
                        {/* Scan Button */}
                        <Button
                            variant={scanStatus !== 'idle' ? "secondary" : "outline"}
                            size="sm"
                            onClick={handleScan}
                            disabled={scanStatus !== 'idle' || running || !project?.domain}
                        >
                            {scanStatus === 'init' ? (
                                <>
                                    <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                                    <span className="text-xs">Initializing...</span>
                                </>
                            ) : scanStatus === 'scanning' ? (
                                <>
                                    <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                                    <span className="text-xs">
                                        {scanProgress.total > 0 ? Math.round((scanProgress.current / scanProgress.total) * 100) : 0}%
                                    </span>
                                </>
                            ) : (
                                <>
                                    <Search className="mr-1 h-3 w-3" />
                                    {selectedKeywords.length > 0 ? `Scan (${selectedKeywords.length})` : 'Scan All'}
                                </>
                            )}
                        </Button>

                        {/* Process Button */}
                        <Button
                            size="sm"
                            onClick={handleProcessQueue}
                            disabled={processStatus === 'processing' || scanStatus === 'scanning'}
                        >
                            {processStatus === 'processing' ? (
                                <>
                                    <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                                    <span className="text-xs">
                                        {processProgress.current}/{processProgress.total}
                                    </span>
                                </>
                            ) : (
                                <>
                                    <Play className="mr-1 h-3 w-3" />
                                    Run
                                    {selectedLogs.length > 0 && (
                                        <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">
                                            {selectedLogs.length}
                                        </Badge>
                                    )}
                                </>
                            )}
                        </Button>

                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleRun}
                            className="text-slate-400"
                            title="Legacy Run All (Single Batch)"
                        >
                            Classic Run
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setLogsOpen(true)}
                            className="text-slate-400"
                            title="View Plugin Logs"
                        >
                            <FileText className="h-4 w-4" />
                        </Button>
                    </div>
                </div>

                {/* Progress Bar Area (Conditional) */}
                {(scanStatus === 'scanning' || processStatus === 'processing') && (
                    <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden">
                        <div
                            className={`h-full transition-all duration-300 ${scanStatus === 'scanning' ? 'bg-blue-500' : 'bg-green-500'}`}
                            style={{
                                width: `${scanStatus === 'scanning'
                                    ? (scanProgress.current / Math.max(scanProgress.total, 1)) * 100
                                    : (processProgress.current / Math.max(processProgress.total, 1)) * 100}%`
                            }}
                        />
                    </div>
                )}
            </div>

            {/* Main Content - Scrollable */}
            <div className="flex-1 overflow-auto p-4 space-y-4">
                {/* Stats Dashboard */}
                {stats && (
                    <Collapsible open={showStats} onOpenChange={setShowStats}>
                        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-slate-800 dark:to-slate-800 rounded-lg border p-3">
                            <CollapsibleTrigger className="flex items-center justify-between w-full">
                                <div className="flex items-center gap-4">
                                    <div className="text-left">
                                        <p className="text-xs text-muted-foreground">Total Links</p>
                                        <p className="text-xl font-bold text-blue-600">{stats.totalLinks}</p>
                                    </div>
                                    <div className="text-left">
                                        <p className="text-xs text-muted-foreground">This Week</p>
                                        <p className="text-xl font-bold text-green-600">+{stats.linksThisWeek}</p>
                                    </div>
                                    <div className="text-left">
                                        <p className="text-xs text-muted-foreground">Pending</p>
                                        <p className="text-xl font-bold text-orange-500">{stats.pendingCount}</p>
                                    </div>
                                    <div className="text-left">
                                        <p className="text-xs text-muted-foreground">Success Rate</p>
                                        <p className="text-xl font-bold text-purple-600">{stats.successRate}%</p>
                                    </div>
                                </div>
                                <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${showStats ? 'rotate-180' : ''}`} />
                            </CollapsibleTrigger>
                            <CollapsibleContent className="pt-3 mt-3 border-t">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <p className="text-sm font-medium mb-2">Top Keywords</p>
                                        {stats.topKeywords.length > 0 ? (
                                            <div className="space-y-1">
                                                {stats.topKeywords.map((tk, i) => (
                                                    <div key={tk.id} className="flex items-center justify-between text-xs bg-white dark:bg-slate-700 rounded px-2 py-1">
                                                        <span className="truncate max-w-[200px]">{tk.keyword}</span>
                                                        <Badge variant="outline" className="ml-2">{tk.linksCreated}</Badge>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <p className="text-xs text-muted-foreground">No links created yet</p>
                                        )}
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium mb-2">Summary</p>
                                        <div className="text-xs space-y-1">
                                            <p>✅ {stats.totalLinks} links created successfully</p>
                                            <p>⏳ {stats.pendingCount} opportunities waiting</p>
                                            <p>⏭️ {stats.skippedCount} skipped</p>
                                        </div>
                                    </div>
                                </div>
                            </CollapsibleContent>
                        </div>
                    </Collapsible>
                )}

                {/* Add Keyword */}
                <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-lg border">
                    <Input
                        placeholder="Keyword"
                        value={newKeyword}
                        onChange={e => setNewKeyword(e.target.value)}
                        className="flex-1 h-9 bg-white"
                    />
                    <Input
                        placeholder="/target-url"
                        value={newUrl}
                        onChange={e => setNewUrl(e.target.value)}
                        className="flex-1 h-9 bg-white"
                    />
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="outline" className="h-9 min-w-[140px] justify-between">
                                <span className="text-sm truncate">
                                    {newPageTypes.length === 0
                                        ? 'Select pages...'
                                        : `${newPageTypes.length} selected`
                                    }
                                </span>
                                <ChevronDown className="h-4 w-4 ml-2 shrink-0 opacity-50" />
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-56 p-2" align="start">
                            <div className="space-y-1">
                                {discoveredPageTypes.length > 0 ? (
                                    discoveredPageTypes.map(pt => (
                                        <label
                                            key={pt.typeName}
                                            className="flex items-center gap-2 px-2 py-1.5 text-sm cursor-pointer hover:bg-slate-100 rounded"
                                        >
                                            <Checkbox
                                                checked={newPageTypes.includes(pt.typeName)}
                                                onCheckedChange={(checked) => {
                                                    if (checked) {
                                                        setNewPageTypes([...newPageTypes, pt.typeName])
                                                    } else {
                                                        setNewPageTypes(newPageTypes.filter(p => p !== pt.typeName))
                                                    }
                                                }}
                                            />
                                            <span className="flex-1">{pt.typeName}</span>
                                            <Badge variant="secondary" className="text-xs">{pt.count}</Badge>
                                        </label>
                                    ))
                                ) : (
                                    DEFAULT_PAGE_TYPES.map(pt => (
                                        <label
                                            key={pt.value}
                                            className="flex items-center gap-2 px-2 py-1.5 text-sm cursor-pointer hover:bg-slate-100 rounded"
                                        >
                                            <Checkbox
                                                checked={newPageTypes.includes(pt.value)}
                                                onCheckedChange={(checked) => {
                                                    if (checked) {
                                                        setNewPageTypes([...newPageTypes, pt.value])
                                                    } else {
                                                        setNewPageTypes(newPageTypes.filter(p => p !== pt.value))
                                                    }
                                                }}
                                            />
                                            {pt.label}
                                        </label>
                                    ))
                                )}
                            </div>
                            <div className="border-t mt-2 pt-2">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="w-full text-xs"
                                    onClick={handleCrawl}
                                    disabled={crawling}
                                >
                                    {crawling ? (
                                        <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Crawling...</>
                                    ) : (
                                        <><Search className="h-3 w-3 mr-1" /> Refresh from Site</>
                                    )}
                                </Button>
                            </div>
                        </PopoverContent>
                    </Popover>
                    <Button size="sm" onClick={addKeyword} className="h-9 px-4">
                        <Plus className="h-4 w-4 mr-1" /> Add
                    </Button>
                </div>

                {/* Keywords Table */}
                <div className="border rounded-lg overflow-hidden bg-white">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-slate-50">
                                <TableHead className="w-[40px]">
                                    <Checkbox
                                        checked={selectedKeywords.length === keywords.length && keywords.length > 0}
                                        onCheckedChange={(checked) => {
                                            if (checked) {
                                                setSelectedKeywords(keywords.map(k => k.id))
                                            } else {
                                                setSelectedKeywords([])
                                            }
                                        }}
                                    />
                                </TableHead>
                                <TableHead className="w-[180px]">Keyword</TableHead>
                                <TableHead>Target URL</TableHead>
                                <TableHead className="w-[100px]">Pages</TableHead>
                                <TableHead className="w-[60px] text-center">Links</TableHead>
                                <TableHead className="w-[60px] text-center">Active</TableHead>
                                <TableHead className="w-[80px]"></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {keywords.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="text-center text-slate-400 py-8">
                                        No keywords yet. Add your first one above.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                keywords.map(kw => {
                                    const pageTypes = kw.pageTypes ? JSON.parse(kw.pageTypes) : []
                                    const isExpanded = expandedKeywords.has(kw.id)
                                    const keywordLogs = kw.logs || []

                                    return (
                                        <React.Fragment key={kw.id}>
                                            <TableRow className={!kw.isEnabled ? 'opacity-50' : ''}>
                                                <TableCell>
                                                    <Checkbox
                                                        checked={selectedKeywords.includes(kw.id)}
                                                        onCheckedChange={(checked) => {
                                                            if (checked) {
                                                                setSelectedKeywords([...selectedKeywords, kw.id])
                                                            } else {
                                                                setSelectedKeywords(selectedKeywords.filter(id => id !== kw.id))
                                                            }
                                                        }}
                                                    />
                                                </TableCell>
                                                <TableCell className="font-medium">{kw.keyword}</TableCell>
                                                <TableCell className="text-sm text-slate-600">
                                                    <a href={kw.targetUrl} target="_blank" rel="noopener noreferrer" className="hover:underline flex items-center gap-1">
                                                        {kw.targetUrl}
                                                        <ExternalLink className="h-3 w-3" />
                                                    </a>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex gap-1 flex-wrap">
                                                        {pageTypes.map((pt: string) => (
                                                            <Badge key={pt} variant="outline" className="text-xs">{pt}</Badge>
                                                        ))}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    <button
                                                        onClick={() => toggleKeywordExpanded(kw.id)}
                                                        className="flex items-center gap-1 mx-auto hover:bg-slate-100 px-2 py-1 rounded"
                                                    >
                                                        <Badge variant="secondary">{keywordLogs.length}</Badge>
                                                        <ChevronDown className={`h-3 w-3 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                                                    </button>
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    <Switch
                                                        checked={kw.isEnabled}
                                                        onCheckedChange={v => toggleKeyword(kw.id, v)}
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex gap-1">
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-7 w-7 text-slate-400 hover:text-red-500"
                                                            onClick={() => deleteKeyword(kw.id)}
                                                        >
                                                            <Trash2 className="h-3.5 w-3.5" />
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                            {isExpanded && (
                                                <TableRow className="bg-slate-50 hover:bg-slate-50">
                                                    <TableCell colSpan={7} className="p-0">
                                                        <div className="px-4 py-2 max-h-64 overflow-y-auto">
                                                            {keywordLogs.length === 0 ? (
                                                                <p className="text-sm text-slate-400 py-2">No links yet</p>
                                                            ) : (
                                                                <div className="space-y-1">
                                                                    {keywordLogs.map(log => {
                                                                        const isLogExpanded = expandedLogs.has(log.id)
                                                                        const backlinksData = pageBacklinks[log.id]
                                                                        // @ts-ignore - pageId might exist
                                                                        const logPageId = log.pageId || 0
                                                                        const isLinked = log.status === 'linked'
                                                                        // Check message for existing links indicator
                                                                        const hasExisting = log.message?.includes('existing') || log.message?.includes('Already linked')

                                                                        return (
                                                                            <div key={log.id} className="border-b last:border-b-0">
                                                                                <div className={`flex items-center gap-2 text-sm py-1.5 px-2 rounded-t ${isLinked ? 'bg-green-50' : hasExisting ? 'bg-purple-50' : 'hover:bg-slate-100'}`}>
                                                                                    {isLinked ? (
                                                                                        <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
                                                                                    ) : hasExisting ? (
                                                                                        <Badge variant="secondary" className="h-4 px-1 text-[10px] bg-purple-100 text-purple-700 hover:bg-purple-200 border-purple-200 flex-shrink-0">
                                                                                            ✓
                                                                                        </Badge>
                                                                                    ) : (
                                                                                        <Checkbox
                                                                                            checked={selectedLogs.includes(log.id)}
                                                                                            onCheckedChange={(checked) => {
                                                                                                if (checked) {
                                                                                                    setSelectedLogs([...selectedLogs, log.id])
                                                                                                } else {
                                                                                                    setSelectedLogs(selectedLogs.filter(id => id !== log.id))
                                                                                                }
                                                                                            }}
                                                                                            className="h-4 w-4"
                                                                                        />
                                                                                    )}
                                                                                    <a
                                                                                        href={`${log.pageUrl}${log.anchorId ? '#' + log.anchorId : ''}`}
                                                                                        target="_blank"
                                                                                        rel="noopener noreferrer"
                                                                                        className={`hover:underline truncate flex-1 ${isLinked ? 'text-green-700 font-medium' : hasExisting ? 'text-purple-700 font-medium' : 'text-amber-600'}`}
                                                                                    >
                                                                                        {log.pageTitle || log.pageUrl}
                                                                                    </a>
                                                                                    <span className="text-xs text-slate-400">
                                                                                        {new Date(log.createdAt).toLocaleDateString()}
                                                                                    </span>
                                                                                    <button
                                                                                        onClick={() => toggleLogExpand(log.id, logPageId)}
                                                                                        className="p-1 hover:bg-slate-200 rounded"
                                                                                        title="View existing backlinks"
                                                                                    >
                                                                                        <ChevronDown className={`h-3 w-3 transition-transform ${isLogExpanded ? 'rotate-180' : ''}`} />
                                                                                    </button>
                                                                                    {log.status === 'linked' && log.anchorId && (
                                                                                        <Button
                                                                                            variant="ghost"
                                                                                            size="icon"
                                                                                            className="h-6 w-6 text-slate-400 hover:text-amber-600 hover:bg-amber-50"
                                                                                            title="Undo Link (Remove)"
                                                                                            onClick={(e) => {
                                                                                                e.stopPropagation()
                                                                                                // @ts-ignore
                                                                                                removeBacklink(log.id, log.pageId || 0, log.anchorId)
                                                                                            }}
                                                                                        >
                                                                                            <Undo2 className="h-3.5 w-3.5" />
                                                                                        </Button>
                                                                                    )}
                                                                                </div>
                                                                                {isLogExpanded && (
                                                                                    <div className="bg-slate-100 px-3 py-2 text-xs">
                                                                                        {backlinksData?.loading ? (
                                                                                            <div className="flex items-center gap-1 text-slate-500">
                                                                                                <Loader2 className="h-3 w-3 animate-spin" /> Loading...
                                                                                            </div>
                                                                                        ) : backlinksData?.links.length === 0 ? (
                                                                                            <span className="text-slate-400">No backlinks in this page</span>
                                                                                        ) : (
                                                                                            <div className="flex flex-wrap gap-1">
                                                                                                {backlinksData?.links.map((link: any) => (
                                                                                                    <Badge
                                                                                                        key={link.id}
                                                                                                        variant="secondary"
                                                                                                        className="group cursor-default pl-2 pr-1"
                                                                                                        title={link.url}
                                                                                                    >
                                                                                                        <span className="max-w-[120px] truncate">{link.anchor}</span>
                                                                                                        <button
                                                                                                            onClick={() => removeBacklink(log.id, logPageId, link.id)}
                                                                                                            className="ml-1 p-0.5 hover:bg-red-100 rounded opacity-50 group-hover:opacity-100"
                                                                                                        >
                                                                                                            <XCircle className="h-3 w-3 text-red-500" />
                                                                                                        </button>
                                                                                                    </Badge>
                                                                                                ))}
                                                                                            </div>
                                                                                        )}
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        )
                                                                    })}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            )}
                                        </React.Fragment>
                                    )
                                })
                            )}
                        </TableBody>
                    </Table>
                </div>

                {/* Settings */}
                <Collapsible open={showSettings} onOpenChange={setShowSettings} className="border rounded-lg">
                    <CollapsibleTrigger asChild>
                        <button className="w-full flex items-center justify-between p-3 text-sm font-medium text-slate-600 hover:bg-slate-50">
                            <span>⚙️ WordPress Settings</span>
                            <ChevronDown className={`h-4 w-4 transition-transform ${showSettings ? 'rotate-180' : ''}`} />
                        </button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="px-3 pb-3">
                        <div className="space-y-4 pt-2">
                            {/* API Key - Recommended */}
                            <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                                <Label className="text-xs font-medium text-green-800">🔑 API Key (Recommended)</Label>
                                <p className="text-xs text-green-600 mb-2">Get this from WordPress → Settings → Mehrana App Plugin. No Application Password needed!</p>
                                <Input
                                    value={cmsApiKey}
                                    onChange={e => setCmsApiKey(e.target.value)}
                                    placeholder="plb_xxxxxxxxxx"
                                    className="bg-white"
                                />
                            </div>

                            {/* OR divider */}
                            <div className="flex items-center gap-2">
                                <div className="flex-1 h-px bg-slate-200"></div>
                                <span className="text-xs text-slate-400">OR use Application Password</span>
                                <div className="flex-1 h-px bg-slate-200"></div>
                            </div>

                            {/* Application Password */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label className="text-xs">WordPress Username</Label>
                                    <Input
                                        value={cmsUsername}
                                        onChange={e => setCmsUsername(e.target.value)}
                                        placeholder="admin"
                                        className="mt-1"
                                        disabled={!!cmsApiKey}
                                    />
                                </div>
                                <div>
                                    <Label className="text-xs">Application Password</Label>
                                    <Input
                                        value={cmsAppPassword}
                                        onChange={e => setCmsAppPassword(e.target.value)}
                                        placeholder="xxxx xxxx xxxx xxxx"
                                        type="password"
                                        className="mt-1"
                                        disabled={!!cmsApiKey}
                                    />
                                </div>
                            </div>
                        </div>
                        <Button
                            size="sm"
                            className="mt-3"
                            disabled={savingSettings}
                            onClick={async () => {
                                setSavingSettings(true)
                                try {
                                    const res = await fetch(`/api/seo/projects/${projectId}/settings`, {
                                        method: 'PUT',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({
                                            cmsType: 'wordpress',
                                            cmsUrl: project?.domain?.startsWith('http') ? project.domain : `https://${project?.domain}`,
                                            cmsUsername: cmsApiKey ? '' : cmsUsername,
                                            cmsAppPassword: cmsApiKey ? '' : cmsAppPassword,
                                            cmsApiKey
                                        })
                                    })
                                    if (res.ok) {
                                        toast.success('Settings saved')
                                    } else {
                                        toast.error('Failed to save')
                                    }
                                } catch (e) {
                                    toast.error('Failed to save')
                                }
                                setSavingSettings(false)
                            }}
                        >
                            {savingSettings ? 'Saving...' : 'Save Settings'}
                        </Button>
                    </CollapsibleContent>
                </Collapsible>
            </div>
            {/* Logs Dialog */}
            <Dialog open={logsOpen} onOpenChange={setLogsOpen}>
                <DialogContent className="max-w-4xl max-h-[80vh] flex flex-col">
                    <DialogHeader>
                        <DialogTitle>Plugin Logs</DialogTitle>
                        <DialogDescription>
                            Recent logs from the WordPress plugin ({project?.domain})
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex-1 overflow-auto bg-slate-950 text-slate-50 p-4 rounded-md font-mono text-xs whitespace-pre-wrap">
                        {logsLoading ? 'Loading logs...' : pluginLogs || 'No logs available.'}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}
