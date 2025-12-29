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

    // Autonomous Mode State
    const [scanStatus, setScanStatus] = useState<'idle' | 'init' | 'scanning' | 'complete'>('idle')
    const [scanProgress, setScanProgress] = useState({ current: 0, total: 0 })
    const [processStatus, setProcessStatus] = useState<'idle' | 'processing' | 'paused'>('idle')
    const [processProgress, setProcessProgress] = useState({ current: 0, total: 0 })
    const [pendingCount, setPendingCount] = useState(0)

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
                        body: JSON.stringify({
                            action: 'scan_page',
                            projectId,
                            pageId: page.id,
                            pageUrl: page.url,
                            pageTitle: page.title,
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
            // 1. Fetch pending logs (ALL)
            // We need an endpoint for this. Using the logs endpoint with high limit?
            const logsRes = await fetch(`/api/seo/link-building/logs?projectId=${projectId}&status=pending&limit=500`)
            if (!logsRes.ok) throw new Error('Failed to fetch queue')
            const { logs } = await logsRes.json()

            if (logs.length === 0) {
                toast.info('No pending items')
                setProcessStatus('idle')
                return
            }

            setProcessProgress({ current: 0, total: logs.length })

            // 2. Batch Process
            const batchSize = 5
            const logIds = logs.map((l: any) => l.id)
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

    if (loading) {
        return <div className="p-6 text-center text-slate-500">Loading...</div>
    }

    return (
        <div className="h-[calc(100vh-64px)] flex flex-col overflow-hidden">
            {/* Header - Fixed */}
            <div className="shrink-0 p-4 border-b space-y-3">
                <div className="flex items-center justify-between">
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
                    <div className="flex gap-2 items-center">
                        {/* Scan Button */}
                        <Button
                            variant={scanStatus === 'scanning' ? "secondary" : "outline"}
                            size="sm"
                            onClick={handleScan}
                            disabled={scanStatus === 'scanning' || running || !project?.domain}
                        >
                            {scanStatus === 'scanning' ? (
                                <>
                                    <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                                    <span className="text-xs">
                                        {Math.round((scanProgress.current / scanProgress.total) * 100)}%
                                    </span>
                                </>
                            ) : (
                                <>
                                    <Search className="mr-1 h-3 w-3" />
                                    Scan
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
                                    <CheckCircle2 className="mr-1 h-3 w-3" />
                                    Process Queue
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
                                                                    {keywordLogs.map(log => (
                                                                        <div key={log.id} className="flex items-center gap-2 text-sm py-1">
                                                                            {log.status === 'linked' ? (
                                                                                <CheckCircle2 className="h-3 w-3 text-green-500 flex-shrink-0" />
                                                                            ) : (
                                                                                <Clock className="h-3 w-3 text-amber-500 flex-shrink-0" />
                                                                            )}
                                                                            <a
                                                                                href={`${log.pageUrl}${log.anchorId ? '#' + log.anchorId : ''}`}
                                                                                target="_blank"
                                                                                rel="noopener noreferrer"
                                                                                className={`hover:underline truncate flex-1 ${log.status === 'linked' ? 'text-blue-600' : 'text-amber-600'}`}
                                                                            >
                                                                                {log.pageTitle || log.pageUrl}
                                                                            </a>
                                                                            <span className="text-xs text-slate-400">
                                                                                {new Date(log.createdAt).toLocaleDateString()}
                                                                            </span>
                                                                        </div>
                                                                    ))}
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
        </div>
    )
}
