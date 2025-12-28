"use client"

import { useState, useCallback } from "react"
import { Upload, Download, ImageIcon, Loader2, RotateCcw, Check, X, DownloadCloud } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"

interface ImageFile {
    id: string
    file: File
    preview: string
    status: 'pending' | 'compressing' | 'done' | 'error'
    compressedImage?: string
    stats?: {
        original: { sizeKB: number; width: number; height: number }
        compressed: { sizeKB: number; width: number; height: number }
        savings: number
    }
    error?: string
}

export function ImageCompressor() {
    const [images, setImages] = useState<ImageFile[]>([])
    const [isCompressing, setIsCompressing] = useState(false)
    const [isDragging, setIsDragging] = useState(false)

    // Settings
    const [maxSizeKB, setMaxSizeKB] = useState(100)
    const [maxWidth, setMaxWidth] = useState(1200)
    const [format, setFormat] = useState("webp")
    const [qualityThreshold, setQualityThreshold] = useState(90) // New: quality threshold %

    const handleFiles = useCallback((files: FileList | File[]) => {
        Array.from(files).forEach((file) => {
            if (!file.type.startsWith("image/")) return

            const reader = new FileReader()
            reader.onload = (e) => {
                const newImage: ImageFile = {
                    id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                    file,
                    preview: e.target?.result as string,
                    status: 'pending'
                }
                setImages(prev => [...prev, newImage])
            }
            reader.readAsDataURL(file)
        })
    }, [])

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        setIsDragging(false)
        handleFiles(e.dataTransfer.files)
    }, [handleFiles])

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        setIsDragging(true)
    }, [])

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        setIsDragging(false)
    }, [])

    const compressImage = async (image: ImageFile): Promise<ImageFile> => {
        try {
            const formData = new FormData()
            formData.append("file", image.file)
            formData.append("maxSizeKB", maxSizeKB.toString())
            formData.append("maxWidth", maxWidth.toString())
            formData.append("format", format)
            formData.append("qualityThreshold", qualityThreshold.toString())

            const res = await fetch("/api/images/compress", {
                method: "POST",
                body: formData
            })

            const data = await res.json()

            if (!data.success) {
                throw new Error(data.error || "Compression failed")
            }

            return {
                ...image,
                status: 'done',
                compressedImage: data.image,
                stats: data.stats
            }
        } catch (err: any) {
            return {
                ...image,
                status: 'error',
                error: err.message
            }
        }
    }

    const handleCompressAll = async () => {
        if (images.length === 0) return

        setIsCompressing(true)

        for (let i = 0; i < images.length; i++) {
            const image = images[i]
            if (image.status === 'done') continue

            setImages(prev => prev.map(img =>
                img.id === image.id ? { ...img, status: 'compressing' } : img
            ))

            const result = await compressImage(image)

            setImages(prev => prev.map(img =>
                img.id === image.id ? result : img
            ))
        }

        setIsCompressing(false)
    }

    const handleDownload = (image: ImageFile) => {
        if (!image.compressedImage) return

        const link = document.createElement("a")
        link.href = image.compressedImage
        const ext = format === "jpeg" ? "jpg" : format
        link.download = `compressed-${image.file.name.split('.')[0]}.${ext}`
        link.click()
    }

    const handleDownloadAll = () => {
        images.filter(img => img.status === 'done').forEach(img => {
            handleDownload(img)
        })
    }

    const handleRemove = (id: string) => {
        setImages(prev => prev.filter(img => img.id !== id))
    }

    const handleReset = () => {
        setImages([])
    }

    const completedCount = images.filter(img => img.status === 'done').length
    const totalSavings = images
        .filter(img => img.stats)
        .reduce((acc, img) => acc + (img.stats!.original.sizeKB - img.stats!.compressed.sizeKB), 0)

    return (
        <div className="space-y-6">
            {/* Upload Area */}
            <div
                className={`border-2 border-dashed rounded-xl p-8 text-center transition-all duration-300 ${isDragging
                    ? "border-blue-500 bg-blue-50"
                    : "border-slate-200 hover:border-slate-300 bg-slate-50"
                    }`}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
            >
                <Upload className="h-10 w-10 mx-auto text-slate-400 mb-3" />
                <p className="text-lg font-medium text-slate-700 mb-1">
                    Drop images here
                </p>
                <p className="text-sm text-slate-500 mb-3">
                    or click to browse (multiple files supported)
                </p>
                <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={(e) => e.target.files && handleFiles(e.target.files)}
                    className="hidden"
                    id="file-upload"
                />
                <label htmlFor="file-upload">
                    <Button variant="outline" asChild>
                        <span>Select Files</span>
                    </Button>
                </label>
            </div>

            {/* Settings Bar */}
            {images.length > 0 && (
                <div className="bg-white border rounded-xl p-4">
                    <div className="flex flex-wrap items-end gap-4">
                        <div className="flex-1 min-w-[120px]">
                            <Label htmlFor="maxSize" className="text-xs">Max Size (KB)</Label>
                            <Input
                                id="maxSize"
                                type="number"
                                value={maxSizeKB}
                                onChange={(e) => setMaxSizeKB(parseInt(e.target.value) || 100)}
                                min={10}
                                max={5000}
                                className="mt-1 h-9"
                            />
                        </div>
                        <div className="flex-1 min-w-[120px]">
                            <Label htmlFor="maxWidth" className="text-xs">Max Width (px)</Label>
                            <Input
                                id="maxWidth"
                                type="number"
                                value={maxWidth}
                                onChange={(e) => setMaxWidth(parseInt(e.target.value) || 1200)}
                                min={100}
                                max={4000}
                                className="mt-1 h-9"
                            />
                        </div>
                        <div className="flex-1 min-w-[100px]">
                            <Label htmlFor="threshold" className="text-xs">Quality Target (%)</Label>
                            <Input
                                id="threshold"
                                type="number"
                                value={qualityThreshold}
                                onChange={(e) => setQualityThreshold(Math.min(100, Math.max(50, parseInt(e.target.value) || 90)))}
                                min={50}
                                max={100}
                                className="mt-1 h-9"
                            />
                        </div>
                        <div className="flex-1 min-w-[100px]">
                            <Label className="text-xs">Format</Label>
                            <Select value={format} onValueChange={setFormat}>
                                <SelectTrigger className="mt-1 h-9">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="webp">WebP</SelectItem>
                                    <SelectItem value="jpeg">JPEG</SelectItem>
                                    <SelectItem value="png">PNG</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex gap-2">
                            <Button
                                onClick={handleCompressAll}
                                disabled={isCompressing || images.every(img => img.status === 'done')}
                            >
                                {isCompressing ? (
                                    <>
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                        Compressing...
                                    </>
                                ) : (
                                    <>⚡ Compress All</>
                                )}
                            </Button>
                            <Button variant="outline" onClick={handleReset}>
                                <RotateCcw className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                    <p className="text-xs text-slate-500 mt-2">
                        Quality Target: Aim for {qualityThreshold}% of max size ({Math.round(maxSizeKB * qualityThreshold / 100)}KB - {maxSizeKB}KB)
                    </p>
                </div>
            )}

            {/* Progress Summary */}
            {images.length > 0 && completedCount > 0 && (
                <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-green-700">Completed</p>
                            <p className="text-2xl font-bold text-green-600">
                                {completedCount} / {images.length}
                            </p>
                        </div>
                        <div className="text-right">
                            <p className="text-sm text-green-700">Total Saved</p>
                            <p className="text-2xl font-bold text-green-600">
                                {Math.round(totalSavings)} KB
                            </p>
                        </div>
                        {completedCount > 0 && (
                            <Button onClick={handleDownloadAll} variant="outline" className="border-green-300">
                                <DownloadCloud className="h-4 w-4 mr-2" />
                                Download All
                            </Button>
                        )}
                    </div>
                </div>
            )}

            {/* Image Grid */}
            {images.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {images.map((image) => (
                        <div
                            key={image.id}
                            className="bg-white border rounded-xl overflow-hidden group relative"
                        >
                            <div className="aspect-square bg-slate-100 relative">
                                <img
                                    src={image.compressedImage || image.preview}
                                    alt={image.file.name}
                                    className="w-full h-full object-cover"
                                />

                                {image.status === 'compressing' && (
                                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                                        <Loader2 className="h-8 w-8 text-white animate-spin" />
                                    </div>
                                )}

                                <button
                                    onClick={() => handleRemove(image.id)}
                                    className="absolute top-2 right-2 bg-black/50 hover:bg-black/70 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                    <X className="h-4 w-4" />
                                </button>

                                {image.status === 'done' && (
                                    <div className="absolute top-2 left-2 bg-green-500 text-white rounded-full p-1">
                                        <Check className="h-4 w-4" />
                                    </div>
                                )}
                            </div>

                            <div className="p-3">
                                <p className="text-xs font-medium truncate" title={image.file.name}>
                                    {image.file.name}
                                </p>

                                {image.stats ? (
                                    <div className="mt-1 flex items-center justify-between text-xs">
                                        <span className="text-slate-500">
                                            {image.stats.original.sizeKB}KB → {image.stats.compressed.sizeKB}KB
                                        </span>
                                        <span className="text-green-600 font-medium">
                                            -{image.stats.savings}%
                                        </span>
                                    </div>
                                ) : image.status === 'error' ? (
                                    <p className="text-xs text-red-500 mt-1">{image.error}</p>
                                ) : (
                                    <p className="text-xs text-slate-400 mt-1">
                                        {Math.round(image.file.size / 1024)} KB
                                    </p>
                                )}

                                {image.status === 'done' && (
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        className="w-full mt-2 h-7 text-xs"
                                        onClick={() => handleDownload(image)}
                                    >
                                        <Download className="h-3 w-3 mr-1" />
                                        Download
                                    </Button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
