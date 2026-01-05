"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Progress } from "@/components/ui/progress"
import { Loader2, Check, AlertCircle, ArrowRight } from "lucide-react"

interface MediaItem {
    id: number
    wpId: number
    url: string
    filename: string
    alt: string
    width: number
    height: number
    filesize: number
    mimeType: string
    originalUrl?: string | null
}

interface OptimizeResult {
    mediaId: number
    originalUrl: string
    originalSize: number
    compressedImage: string // base64
    compressedSize: number
    savings: number
    selected: boolean // selected for replacement
    status: 'pending' | 'processing' | 'done' | 'error'
    error?: string
    filename?: string
}

interface OptimizeDialogProps {
    open: boolean
    onClose: () => void
    selectedImages: MediaItem[]
    projectId: number
    onOptimizeComplete: () => void
}

export function OptimizeDialog({ open, onClose, selectedImages, projectId, onOptimizeComplete }: OptimizeDialogProps) {
    // Step: 'settings' | 'processing' | 'results' | 'replacing'
    const [step, setStep] = useState<'settings' | 'processing' | 'results' | 'replacing'>('settings')

    // Settings - use strings to allow empty input
    const [maxSizeKB, setMaxSizeKB] = useState("150")
    const [maxWidth, setMaxWidth] = useState("1200")
    const [qualityThreshold, setQualityThreshold] = useState("90")
    const [format, setFormat] = useState("webp")

    // Results
    const [results, setResults] = useState<OptimizeResult[]>([])
    const [progress, setProgress] = useState(0)
    const [currentProcessing, setCurrentProcessing] = useState("")

    // Replace progress
    const [replaceProgress, setReplaceProgress] = useState(0)

    const handleStartOptimization = async () => {
        setStep('processing')
        setProgress(0)
        setResults([])

        const sizeKB = parseInt(maxSizeKB) || 150
        const width = parseInt(maxWidth) || 1200
        const quality = parseInt(qualityThreshold) || 90

        const newResults: OptimizeResult[] = []

        for (let i = 0; i < selectedImages.length; i++) {
            const img = selectedImages[i]
            setCurrentProcessing(img.filename)

            try {
                // Compress via API (supports URL)
                const formData = new FormData()
                formData.append('imageUrl', img.url)
                formData.append('maxSizeKB', sizeKB.toString())
                formData.append('maxWidth', width.toString())
                formData.append('qualityThreshold', quality.toString())
                formData.append('format', format)

                const res = await fetch('/api/images/compress', {
                    method: 'POST',
                    body: formData
                })

                const data = await res.json()

                if (data.success) {
                    newResults.push({
                        mediaId: img.wpId,
                        originalUrl: img.url,
                        originalSize: img.filesize,
                        compressedImage: data.image,
                        compressedSize: data.stats.compressed.sizeKB * 1024,
                        savings: data.stats.savings,
                        selected: data.stats.savings > 10, // Auto-select if >10% savings
                        status: 'done',
                        filename: img.filename
                    })
                } else {
                    newResults.push({
                        mediaId: img.wpId,
                        originalUrl: img.url,
                        originalSize: img.filesize,
                        compressedImage: '',
                        compressedSize: 0,
                        savings: 0,
                        selected: false,
                        status: 'error',
                        error: data.error,
                        filename: img.filename
                    })
                }
            } catch (e: any) {
                newResults.push({
                    mediaId: img.wpId,
                    originalUrl: img.url,
                    originalSize: img.filesize,
                    compressedImage: '',
                    compressedSize: 0,
                    savings: 0,
                    selected: false,
                    status: 'error',
                    error: e.message,
                    filename: img.filename
                })
            }

            setResults([...newResults])
            setProgress(((i + 1) / selectedImages.length) * 100)
        }

        setStep('results')
    }

    const handleReplaceSelected = async () => {
        const toReplace = results.filter(r => r.selected && r.status === 'done')
        if (toReplace.length === 0) return

        setStep('replacing')
        setReplaceProgress(0)

        for (let i = 0; i < toReplace.length; i++) {
            const item = toReplace[i]

            try {
                // Extract base64 data (remove data:image/...;base64, prefix)
                const base64Data = item.compressedImage.split(',')[1]
                const mimeType = format === 'webp' ? 'image/webp' :
                    format === 'jpeg' || format === 'jpg' ? 'image/jpeg' : 'image/png'

                await fetch('/api/images/replace', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        projectId,
                        mediaId: item.mediaId,
                        imageData: base64Data,
                        mimeType
                    })
                })
            } catch (e) {
                console.error('Replace failed:', e)
            }

            setReplaceProgress(((i + 1) / toReplace.length) * 100)
        }

        onOptimizeComplete()
        handleClose()
    }

    const toggleResultSelection = (mediaId: number) => {
        setResults(prev => prev.map(r =>
            r.mediaId === mediaId ? { ...r, selected: !r.selected } : r
        ))
    }

    const handleClose = () => {
        setStep('settings')
        setResults([])
        setProgress(0)
        onClose()
    }

    const totalSavings = results
        .filter(r => r.selected && r.status === 'done')
        .reduce((acc, r) => acc + (r.originalSize - r.compressedSize), 0)

    const formatBytes = (bytes: number) => {
        if (bytes < 1024) return `${bytes}B`
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
        return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
    }

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>
                        {step === 'settings' && `Optimize ${selectedImages.length} Images`}
                        {step === 'processing' && 'Optimizing...'}
                        {step === 'results' && 'Optimization Results'}
                        {step === 'replacing' && 'Replacing in WordPress...'}
                    </DialogTitle>
                </DialogHeader>

                {/* Step 1: Settings */}
                {step === 'settings' && (
                    <div className="space-y-6">
                        {/* Thumbnail preview */}
                        <div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto p-2 bg-muted rounded-lg">
                            {selectedImages.map(img => (
                                <div key={img.id} className="w-12 h-12 relative rounded overflow-hidden border">
                                    <img
                                        src={img.url}
                                        alt={img.alt || img.filename}
                                        className="w-full h-full object-cover"
                                    />
                                </div>
                            ))}
                        </div>

                        {/* Settings form */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Max Size (KB)</Label>
                                <Input
                                    type="text"
                                    value={maxSizeKB}
                                    onChange={e => setMaxSizeKB(e.target.value)}
                                    placeholder="150"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Max Width (px)</Label>
                                <Input
                                    type="text"
                                    value={maxWidth}
                                    onChange={e => setMaxWidth(e.target.value)}
                                    placeholder="1200"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Quality Threshold (%)</Label>
                                <Input
                                    type="text"
                                    value={qualityThreshold}
                                    onChange={e => setQualityThreshold(e.target.value)}
                                    placeholder="90"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Output Format</Label>
                                <Select value={format} onValueChange={setFormat}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="webp">WebP (Best)</SelectItem>
                                        <SelectItem value="jpeg">JPEG</SelectItem>
                                        <SelectItem value="png">PNG</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <Button onClick={handleStartOptimization} className="w-full">
                            Start Optimization
                        </Button>
                    </div>
                )}

                {/* Step 2: Processing */}
                {step === 'processing' && (
                    <div className="space-y-4 py-8">
                        <div className="flex items-center justify-center gap-3">
                            <Loader2 className="h-6 w-6 animate-spin text-primary" />
                            <span>Processing {currentProcessing}...</span>
                        </div>
                        <Progress value={progress} className="w-full" />
                        <p className="text-center text-sm text-muted-foreground">
                            {Math.round(progress)}% complete
                        </p>
                    </div>
                )}

                {/* Step 3: Results - Larger images with sizes */}
                {step === 'results' && (
                    <div className="space-y-4">
                        <div className="max-h-[60vh] overflow-y-auto space-y-4 pr-2">
                            {results.map(result => (
                                <div
                                    key={result.mediaId}
                                    className={`p-4 rounded-lg border ${result.status === 'error' ? 'bg-red-50 border-red-200' :
                                        result.selected ? 'bg-green-50 border-green-300' : 'bg-muted/50'
                                        }`}
                                >
                                    {/* Header with checkbox and filename */}
                                    <div className="flex items-center gap-3 mb-3">
                                        {result.status === 'done' && (
                                            <Checkbox
                                                checked={result.selected}
                                                onCheckedChange={() => toggleResultSelection(result.mediaId)}
                                            />
                                        )}
                                        <span className="font-medium text-sm truncate flex-1">{result.filename}</span>
                                        {result.status === 'done' && (
                                            <span className={`text-sm font-semibold ${result.savings > 50 ? 'text-green-600' : result.savings > 20 ? 'text-amber-600' : 'text-slate-500'}`}>
                                                -{result.savings}%
                                            </span>
                                        )}
                                    </div>

                                    {result.status === 'done' ? (
                                        <>
                                            {/* Before/After images - LARGER */}
                                            <div className="flex items-center gap-4">
                                                {/* Original */}
                                                <div className="flex-1">
                                                    <p className="text-xs text-muted-foreground mb-1">Original</p>
                                                    <div className="aspect-video bg-white rounded border overflow-hidden">
                                                        <img
                                                            src={result.originalUrl}
                                                            alt="Original"
                                                            className="w-full h-full object-contain"
                                                        />
                                                    </div>
                                                    <p className="text-xs text-center mt-1 font-mono text-muted-foreground">
                                                        {formatBytes(result.originalSize)}
                                                    </p>
                                                </div>

                                                <ArrowRight className="h-5 w-5 text-muted-foreground shrink-0" />

                                                {/* Compressed */}
                                                <div className="flex-1">
                                                    <p className="text-xs text-muted-foreground mb-1">Optimized</p>
                                                    <div className="aspect-video bg-white rounded border overflow-hidden">
                                                        <img
                                                            src={result.compressedImage}
                                                            alt="Compressed"
                                                            className="w-full h-full object-contain"
                                                        />
                                                    </div>
                                                    <p className="text-xs text-center mt-1 font-mono text-green-600 font-medium">
                                                        {formatBytes(result.compressedSize)}
                                                    </p>
                                                </div>
                                            </div>
                                        </>
                                    ) : (
                                        <div className="flex items-center gap-2 py-4">
                                            <AlertCircle className="h-5 w-5 text-red-500" />
                                            <span className="text-sm text-red-600">{result.error}</span>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>

                        {/* Summary */}
                        <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/50">
                            <span className="text-sm">
                                {results.filter(r => r.selected && r.status === 'done').length} selected
                            </span>
                            <span className="font-medium text-green-600">
                                Total Savings: {formatBytes(totalSavings)}
                            </span>
                        </div>

                        <div className="flex gap-2">
                            <Button variant="outline" onClick={handleClose} className="flex-1">
                                Cancel
                            </Button>
                            <Button
                                onClick={handleReplaceSelected}
                                className="flex-1"
                                disabled={results.filter(r => r.selected && r.status === 'done').length === 0}
                            >
                                <Check className="h-4 w-4 mr-2" />
                                Replace {results.filter(r => r.selected && r.status === 'done').length} in WordPress
                            </Button>
                        </div>
                    </div>
                )}

                {/* Step 4: Replacing */}
                {step === 'replacing' && (
                    <div className="space-y-4 py-8">
                        <div className="flex items-center justify-center gap-3">
                            <Loader2 className="h-6 w-6 animate-spin text-primary" />
                            <span>Replacing images in WordPress...</span>
                        </div>
                        <Progress value={replaceProgress} className="w-full" />
                        <p className="text-center text-sm text-muted-foreground">
                            {Math.round(replaceProgress)}% complete
                        </p>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    )
}
