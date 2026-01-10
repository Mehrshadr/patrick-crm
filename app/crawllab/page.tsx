"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
    Globe,
    Loader2,
    Play,
    Image as ImageIcon,
    Link2,
    FileText,
    Clock,
    CheckCircle2,
    XCircle,
    RefreshCw,
    ExternalLink
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

export default function CrawlLabPage() {
    const [url, setUrl] = useState("")
    const [jobs, setJobs] = useState<CrawlJob[]>([])
    const [loading, setLoading] = useState(false)
    const [starting, setStarting] = useState(false)
    const [error, setError] = useState("")

    // Fetch jobs on mount
    useEffect(() => {
        fetchJobs()
    }, [])

    // Poll for updates when there's a running job
    useEffect(() => {
        const hasRunning = jobs.some(j => j.status === 'running' || j.status === 'pending')
        if (hasRunning) {
            const interval = setInterval(fetchJobs, 3000)
            return () => clearInterval(interval)
        }
    }, [jobs])

    const fetchJobs = async () => {
        try {
            const res = await fetch('/api/crawl/jobs')
            const data = await res.json()
            if (data.success) {
                setJobs(data.jobs)
            }
        } catch (e) {
            console.error('Failed to fetch jobs', e)
        }
    }

    const startCrawl = async () => {
        if (!url.trim()) {
            setError("Please enter a URL")
            return
        }

        setStarting(true)
        setError("")

        try {
            const res = await fetch('/api/crawl/start', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: url.trim() })
            })

            const data = await res.json()

            if (!data.success) {
                throw new Error(data.error || 'Failed to start crawl')
            }

            setUrl("")
            fetchJobs()
        } catch (e: any) {
            setError(e.message)
        } finally {
            setStarting(false)
        }
    }

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'running':
                return <Badge className="bg-blue-100 text-blue-700"><Loader2 className="h-3 w-3 mr-1 animate-spin" />Running</Badge>
            case 'completed':
                return <Badge className="bg-green-100 text-green-700"><CheckCircle2 className="h-3 w-3 mr-1" />Completed</Badge>
            case 'failed':
                return <Badge className="bg-red-100 text-red-700"><XCircle className="h-3 w-3 mr-1" />Failed</Badge>
            case 'pending':
                return <Badge className="bg-yellow-100 text-yellow-700"><Clock className="h-3 w-3 mr-1" />Pending</Badge>
            default:
                return <Badge variant="secondary">{status}</Badge>
        }
    }

    return (
        <div className="p-6 max-w-6xl mx-auto">
            {/* Header */}
            <div className="mb-8">
                <h1 className="text-3xl font-bold flex items-center gap-3">
                    <Globe className="h-8 w-8 text-blue-600" />
                    CrawlLab
                </h1>
                <p className="text-muted-foreground mt-2">
                    Crawl websites to extract SEO data, images, and links
                </p>
            </div>

            {/* Start Crawl Form */}
            <div className="bg-white rounded-xl border p-6 mb-8">
                <h2 className="font-semibold mb-4">Start New Crawl</h2>
                <div className="flex gap-3">
                    <Input
                        placeholder="Enter website URL (e.g., example.com)"
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && startCrawl()}
                        className="flex-1"
                    />
                    <Button onClick={startCrawl} disabled={starting}>
                        {starting ? (
                            <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Starting...</>
                        ) : (
                            <><Play className="h-4 w-4 mr-2" /> Start Crawl</>
                        )}
                    </Button>
                </div>
                {error && (
                    <p className="text-red-500 text-sm mt-2">{error}</p>
                )}
            </div>

            {/* Jobs List */}
            <div className="bg-white rounded-xl border">
                <div className="p-4 border-b flex items-center justify-between">
                    <h2 className="font-semibold">Crawl Jobs</h2>
                    <Button variant="ghost" size="sm" onClick={fetchJobs}>
                        <RefreshCw className="h-4 w-4" />
                    </Button>
                </div>

                {jobs.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground">
                        <Globe className="h-12 w-12 mx-auto mb-3 opacity-20" />
                        <p>No crawl jobs yet</p>
                        <p className="text-sm">Start a crawl to see results here</p>
                    </div>
                ) : (
                    <div className="divide-y">
                        {jobs.map((job) => (
                            <Link
                                key={job.id}
                                href={`/crawllab/${job.id}`}
                                className="block p-4 hover:bg-slate-50 transition-colors"
                            >
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-3">
                                        <span className="font-medium truncate max-w-md">
                                            {job.url}
                                        </span>
                                        {getStatusBadge(job.status)}
                                    </div>
                                    <span className="text-xs text-muted-foreground">
                                        {formatDistanceToNow(new Date(job.createdAt), { addSuffix: true })}
                                    </span>
                                </div>

                                <div className="flex items-center gap-6 text-sm text-muted-foreground">
                                    <span className="flex items-center gap-1">
                                        <FileText className="h-3.5 w-3.5" />
                                        {job.crawledPages}{job.totalPages ? `/${job.totalPages}` : ''} pages
                                    </span>
                                    <span className="flex items-center gap-1">
                                        <ImageIcon className="h-3.5 w-3.5" />
                                        {job.imageCount} images
                                    </span>
                                    <span className="flex items-center gap-1">
                                        <Link2 className="h-3.5 w-3.5" />
                                        {job.linkCount} links
                                    </span>
                                </div>

                                {job.status === 'running' && job.totalPages && (
                                    <div className="mt-3">
                                        <div className="bg-blue-100 rounded-full h-2 overflow-hidden">
                                            <div
                                                className="bg-blue-600 h-2 transition-all"
                                                style={{ width: `${(job.crawledPages / job.totalPages) * 100}%` }}
                                            />
                                        </div>
                                    </div>
                                )}

                                {job.error && (
                                    <p className="text-red-500 text-xs mt-2 truncate">
                                        Error: {job.error}
                                    </p>
                                )}
                            </Link>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
