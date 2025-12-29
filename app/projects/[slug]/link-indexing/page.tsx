"use client"

import { useState, useEffect, use, useMemo } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip"
import {
    Plus,
    MoreHorizontal,
    Trash2,
    ArrowLeft,
    Send,
    RefreshCw,
    CheckCircle2,
    Clock,
    AlertCircle,
    ExternalLink,
    Search,
    Download,
    Upload,
    FileSpreadsheet,
    X,
    HelpCircle,
    ArrowRight,
    Link2Off,
    ArrowUp,
    ArrowDown,
} from "lucide-react"
import { toast } from "sonner"
import { ProgressDialog } from "@/components/seo/progress-dialog"
import { QuotaCounter } from "@/components/seo/quota-counter"

interface IndexingUrl {
    id: number
    url: string
    status: string
    interval: string | null
    lastSubmittedAt: string | null
    lastInspectedAt: string | null
    lastInspectionResult: string | null
    lastCrawledAt: string | null
    createdAt: string
}

interface Project {
    id: number
    name: string
    slug: string
    domain: string | null
    description: string | null
}

// Google's actual status values with colors
// Only "Submitted and indexed" is GREEN, all others are non-green
const statusConfig: Record<string, {
    label: string
    icon: React.ElementType
    bgColor: string
    textColor: string
}> = {
    // ✅ INDEXED - The only green status
    'Submitted and indexed': {
        label: 'Submitted and indexed',
        icon: CheckCircle2,
        bgColor: 'bg-green-100 dark:bg-green-900/30',
        textColor: 'text-green-700 dark:text-green-400'
    },

    // ⚠️ CRAWLED BUT NOT INDEXED - Yellow/Orange
    'Crawled - currently not indexed': {
        label: 'Crawled - not indexed',
        icon: Clock,
        bgColor: 'bg-yellow-100 dark:bg-yellow-900/30',
        textColor: 'text-yellow-700 dark:text-yellow-400'
    },
    'Discovered - currently not indexed': {
        label: 'Discovered - not indexed',
        icon: Clock,
        bgColor: 'bg-amber-100 dark:bg-amber-900/30',
        textColor: 'text-amber-700 dark:text-amber-400'
    },

    // 🔄 REDIRECTS - Orange
    'Page with redirect': {
        label: 'Redirect',
        icon: ArrowRight,
        bgColor: 'bg-orange-100 dark:bg-orange-900/30',
        textColor: 'text-orange-700 dark:text-orange-400'
    },
    'Redirect error': {
        label: 'Redirect error',
        icon: AlertCircle,
        bgColor: 'bg-orange-100 dark:bg-orange-900/30',
        textColor: 'text-orange-700 dark:text-orange-400'
    },

    // 🚫 EXCLUDED - Purple/Blue
    "Excluded by 'noindex' tag": {
        label: 'Excluded (noindex)',
        icon: Link2Off,
        bgColor: 'bg-purple-100 dark:bg-purple-900/30',
        textColor: 'text-purple-700 dark:text-purple-400'
    },
    'Alternate page with proper canonical tag': {
        label: 'Alternate (canonical)',
        icon: Link2Off,
        bgColor: 'bg-blue-100 dark:bg-blue-900/30',
        textColor: 'text-blue-700 dark:text-blue-400'
    },
    'Duplicate without user-selected canonical': {
        label: 'Duplicate (no canonical)',
        icon: Link2Off,
        bgColor: 'bg-indigo-100 dark:bg-indigo-900/30',
        textColor: 'text-indigo-700 dark:text-indigo-400'
    },

    // 🚷 BLOCKED - Slate/Gray
    'Blocked by robots.txt': {
        label: 'Blocked (robots.txt)',
        icon: Link2Off,
        bgColor: 'bg-slate-200 dark:bg-slate-700',
        textColor: 'text-slate-700 dark:text-slate-300'
    },
    'Blocked due to other 4xx issue': {
        label: 'Blocked (4xx)',
        icon: AlertCircle,
        bgColor: 'bg-slate-200 dark:bg-slate-700',
        textColor: 'text-slate-700 dark:text-slate-300'
    },

    // ❌ ERRORS - Red
    'Not found (404)': {
        label: 'Not found (404)',
        icon: AlertCircle,
        bgColor: 'bg-red-100 dark:bg-red-900/30',
        textColor: 'text-red-700 dark:text-red-400'
    },

    // ❓ UNKNOWN - Slate
    'URL is unknown to Google': {
        label: 'Unknown to Google',
        icon: HelpCircle,
        bgColor: 'bg-slate-100 dark:bg-slate-800',
        textColor: 'text-slate-600 dark:text-slate-400'
    },

    // 📝 INTERNAL STATUSES
    'PENDING': {
        label: 'Pending check',
        icon: Clock,
        bgColor: 'bg-slate-100 dark:bg-slate-800',
        textColor: 'text-slate-600 dark:text-slate-400'
    },
    'INDEXED': {
        label: 'Indexed',
        icon: CheckCircle2,
        bgColor: 'bg-green-100 dark:bg-green-900/30',
        textColor: 'text-green-700 dark:text-green-400'
    },
    'CRAWLED': {
        label: 'Crawled',
        icon: Clock,
        bgColor: 'bg-yellow-100 dark:bg-yellow-900/30',
        textColor: 'text-yellow-700 dark:text-yellow-400'
    },
    'EXCLUDED': {
        label: 'Excluded',
        icon: Link2Off,
        bgColor: 'bg-purple-100 dark:bg-purple-900/30',
        textColor: 'text-purple-700 dark:text-purple-400'
    },
    'ERROR': {
        label: 'Error',
        icon: AlertCircle,
        bgColor: 'bg-red-100 dark:bg-red-900/30',
        textColor: 'text-red-700 dark:text-red-400'
    },
}

