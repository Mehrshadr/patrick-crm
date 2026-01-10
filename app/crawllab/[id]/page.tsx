"use client"

import { useState, useEffect, use, useMemo } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Switch } from "@/components/ui/switch"
import {
    ArrowLeft,
    Globe,
    Loader2,
    Image as ImageIcon,
    Link2,
    FileText,
    Clock,
    CheckCircle2,
    XCircle,
    RefreshCw,
    ExternalLink,
    AlertTriangle,
    ScrollText,
    Gauge,
    Play,
    ClipboardCheck,
    Download,
    ChevronDown,
    Trash2,
    ArrowUp,
    ArrowDown
} from "lucide-react"
import { formatDistanceToNow } from "date-fns"

interface CrawlJob {
    id: number
    url: string
    status: string
    totalPages: number | null
    crawledPages: number
    imageCount: number
    linkCount: number
    pageCount: number
    startedAt: string | null
    completedAt: string | null
    createdAt: string
    error: string | null
}

interface CrawledPage {
    id: number
    url: string
    statusCode: number
    title: string | null
    metaDescription: string | null
    h1: string | null
    wordCount: number | null
    loadTimeMs: number | null
    _count: {
        images: number
        links: number
    }
}

interface CrawledImage {
    id: number
    url: string
    alt: string | null
    page: {
        url: string
        title: string | null
    }
}

interface CrawlLog {
    id: number
    level: string
    message: string
    details: string | null
    createdAt: string
}

interface PageSpeedData {
    id: number
    strategy: string
    performanceScore: number
    accessibilityScore: number
    seoScore: number
    bestPracticesScore: number
    lcp: number
    fid: number
    cls: number
    fcp: number
    tbt: number
    tti: number
    speedIndex: number
    serverResponseTime: number
    fetchedAt: string
}

interface AuditData {
    job: {
        id: number
        url: string
        crawledAt: string
    }
    scores: {
        seo: number
        performance: number | null
        accessibility: number | null
        bestPractices: number | null
    }
    totals: {
        pages: number
        images: number
        links: number
    }
    issues: {
        missingTitle: number
        missingMetaDescription: number
        missingH1: number
        missingAltImages: number
        slowPages: number
        brokenPages: number
        thinContent: number
    }
    issueDetails?: {
        pagesWithMissingTitle: { url: string }[]
        pagesWithMissingMeta: { url: string }[]
        pagesWithMissingH1: { url: string }[]
        slowPages: { url: string; loadTime: number }[]
        brokenPages: { url: string; statusCode: number }[]
        imagesWithMissingAlt: { imageUrl: string; pageUrl: string }[]
    }
}

