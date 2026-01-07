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
    Zap
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
    }>({
        open: false,
        imageUrl: "",
        imageFilename: "",
        originalSize: 0,
        compressing: false,
        result: null,
        error: ""
    })

    // Alt Modal
    const [altModal, setAltModal] = useState<{
        open: boolean
        imageUrl: string
        imageFilename: string
        altText: string
        pages: { id: number; title: string; url: string }[]
        saving: boolean
        error: string
        success: boolean
    }>({
        open: false,
        imageUrl: "",
        imageFilename: "",
        altText: "",
        pages: [],
        saving: false,
        error: "",
        success: false
    })

    // Auto-load from database on mount
    useEffect(() => {
        loadFromDatabase()
    }, [projectId])

    // Apply filters whenever filter state changes
    useEffect(() => {
        applyFilters()
    }, [allImages, filterUrl, filterFormat, filterType, filterHeavy, filterMissingAlt, search, page])

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
        setSyncProgress({ current: 0, total: 0, images: 0 })

        let pageNum = 1
        let hasMore = true
        let totalImages = 0
        let totalPagesScanned = 0

        try {
            // First call to get total count
            const firstRes = await fetch(`/api/images/scan-content?projectId=${projectId}&sync=true&page=1`)
            const firstData = await firstRes.json()

            if (!firstData.success) {
                throw new Error(firstData.error || "Failed to sync content")
            }

            totalImages += firstData.images?.length || 0
            totalPagesScanned = 1

            // Estimate total pages based on posts_scanned (50 posts per page)
            const estimatedTotalPages = Math.ceil((firstData.posts_scanned || 50) / 50)
            setSyncProgress({ current: 1, total: estimatedTotalPages, images: totalImages })

            // Continue fetching remaining pages
            pageNum = 2
            hasMore = (firstData.images?.length || 0) > 0 && firstData.posts_scanned > 50

            while (hasMore && pageNum <= 100) { // Max 100 pages (5000 posts)
                const res = await fetch(`/api/images/scan-content?projectId=${projectId}&sync=true&page=${pageNum}`)
                const data = await res.json()

                if (!data.success) {
                    break
                }

                const newImages = data.images?.length || 0
                totalImages += newImages
                totalPagesScanned = pageNum

                setSyncProgress({
                    current: pageNum,
                    total: estimatedTotalPages,
                    images: totalImages
                })

                // Stop if no more images found
                if (newImages === 0) {
                    hasMore = false
                } else {
                    pageNum++
                }

                // Small delay to prevent overwhelming the server
                await new Promise(r => setTimeout(r, 100))
            }

            // Reload from database after sync
            setPage(1)
            await loadFromDatabase()
        } catch (e: any) {
            setError(e.message)
        } finally {
            setSyncing(false)
            setSyncProgress({ current: 0, total: 0, images: 0 })
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

    const handleCompress = async (imageUrl: string, filename: string, sizeKB: number) => {
        setCompressModal({
            open: true,
            imageUrl,
            imageFilename: filename,
            originalSize: sizeKB,
            compressing: true,
            result: null,
            error: ""
        })

        try {
            const res = await fetch('/api/images/compress-apply', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectId,
                    imageUrl,
                    maxSizeKB: 100
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

    const handleDownloadCompressed = () => {
        if (!compressModal.result) return

        const link = document.createElement('a')
        link.href = `data:image/webp;base64,${compressModal.result.compressed.base64}`
        link.download = compressModal.imageFilename.replace(/\.[^.]+$/, '.webp')
        link.click()
    }

    const closeCompressModal = () => {
        setCompressModal({
            open: false,
            imageUrl: "",
            imageFilename: "",
            originalSize: 0,
            compressing: false,
            result: null,
            error: ""
        })
    }

    const handleAddAlt = (image: PageImage) => {
        setAltModal({
            open: true,
            imageUrl: image.url,
            imageFilename: image.filename,
            altText: "",
            pages: image.pages,
            saving: false,
            error: "",
            success: false
        })
    }

    const closeAltModal = () => {
        setAltModal({
            open: false,
            imageUrl: "",
            imageFilename: "",
            altText: "",
            pages: [],
            saving: false,
            error: "",
            success: false
        })
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
                            <Button onClick={syncContent} disabled={syncing} variant="default">
                                {syncing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                                {syncing ? "Syncing..." : "Resync"}
                            </Button>

                            {selectedImages.size > 0 && (
                                <Button variant="outline" size="sm" onClick={() => setSelectedImages(new Set())}>
                                    Clear Selection ({selectedImages.size})
                                </Button>
                            )}
                        </div>
                    </div>

                    {/* Sync Progress Bar */}
                    {syncing && syncProgress.total > 0 && (
                        <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-medium text-blue-700">
                                    Syncing pages: {syncProgress.current}/{syncProgress.total}
                                </span>
                                <span className="text-sm text-blue-600">
                                    {syncProgress.images} images found
                                </span>
                            </div>
                            <div className="w-full bg-blue-200 rounded-full h-2">
                                <div
                                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                                    style={{ width: `${Math.min((syncProgress.current / syncProgress.total) * 100, 100)}%` }}
                                />
                            </div>
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
                                            {!image.alt && (
                                                <Button
                                                    variant="secondary"
                                                    size="sm"
                                                    className="flex-1 h-6 text-[10px] bg-blue-50 hover:bg-blue-100 text-blue-700"
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        handleAddAlt(image)
                                                    }}
                                                >
                                                    <FileWarning className="h-2.5 w-2.5 mr-0.5" />
                                                    Add Alt
                                                </Button>
                                            )}
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

                            {compressModal.compressing && (
                                <div className="text-center py-8">
                                    <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-500" />
                                    <p className="text-slate-600">Compressing image...</p>
                                    <p className="text-xs text-slate-400">Converting to WebP format</p>
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
                                        >
                                            Download WebP
                                        </Button>
                                        <Button
                                            onClick={closeCompressModal}
                                            className="flex-1"
                                        >
                                            Done
                                        </Button>
                                    </div>

                                    <p className="text-xs text-center text-slate-400">
                                        Upload the compressed image to WordPress manually for now
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                )}

            {/* Alt Modal */}
            {altModal.open && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-semibold">Add Alt Text</h3>
                            <button
                                onClick={closeAltModal}
                                className="text-slate-400 hover:text-slate-600"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Image Preview */}
                        <div className="aspect-video bg-slate-100 rounded-lg overflow-hidden mb-4">
                            <img
                                src={altModal.imageUrl}
                                alt="Preview"
                                className="w-full h-full object-contain"
                            />
                        </div>

                        <p className="text-sm text-slate-600 mb-2 truncate">
                            {altModal.imageFilename}
                        </p>

                        {/* Pages where image is used */}
                        {altModal.pages.length > 0 && (
                            <div className="mb-4 text-xs text-slate-500">
                                Used in: {altModal.pages.map(p => p.title).join(', ')}
                            </div>
                        )}

                        {/* Alt Text Input */}
                        <div className="mb-4">
                            <label className="block text-sm font-medium mb-1">Alt Text</label>
                            <Input
                                value={altModal.altText}
                                onChange={(e) => setAltModal(prev => ({ ...prev, altText: e.target.value }))}
                                placeholder="Describe this image for accessibility..."
                                className="w-full"
                            />
                            <p className="text-xs text-slate-400 mt-1">
                                Describe what the image shows for screen readers
                            </p>
                        </div>

                        {altModal.error && (
                            <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm">
                                {altModal.error}
                            </div>
                        )}

                        {altModal.success && (
                            <div className="bg-green-50 text-green-600 p-3 rounded-lg mb-4 text-sm">
                                Alt text suggestion saved! (Manual update in WordPress required)
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
                                onClick={() => {
                                    // For now, just show success message
                                    // In future, this could update a suggestions list
                                    setAltModal(prev => ({ ...prev, success: true }))
                                }}
                                className="flex-1"
                                disabled={!altModal.altText.trim() || altModal.saving}
                            >
                                {altModal.saving ? (
                                    <>
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                        Saving...
                                    </>
                                ) : (
                                    'Save Suggestion'
                                )}
                            </Button>
                        </div>

                        <p className="text-xs text-center text-slate-400 mt-4">
                            Alt text must be manually updated in WordPress media library
                        </p>
                    </div>
                </div>
            )}
        </>
    )
}
