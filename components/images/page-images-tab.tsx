"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
    Loader2,
    Search,
    Image as ImageIcon,
    ExternalLink,
    AlertTriangle,
    FileText,
    RefreshCw
} from "lucide-react"
import { formatBytes } from "@/lib/utils"

interface PageImage {
    url: string
    filename: string
    size_bytes: number
    size_kb: number
    pages: {
        id: number
        title: string
        url: string
        type: string
    }[]
    page_count: number
}

interface PageImagesTabProps {
    projectId: number
    onSelectImage?: (image: PageImage) => void
}

export function PageImagesTab({ projectId, onSelectImage }: PageImagesTabProps) {
    const [images, setImages] = useState<PageImage[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState("")
    const [scanned, setScanned] = useState(false)
    const [stats, setStats] = useState({ totalScanned: 0, postsScanned: 0, heavyImages: 0 })
    const [minSizeKB, setMinSizeKB] = useState("100")

    const scanContent = async () => {
        setLoading(true)
        setError("")

        try {
            const res = await fetch(`/api/images/scan-content?projectId=${projectId}&minSizeKB=${minSizeKB}&limit=100`)
            const data = await res.json()

            if (!data.success) {
                throw new Error(data.error || "Failed to scan content")
            }

            setImages(data.images || [])
            setStats(data.stats || {})
            setScanned(true)
        } catch (e: any) {
            setError(e.message)
        } finally {
            setLoading(false)
        }
    }

    const formatType = (type: string) => {
        const types: Record<string, string> = {
            'post': 'Blog Post',
            'page': 'Page',
            'product': 'Product',
            'landing_page': 'Landing Page'
        }
        return types[type] || type
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
                        Find heavy images that are actually being loaded on your pages.
                        This helps you optimize the images that impact page speed the most.
                    </p>

                    <div className="flex items-center gap-3 justify-center mb-4">
                        <label className="text-sm text-muted-foreground">Min size:</label>
                        <Input
                            type="number"
                            value={minSizeKB}
                            onChange={(e) => setMinSizeKB(e.target.value)}
                            className="w-24"
                            placeholder="KB"
                        />
                        <span className="text-sm text-muted-foreground">KB</span>
                    </div>

                    <Button onClick={scanContent} disabled={loading} size="lg">
                        {loading ? (
                            <>
                                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                                Scanning...
                            </>
                        ) : (
                            <>
                                <Search className="h-5 w-5 mr-2" />
                                Scan Content for Heavy Images
                            </>
                        )}
                    </Button>
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Stats Bar */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Badge variant="outline" className="py-1.5">
                        {stats.postsScanned} pages scanned
                    </Badge>
                    <Badge variant="outline" className="py-1.5">
                        {stats.totalScanned} unique images found
                    </Badge>
                    <Badge variant="destructive" className="py-1.5">
                        {images.length} heavy images (&gt;{minSizeKB}KB)
                    </Badge>
                </div>
                <Button variant="outline" size="sm" onClick={scanContent} disabled={loading}>
                    <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                    Rescan
                </Button>
            </div>

            {error && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
                    <AlertTriangle className="h-5 w-5 text-red-500" />
                    <p className="text-red-700">{error}</p>
                </div>
            )}

            {/* Images List */}
            {images.length === 0 ? (
                <div className="text-center py-12">
                    <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                        <ImageIcon className="h-8 w-8 text-green-600" />
                    </div>
                    <h3 className="text-lg font-medium">No Heavy Images Found!</h3>
                    <p className="text-muted-foreground">
                        All images on your pages are under {minSizeKB}KB
                    </p>
                </div>
            ) : (
                <div className="space-y-3">
                    {images.map((image, index) => (
                        <div
                            key={image.url}
                            className="flex items-start gap-4 p-4 bg-white border rounded-lg hover:border-primary/50 transition-colors"
                        >
                            {/* Thumbnail */}
                            <div className="w-20 h-20 rounded-lg overflow-hidden bg-slate-100 flex-shrink-0">
                                <img
                                    src={image.url}
                                    alt={image.filename}
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                        (e.target as HTMLImageElement).src = '/placeholder-image.png'
                                    }}
                                />
                            </div>

                            {/* Info */}
                            <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-4">
                                    <div>
                                        <h4 className="font-medium text-sm truncate max-w-md" title={image.filename}>
                                            {image.filename}
                                        </h4>
                                        <div className="flex items-center gap-3 mt-1">
                                            <Badge variant={image.size_kb > 500 ? "destructive" : "secondary"}>
                                                {formatBytes(image.size_bytes)}
                                            </Badge>
                                            <span className="text-xs text-muted-foreground">
                                                Used in {image.page_count} {image.page_count === 1 ? 'page' : 'pages'}
                                            </span>
                                        </div>
                                    </div>

                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => onSelectImage?.(image)}
                                    >
                                        Optimize
                                    </Button>
                                </div>

                                {/* Pages using this image */}
                                <div className="mt-3 flex flex-wrap gap-2">
                                    {image.pages.slice(0, 3).map((page) => (
                                        <a
                                            key={page.id}
                                            href={page.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center gap-1.5 px-2 py-1 bg-slate-50 rounded text-xs hover:bg-slate-100 transition-colors"
                                        >
                                            <FileText className="h-3 w-3" />
                                            <span className="truncate max-w-[150px]">{page.title}</span>
                                            <Badge variant="outline" className="text-[10px] py-0">
                                                {formatType(page.type)}
                                            </Badge>
                                            <ExternalLink className="h-3 w-3 opacity-50" />
                                        </a>
                                    ))}
                                    {image.pages.length > 3 && (
                                        <span className="px-2 py-1 text-xs text-muted-foreground">
                                            +{image.pages.length - 3} more
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Rank */}
                            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-sm font-bold text-slate-600">
                                #{index + 1}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
