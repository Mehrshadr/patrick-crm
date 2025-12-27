"use client"

import { useState, useEffect, use } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import { RichEditor } from "@/components/editor/rich-editor"
import {
    ArrowLeft,
    Save,
    Eye,
    Sparkles,
    Clock,
    CheckCircle2,
    Copy,
    FileUp,
    Trash2
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

export default function ContentEditorPage({
    params
}: {
    params: Promise<{ projectId: string; contentId: string }>
}) {
    const { projectId, contentId } = use(params)
    const router = useRouter()

    const [content, setContent] = useState<GeneratedContent | null>(null)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [previewMode, setPreviewMode] = useState(false)

    // Editable fields
    const [title, setTitle] = useState('')
    const [htmlContent, setHtmlContent] = useState('')
    const [refineFeedback, setRefineFeedback] = useState('')
    const [refining, setRefining] = useState(false)

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
        <div className="h-screen flex flex-col bg-slate-50">
            {/* Top Bar */}
            <header className="shrink-0 h-14 border-b bg-white flex items-center justify-between px-4">
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
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setPreviewMode(!previewMode)}>
                        <Eye className="h-4 w-4 mr-2" />
                        {previewMode ? 'Edit' : 'Preview'}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={handleCopy}>
                        <Copy className="h-4 w-4 mr-2" />
                        Copy HTML
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
            <div className="flex-1 flex overflow-hidden">
                {/* Editor Area */}
                <div className="flex-1 flex flex-col">
                    {/* Title */}
                    <div className="p-4 bg-white border-b">
                        <Input
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="Enter title..."
                            className="text-2xl font-bold border-0 p-0 focus-visible:ring-0 bg-transparent"
                        />
                    </div>

                    {/* Content */}
                    <ScrollArea className="flex-1 p-4">
                        {previewMode ? (
                            <article
                                className="prose prose-lg max-w-4xl mx-auto bg-white p-8 rounded-lg shadow"
                                dangerouslySetInnerHTML={{ __html: htmlContent }}
                            />
                        ) : (
                            <div className="max-w-4xl mx-auto">
                                <RichEditor
                                    content={htmlContent}
                                    onChange={setHtmlContent}
                                    placeholder="Start writing your content..."
                                />
                            </div>
                        )}
                    </ScrollArea>
                </div>

                {/* Right Sidebar */}
                <div className="w-80 border-l bg-white p-4 flex flex-col gap-4">
                    <div>
                        <h3 className="font-semibold mb-2 text-sm">Content Info</h3>
                        <div className="space-y-1 text-xs text-muted-foreground">
                            <p>Status: <Badge variant="outline" className="ml-1">{content.status}</Badge></p>
                            <p>Created: {new Date(content.createdAt).toLocaleDateString()}</p>
                            <p>Words: {wordCount}</p>
                        </div>
                    </div>

                    <div className="flex-1">
                        <h3 className="font-semibold mb-2 text-sm flex items-center gap-2">
                            <Sparkles className="h-4 w-4" />
                            Refine with AI
                        </h3>
                        <Textarea
                            value={refineFeedback}
                            onChange={(e) => setRefineFeedback(e.target.value)}
                            placeholder="Describe what you want to change..."
                            className="h-24 text-sm resize-none"
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
                                    Refine Content
                                </>
                            )}
                        </Button>
                    </div>

                    {/* Original Brief */}
                    <div className="shrink-0">
                        <h3 className="font-semibold mb-2 text-sm">Original Brief</h3>
                        <p className="text-xs text-muted-foreground bg-slate-50 p-2 rounded max-h-32 overflow-auto">
                            {content.brief}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
}