function getStatusConfig(status: string) {
    // First try exact match
    if (statusConfig[status]) return statusConfig[status]
    // Then try to find a partial match
    const lower = status.toLowerCase()
    if (lower.includes('submitted') && lower.includes('indexed')) return statusConfig['Submitted and indexed']
    if (lower.includes('crawled') && lower.includes('not indexed')) return statusConfig['Crawled - currently not indexed']
    if (lower.includes('discovered') && lower.includes('not indexed')) return statusConfig['Discovered - currently not indexed']
    if (lower.includes('redirect') && lower.includes('error')) return statusConfig['Redirect error']
    if (lower.includes('redirect')) return statusConfig['Page with redirect']
    if (lower.includes('noindex')) return statusConfig["Excluded by 'noindex' tag"]
    if (lower.includes('canonical') && lower.includes('alternate')) return statusConfig['Alternate page with proper canonical tag']
    if (lower.includes('duplicate')) return statusConfig['Duplicate without user-selected canonical']
    if (lower.includes('robots')) return statusConfig['Blocked by robots.txt']
    if (lower.includes('4xx') || lower.includes('blocked')) return statusConfig['Blocked due to other 4xx issue']
    if (lower.includes('404') || lower.includes('not found')) return statusConfig['Not found (404)']
    if (lower.includes('unknown')) return statusConfig['URL is unknown to Google']
    if (lower.includes('error')) return statusConfig['ERROR']
    return statusConfig['PENDING']
}

// Extract path from URL (remove domain)
function getUrlPath(url: string): string {
    try {
        const urlObj = new URL(url)
        return urlObj.pathname + urlObj.search + urlObj.hash
    } catch {
        return url
    }
}

