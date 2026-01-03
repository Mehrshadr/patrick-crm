"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
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
    ArrowUpRight
} from "lucide-react"
import { formatBytes } from "@/lib/utils"

interface MediaItem {
    id: number
    title: string
    filename: string
    alt: string
    url: string
    width: number
    height: number
    filesize: number
    mime_type: string
    date: string
}

interface MediaScannerProps {
    projectId: number
}

export function MediaScanner({ projectId }: MediaScannerProps) {
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
                // Refresh list without sync to just get data
                fetchMedia(1, false)
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

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault()
        fetchMedia(1)
    }

    // Stats
    const missingAltCount = media.filter(m => !m.alt).length
    const largeFilesCount = media.filter(m => m.filesize > 150 * 1024).length // > 150KB

    return (
        <div className="space-y-6">
            {/* Controls */}
            <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center bg-white p-4 rounded-xl border shadow-sm">
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
                        {syncing ? "Syncing Logic..." : "Sync & Save to DB"}
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

            {/* Stats Summary */}
            {media.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-white p-4 rounded-xl border">
                        <p className="text-slate-500 text-xs uppercase font-medium">Total Images</p>
                        <p className="text-2xl font-bold mt-1">{totalItems}</p>
                    </div>
                    <div className="bg-white p-4 rounded-xl border">
                        <p className="text-slate-500 text-xs uppercase font-medium">On This Page</p>
                        <p className="text-2xl font-bold mt-1">{media.length}</p>
                    </div>
                    <div className="bg-yellow-50 p-4 rounded-xl border border-yellow-100">
                        <p className="text-yellow-700 text-xs uppercase font-medium flex items-center gap-1">
                            <FileWarning className="h-3 w-3" /> Heavy Files ({">"}150KB)
                        </p>
                        <p className="text-2xl font-bold text-yellow-800 mt-1">{largeFilesCount}</p>
                    </div>
                    <div className="bg-orange-50 p-4 rounded-xl border border-orange-100">
                        <p className="text-orange-700 text-xs uppercase font-medium flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3" /> Missing Alt Text
                        </p>
                        <p className="text-2xl font-bold text-orange-800 mt-1">{missingAltCount}</p>
                    </div>
                </div>
            )}

            {/* Grid */}
            {media.length === 0 && !loading && !error ? (
                <div className="text-center py-20 bg-slate-50 rounded-xl border border-dashed">
                    <ImageIcon className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                    <p className="text-slate-500 font-medium">No images found</p>
                    <p className="text-sm text-slate-400 mt-1">Click "Scan Library" to fetch images from WordPress</p>
                </div>
            ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
                    {media.map((item) => (
                        <div key={item.id} className="group bg-white border rounded-xl overflow-hidden hover:shadow-md transition-all relative">
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

                                <div className="absolute top-2 right-2 flex gap-1">
                                    {item.filesize > 150 * 1024 && (
                                        <Badge variant="destructive" className="h-6 px-1.5 text-[10px]">
                                            HEAVY
                                        </Badge>
                                    )}
                                </div>

                                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2">
                                    <Button size="sm" variant="secondary" className="h-8 text-xs w-24">
                                        Optimize
                                    </Button>
                                    <Button size="sm" variant="outline" className="h-8 text-xs w-24 bg-transparent text-white border-white hover:bg-white hover:text-black">
                                        Fix Alt
                                    </Button>
                                </div>
                            </div>
                            <div className="p-3">
                                <p className="text-xs font-medium truncate mb-1" title={item.filename}>{item.filename}</p>
                                <div className="flex items-center justify-between text-[10px] text-slate-500">
                                    <span>{formatBytes(item.filesize)}</span>
                                    <span>{item.width}x{item.height}</span>
                                </div>
                                {!item.alt && (
                                    <p className="text-[10px] text-orange-600 mt-1 flex items-center gap-1">
                                        <AlertTriangle className="h-3 w-3" /> Missing Alt
                                    </p>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-8">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => fetchMedia(page - 1)}
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
                        onClick={() => fetchMedia(page + 1)}
                        disabled={page === totalPages || loading}
                    >
                        Next
                        <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                </div>
            )}
        </div>
    )
}
