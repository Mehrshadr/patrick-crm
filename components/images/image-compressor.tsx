"use client"

import { useState, useCallback } from "react"
import { Upload, Download, ImageIcon, Loader2, ArrowRight, RotateCcw } from "lucide-react"
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

interface CompressionStats {
    original: {
        sizeKB: number
        width: number
        height: number
        format: string
    }
    compressed: {
        sizeKB: number
        width: number
        height: number
        format: string
    }
    savings: number
    quality: number
}

export function ImageCompressor() {
    const [file, setFile] = useState<File | null>(null)
    const [preview, setPreview] = useState<string | null>(null)
    const [compressedImage, setCompressedImage] = useState<string | null>(null)
    const [stats, setStats] = useState<CompressionStats | null>(null)
    const [isCompressing, setIsCompressing] = useState(false)
    const [isDragging, setIsDragging] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // Settings
    const [maxSizeKB, setMaxSizeKB] = useState(100)
    const [maxWidth, setMaxWidth] = useState(1200)
    const [format, setFormat] = useState("webp")

    const handleFile = useCallback((f: File) => {
        if (!f.type.startsWith("image/")) {
            setError("لطفاً یک فایل تصویری انتخاب کنید")
            return
        }

        setFile(f)
        setError(null)
        setCompressedImage(null)
        setStats(null)

        // Create preview
        const reader = new FileReader()
        reader.onload = (e) => {
            setPreview(e.target?.result as string)
        }
        reader.readAsDataURL(f)
    }, [])

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        setIsDragging(false)
        const droppedFile = e.dataTransfer.files[0]
        if (droppedFile) {
            handleFile(droppedFile)
        }
    }, [handleFile])

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        setIsDragging(true)
    }, [])

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        setIsDragging(false)
    }, [])

    const handleCompress = async () => {
        if (!file) return

        setIsCompressing(true)
        setError(null)

        try {
            const formData = new FormData()
            formData.append("file", file)
            formData.append("maxSizeKB", maxSizeKB.toString())
            formData.append("maxWidth", maxWidth.toString())
            formData.append("format", format)

            const res = await fetch("/api/images/compress", {
                method: "POST",
                body: formData
            })

            const data = await res.json()

            if (!data.success) {
                throw new Error(data.error || "Compression failed")
            }

            setCompressedImage(data.image)
            setStats(data.stats)
        } catch (err: any) {
            setError(err.message)
        } finally {
            setIsCompressing(false)
        }
    }

    const handleDownload = () => {
        if (!compressedImage) return

        const link = document.createElement("a")
        link.href = compressedImage
        const ext = format === "jpeg" ? "jpg" : format
        link.download = `compressed-${file?.name?.split('.')[0] || 'image'}.${ext}`
        link.click()
    }

    const handleReset = () => {
        setFile(null)
        setPreview(null)
        setCompressedImage(null)
        setStats(null)
        setError(null)
    }

    return (
        <div className="space-y-6">
            {/* Upload Area */}
            {!file && (
                <div
                    className={`border-2 border-dashed rounded-xl p-12 text-center transition-all duration-300 ${isDragging
                        ? "border-blue-500 bg-blue-50"
                        : "border-slate-200 hover:border-slate-300 bg-slate-50"
                        }`}
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                >
                    <Upload className="h-12 w-12 mx-auto text-slate-400 mb-4" />
                    <p className="text-lg font-medium text-slate-700 mb-2">
                        عکس رو اینجا بنداز
                    </p>
                    <p className="text-sm text-slate-500 mb-4">
                        یا کلیک کن انتخاب کن
                    </p>
                    <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                        className="hidden"
                        id="file-upload"
                    />
                    <label htmlFor="file-upload">
                        <Button variant="outline" asChild>
                            <span>انتخاب فایل</span>
                        </Button>
                    </label>
                </div>
            )}

            {/* Settings + Preview */}
            {file && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Settings Panel */}
                    <div className="bg-white border rounded-xl p-6 space-y-6">
                        <h3 className="font-semibold text-lg flex items-center gap-2">
                            <ImageIcon className="h-5 w-5" />
                            تنظیمات کامپرس
                        </h3>

                        <div className="space-y-4">
                            <div>
                                <Label htmlFor="maxSize">حداکثر حجم (KB)</Label>
                                <Input
                                    id="maxSize"
                                    type="number"
                                    value={maxSizeKB}
                                    onChange={(e) => setMaxSizeKB(parseInt(e.target.value) || 100)}
                                    min={10}
                                    max={5000}
                                    className="mt-1"
                                />
                                <p className="text-xs text-slate-500 mt-1">
                                    حجم نهایی عکس از این مقدار کمتر خواهد بود
                                </p>
                            </div>

                            <div>
                                <Label htmlFor="maxWidth">حداکثر عرض (px)</Label>
                                <Input
                                    id="maxWidth"
                                    type="number"
                                    value={maxWidth}
                                    onChange={(e) => setMaxWidth(parseInt(e.target.value) || 1200)}
                                    min={100}
                                    max={4000}
                                    className="mt-1"
                                />
                            </div>

                            <div>
                                <Label>فرمت خروجی</Label>
                                <Select value={format} onValueChange={setFormat}>
                                    <SelectTrigger className="mt-1">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="webp">WebP (پیشنهادی)</SelectItem>
                                        <SelectItem value="jpeg">JPEG</SelectItem>
                                        <SelectItem value="png">PNG</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="flex gap-2">
                            <Button
                                onClick={handleCompress}
                                disabled={isCompressing}
                                className="flex-1"
                            >
                                {isCompressing ? (
                                    <>
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                        در حال کامپرس...
                                    </>
                                ) : (
                                    "⚡ کامپرس"
                                )}
                            </Button>
                            <Button variant="outline" onClick={handleReset}>
                                <RotateCcw className="h-4 w-4" />
                            </Button>
                        </div>

                        {error && (
                            <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm">
                                {error}
                            </div>
                        )}
                    </div>

                    {/* Preview Panel */}
                    <div className="bg-white border rounded-xl p-6 space-y-4">
                        <h3 className="font-semibold text-lg">پیش‌نمایش</h3>

                        {/* Before/After */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <p className="text-sm text-slate-500 mb-2">قبل</p>
                                <div className="aspect-video bg-slate-100 rounded-lg overflow-hidden">
                                    {preview && (
                                        <img
                                            src={preview}
                                            alt="Original"
                                            className="w-full h-full object-contain"
                                        />
                                    )}
                                </div>
                                {stats && (
                                    <p className="text-xs text-slate-500 mt-1">
                                        {stats.original.width}×{stats.original.height} • {stats.original.sizeKB}KB
                                    </p>
                                )}
                            </div>

                            <div>
                                <p className="text-sm text-slate-500 mb-2">بعد</p>
                                <div className="aspect-video bg-slate-100 rounded-lg overflow-hidden relative">
                                    {compressedImage ? (
                                        <img
                                            src={compressedImage}
                                            alt="Compressed"
                                            className="w-full h-full object-contain"
                                        />
                                    ) : (
                                        <div className="absolute inset-0 flex items-center justify-center text-slate-400">
                                            <ArrowRight className="h-8 w-8" />
                                        </div>
                                    )}
                                </div>
                                {stats && (
                                    <p className="text-xs text-slate-500 mt-1">
                                        {stats.compressed.width}×{stats.compressed.height} • {stats.compressed.sizeKB}KB
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* Stats */}
                        {stats && (
                            <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm text-green-700">صرفه‌جویی</p>
                                        <p className="text-3xl font-bold text-green-600">
                                            {stats.savings}%
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-sm text-slate-600">
                                            {stats.original.sizeKB}KB → {stats.compressed.sizeKB}KB
                                        </p>
                                        <p className="text-xs text-slate-500">
                                            کیفیت: {stats.quality}%
                                        </p>
                                    </div>
                                </div>

                                <Button
                                    onClick={handleDownload}
                                    className="w-full mt-4"
                                    variant="outline"
                                >
                                    <Download className="h-4 w-4 mr-2" />
                                    دانلود {format.toUpperCase()}
                                </Button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