export default function CrawlJobPage({ params }: { params: Promise<{ id: string }> }) {
    const resolvedParams = use(params)
    const jobId = parseInt(resolvedParams.id)

    const [job, setJob] = useState<CrawlJob | null>(null)
    const [pages, setPages] = useState<CrawledPage[]>([])
    const [images, setImages] = useState<CrawledImage[]>([])
    const [logs, setLogs] = useState<CrawlLog[]>([])
    const [pageSpeed, setPageSpeed] = useState<PageSpeedData | null>(null)
    const [audit, setAudit] = useState<AuditData | null>(null)
    const [runningPageSpeed, setRunningPageSpeed] = useState(false)
    const [imageStats, setImageStats] = useState({ totalUsage: 0, uniqueImages: 0, missingAlt: 0, duplicates: 0 })
    const [loading, setLoading] = useState(true)
    const [activeTab, setActiveTab] = useState("audit")

    // Pagination state
    const [pagesCurrentPage, setPagesCurrentPage] = useState(1)
    const [imagesCurrentPage, setImagesCurrentPage] = useState(1)
    const [pagesTotalPages, setPagesTotalPages] = useState(1)
    const [imagesTotalPages, setImagesTotalPages] = useState(1)
    const [pagesLoading, setPagesLoading] = useState(false)
    const [imagesLoading, setImagesLoading] = useState(false)
    const ITEMS_PER_PAGE = 25

    // Sorting state for Pages tab
    const [sortColumn, setSortColumn] = useState<string>("url")
    const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc")

    // Image filter state
    const [imageFilter, setImageFilter] = useState<"all" | "missing-alt" | "duplicates">("all")

    // URL type filter state for Pages tab
    const [urlTypeFilter, setUrlTypeFilter] = useState<"all" | "product" | "blog" | "category" | "page">("all")

    // Status code filter state
    const [statusFilter, setStatusFilter] = useState<"all" | "200" | "404" | "error">("all")

    // Server-side counts for filter badges
    const [pageCounts, setPageCounts] = useState({ all: 0, ok: 0, notFound: 0, errors: 0, products: 0, blog: 0, categories: 0 })

    // Robots.txt filter state - persisted in localStorage
    const [robotsData, setRobotsData] = useState<{
        userAgents: { [agent: string]: { type: string; path: string }[] }
        sitemaps: string[]
        disallowedPaths: string[]
        error?: string
    } | null>(null)
    const [applyRobotsFilter, setApplyRobotsFilter] = useState(() => {
        if (typeof window !== 'undefined') {
            return localStorage.getItem(`robotsFilter-${jobId}`) === 'true'
        }
        return false
    })
    const [robotsLoading, setRobotsLoading] = useState(false)

    // Persist robots filter state
    useEffect(() => {
        if (typeof window !== 'undefined') {
            localStorage.setItem(`robotsFilter-${jobId}`, applyRobotsFilter.toString())
        }
    }, [applyRobotsFilter, jobId])

    useEffect(() => {
        fetchJob()
    }, [jobId])

    useEffect(() => {
        if (job?.status === 'running' || job?.status === 'pending') {
            const interval = setInterval(fetchJob, 3000)
            return () => clearInterval(interval)
        }
    }, [job?.status])

    // Fetch robots.txt when job is loaded and toggle is enabled
    useEffect(() => {
        if (job?.url && applyRobotsFilter && !robotsData) {
            fetchRobots()
        }
    }, [job?.url, applyRobotsFilter])

    useEffect(() => {
        if (activeTab === 'audit') fetchAudit()
        if (activeTab === 'pages') fetchPages()
        if (activeTab === 'images') fetchImages()
        if (activeTab === 'logs') fetchLogs()
        if (activeTab === 'speed') fetchPageSpeed()
    }, [activeTab, jobId])

    // Compute duplicate filenames for image duplicate detection
    const duplicateFilenames = useMemo(() => {
        const filenameCount = new Map<string, number>()
        images.forEach(img => {
            const filename = img.url.split('/').pop() || ''
            filenameCount.set(filename, (filenameCount.get(filename) || 0) + 1)
        })
        return filenameCount
    }, [images])

    const fetchJob = async () => {
        try {
            const res = await fetch(`/api/crawl/${jobId}/status`)
            const data = await res.json()
            if (data.success) {
                setJob(data.job)
            }
        } catch (e) {
            console.error('Failed to fetch job', e)
        } finally {
            setLoading(false)
        }
    }

    const fetchPages = async (page = 1, status = statusFilter, urlType = urlTypeFilter, sortCol = sortColumn, sortDir = sortDirection) => {
        setPagesLoading(true)
        try {
            const params = new URLSearchParams({
                page: page.toString(),
                limit: ITEMS_PER_PAGE.toString()
            })
            if (status !== 'all') params.set('statusCode', status)
            if (urlType !== 'all') params.set('urlType', urlType)
            if (sortCol && sortDir) {
                params.set('sortColumn', sortCol)
                params.set('sortDirection', sortDir)
            }

            const res = await fetch(`/api/crawl/${jobId}/pages?${params}`)
            const data = await res.json()
            if (data.success) {
                setPages(data.pages)
                setPagesTotalPages(data.totalPages)
                if (data.counts) setPageCounts(data.counts)
            }
        } catch (e) {
            console.error('Failed to fetch pages', e)
        } finally {
            setPagesLoading(false)
        }
    }

    const toggleSort = (column: string) => {
        let newDir: "asc" | "desc" | null = "asc"

        if (sortColumn === column) {
            if (sortDirection === 'asc') newDir = 'desc'
            else newDir = null
        }

        if (newDir) {
            setSortColumn(column)
            setSortDirection(newDir)
            fetchPages(pagesCurrentPage, statusFilter, urlTypeFilter, column, newDir)
        } else {
            setSortColumn("crawledAt") // Default or reset
            setSortDirection("desc")
            fetchPages(pagesCurrentPage, statusFilter, urlTypeFilter, "crawledAt", "desc")
        }
    }

    const fetchImages = async (page = 1, filter = imageFilter) => {
        setImagesLoading(true)
        try {
            const params = new URLSearchParams({
                page: page.toString(),
                limit: ITEMS_PER_PAGE.toString(),
                filter: filter
            })

            const res = await fetch(`/api/crawl/${jobId}/images?${params}`)
            const data = await res.json()
            if (data.success) {
                setImages(data.images)
                setImagesTotalPages(data.totalPages)
                if (data.stats) setImageStats(data.stats)
            }
        } catch (e) {
            console.error('Failed to fetch images', e)
        } finally {
            setImagesLoading(false)
        }
    }

    const fetchLogs = async () => {
        try {
            const res = await fetch(`/api/crawl/${jobId}/logs?limit=100`)
            const data = await res.json()
            if (data.success) {
                setLogs(data.logs)
            }
        } catch (e) {
            console.error('Failed to fetch logs', e)
        }
    }

    const fetchAudit = async () => {
        try {
            const res = await fetch(`/api/crawl/${jobId}/audit`)
            const data = await res.json()
            if (data.success) {
                setAudit(data.audit)
            }
        } catch (e) {
            console.error('Failed to fetch audit', e)
        }
    }

    const fetchPageSpeed = async () => {
        try {
            const res = await fetch(`/api/crawl/${jobId}/pagespeed`)
            const data = await res.json()
            if (data.success && data.results?.length > 0) {
                setPageSpeed(data.results[0])
            }
        } catch (e) {
            console.error('Failed to fetch pagespeed', e)
        }
    }

    const runPageSpeedTest = async () => {
        setRunningPageSpeed(true)
        try {
            const res = await fetch(`/api/crawl/${jobId}/pagespeed`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ strategy: 'mobile' })
            })
            const data = await res.json()
            if (data.success) {
                setPageSpeed(data.result)
            }
        } catch (e) {
            console.error('Failed to run pagespeed', e)
        } finally {
            setRunningPageSpeed(false)
        }
    }

    const fetchRobots = async () => {
        if (!job?.url || robotsData) return
        setRobotsLoading(true)
        try {
            const res = await fetch(`/api/robots?url=${encodeURIComponent(job.url)}`)
            const data = await res.json()
            if (data.success) {
                // Extract disallowed paths for easy filtering
                const allRules = data.data.userAgents['*'] || []
                const disallowedPaths = allRules
                    .filter((r: any) => r.type === 'disallow')
                    .map((r: any) => r.path)
                setRobotsData({ ...data.data, disallowedPaths })
            }
        } catch (e) {
            console.error('Failed to fetch robots.txt', e)
        } finally {
            setRobotsLoading(false)
        }
    }

    // Check if a URL path is blocked by robots.txt
    const isPathBlocked = (url: string): boolean => {
        if (!robotsData || !applyRobotsFilter) return false
        try {
            const path = new URL(url).pathname
            return robotsData.disallowedPaths.some(disallowed =>
                path.startsWith(disallowed) ||
                (disallowed.endsWith('*') && path.startsWith(disallowed.slice(0, -1)))
            )
        } catch {
            return false
        }
    }

    // Detect URL type based on URL patterns
    const getUrlType = (url: string): "product" | "blog" | "category" | "page" => {
        const path = new URL(url).pathname.toLowerCase()
        if (path.includes('/product') || path.includes('/shop/') || path.includes('/p/')) return 'product'
        if (path.includes('/blog') || path.includes('/post') || path.includes('/article') || path.includes('/news')) return 'blog'
        if (path.includes('/category') || path.includes('/cat/') || path.includes('/collection')) return 'category'
        return 'page'
    }

    // Export to CSV using server API
    const handleExport = () => {
        const params = new URLSearchParams()
        if (statusFilter !== 'all') params.set('statusCode', statusFilter)
        if (urlTypeFilter !== 'all') params.set('urlType', urlTypeFilter)

        window.location.href = `/api/crawl/${jobId}/export?${params.toString()}`
    }

    const getScoreColor = (score: number) => {
        if (score >= 90) return 'text-green-600'
        if (score >= 50) return 'text-orange-500'
        return 'text-red-600'
    }

    const getScoreBg = (score: number) => {
        if (score >= 90) return 'bg-green-100'
        if (score >= 50) return 'bg-orange-100'
        return 'bg-red-100'
    }

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'running':
                return <Badge className="bg-blue-100 text-blue-700"><Loader2 className="h-3 w-3 mr-1 animate-spin" />Running</Badge>
            case 'completed':
                return <Badge className="bg-green-100 text-green-700"><CheckCircle2 className="h-3 w-3 mr-1" />Completed</Badge>
            case 'failed':
                return <Badge className="bg-red-100 text-red-700"><XCircle className="h-3 w-3 mr-1" />Failed</Badge>
            default:
                return <Badge variant="secondary">{status}</Badge>
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        )
    }

    if (!job) {
        return (
            <div className="p-6 text-center">
                <p className="text-muted-foreground">Job not found</p>
                <Link href="/crawllab">
                    <Button variant="link">Back to CrawlLab</Button>
                </Link>
            </div>
        )
    }

    return (
        <div className="h-[calc(100vh-64px)] flex flex-col overflow-hidden">
            {/* Header - Fixed */}
            <div className="shrink-0 p-4 border-b">
                <div className="flex items-center justify-between">
                    <div className="flex flex-col gap-1">
                        {/* Breadcrumb */}
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Link href="/crawllab" className="hover:text-foreground">
                                CrawlLab
                            </Link>
                            <span>/</span>
                            <span className="text-foreground font-semibold">{new URL(job.url).hostname}</span>
                            {getStatusBadge(job.status)}
                        </div>
                        <p className="text-xs text-muted-foreground">{job.url}</p>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                        <div className="flex items-center gap-1.5">
                            <FileText className="h-4 w-4 text-muted-foreground" />
                            <span className="font-semibold">{job.crawledPages}</span>
                            <span className="text-muted-foreground">pages</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <ImageIcon className="h-4 w-4 text-muted-foreground" />
                            <span className="font-semibold">{job.imageCount}</span>
                            <span className="text-muted-foreground">images</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <Link2 className="h-4 w-4 text-muted-foreground" />
                            <span className="font-semibold">{job.linkCount}</span>
                            <span className="text-muted-foreground">links</span>
                        </div>
                        {/* Delete Button */}
                        <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={async () => {
                                if (confirm('Delete this crawl job? All data will be removed.')) {
                                    try {
                                        const res = await fetch(`/api/crawl/${jobId}/delete`, { method: 'DELETE' })
                                        if (res.ok) window.location.href = '/crawllab'
                                    } catch (e) {
                                        console.error('Delete failed', e)
                                    }
                                }
                            }}
                        >
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-hidden flex flex-col">
                {/* Tabs */}
                <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
                    <div className="px-4 pt-4 shrink-0">
                        <TabsList>
                            <TabsTrigger value="audit" className="flex items-center gap-2">
                                <ClipboardCheck className="h-4 w-4" /> Audit
                            </TabsTrigger>
                            <TabsTrigger value="pages" className="flex items-center gap-2">
                                <FileText className="h-4 w-4" /> Pages
                            </TabsTrigger>
                            <TabsTrigger value="images" className="flex items-center gap-2">
                                <ImageIcon className="h-4 w-4" /> Images
                                {imageStats.missingAlt > 0 && (
                                    <Badge variant="destructive" className="ml-1 h-5 px-1.5 text-xs">
                                        {imageStats.missingAlt}
                                    </Badge>
                                )}
                            </TabsTrigger>
                            {/* Logs tab hidden per user request */}
                            <TabsTrigger value="speed" className="flex items-center gap-2">
                                <Gauge className="h-4 w-4" /> PageSpeed
                            </TabsTrigger>
                        </TabsList>
                    </div>

                    {/* Audit Tab */}
                    <TabsContent value="audit" className="flex-1 overflow-auto p-4">
                        {audit ? (
                            <div className="space-y-6">
                                {/* SEO Score Card */}
                                <div className="bg-white rounded-xl border p-6">
                                    <div className="flex items-center justify-between mb-6">
                                        <h3 className="font-semibold text-lg">SEO Audit Summary</h3>
                                        <div className="flex items-center gap-4">
                                            {/* robots.txt toggle */}
                                            <div className="flex items-center gap-2 text-sm">
                                                <Switch
                                                    checked={applyRobotsFilter}
                                                    onCheckedChange={setApplyRobotsFilter}
                                                    disabled={robotsLoading}
                                                />
                                                <span className="text-muted-foreground">robots.txt</span>
                                                {robotsLoading && <Loader2 className="h-3 w-3 animate-spin" />}
                                                {applyRobotsFilter && robotsData && (
                                                    <Badge variant="outline" className="text-xs">{robotsData.disallowedPaths.length} blocked</Badge>
                                                )}
                                            </div>
                                            <Button variant="outline" size="sm" onClick={() => {
                                                const blob = new Blob([JSON.stringify(audit, null, 2)], { type: 'application/json' })
                                                const url = URL.createObjectURL(blob)
                                                const a = document.createElement('a')
                                                a.href = url
                                                a.download = `audit-${job.url.replace(/[^a-z0-9]/gi, '-')}.json`
                                                a.click()
                                            }}>
                                                <Download className="h-4 w-4 mr-2" /> Export JSON
                                            </Button>
                                        </div>
                                    </div>

                                    {/* Main Score */}
                                    <div className="grid grid-cols-4 gap-4 mb-8">
                                        <div className={`rounded-xl p-6 ${getScoreBg(audit.scores.seo)}`}>
                                            <div className={`text-4xl font-bold ${getScoreColor(audit.scores.seo)}`}>
                                                {audit.scores.seo}
                                            </div>
                                            <div className="text-sm font-medium mt-1">SEO Score</div>
                                        </div>
                                        {audit.scores.performance !== null && (
                                            <div className={`rounded-xl p-6 ${getScoreBg(audit.scores.performance)}`}>
                                                <div className={`text-4xl font-bold ${getScoreColor(audit.scores.performance)}`}>
                                                    {audit.scores.performance}
                                                </div>
                                                <div className="text-sm font-medium mt-1">Performance</div>
                                            </div>
                                        )}
                                        {audit.scores.accessibility !== null && (
                                            <div className={`rounded-xl p-6 ${getScoreBg(audit.scores.accessibility)}`}>
                                                <div className={`text-4xl font-bold ${getScoreColor(audit.scores.accessibility)}`}>
                                                    {audit.scores.accessibility}
                                                </div>
                                                <div className="text-sm font-medium mt-1">Accessibility</div>
                                            </div>
                                        )}
                                        {audit.scores.bestPractices !== null && (
                                            <div className={`rounded-xl p-6 ${getScoreBg(audit.scores.bestPractices)}`}>
                                                <div className={`text-4xl font-bold ${getScoreColor(audit.scores.bestPractices)}`}>
                                                    {audit.scores.bestPractices}
                                                </div>
                                                <div className="text-sm font-medium mt-1">Best Practices</div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Totals */}
                                    <h4 className="font-medium mb-3">Overview</h4>
                                    <div className="grid grid-cols-3 gap-4 mb-6">
                                        <div className="border rounded-lg p-4 text-center">
                                            <div className="text-2xl font-bold">{audit.totals.pages}</div>
                                            <div className="text-sm text-muted-foreground">Pages Crawled</div>
                                        </div>
                                        <div className="border rounded-lg p-4 text-center">
                                            <div className="text-2xl font-bold">{audit.totals.images}</div>
                                            <div className="text-sm text-muted-foreground">Images Found</div>
                                        </div>
                                        <div className="border rounded-lg p-4 text-center">
                                            <div className="text-2xl font-bold">{audit.totals.links}</div>
                                            <div className="text-sm text-muted-foreground">Links Found</div>
                                        </div>
                                    </div>
                                </div>

                                {/* Issues Breakdown */}
                                <div className="bg-white rounded-xl border p-6">
                                    <h3 className="font-semibold text-lg mb-4">Issues Found</h3>
                                    <div className="space-y-2">
                                        {audit.issues.brokenPages > 0 && (
                                            <Collapsible>
                                                <CollapsibleTrigger className="flex items-center justify-between p-3 bg-red-50 rounded-lg w-full hover:bg-red-100 transition-colors">
                                                    <div className="flex items-center gap-2">
                                                        <ChevronDown className="h-4 w-4 text-red-600" />
                                                        <span className="font-medium text-red-700">Broken Pages (4xx/5xx)</span>
                                                    </div>
                                                    <Badge variant="destructive">{audit.issues.brokenPages}</Badge>
                                                </CollapsibleTrigger>
                                                <CollapsibleContent className="mt-2 ml-6 space-y-1 max-h-60 overflow-y-auto">
                                                    {audit.issueDetails?.brokenPages.map((p, i) => (
                                                        <div key={i} className="flex items-center justify-between text-sm py-1 px-2 bg-red-25 rounded">
                                                            <a href={p.url} target="_blank" rel="noopener" className="text-red-700 hover:underline truncate max-w-md">{p.url}</a>
                                                            <Badge variant="outline" className="text-red-600">{p.statusCode}</Badge>
                                                        </div>
                                                    ))}
                                                </CollapsibleContent>
                                            </Collapsible>
                                        )}
                                        {audit.issues.missingTitle > 0 && (
                                            <Collapsible>
                                                <CollapsibleTrigger className="flex items-center justify-between p-3 bg-orange-50 rounded-lg w-full hover:bg-orange-100 transition-colors">
                                                    <div className="flex items-center gap-2">
                                                        <ChevronDown className="h-4 w-4 text-orange-600" />
                                                        <span className="font-medium text-orange-700">Missing Title Tags</span>
                                                    </div>
                                                    <Badge className="bg-orange-100 text-orange-700">{audit.issues.missingTitle}</Badge>
                                                </CollapsibleTrigger>
                                                <CollapsibleContent className="mt-2 ml-6 space-y-1 max-h-60 overflow-y-auto">
                                                    {audit.issueDetails?.pagesWithMissingTitle.map((p, i) => (
                                                        <a key={i} href={p.url} target="_blank" rel="noopener" className="block text-sm text-orange-700 hover:underline truncate py-1">{p.url}</a>
                                                    ))}
                                                </CollapsibleContent>
                                            </Collapsible>
                                        )}
                                        {audit.issues.missingMetaDescription > 0 && (
                                            <Collapsible>
                                                <CollapsibleTrigger className="flex items-center justify-between p-3 bg-orange-50 rounded-lg w-full hover:bg-orange-100 transition-colors">
                                                    <div className="flex items-center gap-2">
                                                        <ChevronDown className="h-4 w-4 text-orange-600" />
                                                        <span className="font-medium text-orange-700">Missing Meta Descriptions</span>
                                                    </div>
                                                    <Badge className="bg-orange-100 text-orange-700">{audit.issues.missingMetaDescription}</Badge>
                                                </CollapsibleTrigger>
                                                <CollapsibleContent className="mt-2 ml-6 space-y-1 max-h-60 overflow-y-auto">
                                                    {audit.issueDetails?.pagesWithMissingMeta.map((p, i) => (
                                                        <a key={i} href={p.url} target="_blank" rel="noopener" className="block text-sm text-orange-700 hover:underline truncate py-1">{p.url}</a>
                                                    ))}
                                                </CollapsibleContent>
                                            </Collapsible>
                                        )}
                                        {audit.issues.missingH1 > 0 && (
                                            <Collapsible>
                                                <CollapsibleTrigger className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg w-full hover:bg-yellow-100 transition-colors">
                                                    <div className="flex items-center gap-2">
                                                        <ChevronDown className="h-4 w-4 text-yellow-600" />
                                                        <span className="font-medium text-yellow-700">Missing H1 Tags</span>
                                                    </div>
                                                    <Badge className="bg-yellow-100 text-yellow-700">{audit.issues.missingH1}</Badge>
                                                </CollapsibleTrigger>
                                                <CollapsibleContent className="mt-2 ml-6 space-y-1 max-h-60 overflow-y-auto">
                                                    {audit.issueDetails?.pagesWithMissingH1.map((p, i) => (
                                                        <a key={i} href={p.url} target="_blank" rel="noopener" className="block text-sm text-yellow-700 hover:underline truncate py-1">{p.url}</a>
                                                    ))}
                                                </CollapsibleContent>
                                            </Collapsible>
                                        )}
                                        {audit.issues.missingAltImages > 0 && (
                                            <div
                                                className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg cursor-pointer hover:bg-yellow-100 transition-colors"
                                                onClick={() => setActiveTab('images')}
                                            >
                                                <div className="flex items-center gap-2">
                                                    <ImageIcon className="h-4 w-4 text-yellow-600" />
                                                    <span className="font-medium text-yellow-700">Images Missing Alt Text</span>
                                                    <span className="text-xs text-yellow-600">→ View in Images tab</span>
                                                </div>
                                                <Badge className="bg-yellow-100 text-yellow-700">{audit.issues.missingAltImages}</Badge>
                                            </div>
                                        )}
                                        {audit.issues.slowPages > 0 && (
                                            <Collapsible>
                                                <CollapsibleTrigger className="flex items-center justify-between p-3 bg-blue-50 rounded-lg w-full hover:bg-blue-100 transition-colors">
                                                    <div className="flex items-center gap-2">
                                                        <ChevronDown className="h-4 w-4 text-blue-600" />
                                                        <span className="font-medium text-blue-700">Slow Pages (&gt;3s)</span>
                                                    </div>
                                                    <Badge className="bg-blue-100 text-blue-700">{audit.issues.slowPages}</Badge>
                                                </CollapsibleTrigger>
                                                <CollapsibleContent className="mt-2 ml-6 space-y-1 max-h-60 overflow-y-auto">
                                                    {audit.issueDetails?.slowPages.map((p, i) => (
                                                        <div key={i} className="flex items-center justify-between text-sm py-1">
                                                            <a href={p.url} target="_blank" rel="noopener" className="text-blue-700 hover:underline truncate max-w-md">{p.url}</a>
                                                            <span className="text-blue-600 text-xs">{(p.loadTime / 1000).toFixed(1)}s</span>
                                                        </div>
                                                    ))}
                                                </CollapsibleContent>
                                            </Collapsible>
                                        )}
                                        {audit.issues.thinContent > 0 && (
                                            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                                                <span className="font-medium text-slate-700">Thin Content (&lt;300 words)</span>
                                                <Badge variant="secondary">{audit.issues.thinContent}</Badge>
                                            </div>
                                        )}
                                        {Object.values(audit.issues).every(v => v === 0) && (
                                            <div className="p-4 bg-green-50 rounded-lg text-center text-green-700">
                                                <CheckCircle2 className="h-8 w-8 mx-auto mb-2" />
                                                <p className="font-medium">No issues found!</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="bg-white rounded-xl border p-12 text-center">
                                <ClipboardCheck className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-30" />
                                <p className="text-muted-foreground">Loading audit data...</p>
                            </div>
                        )}
                    </TabsContent>



                    {/* Pages Tab */}
                    <TabsContent value="pages" className="flex-1 overflow-hidden flex flex-col">
                        {/* Filter Toolbar */}
                        <div className="flex flex-wrap items-center gap-2 p-4 pb-2 shrink-0">
                            {/* Status Group */}
                            {['all', '200', '404', 'error'].map((key) => {
                                const count = key === 'all' ? pageCounts.all : key === '200' ? pageCounts.ok : key === '404' ? pageCounts.notFound : pageCounts.errors
                                const isSelected = statusFilter === key
                                let colorClass = isSelected ? "bg-slate-100 text-slate-900 border-slate-200" : "text-muted-foreground hover:bg-slate-50 border-transparent bg-transparent"

                                if (isSelected) {
                                    if (key === '200') colorClass = "bg-emerald-50 text-emerald-700 border-emerald-200"
                                    if (key === '404') colorClass = "bg-rose-50 text-rose-700 border-rose-200"
                                    if (key === 'error') colorClass = "bg-red-50 text-red-700 border-red-200"
                                }

                                return (
                                    <Button
                                        key={key}
                                        variant="outline"
                                        size="sm"
                                        className={`h-7 rounded-md border text-xs shadow-none ${colorClass}`}
                                        disabled={pagesLoading}
                                        onClick={() => {
                                            setStatusFilter(key as any)
                                            setPagesCurrentPage(1)
                                            fetchPages(1, key as any, urlTypeFilter)
                                        }}
                                    >
                                        {key === 'all' ? 'All' : key === '200' ? '200 OK' : key === '404' ? '404' : 'Errors'}
                                        <span className="ml-1.5 opacity-60">({count})</span>
                                    </Button>
                                )
                            })}

                            <div className="h-4 w-px bg-slate-200 mx-1" />

                            {/* Type Group */}
                            {[
                                { key: 'all', label: 'All Types', count: pageCounts.all },
                                { key: 'product', label: 'Products', count: pageCounts.products },
                                { key: 'blog', label: 'Blog', count: pageCounts.blog },
                                { key: 'category', label: 'Categories', count: pageCounts.categories }
                            ].map(({ key, label, count }) => (
                                <Button
                                    key={key}
                                    variant={urlTypeFilter === key ? 'secondary' : 'ghost'}
                                    size="sm"
                                    className={`h-7 rounded-md text-xs ${urlTypeFilter === key ? 'bg-slate-100 text-slate-900' : 'text-muted-foreground hover:bg-slate-50'}`}
                                    disabled={pagesLoading}
                                    onClick={() => {
                                        setUrlTypeFilter(key as any)
                                        setPagesCurrentPage(1)
                                        fetchPages(1, statusFilter, key as any)
                                    }}
                                >
                                    {label}
                                    {key !== 'all' && <span className="ml-1.5 opacity-60">({count})</span>}
                                </Button>
                            ))}

                            <div className="ml-auto">
                                <Button onClick={handleExport} variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground hover:text-foreground">
                                    <Download className="h-3 w-3 mr-1.5" /> Export
                                </Button>
                            </div>
                        </div>

                        {/* Table */}
                        <div className="flex-1 overflow-auto border-t bg-white">
                            {pagesLoading ? (
                                <div className="flex items-center justify-center py-16 text-muted-foreground">
                                    <Loader2 className="h-5 w-5 animate-spin mr-2" />
                                    <span>Loading from database...</span>
                                </div>
                            ) : (
                                <table className="w-full text-sm">
                                    <thead className="bg-slate-50 border-b sticky top-0 z-10">
                                        <tr>
                                            <th
                                                className="text-left p-3 font-medium cursor-pointer hover:bg-slate-100/80 transition-colors group"
                                                onClick={() => toggleSort('url')}
                                            >
                                                <div className="flex items-center gap-1">
                                                    URL
                                                    {sortColumn === 'url' && (
                                                        sortDirection === 'asc' ? <ArrowUp className="h-3 w-3 text-slate-500" /> : <ArrowDown className="h-3 w-3 text-slate-500" />
                                                    )}
                                                </div>
                                            </th>
                                            <th
                                                className="text-left p-3 font-medium w-32 cursor-pointer hover:bg-slate-100/80 transition-colors group"
                                                onClick={() => toggleSort('status')}
                                            >
                                                <div className="flex items-center gap-1">
                                                    Status
                                                    {sortColumn === 'status' && (
                                                        sortDirection === 'asc' ? <ArrowUp className="h-3 w-3 text-slate-500" /> : <ArrowDown className="h-3 w-3 text-slate-500" />
                                                    )}
                                                </div>
                                            </th>
                                            <th
                                                className="text-left p-3 font-medium w-36 cursor-pointer hover:bg-slate-100/80 transition-colors group"
                                                onClick={() => toggleSort('loadTime')}
                                            >
                                                <div className="flex items-center gap-1">
                                                    Load Time
                                                    {sortColumn === 'loadTime' && (
                                                        sortDirection === 'asc' ? <ArrowUp className="h-3 w-3 text-slate-500" /> : <ArrowDown className="h-3 w-3 text-slate-500" />
                                                    )}
                                                </div>
                                            </th>
                                            <th
                                                className="text-left p-3 font-medium w-28 cursor-pointer hover:bg-slate-100/80 transition-colors group"
                                                onClick={() => toggleSort('words')}
                                            >
                                                <div className="flex items-center gap-1">
                                                    Words
                                                    {sortColumn === 'words' && (
                                                        sortDirection === 'asc' ? <ArrowUp className="h-3 w-3 text-slate-500" /> : <ArrowDown className="h-3 w-3 text-slate-500" />
                                                    )}
                                                </div>
                                            </th>
                                            <th
                                                className="text-left p-3 font-medium w-24 cursor-pointer hover:bg-slate-100/80 transition-colors group"
                                            >
                                                <div className="flex items-center gap-1">
                                                    Images
                                                    {/* Images not sortable server-side efficiently yet */}
                                                </div>
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {[...pages].map((page) => {
                                            const blocked = applyRobotsFilter && isPathBlocked(page.url)
                                            return (
                                                <tr key={page.id} className={`hover:bg-slate-50 ${blocked ? 'opacity-50' : ''}`}>
                                                    <td className="p-3">
                                                        <div className="flex items-center gap-2">
                                                            <a
                                                                href={page.url}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className={`text-blue-600 hover:underline truncate block max-w-xl ${blocked ? 'line-through' : ''}`}
                                                                title={page.url}
                                                            >
                                                                {page.url.replace(job?.url || '', '') || '/'}
                                                            </a>
                                                            {blocked && <Badge variant="outline" className="text-xs">robots.txt</Badge>}
                                                        </div>
                                                        {page.title && (
                                                            <div className="text-xs text-muted-foreground truncate max-w-xl mt-0.5">
                                                                {page.title}
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="p-3">
                                                        <Badge variant={page.statusCode === 200 ? 'secondary' : 'destructive'} className="text-xs h-6">
                                                            {page.statusCode}
                                                        </Badge>
                                                    </td>
                                                    <td className="p-3 text-muted-foreground tabular-nums">
                                                        {page.loadTimeMs ? `${page.loadTimeMs}ms` : '-'}
                                                    </td>
                                                    <td className="p-3 text-muted-foreground tabular-nums">
                                                        {page.wordCount || '-'}
                                                    </td>
                                                    <td className="p-3 text-muted-foreground tabular-nums">
                                                        {page._count.images}
                                                    </td>
                                                </tr>
                                            )
                                        })}
                                    </tbody>
                                </table>
                            )}
                        </div>

                        {/* Pagination - Fixed at bottom */}
                        {pagesTotalPages > 1 && (
                            <div className="flex items-center justify-between p-3 border-t bg-slate-50 shrink-0">
                                <span className="text-sm text-muted-foreground">
                                    Page {pagesCurrentPage} of {pagesTotalPages}
                                </span>
                                <div className="flex gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => {
                                            const newPage = Math.max(1, pagesCurrentPage - 1)
                                            setPagesCurrentPage(newPage)
                                            fetchPages(newPage, statusFilter, urlTypeFilter)
                                        }}
                                        disabled={pagesCurrentPage === 1 || pagesLoading}
                                    >
                                        Previous
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => {
                                            const newPage = Math.min(pagesTotalPages, pagesCurrentPage + 1)
                                            setPagesCurrentPage(newPage)
                                            fetchPages(newPage, statusFilter, urlTypeFilter)
                                        }}
                                        disabled={pagesCurrentPage >= pagesTotalPages || pagesLoading}
                                    >
                                        Next
                                    </Button>
                                </div>
                            </div>
                        )}
                    </TabsContent>

                    {/* Images Tab */}
                    <TabsContent value="images" className="flex-1 overflow-auto p-4">
                        <div className="space-y-4">
                            {/* Image Filter */}
                            <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-lg">
                                <span className="text-sm text-muted-foreground">Filter:</span>
                                <div className="flex gap-1">
                                    {['all', 'missing-alt', 'duplicates'].map((key) => (
                                        <Button
                                            key={key}
                                            variant={imageFilter === key ? 'default' : 'outline'}
                                            size="sm"
                                            disabled={imagesLoading}
                                            onClick={() => {
                                                setImageFilter(key as any)
                                                setImagesCurrentPage(1)
                                                fetchImages(1, key as any)
                                            }}
                                        >
                                            {key === 'all' ? 'All' : key === 'missing-alt' ? 'Missing Alt' : 'Duplicates'}
                                        </Button>
                                    ))}
                                </div>
                            </div>

                            {/* Loading Message or Table */}
                            {imagesLoading ? (
                                <div className="flex items-center justify-center py-16 text-muted-foreground">
                                    <Loader2 className="h-5 w-5 animate-spin mr-2" />
                                    <span>Loading from database...</span>
                                </div>
                            ) : (
                                <div className="bg-white rounded-xl border overflow-hidden">
                                    <div className="max-h-[600px] overflow-auto">
                                        <table className="w-full text-sm">
                                            <thead className="bg-slate-50 border-b sticky top-0">
                                                <tr>
                                                    <th className="text-left p-3 font-medium w-16">Preview</th>
                                                    <th className="text-left p-3 font-medium">URL</th>
                                                    <th className="text-left p-3 font-medium w-32">Alt Text</th>
                                                    <th className="text-left p-3 font-medium w-48">Found on Page</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y">
                                                {images.map((img) => (
                                                    <tr key={img.id} className="hover:bg-slate-50">
                                                        <td className="p-3">
                                                            <img
                                                                src={img.url}
                                                                alt={img.alt || ''}
                                                                className="w-12 h-12 object-cover rounded"
                                                                loading="lazy"
                                                            />
                                                        </td>
                                                        <td className="p-3">
                                                            <a
                                                                href={img.url}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="text-blue-600 hover:underline truncate block max-w-xs"
                                                                title={img.url}
                                                            >
                                                                {img.url.split('/').pop()}
                                                            </a>
                                                        </td>
                                                        <td className="p-3">
                                                            {img.alt ? (
                                                                <span className="text-xs truncate block max-w-32" title={img.alt}>{img.alt}</span>
                                                            ) : (
                                                                <Badge variant="destructive" className="text-xs">Missing</Badge>
                                                            )}
                                                        </td>
                                                        <td className="p-3 text-xs text-muted-foreground truncate max-w-48" title={img.page?.url}>
                                                            {img.page?.url?.replace(/^https?:\/\/[^/]+/, '')}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                    {/* Pagination */}
                                    {imagesTotalPages > 1 && (
                                        <div className="flex items-center justify-between p-3 border-t bg-slate-50">
                                            <span className="text-sm text-muted-foreground">
                                                Page {imagesCurrentPage} of {imagesTotalPages}
                                            </span>
                                            <div className="flex gap-2">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => {
                                                        const newPage = Math.max(1, imagesCurrentPage - 1)
                                                        setImagesCurrentPage(newPage)
                                                        fetchImages(newPage, imageFilter)
                                                    }}
                                                    disabled={imagesCurrentPage === 1 || imagesLoading}
                                                >
                                                    Previous
                                                </Button>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => {
                                                        const newPage = Math.min(imagesTotalPages, imagesCurrentPage + 1)
                                                        setImagesCurrentPage(newPage)
                                                        fetchImages(newPage, imageFilter)
                                                    }}
                                                    disabled={imagesCurrentPage >= imagesTotalPages || imagesLoading}
                                                >
                                                    Next
                                                </Button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </TabsContent>

                    {/* Logs Tab */}
                    <TabsContent value="logs" className="mt-4">
                        <div className="bg-white rounded-xl border overflow-hidden">
                            <div className="divide-y max-h-[500px] overflow-auto">
                                {logs.map((log) => (
                                    <div key={log.id} className="p-3 text-sm font-mono">
                                        <div className="flex items-center gap-2">
                                            <Badge
                                                variant={log.level === 'error' ? 'destructive' : log.level === 'warn' ? 'secondary' : 'outline'}
                                                className="text-xs uppercase"
                                            >
                                                {log.level}
                                            </Badge>
                                            <span className="text-muted-foreground text-xs">
                                                {formatDistanceToNow(new Date(log.createdAt), { addSuffix: true })}
                                            </span>
                                        </div>
                                        <p className="mt-1">{log.message}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </TabsContent>

                    {/* Speed Tab */}
                    <TabsContent value="speed" className="flex-1 overflow-auto p-4">
                        <div className="bg-white rounded-xl border p-6">
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="font-semibold text-lg">PageSpeed Insights</h3>
                                <Button onClick={runPageSpeedTest} disabled={runningPageSpeed}>
                                    {runningPageSpeed ? (
                                        <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Running...</>
                                    ) : (
                                        <><Play className="h-4 w-4 mr-2" /> Run Test</>
                                    )}
                                </Button>
                            </div>

                            {pageSpeed ? (
                                <>
                                    {/* Scores with Circular Progress */}
                                    <div className="grid grid-cols-4 gap-6 mb-8">
                                        {[
                                            { score: pageSpeed.performanceScore, label: 'Performance', desc: 'Page load speed and responsiveness' },
                                            { score: pageSpeed.accessibilityScore, label: 'Accessibility', desc: 'Screen readers & keyboard nav' },
                                            { score: pageSpeed.seoScore, label: 'SEO', desc: 'Search engine optimization' },
                                            { score: pageSpeed.bestPracticesScore, label: 'Best Practices', desc: 'Security & code quality' }
                                        ].map((item, i) => (
                                            <div key={i} className="text-center">
                                                <div className="relative w-24 h-24 mx-auto mb-2">
                                                    {/* Background circle */}
                                                    <svg className="w-24 h-24 transform -rotate-90">
                                                        <circle cx="48" cy="48" r="40" stroke="#e5e5e5" strokeWidth="8" fill="none" />
                                                        <circle
                                                            cx="48" cy="48" r="40"
                                                            stroke={item.score >= 90 ? '#22c55e' : item.score >= 50 ? '#f97316' : '#ef4444'}
                                                            strokeWidth="8"
                                                            fill="none"
                                                            strokeDasharray={`${item.score * 2.51} 251`}
                                                            strokeLinecap="round"
                                                        />
                                                    </svg>
                                                    <div className={`absolute inset-0 flex items-center justify-center text-2xl font-bold ${getScoreColor(item.score)}`}>
                                                        {item.score}
                                                    </div>
                                                </div>
                                                <div className="font-medium">{item.label}</div>
                                                <div className="text-xs text-muted-foreground">{item.desc}</div>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Core Web Vitals */}
                                    <h4 className="font-medium mb-4">Core Web Vitals</h4>
                                    <div className="grid grid-cols-3 gap-4 mb-6">
                                        <div className="border rounded-lg p-4">
                                            <div className={`text-2xl font-bold ${pageSpeed.lcp <= 2500 ? 'text-green-600' : pageSpeed.lcp <= 4000 ? 'text-orange-500' : 'text-red-600'}`}>
                                                {(pageSpeed.lcp / 1000).toFixed(2)}s
                                            </div>
                                            <div className="text-sm font-medium">LCP (Largest Contentful Paint)</div>
                                            <div className="text-xs text-muted-foreground mt-1">
                                                {pageSpeed.lcp <= 2500 ? '✓ Good' : pageSpeed.lcp <= 4000 ? '⚠ Needs Improvement' : '✗ Poor'}
                                                <span className="ml-1 opacity-75">(&lt;2.5s is good)</span>
                                            </div>
                                        </div>
                                        <div className="border rounded-lg p-4">
                                            <div className={`text-2xl font-bold ${pageSpeed.fid <= 100 ? 'text-green-600' : pageSpeed.fid <= 300 ? 'text-orange-500' : 'text-red-600'}`}>
                                                {pageSpeed.fid.toFixed(0)}ms
                                            </div>
                                            <div className="text-sm font-medium">FID (First Input Delay)</div>
                                            <div className="text-xs text-muted-foreground mt-1">
                                                {pageSpeed.fid <= 100 ? '✓ Good' : pageSpeed.fid <= 300 ? '⚠ Needs Improvement' : '✗ Poor'}
                                                <span className="ml-1 opacity-75">(&lt;100ms is good)</span>
                                            </div>
                                        </div>
                                        <div className="border rounded-lg p-4">
                                            <div className={`text-2xl font-bold ${pageSpeed.cls <= 0.1 ? 'text-green-600' : pageSpeed.cls <= 0.25 ? 'text-orange-500' : 'text-red-600'}`}>
                                                {pageSpeed.cls.toFixed(3)}
                                            </div>
                                            <div className="text-sm font-medium">CLS (Cumulative Layout Shift)</div>
                                            <div className="text-xs text-muted-foreground mt-1">
                                                {pageSpeed.cls <= 0.1 ? '✓ Good' : pageSpeed.cls <= 0.25 ? '⚠ Needs Improvement' : '✗ Poor'}
                                                <span className="ml-1 opacity-75">(&lt;0.1 is good)</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Other Metrics */}
                                    <h4 className="font-medium mb-4">Other Metrics</h4>
                                    <div className="grid grid-cols-4 gap-4">
                                        <div className="border rounded-lg p-3 text-center">
                                            <div className="font-semibold">{(pageSpeed.fcp / 1000).toFixed(2)}s</div>
                                            <div className="text-xs text-muted-foreground">First Contentful Paint</div>
                                        </div>
                                        <div className="border rounded-lg p-3 text-center">
                                            <div className="font-semibold">{pageSpeed.tbt.toFixed(0)}ms</div>
                                            <div className="text-xs text-muted-foreground">Total Blocking Time</div>
                                        </div>
                                        <div className="border rounded-lg p-3 text-center">
                                            <div className="font-semibold">{(pageSpeed.tti / 1000).toFixed(2)}s</div>
                                            <div className="text-xs text-muted-foreground">Time to Interactive</div>
                                        </div>
                                        <div className="border rounded-lg p-3 text-center">
                                            <div className="font-semibold">{(pageSpeed.speedIndex / 1000).toFixed(2)}s</div>
                                            <div className="text-xs text-muted-foreground">Speed Index</div>
                                        </div>
                                    </div>

                                    <p className="text-xs text-muted-foreground mt-6">
                                        Last tested: {formatDistanceToNow(new Date(pageSpeed.fetchedAt), { addSuffix: true })}
                                    </p>
                                </>
                            ) : (
                                <div className="text-center py-12">
                                    <Gauge className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-30" />
                                    <p className="text-muted-foreground">No PageSpeed data yet</p>
                                    <p className="text-sm text-muted-foreground mt-1">Click "Run Test" to analyze this site&apos;s performance</p>
                                </div>
                            )}
                        </div>
                    </TabsContent>
                </Tabs>
            </div>
        </div >
    )
}
