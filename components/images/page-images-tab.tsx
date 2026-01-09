"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import {
    Loader2,
    Search,
    Image as ImageIcon,
    ExternalLink,
    AlertTriangle,
    FileText,
    RefreshCw,
    Database,
    FileWarning,
    ChevronLeft,
    ChevronRight,
    Zap,
    Upload,
    Check,
    Undo2
} from "lucide-react"
import { formatBytes } from "@/lib/utils"

interface PageImage {
    id?: number
    url: string
    filename: string
    size_bytes: number
    size_kb: number
    alt?: string
    mime_type?: string
    pages: {
        id: number
        title: string
        url: string
        type: string
    }[]
    page_count: number
    optimized?: boolean
}

interface PageImagesTabProps {
    projectId: number
    onSelectImage?: (image: PageImage) => void
}

export function PageImagesTab({ projectId, onSelectImage }: PageImagesTabProps) {
    const [images, setImages] = useState<PageImage[]>([])
    const [allImages, setAllImages] = useState<PageImage[]>([]) // Unfiltered
    const [loading, setLoading] = useState(false)
    const [syncing, setSyncing] = useState(false)
    const [syncProgress, setSyncProgress] = useState({ current: 0, total: 0, images: 0 })
    const [error, setError] = useState("")
    const [scanned, setScanned] = useState(false)
    const [fromDatabase, setFromDatabase] = useState(false)
    const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null)

    // Global stats
    const [globalStats, setGlobalStats] = useState({ total: 0, heavy: 0, missingAlt: 0 })

    // Filters
    const [filterUrl, setFilterUrl] = useState("")
    const [filterFormat, setFilterFormat] = useState("")
    const [filterType, setFilterType] = useState("")
    const [filterHeavy, setFilterHeavy] = useState(false)
    const [filterMissingAlt, setFilterMissingAlt] = useState(false)
    const [search, setSearch] = useState("")

    // Pagination
    const [page, setPage] = useState(1)
    const perPage = 24
    const [totalPages, setTotalPages] = useState(1)

    // Selection
    const [selectedImages, setSelectedImages] = useState<Set<string>>(new Set())

    // Compress Modal
    const [compressModal, setCompressModal] = useState<{
        open: boolean
        imageUrl: string
        imageFilename: string
        originalSize: number
        compressing: boolean
        result: any
        error: string
        // Settings
        maxSizeKB: number
        maxWidth: number
        format: 'webp' | 'jpeg' | 'png'
        keepOriginalFormat: boolean
        // Apply state
        applying: boolean
        applied: boolean
        appliedData: any
    }>({
        open: false,
        imageUrl: "",
        imageFilename: "",
        originalSize: 0,
        compressing: false,
        result: null,
        error: "",
        // Settings defaults
        maxSizeKB: 100,
        maxWidth: 1200,
        format: 'webp',
        keepOriginalFormat: true,
        // Apply state
        applying: false,
        applied: false,
        appliedData: null
    })

    // Alt Modal
    const [altModal, setAltModal] = useState<{
        open: boolean
        imageUrl: string
        imageFilename: string
        altText: string
        currentAlt: string // Original alt from WordPress
        pages: { id: number; title: string; url: string; type?: string }[]
        saving: boolean
        generating: boolean
        error: string
        success: boolean
        refinementInput: string
    }>({
        open: false,
        imageUrl: "",
        imageFilename: "",
        altText: "",
        currentAlt: "",
        pages: [],
        saving: false,
        generating: false,
        error: "",
        success: false,
        refinementInput: ""
    })

    // Background sync job status
    const [syncJob, setSyncJob] = useState<{
        hasJob: boolean
        status: string
        currentPage: number
        totalPages: number | null
        progress: number
        error: string | null
    } | null>(null)

    // Auto-load from database on mount and check sync status
    useEffect(() => {
        loadFromDatabase()
        checkSyncStatus()
    }, [projectId])

    // Poll sync status when job is active
    useEffect(() => {
        if (syncJob?.status === 'pending' || syncJob?.status === 'running') {
            const interval = setInterval(() => {
                checkSyncStatus()
                // Also reload images to show progress
                loadFromDatabase()
            }, 5000) // Check every 5 seconds
            return () => clearInterval(interval)
        }
    }, [syncJob?.status])

    // Apply filters whenever filter state changes
    useEffect(() => {
        applyFilters()
    }, [allImages, filterUrl, filterFormat, filterType, filterHeavy, filterMissingAlt, search, page])

    const checkSyncStatus = async () => {
        try {
            const res = await fetch(`/api/images/sync-job?projectId=${projectId}`)
            const data = await res.json()
            if (data.success) {
                setSyncJob(data.hasJob ? data.job : null)
            }
        } catch (e) {
            console.error('Failed to check sync status:', e)
        }
    }

    const loadFromDatabase = async () => {
        setError("")

        try {
            const res = await fetch(`/api/images/scan-content?projectId=${projectId}&limit=10000`)

            if (!res.ok) {
                const errorData = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
                console.error("Load error:", errorData)
                return
            }

            const data = await res.json()

            if (data.success && data.images && data.images.length > 0) {
                setAllImages(data.images)
                setFromDatabase(data.fromDatabase || false)
                setLastSyncedAt(data.stats?.lastSyncedAt ? new Date(data.stats.lastSyncedAt) : null)
                setScanned(true)

                // Calculate global stats
                const total = data.images.length
                const heavy = data.images.filter((img: PageImage) => img.size_kb > 150).length
                const missingAlt = data.images.filter((img: PageImage) => !img.alt).length
                setGlobalStats({ total, heavy, missingAlt })
            }
        } catch (e: any) {
            console.error("Load error:", e)
        }
    }

    const applyFilters = () => {
        let filtered = [...allImages]

        // Search filter
        if (search) {
            const s = search.toLowerCase()
            filtered = filtered.filter(img =>
                img.filename.toLowerCase().includes(s) ||
                img.url.toLowerCase().includes(s)
            )
        }

        // URL filter (filter by page URL)
        if (filterUrl) {
            const urlLower = filterUrl.toLowerCase()
            filtered = filtered.filter(img =>
                img.pages.some(p => p.url.toLowerCase().includes(urlLower))
            )
        }

        // Format filter
        if (filterFormat) {
            filtered = filtered.filter(img => {
                const ext = img.filename.split('.').pop()?.toLowerCase() || ''
                if (filterFormat === 'jpeg') return ext === 'jpg' || ext === 'jpeg'
                return ext === filterFormat
            })
        }

        // Type filter
        if (filterType) {
            filtered = filtered.filter(img =>
                img.pages.some(p => p.type === filterType)
            )
        }

        // Heavy filter (>150KB)
        if (filterHeavy) {
            filtered = filtered.filter(img => img.size_kb > 150)
        }

        // Missing alt filter
        if (filterMissingAlt) {
            filtered = filtered.filter(img => !img.alt)
        }

        // Pagination
        const total = filtered.length
        setTotalPages(Math.ceil(total / perPage) || 1)

        const start = (page - 1) * perPage
        const paged = filtered.slice(start, start + perPage)

        setImages(paged)
    }

    const syncContent = async () => {
        setSyncing(true)
        setError("")

        try {
            // Start a background sync job
            const res = await fetch(`/api/images/sync-job?projectId=${projectId}`, {
                method: 'POST'
            })
            const data = await res.json()

            if (!data.success) {
                throw new Error(data.error || "Failed to start sync")
            }

            // Update sync job status
            setSyncJob(data.job)

            // The background job will process images in batches
            // We poll for status updates in the useEffect

        } catch (e: any) {
            setError(e.message)
            setSyncing(false)
        }
    }

    const cancelSync = async () => {
        try {
            await fetch(`/api/images/sync-job?projectId=${projectId}`, {
                method: 'DELETE'
            })
            setSyncJob(null)
            setSyncing(false)
        } catch (e) {
            console.error('Failed to cancel sync:', e)
        }
    }

    const resumeSync = async () => {
        try {
            setSyncing(true)
            setError('')

            // Call API with resume=true to continue from where it stopped
            const res = await fetch(`/api/images/sync-job?projectId=${projectId}&resume=true`, {
                method: 'POST'
            })

            const data = await res.json()
            if (data.success) {
                setSyncJob(data.job)
            } else {
                setError(data.error || 'Failed to resume sync')
                setSyncing(false)
            }
        } catch (e: any) {
            setError(e.message)
            setSyncing(false)
        }
    }

    const formatType = (type: string) => {
        const types: Record<string, string> = {
            'post': 'Blog',
            'page': 'Page',
            'product': 'Product',
            'landing_page': 'Landing'
        }
        return types[type] || type
    }

    const clearFilters = () => {
        setFilterUrl("")
        setFilterFormat("")
        setFilterType("")
        setFilterHeavy(false)
        setFilterMissingAlt(false)
        setSearch("")
        setPage(1)
    }

    const toggleSelectImage = (url: string) => {
        setSelectedImages(prev => {
            const next = new Set(prev)
            if (next.has(url)) {
                next.delete(url)
            } else {
                next.add(url)
            }
            return next
        })
    }

    // Open compress modal with settings (don't start compression yet)
    const handleCompress = (imageUrl: string, filename: string, sizeKB: number) => {
        setCompressModal({
            open: true,
            imageUrl,
            imageFilename: filename,
            originalSize: sizeKB,
            compressing: false,
            result: null,
            error: "",
            maxSizeKB: 100,
            maxWidth: 1200,
            format: 'webp',
            keepOriginalFormat: true,
            applying: false,
            applied: false,
            appliedData: null
        })
    }

    // Start compression with current settings
    const startCompression = async () => {
        setCompressModal(prev => ({ ...prev, compressing: true, error: "", result: null }))

        try {
            // Detect original format for keepOriginalFormat option
            let format = compressModal.format
            if (compressModal.keepOriginalFormat) {
                const ext = compressModal.imageFilename.split('.').pop()?.toLowerCase()
                if (ext === 'jpg' || ext === 'jpeg') format = 'jpeg'
                else if (ext === 'png') format = 'png'
                else format = 'webp'
            }

            const res = await fetch('/api/images/compress-apply', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectId,
                    imageUrl: compressModal.imageUrl,
                    maxSizeKB: compressModal.maxSizeKB,
                    maxWidth: compressModal.maxWidth,
                    format,
                    keepFormat: compressModal.keepOriginalFormat
                })
            })

            const data = await res.json()

            if (!data.success) {
                throw new Error(data.error || "Compression failed")
            }

            setCompressModal(prev => ({
                ...prev,
                compressing: false,
                result: data
            }))
        } catch (e: any) {
            setCompressModal(prev => ({
                ...prev,
                compressing: false,
                error: e.message
            }))
        }
    }

    // Apply compressed image to WordPress
    const handleApplyToWordPress = async () => {
        if (!compressModal.result) return

        setCompressModal(prev => ({ ...prev, applying: true, error: "" }))

        try {
            const res = await fetch('/api/images/apply-to-wordpress', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectId,
                    imageUrl: compressModal.imageUrl,
                    base64: compressModal.result.compressed.base64,
                    mimeType: `image/${compressModal.result.compressed.format || 'webp'}`,
                    newSizeBytes: compressModal.result.compressed.sizeBytes
                })
            })

            const data = await res.json()

            if (!data.success) {
                throw new Error(data.error || "Failed to apply to WordPress")
            }

            // Update local state with new size
            const newSizeKB = compressModal.result.compressed.sizeBytes / 1024
            setAllImages(prev => prev.map(img =>
                img.url === compressModal.imageUrl
                    ? { ...img, size_kb: newSizeKB, size_bytes: compressModal.result.compressed.sizeBytes }
                    : img
            ))

            setCompressModal(prev => ({
                ...prev,
                applying: false,
                applied: true,
                appliedData: data
            }))
        } catch (e: any) {
            setCompressModal(prev => ({
                ...prev,
                applying: false,
                error: e.message
            }))
        }
    }

    const handleDownloadCompressed = () => {
        if (!compressModal.result) return

        const format = compressModal.result.compressed.format || 'webp'
        const link = document.createElement('a')
        link.href = `data:image/${format};base64,${compressModal.result.compressed.base64}`
        link.download = compressModal.imageFilename.replace(/\.[^.]+$/, `.${format}`)
        link.click()
    }

    const handleUndoReplace = async () => {
        if (!compressModal.appliedData?.mediaId) return

        setCompressModal(prev => ({ ...prev, applying: true, error: "" }))

        try {
            const res = await fetch('/api/images/restore-original', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectId,
                    mediaId: compressModal.appliedData.mediaId,
                    backupPath: compressModal.appliedData.backupPath
                })
            })

            const data = await res.json()

            if (!data.success) {
                throw new Error(data.error || "Failed to restore original")
            }

            // Restore original size in local state
            setAllImages(prev => prev.map(img =>
                img.url === compressModal.imageUrl
                    ? { ...img, size_kb: compressModal.originalSize, size_bytes: compressModal.originalSize * 1024 }
                    : img
            ))

            setCompressModal(prev => ({
                ...prev,
                applying: false,
                applied: false,
                appliedData: null
            }))

            alert("Original image restored successfully!")
        } catch (e: any) {
            setCompressModal(prev => ({
                ...prev,
                applying: false,
                error: e.message
            }))
        }
    }

    const closeCompressModal = () => {
        setCompressModal({
            open: false,
            imageUrl: "",
            imageFilename: "",
            originalSize: 0,
            compressing: false,
            result: null,
            error: "",
            maxSizeKB: 100,
            maxWidth: 1200,
            format: 'webp',
            keepOriginalFormat: true,
            applying: false,
            applied: false,
            appliedData: null
        })
    }

    const handleAddAlt = (image: PageImage) => {
        setAltModal({
            open: true,
            imageUrl: image.url,
            imageFilename: image.filename,
            altText: image.alt || "",
            currentAlt: image.alt || "",
            pages: image.pages,
            saving: false,
            generating: false,
            error: "",
            success: false,
            refinementInput: ""
        })
    }

    const closeAltModal = () => {
        setAltModal({
            open: false,
            imageUrl: "",
            imageFilename: "",
            altText: "",
            currentAlt: "",
            pages: [],
            saving: false,
            generating: false,
            error: "",
            success: false,
            refinementInput: ""
        })
    }

    // Generate alt text with AI
    const generateAltText = async (withRefinement = false) => {
        setAltModal(prev => ({ ...prev, generating: true, error: "" }))
        try {
            // Build page context from first page if available
            const pageContext = altModal.pages[0] ? {
                title: altModal.pages[0].title,
                url: altModal.pages[0].url,
                type: altModal.pages[0].type || "page"
            } : undefined

            const response = await fetch("/api/images/generate-alt", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    imageUrl: altModal.imageUrl,
                    projectId,
                    pageContext,
                    refinementInstructions: withRefinement ? altModal.refinementInput : undefined
                })
            })
            const data = await response.json()
            if (!response.ok) {
                throw new Error(data.error || "Failed to generate alt text")
            }
            setAltModal(prev => ({ ...prev, altText: data.altText, generating: false, refinementInput: "" }))
        } catch (error) {
            setAltModal(prev => ({
                ...prev,
                generating: false,
                error: error instanceof Error ? error.message : "Failed to generate alt text"
            }))
        }
    }

    // Apply alt text to WordPress
    const applyAltText = async () => {
        setAltModal(prev => ({ ...prev, saving: true, error: "" }))
        try {
            const response = await fetch("/api/images/update-alt", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    imageUrl: altModal.imageUrl,
                    altText: altModal.altText,
                    projectId
                })
            })
            const data = await response.json()
            if (!response.ok) {
                throw new Error(data.error || "Failed to update alt text")
            }
            setAltModal(prev => ({ ...prev, saving: false, success: true, currentAlt: prev.altText }))
            // Update the image in the local state
            setAllImages(prev => prev.map(img =>
                img.url === altModal.imageUrl ? { ...img, alt: altModal.altText } : img
            ))
        } catch (error) {
            setAltModal(prev => ({
                ...prev,
                saving: false,
                error: error instanceof Error ? error.message : "Failed to update alt text"
            }))
        }
    }

    if (!scanned) {
        return (
            <div className="flex flex-col items-center justify-center py-16 gap-6">
                <div className="text-center max-w-md">
                    <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-4">
                        <Search className="h-8 w-8 text-amber-600" />
                    </div>
                    <h3 className="text-xl font-semibold mb-2">Scan Page Content</h3>
                    <p className="text-muted-foreground mb-6">
                        Find all images that are being loaded on your published pages.
                        This helps you optimize images, add alt text, and improve SEO.
                    </p>

                    <Button onClick={syncContent} disabled={syncing || loading} size="lg">
                        {syncing ? (
                            <>
                                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                                Syncing from WordPress...
                            </>
                        ) : (
                            <>
                                <RefreshCw className="h-5 w-5 mr-2" />
                                Sync Page Images
                            </>
                        )}
                    </Button>
                    <p className="text-xs text-muted-foreground mt-2">
                        This will scan all published pages and save the results.
                    </p>
                </div>
            </div>
        )
    }

    return (
        <>
            <div className="space-y-6">
                {/* Controls */}
                <div className="bg-white p-4 rounded-xl border shadow-sm space-y-4">
                    <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
                        <form onSubmit={(e) => { e.preventDefault(); setPage(1); }} className="flex gap-2 w-full sm:w-auto">
                            <div className="relative w-full sm:w-64">
                                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                                <Input
                                    placeholder="Search images..."
                                    className="pl-9"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                />
                            </div>
                        </form>

                        <div className="flex gap-2">
                            <Button
                                onClick={syncContent}
                                disabled={syncing || syncJob?.status === 'running' || syncJob?.status === 'pending'}
                                variant="default"
                            >
                                {(syncing || syncJob?.status === 'running' || syncJob?.status === 'pending')
                                    ? <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    : <RefreshCw className="h-4 w-4 mr-2" />}
                                {(syncing || syncJob?.status === 'running' || syncJob?.status === 'pending') ? "Syncing..." : "Resync"}
                            </Button>

                            {(syncJob?.status === 'running' || syncJob?.status === 'pending') && (
                                <Button variant="outline" size="sm" onClick={cancelSync}>
                                    Cancel
                                </Button>
                            )}

                            {selectedImages.size > 0 && (
                                <Button variant="outline" size="sm" onClick={() => setSelectedImages(new Set())}>
                                    Clear Selection ({selectedImages.size})
                                </Button>
                            )}
                        </div>
                    </div>

                    {/* Background Sync Progress Bar */}
                    {(syncJob?.status === 'running' || syncJob?.status === 'pending') && (
                        <div className="bg-blue-50 p-4 rounded-lg border border-blue-200 overflow-hidden">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-medium text-blue-700">
                                    🔄 Background Sync: Page {syncJob.currentPage}/{syncJob.totalPages || '?'}
                                </span>
                                <span className="text-sm text-blue-600">
                                    {globalStats.total} images synced
                                </span>
                            </div>
                            <div className="w-full bg-blue-200 rounded-full h-2 overflow-hidden">
                                <div
                                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                                    style={{ width: `${Math.min(syncJob.progress || 0, 100)}%` }}
                                />
                            </div>
                            <p className="text-xs text-blue-600 mt-2">
                                Sync runs in background every 2 minutes. You can close this page.
                            </p>
                        </div>
                    )}

                    {/* Sync Completed */}
                    {syncJob?.status === 'completed' && (
                        <div className="bg-green-50 p-3 rounded-lg border border-green-200 flex items-center justify-between">
                            <span className="text-sm text-green-700">
                                ✅ Sync completed! {syncJob.totalPages} pages processed.
                            </span>
                            <Button variant="ghost" size="sm" onClick={() => setSyncJob(null)}>
                                Dismiss
                            </Button>
                        </div>
                    )}

                    {/* Sync Error - with Resume option */}
                    {syncJob?.status === 'failed' && (
                        <div className="bg-red-50 p-3 rounded-lg border border-red-200">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-sm text-red-700 truncate max-w-[70%]" title={syncJob.error || undefined}>
                                    ❌ Sync failed at page {syncJob.currentPage}: {(syncJob.error || '').substring(0, 100)}...
                                </span>
                                <div className="flex gap-2">
                                    <Button variant="outline" size="sm" onClick={resumeSync}>
                                        Resume
                                    </Button>
                                    <Button variant="ghost" size="sm" onClick={syncContent}>
                                        Restart
                                    </Button>
                                </div>
                            </div>
                            <p className="text-xs text-red-600">
                                {globalStats.total} images already synced. Click Resume to continue from page {syncJob.currentPage}.
                            </p>
                        </div>
                    )}

                    {/* Filters */}
                    <div className="flex flex-wrap gap-3 items-center border-t pt-4">
                        <span className="text-xs font-medium text-slate-500 uppercase">Filters:</span>

                        {/* URL Filter */}
                        <Input
                            placeholder="Filter by page URL..."
                            className="w-48 h-8 text-xs"
                            value={filterUrl}
                            onChange={(e) => { setFilterUrl(e.target.value); setPage(1); }}
                        />

                        {/* Format Filter */}
                        <select
                            value={filterFormat}
                            onChange={(e) => { setFilterFormat(e.target.value); setPage(1); }}
                            className="h-8 px-2 text-xs border rounded-md bg-white"
                        >
                            <option value="">All Formats</option>
                            <option value="jpeg">JPG</option>
                            <option value="png">PNG</option>
                            <option value="webp">WebP</option>
                            <option value="gif">GIF</option>
                            <option value="svg">SVG</option>
                        </select>

                        {/* Type Filter */}
                        <select
                            value={filterType}
                            onChange={(e) => { setFilterType(e.target.value); setPage(1); }}
                            className="h-8 px-2 text-xs border rounded-md bg-white"
                        >
                            <option value="">All Types</option>
                            <option value="product">Product</option>
                            <option value="post">Blog</option>
                            <option value="page">Page</option>
                        </select>

                        {/* Heavy Files Checkbox */}
                        <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                            <input
                                type="checkbox"
                                checked={filterHeavy}
                                onChange={(e) => { setFilterHeavy(e.target.checked); setPage(1); }}
                                className="w-3.5 h-3.5"
                            />
                            <span>Heavy Only</span>
                        </label>

                        {/* Missing Alt Checkbox */}
                        <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                            <input
                                type="checkbox"
                                checked={filterMissingAlt}
                                onChange={(e) => { setFilterMissingAlt(e.target.checked); setPage(1); }}
                                className="w-3.5 h-3.5"
                            />
                            <span>Missing Alt</span>
                        </label>

                        {/* Clear Filters */}
                        {(filterUrl || filterFormat || filterType || filterHeavy || filterMissingAlt || search) && (
                            <Button
                                size="sm"
                                variant="ghost"
                                onClick={clearFilters}
                                className="h-8 text-xs"
                            >
                                Clear All
                            </Button>
                        )}
                    </div>
                </div>

                {error && (
                    <div className="bg-red-50 text-red-600 p-4 rounded-xl flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5" />
                        {error}
                    </div>
                )}

                {/* Stats Dashboard */}
                {globalStats.total > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Total Images */}
                        <div
                            className="bg-white p-5 rounded-xl border hover:shadow-md transition-shadow cursor-pointer"
                            onClick={clearFilters}
                        >
                            <p className="text-slate-500 text-xs uppercase font-medium flex items-center gap-1">
                                <Database className="h-3 w-3" /> Total Images
                            </p>
                            <p className="text-3xl font-bold mt-1">{globalStats.total.toLocaleString()}</p>
                            {lastSyncedAt && (
                                <p className="text-[10px] text-slate-400 mt-2">
                                    Last synced: {new Date(lastSyncedAt).toLocaleDateString()}
                                </p>
                            )}
                        </div>

                        {/* Heavy Files */}
                        <div
                            className={`p-5 rounded-xl border cursor-pointer hover:shadow-md transition-shadow ${filterHeavy ? 'bg-yellow-100 border-yellow-300' : 'bg-yellow-50 border-yellow-100'}`}
                            onClick={() => { setFilterHeavy(!filterHeavy); setPage(1); }}
                        >
                            <p className="text-yellow-700 text-xs uppercase font-medium flex items-center gap-1">
                                <FileWarning className="h-3 w-3" /> Heavy Files (&gt;150KB)
                            </p>
                            <p className="text-3xl font-bold text-yellow-800 mt-1">{globalStats.heavy.toLocaleString()}</p>
                        </div>

                        {/* Missing Alt */}
                        <div
                            className={`p-5 rounded-xl border cursor-pointer hover:shadow-md transition-shadow ${filterMissingAlt ? 'bg-orange-100 border-orange-300' : 'bg-orange-50 border-orange-100'}`}
                            onClick={() => { setFilterMissingAlt(!filterMissingAlt); setPage(1); }}
                        >
                            <p className="text-orange-700 text-xs uppercase font-medium flex items-center gap-1">
                                <AlertTriangle className="h-3 w-3" /> Missing Alt Text
                            </p>
                            <p className="text-3xl font-bold text-orange-800 mt-1">{globalStats.missingAlt.toLocaleString()}</p>
                        </div>
                    </div>
                )}

                {/* Images Grid */}
                {images.length === 0 ? (
                    <div className="text-center py-20 bg-slate-50 rounded-xl border border-dashed">
                        <ImageIcon className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                        <p className="text-slate-500 font-medium">No images found</p>
                        <p className="text-sm text-slate-400 mt-1">Try adjusting your filters or sync again</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
                        {images.map((image) => {
                            const isSelected = selectedImages.has(image.url)
                            return (
                                <div
                                    key={image.url}
                                    className={`group bg-white border rounded-xl overflow-hidden hover:shadow-md transition-all cursor-pointer ${isSelected ? 'ring-2 ring-primary' : ''}`}
                                    onClick={() => toggleSelectImage(image.url)}
                                >
                                    {/* Image */}
                                    <div className="aspect-square bg-slate-100 relative overflow-hidden">
                                        <img
                                            src={image.url}
                                            alt={image.alt || image.filename}
                                            className="w-full h-full object-cover transition-transform group-hover:scale-105"
                                            loading="lazy"
                                        />
                                    </div>

                                    {/* Info */}
                                    <div className="p-3">
                                        <div className="flex items-center gap-2 mb-1">
                                            <Checkbox
                                                checked={isSelected}
                                                className="shrink-0"
                                                onClick={(e) => e.stopPropagation()}
                                                onCheckedChange={(checked) => {
                                                    if (checked) {
                                                        setSelectedImages(prev => new Set([...prev, image.url]))
                                                    } else {
                                                        setSelectedImages(prev => {
                                                            const next = new Set(prev)
                                                            next.delete(image.url)
                                                            return next
                                                        })
                                                    }
                                                }}
                                            />
                                            <p className="text-xs font-medium truncate flex-1" title={image.filename}>
                                                {image.filename}
                                            </p>
                                        </div>

                                        {/* Size and format */}
                                        <div className="flex items-center justify-between text-[10px] text-slate-500">
                                            <span>{formatBytes(image.size_bytes)}</span>
                                            <span className="font-mono bg-slate-100 px-1 rounded">
                                                {image.filename.split('.').pop()?.toUpperCase() || 'IMG'}
                                            </span>
                                        </div>

                                        {/* Badges */}
                                        <div className="flex flex-wrap gap-1 mt-2">
                                            {image.size_kb > 150 && (
                                                <Badge variant="destructive" className="h-5 px-1.5 text-[9px]">
                                                    HEAVY
                                                </Badge>
                                            )}
                                            {image.pages[0]?.type && (
                                                <Badge
                                                    variant="secondary"
                                                    className={`h-5 px-1.5 text-[9px] ${image.pages[0].type === 'product' ? 'bg-blue-100 text-blue-700' :
                                                        image.pages[0].type === 'post' ? 'bg-green-100 text-green-700' :
                                                            'bg-purple-100 text-purple-700'
                                                        }`}
                                                >
                                                    {formatType(image.pages[0].type).toUpperCase()}
                                                </Badge>
                                            )}
                                            {!image.alt && (
                                                <Badge variant="outline" className="h-5 px-1.5 text-[9px] text-orange-600 border-orange-300">
                                                    No Alt
                                                </Badge>
                                            )}
                                        </div>

                                        {/* Pages count */}
                                        <div className="mt-2 text-[10px] text-slate-500">
                                            Used in {image.page_count} {image.page_count === 1 ? 'page' : 'pages'}
                                        </div>

                                        {/* View/Optimize buttons */}
                                        <div className="flex gap-1 mt-2">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="flex-1 h-7 text-xs"
                                                onClick={(e) => {
                                                    e.stopPropagation()
                                                    window.open(image.url, '_blank')
                                                }}
                                                title="Open image in new tab"
                                            >
                                                <ImageIcon className="h-3 w-3 mr-1" />
                                                Image
                                            </Button>
                                            {image.pages[0]?.url && (
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="flex-1 h-7 text-xs"
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        window.open(image.pages[0].url, '_blank')
                                                    }}
                                                    title={`Open page: ${image.pages[0].title}`}
                                                >
                                                    <FileText className="h-3 w-3 mr-1" />
                                                    Page
                                                </Button>
                                            )}
                                        </div>

                                        {/* Optimize Actions */}
                                        <div className="flex gap-1 mt-1">
                                            {image.size_kb > 100 && (
                                                <Button
                                                    variant="secondary"
                                                    size="sm"
                                                    className="flex-1 h-6 text-[10px] bg-orange-50 hover:bg-orange-100 text-orange-700"
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        handleCompress(image.url, image.filename, image.size_kb)
                                                    }}
                                                >
                                                    <Zap className="h-2.5 w-2.5 mr-0.5" />
                                                    Compress
                                                </Button>
                                            )}
                                        </div>
                                        {/* Alt Manager - always visible */}
                                        <div className="flex gap-1 mt-1">
                                            <Button
                                                variant="secondary"
                                                size="sm"
                                                className={`flex-1 h-6 text-[10px] ${image.alt ? 'bg-green-50 hover:bg-green-100 text-green-700' : 'bg-blue-50 hover:bg-blue-100 text-blue-700'}`}
                                                onClick={(e) => {
                                                    e.stopPropagation()
                                                    handleAddAlt(image)
                                                }}
                                            >
                                                <FileWarning className="h-2.5 w-2.5 mr-0.5" />
                                                {image.alt ? 'Alt' : 'Add Alt'}
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="flex items-center justify-center gap-2 mt-8">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPage(page - 1)}
                            disabled={page === 1}
                        >
                            <ChevronLeft className="h-4 w-4 mr-1" />
                            Previous
                        </Button>
                        <span className="text-sm text-muted-foreground px-4">
                            Page {page} of {totalPages}
                        </span>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPage(page + 1)}
                            disabled={page === totalPages}
                        >
                            Next
                            <ChevronRight className="h-4 w-4 ml-1" />
                        </Button>
                    </div>
                )}
            </div>

            {/* Compress Modal */}
            {
                compressModal.open && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                        <div className="bg-white rounded-xl p-6 max-w-lg w-full mx-4 shadow-2xl">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-lg font-semibold">Compress Image</h3>
                                <button
                                    onClick={closeCompressModal}
                                    className="text-slate-400 hover:text-slate-600"
                                >
                                    ✕
                                </button>
                            </div>

                            <p className="text-sm text-slate-600 mb-4 truncate">
                                {compressModal.imageFilename}
                            </p>

                            {/* Settings (show when not compressing and no result) */}
                            {!compressModal.compressing && !compressModal.result && (
                                <div className="space-y-4 mb-4">
                                    {/* Max Width */}
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Max Width (px)</label>
                                        <select
                                            value={compressModal.maxWidth}
                                            onChange={(e) => setCompressModal(prev => ({ ...prev, maxWidth: parseInt(e.target.value) }))}
                                            className="w-full border rounded-lg p-2"
                                        >
                                            <option value={0}>No Resize</option>
                                            <option value={800}>800px</option>
                                            <option value={1000}>1000px</option>
                                            <option value={1200}>1200px</option>
                                            <option value={1600}>1600px</option>
                                            <option value={2000}>2000px</option>
                                        </select>
                                        <p className="text-xs text-slate-400 mt-1">Resize only if image is wider</p>
                                    </div>

                                    {/* Max Size */}
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Max Size (KB)</label>
                                        <select
                                            value={compressModal.maxSizeKB}
                                            onChange={(e) => setCompressModal(prev => ({ ...prev, maxSizeKB: parseInt(e.target.value) }))}
                                            className="w-full border rounded-lg p-2"
                                        >
                                            <option value={50}>50 KB</option>
                                            <option value={100}>100 KB</option>
                                            <option value={150}>150 KB</option>
                                            <option value={200}>200 KB</option>
                                            <option value={300}>300 KB</option>
                                            <option value={500}>500 KB</option>
                                        </select>
                                    </div>

                                    {/* Format */}
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Output Format</label>
                                        <select
                                            value={compressModal.keepOriginalFormat ? 'original' : compressModal.format}
                                            onChange={(e) => {
                                                if (e.target.value === 'original') {
                                                    setCompressModal(prev => ({ ...prev, keepOriginalFormat: true }))
                                                } else {
                                                    setCompressModal(prev => ({
                                                        ...prev,
                                                        format: e.target.value as 'webp' | 'jpeg' | 'png',
                                                        keepOriginalFormat: false
                                                    }))
                                                }
                                            }}
                                            className="w-full border rounded-lg p-2"
                                        >
                                            <option value="original">Keep Original Format</option>
                                            <option value="webp">WebP (Best compression)</option>
                                            <option value="jpeg">JPEG</option>
                                            <option value="png">PNG</option>
                                        </select>
                                    </div>

                                    {/* Original Size Info */}
                                    <div className="bg-slate-50 p-3 rounded-lg text-sm">
                                        <span className="text-slate-500">Original size: </span>
                                        <span className="font-medium">{Math.round(compressModal.originalSize)} KB</span>
                                    </div>

                                    {/* Start Compress Button */}
                                    <Button
                                        onClick={startCompression}
                                        className="w-full"
                                    >
                                        <Zap className="h-4 w-4 mr-2" />
                                        Start Compression
                                    </Button>
                                </div>
                            )}

                            {compressModal.compressing && (
                                <div className="text-center py-8">
                                    <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-500" />
                                    <p className="text-slate-600">Compressing image...</p>
                                    <p className="text-xs text-slate-400">Converting to {compressModal.keepOriginalFormat ? 'optimized' : compressModal.format.toUpperCase()} format</p>
                                </div>
                            )}

                            {compressModal.error && (
                                <div className="bg-red-50 text-red-600 p-4 rounded-lg mb-4">
                                    {compressModal.error}
                                </div>
                            )}

                            {compressModal.result && (
                                <div className="space-y-4">
                                    {/* Before/After Comparison */}
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="text-center p-3 bg-slate-50 rounded-lg">
                                            <p className="text-xs text-slate-500 mb-1">Original</p>
                                            <p className="text-lg font-semibold text-slate-700">
                                                {compressModal.result.original.sizeKB} KB
                                            </p>
                                            <p className="text-xs text-slate-400">
                                                {compressModal.result.original.format?.toUpperCase()}
                                            </p>
                                        </div>
                                        <div className="text-center p-3 bg-green-50 rounded-lg">
                                            <p className="text-xs text-green-600 mb-1">Compressed</p>
                                            <p className="text-lg font-semibold text-green-700">
                                                {compressModal.result.compressed.sizeKB} KB
                                            </p>
                                            <p className="text-xs text-green-500">WebP</p>
                                        </div>
                                    </div>

                                    {/* Savings Badge */}
                                    <div className="text-center">
                                        <Badge className="bg-green-100 text-green-700 text-sm px-4 py-1">
                                            {compressModal.result.savings}% smaller
                                        </Badge>
                                    </div>

                                    {/* Preview */}
                                    <div className="aspect-video bg-slate-100 rounded-lg overflow-hidden">
                                        <img
                                            src={`data:image/webp;base64,${compressModal.result.compressed.base64}`}
                                            alt="Compressed preview"
                                            className="w-full h-full object-contain"
                                        />
                                    </div>

                                    {/* Actions */}
                                    <div className="flex gap-2">
                                        <Button
                                            onClick={handleDownloadCompressed}
                                            className="flex-1"
                                            variant="outline"
                                            disabled={compressModal.applying}
                                        >
                                            Download
                                        </Button>
                                        {!compressModal.applied ? (
                                            <Button
                                                onClick={handleApplyToWordPress}
                                                className="flex-1"
                                                disabled={compressModal.applying}
                                            >
                                                {compressModal.applying ? (
                                                    <>
                                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                                        Applying...
                                                    </>
                                                ) : (
                                                    <>
                                                        <Upload className="h-4 w-4 mr-2" />
                                                        Apply to WordPress
                                                    </>
                                                )}
                                            </Button>
                                        ) : (
                                            <div className="flex gap-2 w-full">
                                                <Button
                                                    onClick={handleUndoReplace}
                                                    variant="outline"
                                                    className="flex-1"
                                                    disabled={compressModal.applying}
                                                >
                                                    {compressModal.applying ? (
                                                        <Loader2 className="h-4 w-4 animate-spin" />
                                                    ) : (
                                                        <>
                                                            <Undo2 className="h-4 w-4 mr-2" />
                                                            Undo
                                                        </>
                                                    )}
                                                </Button>
                                                <Button
                                                    onClick={closeCompressModal}
                                                    className="flex-1 bg-green-600 hover:bg-green-700"
                                                >
                                                    <Check className="h-4 w-4 mr-2" />
                                                    Done
                                                </Button>
                                            </div>
                                        )}
                                    </div>

                                    {compressModal.applied && (
                                        <p className="text-xs text-center text-green-600 font-medium">
                                            ✓ Image replaced in WordPress successfully!
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                )}

            {/* Alt Manager Modal */}
            {altModal.open && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-2xl max-w-md w-full max-h-[90vh] flex flex-col">
                        {/* Sticky Header */}
                        <div className="flex justify-between items-center p-5 pb-3 border-b border-slate-100 flex-shrink-0">
                            <h3 className="text-lg font-semibold">🏷️ Alt Text Manager</h3>
                            <button
                                onClick={closeAltModal}
                                className="text-slate-400 hover:text-slate-600"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Scrollable Content */}
                        <div className="p-5 pt-3 overflow-y-auto flex-1">
                            {/* Image Preview - smaller */}
                            <div className="h-32 bg-slate-100 rounded-lg overflow-hidden mb-3">
                                <img
                                    src={altModal.imageUrl}
                                    alt="Preview"
                                    className="w-full h-full object-contain"
                                />
                            </div>

                            <p className="text-sm text-slate-600 mb-2 truncate">
                                {altModal.imageFilename}
                            </p>

                            {/* Current Alt Badge */}
                            {altModal.currentAlt ? (
                                <div className="mb-4 p-2 bg-green-50 border border-green-200 rounded-lg">
                                    <span className="text-xs text-green-600 font-medium">Current Alt:</span>
                                    <p className="text-sm text-green-800">{altModal.currentAlt}</p>
                                </div>
                            ) : (
                                <div className="mb-4 p-2 bg-amber-50 border border-amber-200 rounded-lg">
                                    <span className="text-xs text-amber-600 font-medium">⚠️ No alt text set</span>
                                </div>
                            )}

                            {/* Pages where image is used - with context info */}
                            {altModal.pages.length > 0 && (
                                <div className="mb-3 p-2 bg-slate-50 rounded-lg text-xs">
                                    <span className="text-slate-500">📍 Page Context:</span>
                                    <p className="font-medium text-slate-700 truncate">{altModal.pages[0].title}</p>
                                </div>
                            )}

                            {/* Generate with AI Button */}
                            <Button
                                onClick={() => generateAltText(false)}
                                variant="outline"
                                className="w-full mb-2"
                                disabled={altModal.generating}
                            >
                                {altModal.generating ? (
                                    <>
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                        Generating...
                                    </>
                                ) : (
                                    <>
                                        <Zap className="h-4 w-4 mr-2" />
                                        Generate with AI
                                    </>
                                )}
                            </Button>

                            {/* Alt Text Input */}
                            <div className="mb-3">
                                <label className="block text-sm font-medium mb-1">Alt Text</label>
                                <textarea
                                    value={altModal.altText}
                                    onChange={(e) => setAltModal(prev => ({ ...prev, altText: e.target.value }))}
                                    placeholder="Describe this image for accessibility..."
                                    className="w-full p-2 border rounded-lg text-sm resize-none"
                                    rows={2}
                                />
                                <p className="text-xs text-slate-400 mt-1">
                                    {altModal.altText.length}/125 characters
                                </p>
                            </div>

                            {/* Inline Refinement */}
                            <div className="mb-3 p-2 bg-purple-50 rounded-lg">
                                <label className="block text-xs font-medium text-purple-700 mb-1">
                                    ✨ Refine with instructions
                                </label>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={altModal.refinementInput}
                                        onChange={(e) => setAltModal(prev => ({ ...prev, refinementInput: e.target.value }))}
                                        placeholder="e.g. focus on the electrical work"
                                        className="flex-1 p-2 border rounded text-xs"
                                    />
                                    <Button
                                        onClick={() => generateAltText(true)}
                                        variant="secondary"
                                        size="sm"
                                        className="text-xs bg-purple-100 hover:bg-purple-200 text-purple-700"
                                        disabled={altModal.generating || !altModal.refinementInput.trim()}
                                    >
                                        Refine
                                    </Button>
                                </div>
                            </div>

                            {altModal.error && (
                                <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm">
                                    {altModal.error}
                                </div>
                            )}

                            {altModal.success && (
                                <div className="bg-green-50 text-green-600 p-3 rounded-lg mb-4 text-sm flex items-center gap-2">
                                    <Check className="h-4 w-4" />
                                    Alt text updated in WordPress!
                                </div>
                            )}

                            {/* Actions */}
                            <div className="flex gap-2">
                                <Button
                                    onClick={closeAltModal}
                                    variant="outline"
                                    className="flex-1"
                                >
                                    Cancel
                                </Button>
                                <Button
                                    onClick={applyAltText}
                                    className="flex-1 bg-blue-600 hover:bg-blue-700"
                                    disabled={!altModal.altText.trim() || altModal.saving || altModal.altText === altModal.currentAlt}
                                >
                                    {altModal.saving ? (
                                        <>
                                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                            Applying...
                                        </>
                                    ) : (
                                        <>
                                            <Upload className="h-4 w-4 mr-2" />
                                            Apply to WordPress
                                        </>
                                    )}
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
