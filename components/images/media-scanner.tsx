"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import {
    Loader2,
    Search,
    Image as ImageIcon,
    AlertTriangle,
    FileWarning,
    CheckCircle2,
    RefreshCw,
    ChevronLeft,
    ChevronRight,
    ArrowUpRight,
    ExternalLink,
    Database,
    History,
    TrendingDown,
    ClipboardList,
    X,
    Trash2,
    Zap,
    Undo2
} from "lucide-react"
import { formatBytes } from "@/lib/utils"
import { PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { OptimizeDialog } from "./optimize-dialog"
import { ImageHistoryPopover } from "./image-history-popover"
import { PageImagesTab } from "./page-images-tab"

interface MediaItem {
    id: number
    wpId: number
    title: string
    filename: string
    alt: string
    url: string
    width: number
    height: number
    filesize: number
    mime_type: string
    date: string
    parent_type?: string
    parent_title?: string
    parent_url?: string
    originalUrl?: string | null
}

interface MediaScannerProps {
    projectId: number
    isAdmin?: boolean
}

export function MediaScanner({ projectId, isAdmin = false }: MediaScannerProps) {
    const { data: session } = useSession()
    const [media, setMedia] = useState<MediaItem[]>([])
    const [loading, setLoading] = useState(false)
    const [syncing, setSyncing] = useState(false)
    const [error, setError] = useState("")
    const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' } | null>(null)

    // Pagination & Search
    const [page, setPage] = useState(1)
    const [totalPages, setTotalPages] = useState(1)
    const [totalItems, setTotalItems] = useState(0)
    const [search, setSearch] = useState("")

    // Filters
    const [filterUrl, setFilterUrl] = useState("") // Filter by parent URL
    const [filterHeavy, setFilterHeavy] = useState(false) // Only heavy files
    const [filterFormat, setFilterFormat] = useState("") // jpg, png, webp, etc.
    const [filterType, setFilterType] = useState("") // product, post, page
    const [filterMissingAlt, setFilterMissingAlt] = useState(false) // Only missing alt

    // Global stats from DB
    const [globalStats, setGlobalStats] = useState({ total: 0, heavy: 0, missingAlt: 0 })

    // Chart data
    const [snapshots, setSnapshots] = useState<{ date: string, heavy: number, missingAlt: number }[]>([])

    // Format/Type breakdown for pie chart
    const [formatBreakdown, setFormatBreakdown] = useState<{ name: string, value: number, color: string }[]>([])
    const [typeBreakdown, setTypeBreakdown] = useState<{ name: string, value: number, color: string }[]>([])
    const [showTypeChart, setShowTypeChart] = useState(false) // Toggle between format and type pie

    // Database status
    const [databaseCreatedAt, setDatabaseCreatedAt] = useState<string | null>(null)
    const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null)

    // Log dialog
    const [showLogDialog, setShowLogDialog] = useState(false)
    const [logs, setLogs] = useState<any[]>([])
    const [logsLoading, setLogsLoading] = useState(false)
    const [logFilterAction, setLogFilterAction] = useState('')
    const [logFilterUser, setLogFilterUser] = useState('')
    const [availableUsers, setAvailableUsers] = useState<{ userId: string, userName: string }[]>([])

    // Selection & Optimize
    const [selectedImages, setSelectedImages] = useState<Set<number>>(new Set())
    const [showOptimizeDialog, setShowOptimizeDialog] = useState(false)

    // Tab state
    const [activeTab, setActiveTab] = useState<'library' | 'pages'>('library')

    // Load from database on mount
    useEffect(() => {
        fetchMediaFromDb(1)
        fetchSnapshots()
    }, [projectId])

    const fetchMedia = async (pageNum = 1, shouldSync = false) => {
        if (shouldSync) setSyncing(true)
        else setLoading(true)

        setError("")
        setToast(null)

        try {
            const res = await fetch("/api/images/scan", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    projectId,
                    page: pageNum,
                    per_page: 24,
                    search,
                    sync: shouldSync
                })
            })

            const data = await res.json()

            if (!data.success) {
                throw new Error(data.error || "Failed to scan media")
            }

            if (data.synced) {
                setToast({
                    message: `Sync Complete: Added ${data.added}, Updated ${data.updated} images.`,
                    type: 'success'
                })
                // Refresh list from database (not WordPress)
                fetchMediaFromDb(1)
            } else {
                setMedia(data.media)
                setTotalItems(data.total)
                setTotalPages(data.pages)
                setPage(pageNum)
            }
        } catch (err: any) {
            setError(err.message)
        } finally {
            setLoading(false)
            setSyncing(false)
        }
    }

    // Fetch media from database (after sync)
    const fetchMediaFromDb = async (pageNum = 1) => {
        setLoading(true)
        setError("")

        try {
            const res = await fetch("/api/images/scan", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    projectId,
                    page: pageNum,
                    per_page: 24,
                    search,
                    fromDb: true,
                    filterUrl,
                    filterHeavy,
                    filterFormat,
                    filterType,
                    filterMissingAlt
                })
            })

            const data = await res.json()

            if (!data.success) {
                throw new Error(data.error || "Failed to load media")
            }

            setMedia(data.media)
            setTotalItems(data.total)
            setTotalPages(data.pages)
            setPage(pageNum)

            // Update global stats if available
            if (data.globalStats) {
                setGlobalStats(data.globalStats)
            }

            // Update format/type breakdown and last updated
            if (data.formatBreakdown) setFormatBreakdown(data.formatBreakdown)
            if (data.typeBreakdown) setTypeBreakdown(data.typeBreakdown)
            if (data.lastUpdatedAt) setLastUpdatedAt(data.lastUpdatedAt)
            if (data.databaseCreatedAt) setDatabaseCreatedAt(data.databaseCreatedAt)
        } catch (err: any) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    // Fetch snapshots for charts
    const fetchSnapshots = async () => {
        try {
            const res = await fetch(`/api/images/snapshots?projectId=${projectId}`)
            const data = await res.json()
            if (data.success && data.snapshots) {
                setSnapshots(data.snapshots)
            }
        } catch (err) {
            console.error("Failed to fetch snapshots:", err)
        }
    }

    // Fetch logs for dialog
    const fetchLogs = async () => {
        setLogsLoading(true)
        try {
            const params = new URLSearchParams({ projectId: projectId.toString() })
            if (logFilterAction) params.append('action', logFilterAction)
            if (logFilterUser) params.append('userId', logFilterUser)

            const res = await fetch(`/api/images/logs?${params}`)
            const data = await res.json()
            if (data.success) {
                setLogs(data.logs)
                setAvailableUsers(data.users || [])
            }
        } catch (err) {
            console.error("Failed to fetch logs:", err)
        } finally {
            setLogsLoading(false)
        }
    }

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault()
        fetchMedia(1)
    }

    // Stats
    const missingAltCount = media.filter(m => !m.alt).length
    const largeFilesCount = media.filter(m => m.filesize > 150 * 1024).length // > 150KB

    return (
        <div className="space-y-6">
            {/* Tab Toggle */}
            <div className="flex items-center gap-2 border-b pb-4">
                <Button
                    variant={activeTab === 'library' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setActiveTab('library')}
                >
                    <Database className="h-4 w-4 mr-2" />
                    Media Library
                </Button>
                <Button
                    variant={activeTab === 'pages' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setActiveTab('pages')}
                >
                    <FileWarning className="h-4 w-4 mr-2" />
                    Page Images
                </Button>
            </div>

            {activeTab === 'pages' && (
                <PageImagesTab projectId={projectId} />
            )}

            {activeTab === 'library' && (
                <div className="space-y-6">
                    {/* Controls */}
                    <div className="bg-white p-4 rounded-xl border shadow-sm space-y-4">
                        <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
                            <form onSubmit={handleSearch} className="flex gap-2 w-full sm:w-auto">
                                <div className="relative w-full sm:w-64">
                                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                                    <Input
                                        placeholder="Search media..."
                                        className="pl-9"
                                        value={search}
                                        onChange={(e) => setSearch(e.target.value)}
                                    />
                                </div>
                            </form>

                            <div className="flex gap-2 w-full sm:w-auto">
                                <Button onClick={() => fetchMedia(page, true)} disabled={loading || syncing} variant="default">
                                    {syncing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                                    {syncing ? "Syncing..." : databaseCreatedAt ? "Update Database" : "Create Database"}
                                </Button>
                                <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={() => { fetchLogs(); setShowLogDialog(true) }}
                                    title="View Logs"
                                >
                                    <ClipboardList className="h-4 w-4" />
                                </Button>
                                {isAdmin && databaseCreatedAt && (
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        onClick={async () => {
                                            if (!confirm('Are you sure you want to delete all media data for this project? This cannot be undone.')) return
                                            try {
                                                const res = await fetch('/api/images/delete', {
                                                    method: 'POST',
                                                    headers: { 'Content-Type': 'application/json' },
                                                    body: JSON.stringify({ projectId })
                                                })
                                                if (res.ok) {
                                                    setMedia([])
                                                    setGlobalStats({ total: 0, heavy: 0, missingAlt: 0 })
                                                    setDatabaseCreatedAt(null)
                                                    setToast({ message: 'Database deleted successfully', type: 'success' })
                                                } else {
                                                    setToast({ message: 'Failed to delete database', type: 'error' })
                                                }
                                            } catch (e) {
                                                setToast({ message: 'Error deleting database', type: 'error' })
                                            }
                                        }}
                                        title="Delete Database (Admin Only)"
                                        className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                )}
                            </div>

                            {/* Selection controls */}
                            {selectedImages.size > 0 && (
                                <div className="flex items-center gap-2">
                                    <Button
                                        onClick={() => setShowOptimizeDialog(true)}
                                        size="sm"
                                    >
                                        <Zap className="h-4 w-4 mr-1" />
                                        Optimize {selectedImages.size} Selected
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setSelectedImages(new Set())}
                                    >
                                        Clear
                                    </Button>
                                </div>
                            )}
                        </div>

                        {/* Filters */}
                        <div className="flex flex-wrap gap-3 items-center border-t pt-4">
                            <span className="text-xs font-medium text-slate-500 uppercase">Filters:</span>

                            {/* URL Filter */}
                            <Input
                                placeholder="Filter by page URL..."
                                className="w-48 h-8 text-xs"
                                value={filterUrl}
                                onChange={(e) => setFilterUrl(e.target.value)}
                            />

                            {/* Format Filter */}
                            <select
                                value={filterFormat}
                                onChange={(e) => setFilterFormat(e.target.value)}
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
                                onChange={(e) => setFilterType(e.target.value)}
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
                                    onChange={(e) => setFilterHeavy(e.target.checked)}
                                    className="w-3.5 h-3.5"
                                />
                                <span>Heavy Only</span>
                            </label>

                            {/* Missing Alt Checkbox */}
                            <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={filterMissingAlt}
                                    onChange={(e) => setFilterMissingAlt(e.target.checked)}
                                    className="w-3.5 h-3.5"
                                />
                                <span>Missing Alt</span>
                            </label>

                            {/* Apply Filters Button */}
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() => fetchMediaFromDb(1)}
                                disabled={loading}
                                className="h-8 text-xs"
                            >
                                Apply Filters
                            </Button>
                        </div>
                    </div>

                    {toast && (
                        <div className={`p-4 rounded-xl flex items-center gap-2 ${toast.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                            <CheckCircle2 className="h-5 w-5" />
                            {toast.message}
                        </div>
                    )}

                    {error && (
                        <div className="bg-red-50 text-red-600 p-4 rounded-xl flex items-center gap-2">
                            <AlertTriangle className="h-5 w-5" />
                            {error}
                        </div>
                    )}

                    {/* Stats Dashboard - 3 Boxes */}
                    {globalStats.total > 0 && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {/* Box 1: Total Images with Pie Chart */}
                            <div
                                className="bg-white p-5 rounded-xl border hover:shadow-md transition-shadow cursor-pointer"
                                onClick={() => {
                                    setFilterHeavy(false)
                                    setFilterMissingAlt(false)
                                    setFilterUrl("")
                                    setFilterFormat("")
                                    setFilterType("")
                                    fetchMediaFromDb(1)
                                }}
                            >
                                <div className="flex items-center justify-between mb-3">
                                    <div>
                                        <p className="text-slate-500 text-xs uppercase font-medium flex items-center gap-1">
                                            <Database className="h-3 w-3" /> Total Images
                                        </p>
                                        <p className="text-3xl font-bold mt-1">{globalStats.total.toLocaleString()}</p>
                                    </div>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); setShowTypeChart(!showTypeChart) }}
                                        className="text-xs text-blue-600 hover:underline"
                                    >
                                        {showTypeChart ? 'By Format' : 'By Type'}
                                    </button>
                                </div>
                                {(showTypeChart ? typeBreakdown : formatBreakdown).length > 0 && (
                                    <div className="h-24">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <PieChart>
                                                <Pie
                                                    data={showTypeChart ? typeBreakdown : formatBreakdown}
                                                    dataKey="value"
                                                    nameKey="name"
                                                    cx="50%"
                                                    cy="50%"
                                                    innerRadius={25}
                                                    outerRadius={40}
                                                >
                                                    {(showTypeChart ? typeBreakdown : formatBreakdown).map((entry, index) => (
                                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                                    ))}
                                                </Pie>
                                                <Tooltip formatter={(value) => value?.toLocaleString() || ''} />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    </div>
                                )}
                                {lastUpdatedAt && (
                                    <p className="text-[10px] text-slate-400 mt-2 flex items-center gap-1">
                                        <History className="h-3 w-3" />
                                        Updated {new Date(lastUpdatedAt).toLocaleDateString()}
                                    </p>
                                )}
                            </div>

                            {/* Box 2: Heavy Files with Line Chart */}
                            <div
                                className={`p-5 rounded-xl border cursor-pointer hover:shadow-md transition-shadow ${filterHeavy ? 'bg-yellow-100 border-yellow-300' : 'bg-yellow-50 border-yellow-100'}`}
                                onClick={() => {
                                    setFilterHeavy(!filterHeavy)
                                    fetchMediaFromDb(1)
                                }}
                            >
                                <p className="text-yellow-700 text-xs uppercase font-medium flex items-center gap-1">
                                    <FileWarning className="h-3 w-3" /> Heavy Files ({">"}150KB)
                                </p>
                                <p className="text-3xl font-bold text-yellow-800 mt-1">{globalStats.heavy.toLocaleString()}</p>
                                {snapshots.length > 1 && (
                                    <div className="h-16 mt-2">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <LineChart data={snapshots}>
                                                <XAxis
                                                    dataKey="date"
                                                    tick={{ fontSize: 10 }}
                                                    tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' })}
                                                />
                                                <Line type="monotone" dataKey="heavy" stroke="#EAB308" strokeWidth={2} dot={false} />
                                                <Tooltip
                                                    formatter={(value) => [value?.toLocaleString() || '', 'Heavy']}
                                                    labelFormatter={(label) => new Date(String(label)).toLocaleDateString()}
                                                />
                                            </LineChart>
                                        </ResponsiveContainer>
                                    </div>
                                )}
                                {snapshots.length > 1 && snapshots[snapshots.length - 1].heavy < snapshots[0].heavy && (
                                    <p className="text-[10px] text-green-600 mt-1 flex items-center gap-1">
                                        <TrendingDown className="h-3 w-3" />
                                        {(snapshots[0].heavy - snapshots[snapshots.length - 1].heavy).toLocaleString()} fixed
                                    </p>
                                )}
                            </div>

                            {/* Box 3: Missing Alt with Line Chart */}
                            <div
                                className={`p-5 rounded-xl border cursor-pointer hover:shadow-md transition-shadow ${filterMissingAlt ? 'bg-orange-100 border-orange-300' : 'bg-orange-50 border-orange-100'}`}
                                onClick={() => {
                                    setFilterMissingAlt(!filterMissingAlt)
                                    fetchMediaFromDb(1)
                                }}
                            >
                                <p className="text-orange-700 text-xs uppercase font-medium flex items-center gap-1">
                                    <AlertTriangle className="h-3 w-3" /> Missing Alt Text
                                </p>
                                <p className="text-3xl font-bold text-orange-800 mt-1">{globalStats.missingAlt.toLocaleString()}</p>
                                {snapshots.length > 1 && (
                                    <div className="h-16 mt-2">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <LineChart data={snapshots}>
                                                <XAxis
                                                    dataKey="date"
                                                    tick={{ fontSize: 10 }}
                                                    tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' })}
                                                />
                                                <Line type="monotone" dataKey="missingAlt" stroke="#F97316" strokeWidth={2} dot={false} />
                                                <Tooltip
                                                    formatter={(value) => [value?.toLocaleString() || '', 'Missing Alt']}
                                                    labelFormatter={(label) => new Date(String(label)).toLocaleDateString()}
                                                />
                                            </LineChart>
                                        </ResponsiveContainer>
                                    </div>
                                )}
                                {snapshots.length > 1 && snapshots[snapshots.length - 1].missingAlt < snapshots[0].missingAlt && (
                                    <p className="text-[10px] text-green-600 mt-1 flex items-center gap-1">
                                        <TrendingDown className="h-3 w-3" />
                                        {(snapshots[0].missingAlt - snapshots[snapshots.length - 1].missingAlt).toLocaleString()} fixed
                                    </p>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Grid */}
                    {
                        media.length === 0 && !loading && !error ? (
                            <div className="text-center py-20 bg-slate-50 rounded-xl border border-dashed">
                                <ImageIcon className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                                <p className="text-slate-500 font-medium">No images found</p>
                                <p className="text-sm text-slate-400 mt-1">Click "Scan Library" to fetch images from WordPress</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
                                {media.map((item) => {
                                    const isSelected = selectedImages.has(item.id)
                                    return (
                                        <div
                                            key={item.id}
                                            className={`group bg-white border rounded-xl overflow-hidden hover:shadow-md transition-all cursor-pointer ${isSelected ? 'ring-2 ring-primary' : ''}`}
                                            onClick={() => {
                                                setSelectedImages(prev => {
                                                    const next = new Set(prev)
                                                    if (next.has(item.id)) {
                                                        next.delete(item.id)
                                                    } else {
                                                        next.add(item.id)
                                                    }
                                                    return next
                                                })
                                            }}
                                        >
                                            {/* Image */}
                                            <div className="aspect-square bg-slate-100 relative overflow-hidden">
                                                {item.mime_type.includes('image') ? (
                                                    <img
                                                        src={item.url}
                                                        alt={item.alt}
                                                        className="w-full h-full object-cover transition-transform group-hover:scale-105"
                                                        loading="lazy"
                                                    />
                                                ) : (
                                                    <div className="flex items-center justify-center h-full">
                                                        <ImageIcon className="h-10 w-10 text-slate-300" />
                                                    </div>
                                                )}
                                            </div>
                                            {/* Info box with checkbox, badges, and details */}
                                            <div className="p-3">
                                                {/* Top row: checkbox + filename + history */}
                                                <div className="flex items-center gap-2 mb-1">
                                                    <Checkbox
                                                        checked={isSelected}
                                                        className="shrink-0"
                                                        onClick={(e) => e.stopPropagation()}
                                                        onCheckedChange={(checked) => {
                                                            setSelectedImages(prev => {
                                                                const next = new Set(prev)
                                                                if (checked) {
                                                                    next.add(item.id)
                                                                } else {
                                                                    next.delete(item.id)
                                                                }
                                                                return next
                                                            })
                                                        }}
                                                    />
                                                    <p className="text-xs font-medium truncate flex-1" title={item.filename}>{item.filename}</p>
                                                    <ImageHistoryPopover
                                                        item={{ id: item.id, wpId: item.wpId, filename: item.filename, originalUrl: item.originalUrl }}
                                                        projectId={projectId}
                                                        onRefresh={() => fetchMediaFromDb(page)}
                                                    />
                                                </div>
                                                {/* Size, format, dimensions */}
                                                <div className="flex items-center justify-between text-[10px] text-slate-500">
                                                    <span>{formatBytes(item.filesize)}</span>
                                                    <span className="font-mono bg-slate-100 px-1 rounded">
                                                        {item.mime_type.split('/')[1]?.toUpperCase() || 'IMG'}
                                                    </span>
                                                    <span>{item.width}x{item.height}</span>
                                                </div>
                                                {/* Badges row */}
                                                <div className="flex flex-wrap gap-1 mt-2">
                                                    {item.filesize > 150 * 1024 && (
                                                        <Badge variant="destructive" className="h-5 px-1.5 text-[9px]">
                                                            HEAVY
                                                        </Badge>
                                                    )}
                                                    {item.parent_type && (
                                                        <Badge
                                                            variant="secondary"
                                                            className={`h-5 px-1.5 text-[9px] ${item.parent_type === 'product' ? 'bg-blue-100 text-blue-700' :
                                                                item.parent_type === 'post' ? 'bg-green-100 text-green-700' :
                                                                    item.parent_type === 'page' ? 'bg-purple-100 text-purple-700' :
                                                                        'bg-slate-100 text-slate-700'
                                                                }`}
                                                        >
                                                            {item.parent_type === 'product' ? 'PRODUCT' :
                                                                item.parent_type === 'post' ? 'BLOG' :
                                                                    item.parent_type === 'page' ? 'PAGE' :
                                                                        item.parent_type.toUpperCase()}
                                                        </Badge>
                                                    )}
                                                    {!item.alt && (
                                                        <Badge variant="outline" className="h-5 px-1.5 text-[9px] text-orange-600 border-orange-300">
                                                            No Alt
                                                        </Badge>
                                                    )}
                                                </div>
                                                {item.parent_url && (
                                                    <a
                                                        href={item.parent_url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="mt-2 flex items-center gap-1 text-[10px] text-blue-600 hover:underline"
                                                        onClick={(e) => e.stopPropagation()}
                                                    >
                                                        <ExternalLink className="h-3 w-3" />
                                                        View Page
                                                    </a>
                                                )}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        )
                    }

                    {/* Pagination */}
                    {
                        totalPages > 1 && (
                            <div className="flex items-center justify-center gap-2 mt-8">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => fetchMediaFromDb(page - 1)}
                                    disabled={page === 1 || loading}
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
                                    onClick={() => fetchMediaFromDb(page + 1)}
                                    disabled={page === totalPages || loading}
                                >
                                    Next
                                    <ChevronRight className="h-4 w-4 ml-1" />
                                </Button>
                            </div>
                        )
                    }

                    {/* Log Dialog */}
                    {showLogDialog && (
                        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                            <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
                                <div className="flex items-center justify-between p-4 border-b">
                                    <h3 className="font-semibold text-lg flex items-center gap-2">
                                        <ClipboardList className="h-5 w-5" />
                                        Image Factory Logs
                                    </h3>
                                    <Button variant="ghost" size="icon" onClick={() => setShowLogDialog(false)}>
                                        <X className="h-4 w-4" />
                                    </Button>
                                </div>

                                <div className="flex gap-3 p-4 border-b bg-slate-50">
                                    <select
                                        value={logFilterAction}
                                        onChange={(e) => { setLogFilterAction(e.target.value); fetchLogs() }}
                                        className="h-8 px-3 text-sm border rounded-md bg-white"
                                    >
                                        <option value="">All Actions</option>
                                        <option value="DATABASE_CREATE">Database Create</option>
                                        <option value="DATABASE_UPDATE">Database Update</option>
                                        <option value="COMPRESS">Compression</option>
                                        <option value="ALT_EDIT">Alt Edit</option>
                                    </select>
                                    <select
                                        value={logFilterUser}
                                        onChange={(e) => { setLogFilterUser(e.target.value); fetchLogs() }}
                                        className="h-8 px-3 text-sm border rounded-md bg-white"
                                    >
                                        <option value="">All Users</option>
                                        {availableUsers.map(u => (
                                            <option key={u.userId} value={u.userId}>{u.userName}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="flex-1 overflow-auto p-4">
                                    {logsLoading ? (
                                        <div className="flex items-center justify-center py-8">
                                            <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
                                        </div>
                                    ) : logs.length === 0 ? (
                                        <div className="text-center py-8 text-slate-500">No logs found</div>
                                    ) : (
                                        <table className="w-full text-sm">
                                            <thead className="text-left border-b">
                                                <tr>
                                                    <th className="pb-2 font-medium">Date</th>
                                                    <th className="pb-2 font-medium">User</th>
                                                    <th className="pb-2 font-medium">Action</th>
                                                    <th className="pb-2 font-medium">Details</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {logs.map((log: any) => (
                                                    <tr key={log.id} className="border-b last:border-0">
                                                        <td className="py-2 text-slate-600">
                                                            {new Date(log.createdAt).toLocaleDateString()}{' '}
                                                            <span className="text-xs text-slate-400">
                                                                {new Date(log.createdAt).toLocaleTimeString()}
                                                            </span>
                                                        </td>
                                                        <td className="py-2">{log.userName}</td>
                                                        <td className="py-2">
                                                            <Badge variant={
                                                                log.action === 'DATABASE_CREATE' ? 'default' :
                                                                    log.action === 'DATABASE_UPDATE' ? 'secondary' :
                                                                        log.action === 'COMPRESS' ? 'outline' : 'destructive'
                                                            }>
                                                                {log.action.replace('DATABASE_', '').replace('_', ' ')}
                                                            </Badge>
                                                        </td>
                                                        <td className="py-2 text-xs text-slate-500">
                                                            {log.details ? (() => {
                                                                try {
                                                                    const d = JSON.parse(log.details)
                                                                    return `+${d.added || 0} added, ${d.updated || 0} updated`
                                                                } catch { return '' }
                                                            })() : ''}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    )}
                                </div>

                                {databaseCreatedAt && (
                                    <div className="p-3 border-t bg-slate-50 text-xs text-slate-500 flex items-center gap-1">
                                        <Database className="h-3 w-3" />
                                        Database created: {new Date(databaseCreatedAt).toLocaleString()}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Optimize Dialog */}
                    <OptimizeDialog
                        open={showOptimizeDialog}
                        onClose={() => setShowOptimizeDialog(false)}
                        selectedImages={media.filter(m => selectedImages.has(m.id)).map(m => ({
                            ...m,
                            mimeType: m.mime_type
                        }))}
                        projectId={projectId}
                        onOptimizeComplete={() => {
                            setSelectedImages(new Set())
                            fetchMediaFromDb(page)
                        }}
                    />
                </div>
            )}
        </div>
    )
}
