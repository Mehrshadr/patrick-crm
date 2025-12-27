"use client"

import { useState, useEffect, use, useRef, useMemo } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { RichEditor } from "@/components/editor/rich-editor"
import {
    ArrowLeft,
    Save,
    Eye,
    Sparkles,
    Clock,
    Copy,
    FileUp,
    Trash2,
    Image as ImageIcon,
    RefreshCw
} from "lucide-react"
import { toast } from "sonner"

interface GeneratedContent {
    id: number
    title: string | null
    contentType: string
    brief: string
    content: string | null
    llmPrompt: string | null
    status: string
    createdAt: string
    updatedAt: string
}

interface ImageInfo {
    src: string
    alt: string
    index: number
}

export default function ContentEditorPage({
    params
}: {
    params: Promise<{ projectId: string; contentId: string }>
}) {
    const { projectId, contentId } = use(params)
    const router = useRouter()
    const contentRef = useRef<HTMLDivElement>(null)

    const [content, setContent] = useState<GeneratedContent | null>(null)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [previewMode, setPreviewMode] = useState(false)

    // Editable fields
    const [title, setTitle] = useState('')
    const [htmlContent, setHtmlContent] = useState('')
    const [refineFeedback, setRefineFeedback] = useState('')
    const [refining, setRefining] = useState(false)

    // Text selection for inline refine
    const [selectedText, setSelectedText] = useState('')
    const [selectionPosition, setSelectionPosition] = useState<{ x: number; y: number } | null>(null)
    const [improveFeedback, setImproveFeedback] = useState('')
    const [improving, setImproving] = useState(false)

    // Image regeneration
    const [regeneratingImage, setRegeneratingImage] = useState<number | null>(null)

    // Extract images from content
    const images = useMemo<ImageInfo[]>(() => {
        const imgRegex = /<img[^>]+src="([^"]+)"[^>]*alt="([^"]*)"[^>]*>/gi
        const matches: ImageInfo[] = []
        let match
        let index = 0
        while ((match = imgRegex.exec(htmlContent)) !== null) {
            matches.push({
                src: match[1],
                alt: match[2] || `Image ${index + 1}`,
                index: index++
            })
        }
        return matches
    }, [htmlContent])

    useEffect(() => {
        fetchContent()
    }, [projectId, contentId])

    async function fetchContent() {
        try {
            const res = await fetch(`/api/seo/content/${projectId}/${contentId}`)
            if (!res.ok) {
                toast.error('Content not found')
                router.push(`/seo/content-factory/projects/${projectId}`)
                return
            }
            const data = await res.json()
            setContent(data)
            setTitle(data.title || '')
            setHtmlContent(data.content || '')
        } catch (error) {
            toast.error('Failed to load content')
        } finally {
            setLoading(false)
        }
    }

    async function handleSave() {
        setSaving(true)
        try {
            const res = await fetch(`/api/seo/content/${projectId}/${contentId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title, content: htmlContent })
            })

            if (res.ok) {
                const updated = await res.json()
                setContent(updated)
                toast.success('Content saved!')
            } else {
                toast.error('Failed to save')
            }
        } catch (error) {
            toast.error('Failed to save')
        } finally {
            setSaving(false)
        }
    }

    async function handleRefine() {
        if (!refineFeedback.trim()) return

        setRefining(true)
        try {
            const res = await fetch(`/api/seo/content/${projectId}/${contentId}/refine`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ feedback: refineFeedback })
            })

            if (res.ok) {
                const updated = await res.json()
                setContent(updated)
                setHtmlContent(updated.content || '')
                setRefineFeedback('')
                toast.success('Content refined!')
            } else {
                toast.error('Refinement failed')
            }
        } catch (error) {
            toast.error('Refinement failed')
        } finally {
            setRefining(false)
        }
    }

    function handleTextSelection() {
        const selection = window.getSelection()
        if (selection && selection.toString().trim().length > 10) {
            const text = selection.toString().trim()
            const range = selection.getRangeAt(0)
            const rect = range.getBoundingClientRect()

            setSelectedText(text)
            setSelectionPosition({
                x: rect.left + (rect.width / 2),
                y: rect.top - 10
            })
        } else if (!improving) {
            setSelectedText('')
            setSelectionPosition(null)
        }
    }

    async function handleImproveSection() {
        if (!content || !selectedText) return

        setImproving(true)
        try {
            const res = await fetch(`/api/seo/content/${projectId}/${contentId}/improve-section`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    selectedText,
                    feedback: improveFeedback
                })
            })

            const data = await res.json()

            if (res.ok) {
                toast.success('Section improved!')
                setHtmlContent(data.content.content || '')
                setSelectedText('')
                setSelectionPosition(null)
                setImproveFeedback('')
            } else {
                toast.error(data.error || 'Failed to improve section')
            }
        } catch (error) {
            toast.error('Failed to improve section')
        } finally {
            setImproving(false)
        }
    }

    async function handleRegenerateImage(imageIndex: number, imageSrc: string) {
        setRegeneratingImage(imageIndex)
        toast.info('Regenerating image...')

        try {
            const res = await fetch(`/api/seo/content/${projectId}/${contentId}/regenerate-image`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    imageIndex,
                    currentSrc: imageSrc
                })
            })

            const data = await res.json()

            if (res.ok && data.newSrc) {
                const newHtml = htmlContent.replace(imageSrc, data.newSrc)
                setHtmlContent(newHtml)
                toast.success('Image regenerated!')
            } else {
                toast.error(data.error || 'Failed to regenerate image')
            }
        } catch (error) {
            toast.error('Failed to regenerate image')
        } finally {
            setRegeneratingImage(null)
        }
    }

    function handleCopy() {
        navigator.clipboard.writeText(htmlContent)
        toast.success('HTML copied to clipboard!')
    }

    async function handleExport() {
        try {
            const res = await fetch(`/api/seo/content/${projectId}/${contentId}/export-gdocs`, {
                method: 'POST'
            })

            const data = await res.json()

            if (res.ok) {
                toast.success('Exported to Google Docs!')
                window.open(data.url, '_blank')
            } else {
                toast.error(data.error || 'Export failed')
            }
        } catch (error) {
            toast.error('Export failed')
        }
    }

    async function handleDelete() {
        if (!confirm('Are you sure you want to delete this content?')) return

        try {
            const res = await fetch(`/api/seo/content/${projectId}/${contentId}`, {
                method: 'DELETE'
            })

            if (res.ok) {
                toast.success('Content deleted')
                router.push(`/seo/content-factory/projects/${projectId}`)
            } else {
                toast.error('Failed to delete')
            }
        } catch (error) {
            toast.error('Failed to delete')
        }
    }

    if (loading) {
        return (
            <div className="h-screen flex items-center justify-center">
                <div className="animate-pulse">Loading...</div>
            </div>
        )
    }

    if (!content) return null

    const wordCount = htmlContent.replace(/<[^>]*>/g, ' ').split(/\s+/).filter(Boolean).length

    return (
        <>
            <div className="fixed inset-0 flex flex-col bg-slate-50">
                {/* Top Bar */}
                <header className="h-14 border-b bg-white flex items-center justify-between px-4 shrink-0">
                    <div className="flex items-center gap-4">
                        <Link href={`/seo/content-factory/projects/${projectId}`}>
                            <Button variant="ghost" size="sm">
                                <ArrowLeft className="h-4 w-4 mr-2" />
                                Back
                            </Button>
                        </Link>

                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Badge variant="outline">{content.contentType}</Badge>
                            <span>·</span>
                            <span>{wordCount} words</span>
                            {images.length > 0 && (
                                <>
                                    <span>·</span>
                                    <span>{images.length} images</span>
                                </>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <Button variant="ghost" size="sm" onClick={() => setPreviewMode(!previewMode)}>
                            <Eye className="h-4 w-4 mr-2" />
                            {previewMode ? 'Edit' : 'Preview'}
                        </Button>
                        <Button variant="ghost" size="sm" onClick={handleCopy}>
                            <Copy className="h-4 w-4 mr-2" />
                            Copy
                        </Button>
                        <Button variant="ghost" size="sm" onClick={handleExport}>
                            <FileUp className="h-4 w-4 mr-2" />
                            Export
                        </Button>
                        <Button variant="destructive" size="sm" onClick={handleDelete}>
                            <Trash2 className="h-4 w-4" />
                        </Button>
                        <Button size="sm" onClick={handleSave} disabled={saving}>
                            <Save className="h-4 w-4 mr-2" />
                            {saving ? 'Saving...' : 'Save'}
                        </Button>
                    </div>
                </header>

                {/* Main Content */}
                <div className="flex-1 flex min-h-0">
                    {/* Editor Area */}
                    <div className="flex-1 flex flex-col min-w-0">
                        {/* Title */}
                        <div className="p-4 bg-white border-b shrink-0">
                            <Input
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder="Enter title..."
                                className="text-2xl font-bold border-0 p-0 focus-visible:ring-0 bg-transparent"
                            />
                        </div>

                        {/* Content - Scrollable */}
                        <div
                            className="flex-1 overflow-y-auto p-4"
                            ref={contentRef}
                            onMouseUp={handleTextSelection}
                        >
                            {previewMode ? (
                                <article className="max-w-4xl mx-auto bg-white p-8 rounded-lg shadow">
                                    <style>{`
                                        .preview-content h1 { font-size: 2rem; font-weight: bold; margin: 1rem 0; }
                                        .preview-content h2 { font-size: 1.5rem; font-weight: bold; margin: 0.75rem 0; }
                                        .preview-content h3 { font-size: 1.25rem; font-weight: bold; margin: 0.5rem 0; }
                                        .preview-content p { margin: 0.5rem 0; line-height: 1.7; }
                                        .preview-content ul, .preview-content ol { padding-left: 1.5rem; margin: 0.5rem 0; }
                                        .preview-content li { margin: 0.25rem 0; }
                                        .preview-content blockquote { border-left: 3px solid #e2e8f0; padding-left: 1rem; margin: 0.5rem 0; color: #64748b; font-style: italic; }
                                        .preview-content img { max-width: 100%; border-radius: 0.5rem; margin: 1rem 0; }
                                        .preview-content a { color: #2563eb; text-decoration: underline; }
                                        .preview-content strong { font-weight: bold; }
                                        .preview-content em { font-style: italic; }
                                    `}</style>
                                    <div
                                        className="preview-content"
                                        dangerouslySetInnerHTML={{ __html: htmlContent }}
                                    />
                                </article>
                            ) : (
                                <div className="max-w-4xl mx-auto">
                                    <RichEditor
                                        content={htmlContent}
                                        onChange={setHtmlContent}
                                        placeholder="Start writing your content..."
                                    />
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right Sidebar */}
                    <div className="w-72 border-l bg-white flex flex-col shrink-0">
                        <div className="flex-1 overflow-y-auto p-4 space-y-4">
                            {/* Content Info */}
                            <div>
                                <h3 className="font-semibold mb-2 text-sm">Content Info</h3>
                                <div className="space-y-1 text-xs text-muted-foreground">
                                    <p>Status: <Badge variant="outline" className="ml-1">{content.status}</Badge></p>
                                    <p>Created: {new Date(content.createdAt).toLocaleDateString()}</p>
                                    <p>Words: {wordCount}</p>
                                </div>
                            </div>

                            {/* AI Refine */}
                            <div>
                                <h3 className="font-semibold mb-2 text-sm flex items-center gap-2">
                                    <Sparkles className="h-4 w-4" />
                                    Refine with AI
                                </h3>
                                <Textarea
                                    value={refineFeedback}
                                    onChange={(e) => setRefineFeedback(e.target.value)}
                                    placeholder="Describe changes..."
                                    className="h-16 text-sm resize-none"
                                />
                                <Button
                                    size="sm"
                                    className="mt-2 w-full"
                                    onClick={handleRefine}
                                    disabled={refining || !refineFeedback.trim()}
                                >
                                    {refining ? (
                                        <>
                                            <Clock className="h-4 w-4 mr-2 animate-spin" />
                                            Refining...
                                        </>
                                    ) : (
                                        <>
                                            <Sparkles className="h-4 w-4 mr-2" />
                                            Refine
                                        </>
                                    )}
                                </Button>
                            </div>

                            {/* Images Panel */}
                            {images.length > 0 && (
                                <div>
                                    <h3 className="font-semibold mb-2 text-sm flex items-center gap-2">
                                        <ImageIcon className="h-4 w-4" />
                                        Images ({images.length})
                                    </h3>
                                    <div className="space-y-2">
                                        {images.map((img) => (
                                            <div key={img.index} className="border rounded p-2 bg-slate-50">
                                                <img
                                                    src={img.src}
                                                    alt={img.alt}
                                                    className="w-full h-20 object-cover rounded mb-1"
                                                />
                                                <p className="text-[10px] text-muted-foreground truncate mb-1" title={img.alt}>
                                                    {img.alt}
                                                </p>
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="w-full text-xs h-7"
                                                    onClick={() => handleRegenerateImage(img.index, img.src)}
                                                    disabled={regeneratingImage === img.index}
                                                >
                                                    {regeneratingImage === img.index ? (
                                                        <RefreshCw className="h-3 w-3 animate-spin" />
                                                    ) : (
                                                        <>
                                                            <RefreshCw className="h-3 w-3 mr-1" />
                                                            Regenerate
                                                        </>
                                                    )}
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Original Brief */}
                            <div>
                                <h3 className="font-semibold mb-2 text-sm">Original Brief</h3>
                                <p className="text-xs text-muted-foreground bg-slate-50 p-2 rounded max-h-24 overflow-auto">
                                    {content.brief}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Inline Selection Improvement Popup */}
            {selectedText && selectionPosition && (
                <div
                    className="fixed z-[100] bg-white border rounded-lg shadow-xl p-3 w-72"
                    style={{
                        left: Math.max(16, Math.min(selectionPosition.x - 140, window.innerWidth - 300)),
                        top: Math.max(16, selectionPosition.y - 180)
                    }}
                >
                    <div className="text-xs text-muted-foreground mb-2 font-medium">
                        ✏️ Improve Selection
                    </div>
                    <div className="text-xs bg-slate-50 p-2 rounded mb-2 max-h-12 overflow-hidden">
                        "{selectedText.substring(0, 80)}{selectedText.length > 80 ? '...' : ''}"
                    </div>
                    <Textarea
                        value={improveFeedback}
                        onChange={(e) => setImproveFeedback(e.target.value)}
                        placeholder="How to improve?"
                        className="text-sm h-14 mb-2"
                    />
                    <div className="flex gap-2">
                        <Button
                            size="sm"
                            variant="outline"
                            className="flex-1"
                            onClick={() => {
                                setSelectedText('')
                                setSelectionPosition(null)
                                setImproveFeedback('')
                            }}
                        >
                            Cancel
                        </Button>
                        <Button
                            size="sm"
                            className="flex-1"
                            onClick={handleImproveSection}
                            disabled={improving || !improveFeedback.trim()}
                        >
                            {improving ? 'Working...' : 'Improve'}
                        </Button>
                    </div>
                </div>
            )}
        </>
    )
}
