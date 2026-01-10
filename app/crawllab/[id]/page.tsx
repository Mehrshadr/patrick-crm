"use client"

import { useState, useEffect, use } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
    Download
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
    const [imageStats, setImageStats] = useState({ total: 0, missingAlt: 0 })
    const [loading, setLoading] = useState(true)
    const [activeTab, setActiveTab] = useState("audit")

    useEffect(() => {
        fetchJob()
    }, [jobId])

    useEffect(() => {
        if (job?.status === 'running' || job?.status === 'pending') {
            const interval = setInterval(fetchJob, 3000)
            return () => clearInterval(interval)
        }
    }, [job?.status])

    useEffect(() => {
        if (activeTab === 'audit') fetchAudit()
        if (activeTab === 'pages') fetchPages()
        if (activeTab === 'images') fetchImages()
        if (activeTab === 'logs') fetchLogs()
        if (activeTab === 'speed') fetchPageSpeed()
    }, [activeTab, jobId])

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

    const fetchPages = async () => {
        try {
            const res = await fetch(`/api/crawl/${jobId}/pages?limit=100`)
            const data = await res.json()
            if (data.success) {
                setPages(data.pages)
            }
        } catch (e) {
            console.error('Failed to fetch pages', e)
        }
    }

    const fetchImages = async () => {
        try {
            const res = await fetch(`/api/crawl/${jobId}/images?limit=100`)
            const data = await res.json()
            if (data.success) {
                setImages(data.images)
                setImageStats(data.stats)
            }
        } catch (e) {
            console.error('Failed to fetch images', e)
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
        <div className="p-6 max-w-6xl mx-auto">
            {/* Header */}
            <div className="mb-6">
                <Link href="/crawllab" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4">
                    <ArrowLeft className="h-4 w-4 mr-1" />
                    Back to CrawlLab
                </Link>

                <div className="flex items-start justify-between">
                    <div>
                        <h1 className="text-2xl font-bold flex items-center gap-3">
                            <Globe className="h-6 w-6 text-blue-600" />
                            {new URL(job.url).hostname}
                        </h1>
                        <p className="text-muted-foreground text-sm mt-1">{job.url}</p>
                    </div>
                    {getStatusBadge(job.status)}
                </div>

                {/* Stats */}
                <div className="grid grid-cols-4 gap-4 mt-6">
                    <div className="bg-white rounded-lg border p-4">
                        <div className="text-2xl font-bold">{job.crawledPages}</div>
                        <div className="text-sm text-muted-foreground flex items-center gap-1">
                            <FileText className="h-3.5 w-3.5" /> Pages
                        </div>
                    </div>
                    <div className="bg-white rounded-lg border p-4">
                        <div className="text-2xl font-bold">{job.imageCount}</div>
                        <div className="text-sm text-muted-foreground flex items-center gap-1">
                            <ImageIcon className="h-3.5 w-3.5" /> Images
                        </div>
                    </div>
                    <div className="bg-white rounded-lg border p-4">
                        <div className="text-2xl font-bold">{job.linkCount}</div>
                        <div className="text-sm text-muted-foreground flex items-center gap-1">
                            <Link2 className="h-3.5 w-3.5" /> Links
                        </div>
                    </div>
                    <div className="bg-white rounded-lg border p-4">
                        <div className="text-2xl font-bold text-orange-600">{imageStats.missingAlt}</div>
                        <div className="text-sm text-muted-foreground flex items-center gap-1">
                            <AlertTriangle className="h-3.5 w-3.5" /> Missing Alt
                        </div>
                    </div>
                </div>

                {/* Progress */}
                {job.status === 'running' && job.totalPages && (
                    <div className="mt-4">
                        <div className="flex items-center justify-between text-sm mb-1">
                            <span>Progress</span>
                            <span>{Math.round((job.crawledPages / job.totalPages) * 100)}%</span>
                        </div>
                        <div className="bg-blue-100 rounded-full h-3 overflow-hidden">
                            <div
                                className="bg-blue-600 h-3 transition-all"
                                style={{ width: `${(job.crawledPages / job.totalPages) * 100}%` }}
                            />
                        </div>
                    </div>
                )}
            </div>

            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab}>
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
                    <TabsTrigger value="logs" className="flex items-center gap-2">
                        <ScrollText className="h-4 w-4" /> Logs
                    </TabsTrigger>
                    <TabsTrigger value="speed" className="flex items-center gap-2">
                        <Gauge className="h-4 w-4" /> Speed
                    </TabsTrigger>
                </TabsList>

                {/* Audit Tab */}
                <TabsContent value="audit" className="mt-4">
                    {audit ? (
                        <div className="space-y-6">
                            {/* SEO Score Card */}
                            <div className="bg-white rounded-xl border p-6">
                                <div className="flex items-center justify-between mb-6">
                                    <h3 className="font-semibold text-lg">SEO Audit Summary</h3>
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
                                <div className="space-y-3">
                                    {audit.issues.brokenPages > 0 && (
                                        <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                                            <span className="font-medium text-red-700">Broken Pages (4xx/5xx)</span>
                                            <Badge variant="destructive">{audit.issues.brokenPages}</Badge>
                                        </div>
                                    )}
                                    {audit.issues.missingTitle > 0 && (
                                        <div className="flex items-center justify-between p-3 bg-orange-50 rounded-lg">
                                            <span className="font-medium text-orange-700">Missing Title Tags</span>
                                            <Badge className="bg-orange-100 text-orange-700">{audit.issues.missingTitle}</Badge>
                                        </div>
                                    )}
                                    {audit.issues.missingMetaDescription > 0 && (
                                        <div className="flex items-center justify-between p-3 bg-orange-50 rounded-lg">
                                            <span className="font-medium text-orange-700">Missing Meta Descriptions</span>
                                            <Badge className="bg-orange-100 text-orange-700">{audit.issues.missingMetaDescription}</Badge>
                                        </div>
                                    )}
                                    {audit.issues.missingH1 > 0 && (
                                        <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
                                            <span className="font-medium text-yellow-700">Missing H1 Tags</span>
                                            <Badge className="bg-yellow-100 text-yellow-700">{audit.issues.missingH1}</Badge>
                                        </div>
                                    )}
                                    {audit.issues.missingAltImages > 0 && (
                                        <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
                                            <span className="font-medium text-yellow-700">Images Missing Alt Text</span>
                                            <Badge className="bg-yellow-100 text-yellow-700">{audit.issues.missingAltImages}</Badge>
                                        </div>
                                    )}
                                    {audit.issues.slowPages > 0 && (
                                        <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                                            <span className="font-medium text-blue-700">Slow Pages (&gt;3s)</span>
                                            <Badge className="bg-blue-100 text-blue-700">{audit.issues.slowPages}</Badge>
                                        </div>
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
                <TabsContent value="pages" className="mt-4">
                    <div className="bg-white rounded-xl border overflow-hidden">
                        <table className="w-full text-sm">
                            <thead className="bg-slate-50 border-b">
                                <tr>
                                    <th className="text-left p-3 font-medium">URL</th>
                                    <th className="text-left p-3 font-medium w-20">Status</th>
                                    <th className="text-left p-3 font-medium w-24">Load Time</th>
                                    <th className="text-left p-3 font-medium w-20">Words</th>
                                    <th className="text-left p-3 font-medium w-20">Images</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {pages.map((page) => (
                                    <tr key={page.id} className="hover:bg-slate-50">
                                        <td className="p-3">
                                            <div className="truncate max-w-md" title={page.url}>
                                                {page.url.replace(job.url, '')}
                                            </div>
                                            {page.title && (
                                                <div className="text-xs text-muted-foreground truncate max-w-md">
                                                    {page.title}
                                                </div>
                                            )}
                                        </td>
                                        <td className="p-3">
                                            <Badge variant={page.statusCode === 200 ? 'secondary' : 'destructive'} className="text-xs">
                                                {page.statusCode}
                                            </Badge>
                                        </td>
                                        <td className="p-3 text-muted-foreground">
                                            {page.loadTimeMs ? `${page.loadTimeMs}ms` : '-'}
                                        </td>
                                        <td className="p-3 text-muted-foreground">
                                            {page.wordCount || '-'}
                                        </td>
                                        <td className="p-3 text-muted-foreground">
                                            {page._count.images}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </TabsContent>

                {/* Images Tab */}
                <TabsContent value="images" className="mt-4">
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {images.map((img) => (
                            <div key={img.id} className="bg-white rounded-lg border overflow-hidden">
                                <div className="aspect-video bg-slate-100 relative">
                                    <img
                                        src={img.url}
                                        alt={img.alt || ''}
                                        className="w-full h-full object-cover"
                                        loading="lazy"
                                    />
                                </div>
                                <div className="p-3">
                                    {!img.alt && (
                                        <Badge variant="destructive" className="mb-2 text-xs">
                                            Missing Alt
                                        </Badge>
                                    )}
                                    <p className="text-xs text-muted-foreground truncate" title={img.url}>
                                        {img.url.split('/').pop()}
                                    </p>
                                    {img.alt && (
                                        <p className="text-xs mt-1 truncate" title={img.alt}>
                                            Alt: {img.alt}
                                        </p>
                                    )}
                                </div>
                            </div>
                        ))}
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
                <TabsContent value="speed" className="mt-4">
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
                                {/* Scores */}
                                <div className="grid grid-cols-4 gap-4 mb-8">
                                    <div className={`rounded-lg p-4 ${getScoreBg(pageSpeed.performanceScore)}`}>
                                        <div className={`text-3xl font-bold ${getScoreColor(pageSpeed.performanceScore)}`}>
                                            {pageSpeed.performanceScore}
                                        </div>
                                        <div className="text-sm text-muted-foreground">Performance</div>
                                    </div>
                                    <div className={`rounded-lg p-4 ${getScoreBg(pageSpeed.accessibilityScore)}`}>
                                        <div className={`text-3xl font-bold ${getScoreColor(pageSpeed.accessibilityScore)}`}>
                                            {pageSpeed.accessibilityScore}
                                        </div>
                                        <div className="text-sm text-muted-foreground">Accessibility</div>
                                    </div>
                                    <div className={`rounded-lg p-4 ${getScoreBg(pageSpeed.seoScore)}`}>
                                        <div className={`text-3xl font-bold ${getScoreColor(pageSpeed.seoScore)}`}>
                                            {pageSpeed.seoScore}
                                        </div>
                                        <div className="text-sm text-muted-foreground">SEO</div>
                                    </div>
                                    <div className={`rounded-lg p-4 ${getScoreBg(pageSpeed.bestPracticesScore)}`}>
                                        <div className={`text-3xl font-bold ${getScoreColor(pageSpeed.bestPracticesScore)}`}>
                                            {pageSpeed.bestPracticesScore}
                                        </div>
                                        <div className="text-sm text-muted-foreground">Best Practices</div>
                                    </div>
                                </div>

                                {/* Core Web Vitals */}
                                <h4 className="font-medium mb-4">Core Web Vitals</h4>
                                <div className="grid grid-cols-3 gap-4 mb-6">
                                    <div className="border rounded-lg p-4">
                                        <div className="text-2xl font-bold">{(pageSpeed.lcp / 1000).toFixed(2)}s</div>
                                        <div className="text-sm text-muted-foreground">LCP (Largest Contentful Paint)</div>
                                    </div>
                                    <div className="border rounded-lg p-4">
                                        <div className="text-2xl font-bold">{pageSpeed.fid.toFixed(0)}ms</div>
                                        <div className="text-sm text-muted-foreground">FID (First Input Delay)</div>
                                    </div>
                                    <div className="border rounded-lg p-4">
                                        <div className="text-2xl font-bold">{pageSpeed.cls.toFixed(3)}</div>
                                        <div className="text-sm text-muted-foreground">CLS (Cumulative Layout Shift)</div>
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
    )
}