// Format date in English - show "Today" for today's dates
function formatDate(dateStr: string | null): string {
    if (!dateStr) return '—'
    const date = new Date(dateStr)
    const today = new Date()
    const isToday = date.toDateString() === today.toDateString()

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

export default function ProjectDetailPage({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = use(params)
    const router = useRouter()
    const [projectId, setProjectId] = useState<string | null>(null)
    const [project, setProject] = useState<Project | null>(null)
    const [urls, setUrls] = useState<IndexingUrl[]>([])
    const [loading, setLoading] = useState(true)
    const [addDialogOpen, setAddDialogOpen] = useState(false)
    const [importDialogOpen, setImportDialogOpen] = useState(false)
    const [urlInput, setUrlInput] = useState('')
    const [intervalInput, setIntervalInput] = useState<string>('')
    const [saving, setSaving] = useState(false)
    const [selectedUrls, setSelectedUrls] = useState<Set<number>>(new Set())
    const [submitting, setSubmitting] = useState(false)
    const [lastClickedIndex, setLastClickedIndex] = useState<number | null>(null)

    // Progress dialog state
    const [progressDialog, setProgressDialog] = useState({
        open: false,
        title: '',
        current: 0,
        total: 0,
        status: 'running' as 'running' | 'completed' | 'error',
        successCount: 0,
        failedCount: 0
    })

    // Filters
    const [searchQuery, setSearchQuery] = useState('')
    const [statusFilter, setStatusFilter] = useState<string>('ALL')

    // Sort state: null = default, 'asc' = ascending, 'desc' = descending
    const [sortColumn, setSortColumn] = useState<string | null>(null)
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc' | null>(null)

    // Toggle sort on column click (3 states: asc -> desc -> none)
    const toggleSort = (column: string) => {
        if (sortColumn !== column) {
            setSortColumn(column)
            setSortDirection('asc')
        } else if (sortDirection === 'asc') {
            setSortDirection('desc')
        } else {
            setSortColumn(null)
            setSortDirection(null)
        }
    }

    useEffect(() => {
        fetchProjectData()
    }, [slug])

    async function fetchProjectData() {
        try {
            // Fetch project by slug first
            const projectRes = await fetch(`/api/seo/projects/by-slug/${slug}`)
            if (!projectRes.ok) {
                toast.error('Project not found')
                router.push('/projects')
                return
            }
            const projectData = await projectRes.json()
            const pid = String(projectData.id)
            setProjectId(pid)
            setProject(projectData)

            // Fetch URLs using project ID
            const urlsRes = await fetch(`/api/seo/projects/${pid}/urls`)
            if (urlsRes.ok) {
                setUrls(await urlsRes.json())
            }
        } catch (error) {
            toast.error('Failed to load project')
        } finally {
            setLoading(false)
        }
    }

    // Get unique statuses for filter
    const uniqueStatuses = useMemo(() => {
        const statuses = new Map<string, number>()
        urls.forEach(url => {
            const status = url.lastInspectionResult || url.status
            statuses.set(status, (statuses.get(status) || 0) + 1)
        })
        return statuses
    }, [urls])

    // Filter and sort URLs (selected items appear at top)
    const filteredUrls = useMemo(() => {
        const filtered = urls.filter(url => {
            // Search filter
            if (searchQuery && !url.url.toLowerCase().includes(searchQuery.toLowerCase())) {
                return false
            }
            // Status filter
            if (statusFilter !== 'ALL') {
                const urlStatus = url.lastInspectionResult || url.status
                if (urlStatus !== statusFilter) return false
            }
            return true
        })

        // Sort: selected items first, then by column sort, then by original order
        return filtered.sort((a, b) => {
            // Selected items always first
            const aSelected = selectedUrls.has(a.id) ? 0 : 1
            const bSelected = selectedUrls.has(b.id) ? 0 : 1
            if (aSelected !== bSelected) return aSelected - bSelected

            // Column sort
            if (sortColumn && sortDirection) {
                let aVal: any, bVal: any
                switch (sortColumn) {
                    case 'status':
                        aVal = a.lastInspectionResult || a.status || ''
                        bVal = b.lastInspectionResult || b.status || ''
                        break
                    case 'lastSubmittedAt':
                        aVal = a.lastSubmittedAt ? new Date(a.lastSubmittedAt).getTime() : 0
                        bVal = b.lastSubmittedAt ? new Date(b.lastSubmittedAt).getTime() : 0
                        break
                    case 'lastInspectedAt':
                        aVal = a.lastInspectedAt ? new Date(a.lastInspectedAt).getTime() : 0
                        bVal = b.lastInspectedAt ? new Date(b.lastInspectedAt).getTime() : 0
                        break
                    case 'lastCrawledAt':
                        aVal = a.lastCrawledAt ? new Date(a.lastCrawledAt).getTime() : 0
                        bVal = b.lastCrawledAt ? new Date(b.lastCrawledAt).getTime() : 0
                        break
                    default:
                        return 0
                }
                if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1
                if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1
            }
            return 0
        })
    }, [urls, searchQuery, statusFilter, selectedUrls, sortColumn, sortDirection])

    async function handleAddUrls() {
        const urlLines = urlInput.split('\n').filter(u => u.trim())
        if (urlLines.length === 0) {
            toast.error('Enter at least one URL')
            return
        }

        setSaving(true)
        try {
            const res = await fetch(`/api/seo/projects/${projectId}/urls`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    urls: urlLines,
                    interval: intervalInput || null
                })
            })

            if (res.ok) {
                const data = await res.json()
                toast.success(`Added ${data.added} URLs`)
                setAddDialogOpen(false)
                setUrlInput('')
                setIntervalInput('')
                fetchProjectData()
            } else {
                const data = await res.json()
                toast.error(data.error || 'Failed to add URLs')
            }
        } catch (error) {
            toast.error('Failed to add URLs')
        } finally {
            setSaving(false)
        }
    }

    async function handleDeleteUrl(urlId: number) {
        try {
            const res = await fetch(`/api/seo/urls/${urlId}`, { method: 'DELETE' })
            if (res.ok) {
                toast.success('URL deleted')
                setUrls(urls.filter(u => u.id !== urlId))
                setSelectedUrls(prev => {
                    const newSet = new Set(prev)
                    newSet.delete(urlId)
                    return newSet
                })
            }
        } catch (error) {
            toast.error('Failed to delete URL')
        }
    }

    async function handleBulkDelete() {
        if (!confirm(`Delete ${selectedUrls.size} selected URLs?`)) return

        setSubmitting(true)
        try {
            await Promise.all(
                Array.from(selectedUrls).map(id =>
                    fetch(`/api/seo/urls/${id}`, { method: 'DELETE' })
                )
            )
            toast.success(`Deleted ${selectedUrls.size} URLs`)
            setSelectedUrls(new Set())
            fetchProjectData()
        } catch (error) {
            toast.error('Failed to delete some URLs')
        } finally {
            setSubmitting(false)
        }
    }

    async function handleSubmitForIndexing(urlIds: number[]) {
        setSubmitting(true)
        setProgressDialog({
            open: true,
            title: 'Submitting URLs for Indexing',
            current: 0,
            total: urlIds.length,
            status: 'running',
            successCount: 0,
            failedCount: 0
        })

        try {
            const res = await fetch('/api/seo/urls/submit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ urlIds })
            })

            const data = await res.json()
            if (res.ok) {
                setProgressDialog(prev => ({
                    ...prev,
                    current: urlIds.length,
                    status: 'completed',
                    successCount: data.submitted || 0,
                    failedCount: data.failed || 0
                }))
                toast.success(`Sent ${data.submitted} URLs to Index Now`)
                setSelectedUrls(new Set())
                fetchProjectData()
            } else {
                setProgressDialog(prev => ({ ...prev, status: 'error' }))
                toast.error(data.error || 'Failed to submit URLs')
            }
        } catch (error) {
            setProgressDialog(prev => ({ ...prev, status: 'error' }))
            toast.error('Failed to submit URLs')
        } finally {
            setSubmitting(false)
        }
    }

    async function handleCheckStatus(urlIds: number[]) {
        setSubmitting(true)
        setProgressDialog({
            open: true,
            title: 'Checking URL Status',
            current: 0,
            total: urlIds.length,
            status: 'running',
            successCount: 0,
            failedCount: 0
        })

        try {
            const res = await fetch('/api/seo/urls/inspect', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ urlIds })
            })

            const data = await res.json()
            if (res.ok) {
                setProgressDialog(prev => ({
                    ...prev,
                    current: urlIds.length,
                    status: 'completed',
                    successCount: data.checked || 0,
                    failedCount: data.failed || 0
                }))
                toast.success(`Checked status for ${data.checked} URLs`)
                setSelectedUrls(new Set())
                fetchProjectData()
            } else {
                setProgressDialog(prev => ({ ...prev, status: 'error' }))
                toast.error(data.error || 'Failed to check status')
            }
        } catch (error) {
            setProgressDialog(prev => ({ ...prev, status: 'error' }))
            toast.error('Failed to check status')
        } finally {
            setSubmitting(false)
        }
    }

    function toggleUrlSelection(urlId: number, index?: number, shiftKey?: boolean) {
        const newSet = new Set(selectedUrls)

        // Shift+Click: select range
        if (shiftKey && lastClickedIndex !== null && index !== undefined) {
            const start = Math.min(lastClickedIndex, index)
            const end = Math.max(lastClickedIndex, index)
            for (let i = start; i <= end; i++) {
                if (filteredUrls[i]) {
                    newSet.add(filteredUrls[i].id)
                }
            }
        } else {
            // Normal click: toggle single
            if (newSet.has(urlId)) {
                newSet.delete(urlId)
            } else {
                newSet.add(urlId)
            }
        }

        setSelectedUrls(newSet)
        if (index !== undefined) {
            setLastClickedIndex(index)
        }
    }

    function toggleAllUrls() {
        if (selectedUrls.size === filteredUrls.length) {
            setSelectedUrls(new Set())
        } else {
            setSelectedUrls(new Set(filteredUrls.map(u => u.id)))
        }
    }

    function downloadTemplate() {
        const template = "URL\nhttps://example.com/page1\nhttps://example.com/page2\nhttps://example.com/page3"
        const blob = new Blob([template], { type: 'text/csv' })
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = 'url-import-template.csv'
        a.click()
        window.URL.revokeObjectURL(url)
    }

    async function handleFileImport(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0]
        if (!file) return

        const text = await file.text()
        const lines = text.split('\n').slice(1).filter(l => l.trim())

        if (lines.length === 0) {
            toast.error('No URLs found in file')
            return
        }

        setSaving(true)
        try {
            const res = await fetch(`/api/seo/projects/${projectId}/urls`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ urls: lines })
            })

            if (res.ok) {
                const data = await res.json()
                toast.success(`Imported ${data.added} URLs`)
                setImportDialogOpen(false)
                fetchProjectData()
            } else {
                const data = await res.json()
                toast.error(data.error || 'Failed to import URLs')
            }
        } catch (error) {
            toast.error('Failed to import URLs')
        } finally {
            setSaving(false)
        }
    }

    if (loading) {
        return (
            <div className="p-6 h-full flex items-center justify-center">
                <div className="animate-pulse">Loading...</div>
            </div>
        )
    }

    if (!project) return null

    const selectedCount = selectedUrls.size

    return (
        <TooltipProvider>
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
                                    {project.name}
                                </Link>
                                <span>/</span>
                                <span className="text-foreground font-semibold">Link Indexing</span>
                            </div>
                            <p className="text-xs text-muted-foreground">
                                {project.domain || 'No domain'} · {urls.length} URLs
                            </p>
                        </div>
                        <div className="flex gap-2 items-center flex-wrap">
                            <QuotaCounter />
                            <Button variant="outline" size="sm" onClick={() => setImportDialogOpen(true)}>
                                <Upload className="mr-1 h-3 w-3" />
                                Import
                            </Button>
                            <Button size="sm" onClick={() => setAddDialogOpen(true)}>
                                <Plus className="mr-1 h-3 w-3" />
                                Add URLs
                            </Button>
                        </div>
                    </div>

                    {/* Filter Badges */}
                    <div className="flex gap-1 flex-wrap">
                        <Badge
                            variant={statusFilter === 'ALL' ? 'default' : 'outline'}
                            className="cursor-pointer text-xs"
                            onClick={() => setStatusFilter('ALL')}
                        >
                            All ({urls.length})
                        </Badge>
                        {Array.from(uniqueStatuses.entries()).map(([status, count]) => {
                            const config = getStatusConfig(status)
                            return (
                                <Badge
                                    key={status}
                                    variant="outline"
                                    className={`cursor-pointer text-xs ${statusFilter === status ? config.bgColor + ' ' + config.textColor : ''}`}
                                    onClick={() => setStatusFilter(status)}
                                >
                                    <config.icon className="h-3 w-3 mr-1" />
                                    {config.label} ({count})
                                </Badge>
                            )
                        })}
                    </div>

                    {/* Search and Actions */}
                    <div className="flex gap-2 items-center flex-wrap">
                        <div className="relative flex-1 min-w-[200px] max-w-xs">
                            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                            <Input
                                placeholder="Search URLs..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-7 h-8 text-sm"
                            />
                        </div>

                        {selectedCount > 0 && (
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs font-medium text-muted-foreground">
                                    {selectedCount} selected
                                </span>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 text-xs"
                                    onClick={() => handleCheckStatus(Array.from(selectedUrls))}
                                    disabled={submitting}
                                >
                                    <Search className="mr-1 h-3 w-3" />
                                    Check
                                </Button>
                                <Button
                                    size="sm"
                                    className="h-7 text-xs"
                                    onClick={() => handleSubmitForIndexing(Array.from(selectedUrls))}
                                    disabled={submitting}
                                >
                                    <Send className="mr-1 h-3 w-3" />
                                    Index Now
                                </Button>
                                <Button
                                    size="sm"
                                    variant="destructive"
                                    className="h-7 text-xs"
                                    onClick={handleBulkDelete}
                                    disabled={submitting}
                                >
                                    <Trash2 className="mr-1 h-3 w-3" />
                                    Delete
                                </Button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Table - Scrollable */}
                <div className="flex-1 overflow-hidden flex flex-col">
                    {filteredUrls.length === 0 ? (
                        <div className="h-full flex items-center justify-center">
                            <div className="text-center">
                                <ExternalLink className="h-10 w-10 mx-auto mb-3 text-muted-foreground opacity-50" />
                                <h3 className="font-medium mb-1 text-sm">
                                    {urls.length === 0 ? 'No URLs yet' : 'No URLs match filter'}
                                </h3>
                                <p className="text-xs text-muted-foreground mb-3">
                                    {urls.length === 0
                                        ? 'Add URLs to start indexing'
                                        : 'Try adjusting your search or filter'}
                                </p>
                                {urls.length === 0 && (
                                    <Button size="sm" onClick={() => setAddDialogOpen(true)}>
                                        <Plus className="mr-1 h-3 w-3" />
                                        Add URLs
                                    </Button>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="flex-1 flex flex-col overflow-hidden">
                            {/* Fixed Table Header */}
                            <div className="shrink-0 border-b bg-muted/50">
                                <Table className="table-fixed">
                                    <colgroup>
                                        <col className="w-[40px]" />
                                        <col />
                                        <col className="w-[180px]" />
                                        <col className="w-[120px]" />
                                        <col className="w-[120px]" />
                                        <col className="w-[120px]" />
                                        <col className="w-[40px]" />
                                    </colgroup>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>
                                                <Checkbox
                                                    checked={selectedUrls.size === filteredUrls.length && filteredUrls.length > 0}
                                                    onCheckedChange={toggleAllUrls}
                                                />
                                            </TableHead>
                                            <TableHead>URL Path</TableHead>
                                            <TableHead>
                                                <Button
                                                    variant={sortColumn === 'status' ? 'secondary' : 'ghost'}
                                                    size="sm"
                                                    className="h-auto p-1 font-medium"
                                                    onClick={() => toggleSort('status')}
                                                >
                                                    Status
                                                    {sortColumn === 'status' && sortDirection === 'asc' && <ArrowUp className="ml-1 h-3 w-3" />}
                                                    {sortColumn === 'status' && sortDirection === 'desc' && <ArrowDown className="ml-1 h-3 w-3" />}
                                                </Button>
                                            </TableHead>
                                            <TableHead className="text-left">
                                                <Button
                                                    variant={sortColumn === 'lastSubmittedAt' ? 'secondary' : 'ghost'}
                                                    size="sm"
                                                    className="h-auto p-1 font-medium"
                                                    onClick={() => toggleSort('lastSubmittedAt')}
                                                >
                                                    Last Indexed
                                                    {sortColumn === 'lastSubmittedAt' && sortDirection === 'asc' && <ArrowUp className="ml-1 h-3 w-3" />}
                                                    {sortColumn === 'lastSubmittedAt' && sortDirection === 'desc' && <ArrowDown className="ml-1 h-3 w-3" />}
                                                </Button>
                                            </TableHead>
                                            <TableHead className="text-left">
                                                <Button
                                                    variant={sortColumn === 'lastInspectedAt' ? 'secondary' : 'ghost'}
                                                    size="sm"
                                                    className="h-auto p-1 font-medium"
                                                    onClick={() => toggleSort('lastInspectedAt')}
                                                >
                                                    Last Checked
                                                    {sortColumn === 'lastInspectedAt' && sortDirection === 'asc' && <ArrowUp className="ml-1 h-3 w-3" />}
                                                    {sortColumn === 'lastInspectedAt' && sortDirection === 'desc' && <ArrowDown className="ml-1 h-3 w-3" />}
                                                </Button>
                                            </TableHead>
                                            <TableHead className="text-left">
                                                <Button
                                                    variant={sortColumn === 'lastCrawledAt' ? 'secondary' : 'ghost'}
                                                    size="sm"
                                                    className="h-auto p-1 font-medium"
                                                    onClick={() => toggleSort('lastCrawledAt')}
                                                >
                                                    Last Crawled
                                                    {sortColumn === 'lastCrawledAt' && sortDirection === 'asc' && <ArrowUp className="ml-1 h-3 w-3" />}
                                                    {sortColumn === 'lastCrawledAt' && sortDirection === 'desc' && <ArrowDown className="ml-1 h-3 w-3" />}
                                                </Button>
                                            </TableHead>
                                            <TableHead></TableHead>
                                        </TableRow>
                                    </TableHeader>
                                </Table>
                            </div>

                            {/* Scrollable Table Body */}
                            <div className="flex-1 overflow-x-auto overflow-y-auto">
                                <Table className="table-fixed">
                                    <colgroup>
                                        <col className="w-[40px]" />
                                        <col />
                                        <col className="w-[180px]" />
                                        <col className="w-[120px]" />
                                        <col className="w-[120px]" />
                                        <col className="w-[120px]" />
                                        <col className="w-[40px]" />
                                    </colgroup>
                                    <TableBody>
                                        {filteredUrls.map((url, index) => {
                                            const status = url.lastInspectionResult || url.status
                                            const config = getStatusConfig(status)
                                            const StatusIcon = config.icon

                                            return (
                                                <TableRow key={url.id} className="group">
                                                    <TableCell>
                                                        <Checkbox
                                                            checked={selectedUrls.has(url.id)}
                                                            onClick={(e) => {
                                                                e.stopPropagation()
                                                                toggleUrlSelection(url.id, index, e.shiftKey)
                                                            }}
                                                            onCheckedChange={() => { }}
                                                        />
                                                    </TableCell>
                                                    <TableCell>
                                                        <Tooltip>
                                                            <TooltipTrigger asChild>
                                                                <a
                                                                    href={url.url}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="text-blue-600 hover:underline text-sm block truncate max-w-[350px]"
                                                                    onClick={(e) => e.stopPropagation()}
                                                                >
                                                                    {getUrlPath(url.url)}
                                                                </a>
                                                            </TooltipTrigger>
                                                            <TooltipContent side="top" className="max-w-md">
                                                                <p className="text-xs break-all">{url.url}</p>
                                                            </TooltipContent>
                                                        </Tooltip>
                                                    </TableCell>
                                                    <TableCell className="pr-4">
                                                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${config.bgColor} ${config.textColor}`}>
                                                            <StatusIcon className="h-3 w-3" />
                                                            {config.label}
                                                        </span>
                                                    </TableCell>
                                                    <TableCell className="text-xs text-muted-foreground text-left">
                                                        {formatDate(url.lastSubmittedAt)}
                                                    </TableCell>
                                                    <TableCell className="text-xs text-muted-foreground text-left">
                                                        {formatDate(url.lastInspectedAt)}
                                                    </TableCell>
                                                    <TableCell className="text-xs text-muted-foreground text-left">
                                                        {formatDate(url.lastCrawledAt)}
                                                    </TableCell>
                                                    <TableCell>
                                                        <DropdownMenu>
                                                            <DropdownMenuTrigger asChild>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="h-7 w-7 opacity-0 group-hover:opacity-100"
                                                                >
                                                                    <MoreHorizontal className="h-4 w-4" />
                                                                </Button>
                                                            </DropdownMenuTrigger>
                                                            <DropdownMenuContent align="end">
                                                                <DropdownMenuItem onClick={() => handleSubmitForIndexing([url.id])}>
                                                                    <Send className="h-4 w-4 mr-2" />
                                                                    Index Now
                                                                </DropdownMenuItem>
                                                                <DropdownMenuItem onClick={() => handleCheckStatus([url.id])}>
                                                                    <Search className="h-4 w-4 mr-2" />
                                                                    Check Status
                                                                </DropdownMenuItem>
                                                                <DropdownMenuSeparator />
                                                                <DropdownMenuItem
                                                                    className="text-destructive"
                                                                    onClick={() => handleDeleteUrl(url.id)}
                                                                >
                                                                    <Trash2 className="h-4 w-4 mr-2" />
                                                                    Delete
                                                                </DropdownMenuItem>
                                                            </DropdownMenuContent>
                                                        </DropdownMenu>
                                                    </TableCell>
                                                </TableRow>
                                            )
                                        })}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>
                    )}
                </div>

                {/* Add URLs Dialog */}
                <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
                    <DialogContent className="sm:max-w-[500px]">
                        <DialogHeader>
                            <DialogTitle>Add URLs</DialogTitle>
                            <DialogDescription>
                                Enter URLs to add (one per line)
                            </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="urls">URLs</Label>
                                <Textarea
                                    id="urls"
                                    placeholder="https://example.com/page1&#10;https://example.com/page2"
                                    rows={6}
                                    value={urlInput}
                                    onChange={(e) => setUrlInput(e.target.value)}
                                />
                                <p className="text-xs text-muted-foreground">
                                    {urlInput.split('\n').filter(u => u.trim()).length} URLs
                                </p>
                            </div>

                            <div className="space-y-2">
                                <Label>Re-indexing Interval</Label>
                                <Select value={intervalInput} onValueChange={setIntervalInput}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="One-time" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="">One-time</SelectItem>
                                        <SelectItem value="WEEKLY">Weekly</SelectItem>
                                        <SelectItem value="MONTHLY">Monthly</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <DialogFooter>
                            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>Cancel</Button>
                            <Button onClick={handleAddUrls} disabled={saving}>
                                {saving ? 'Adding...' : 'Add'}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* Import Dialog */}
                <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
                    <DialogContent className="sm:max-w-[400px]">
                        <DialogHeader>
                            <DialogTitle>Import URLs</DialogTitle>
                            <DialogDescription>Upload a CSV file with URLs</DialogDescription>
                        </DialogHeader>

                        <div className="space-y-4">
                            <div className="border-2 border-dashed rounded-lg p-6 text-center">
                                <FileSpreadsheet className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                                <Label htmlFor="csv-upload" className="cursor-pointer text-primary hover:underline text-sm">
                                    Click to upload
                                </Label>
                                <Input
                                    id="csv-upload"
                                    type="file"
                                    accept=".csv,.txt"
                                    className="hidden"
                                    onChange={handleFileImport}
                                    disabled={saving}
                                />
                                <p className="text-xs text-muted-foreground mt-1">One URL per line</p>
                            </div>

                            <Button variant="outline" className="w-full" onClick={downloadTemplate}>
                                <Download className="mr-2 h-4 w-4" />
                                Download Template
                            </Button>
                        </div>

                        <DialogFooter>
                            <Button variant="outline" onClick={() => setImportDialogOpen(false)}>Cancel</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* Progress Dialog */}
                <ProgressDialog
                    open={progressDialog.open}
                    title={progressDialog.title}
                    current={progressDialog.current}
                    total={progressDialog.total}
                    status={progressDialog.status}
                    successCount={progressDialog.successCount}
                    failedCount={progressDialog.failedCount}
                    onClose={() => setProgressDialog(prev => ({ ...prev, open: false }))}
                />
            </div>
        </TooltipProvider>
    )
}
