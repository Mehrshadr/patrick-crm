"use client"

import { useState, useEffect, use } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import {
    Plus,
    MoreHorizontal,
    Trash2,
    FileText,
    Sparkles,
    CheckCircle2,
    Clock,
    AlertCircle,
    Pencil,
    Eye,
    Settings,
    FileUp,
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
    useGuidelines: boolean
    useAiRules: boolean
    createdAt: string
    updatedAt: string
}

interface Project {
    id: number
    name: string
    domain: string | null
    description: string | null
}

interface ProjectSettings {
    brandStatement: string | null
}

const statusConfig: Record<string, { label: string; icon: React.ElementType; color: string }> = {
    'DRAFT': { label: 'Draft', icon: FileText, color: 'bg-slate-100 text-slate-700' },
    'GENERATING': { label: 'Generating text...', icon: Clock, color: 'bg-blue-100 text-blue-700' },
    'GENERATING_IMAGES': { label: 'Generating images...', icon: Sparkles, color: 'bg-purple-100 text-purple-700' },
    'DONE': { label: 'Completed', icon: CheckCircle2, color: 'bg-green-100 text-green-700' },
    'ERROR': { label: 'Error', icon: AlertCircle, color: 'bg-red-100 text-red-700' },
}

const contentTypes = [
    { id: 'BLOG_POST', name: 'Blog Post', icon: '📝' },
    { id: 'SERVICE_PAGE', name: 'Service Page', icon: '🏢' },
]

export default function ContentFactoryPage({ params }: { params: Promise<{ projectId: string }> }) {
    const { projectId } = use(params)
    const router = useRouter()
    const [project, setProject] = useState<Project | null>(null)
    const [contents, setContents] = useState<GeneratedContent[]>([])
    const [loading, setLoading] = useState(true)

    // Dialogs
    const [createDialogOpen, setCreateDialogOpen] = useState(false)
    const [settingsDialogOpen, setSettingsDialogOpen] = useState(false)
    const [viewDialogOpen, setViewDialogOpen] = useState(false)
    const [selectedContent, setSelectedContent] = useState<GeneratedContent | null>(null)

    // Create form
    const [formData, setFormData] = useState({
        title: '',
        contentType: 'BLOG_POST',
        brief: '',
        useGuidelines: true,
        useAiRules: true,
    })
    const [generating, setGenerating] = useState(false)

    // Settings
    const [brandStatement, setBrandStatement] = useState('')
    const [savingSettings, setSavingSettings] = useState(false)

    // Refinement
    const [refineFeedback, setRefineFeedback] = useState('')
    const [refining, setRefining] = useState(false)

    // Export
    const [exporting, setExporting] = useState(false)

    useEffect(() => {
        fetchProjectData()
    }, [projectId])

    async function fetchProjectData() {
        try {
            // Fetch project info
            const projectRes = await fetch(`/api/seo/projects/${projectId}`)
            if (!projectRes.ok) {
                toast.error('Project not found')
                router.push('/projects')
                return
            }
            setProject(await projectRes.json())

            // Fetch contents
            const contentsRes = await fetch(`/api/seo/content/${projectId}`)
            if (contentsRes.ok) {
                setContents(await contentsRes.json())
            }

            // Fetch project settings
            const settingsRes = await fetch(`/api/seo/projects/${projectId}/settings`)
            if (settingsRes.ok) {
                const settings = await settingsRes.json()
                setBrandStatement(settings.brandStatement || '')
            }
        } catch (error) {
            toast.error('Failed to load project')
        } finally {
            setLoading(false)
        }
    }

    async function handleCreateContent() {
        if (!formData.brief.trim()) {
            toast.error('Please enter a brief')
            return
        }

        setGenerating(true)
        try {
            const res = await fetch(`/api/seo/content/${projectId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            })

            if (res.ok) {
                const content = await res.json()
                toast.success('Content created! Generating...')
                setCreateDialogOpen(false)
                setFormData({ title: '', contentType: 'BLOG_POST', brief: '', useGuidelines: true, useAiRules: true })
                fetchProjectData()

                // If content was created, start generation
                if (content.id) {
                    generateContent(content.id)
                }
            } else {
                const data = await res.json()
                toast.error(data.error || 'Failed to create content')
            }
        } catch (error) {
            toast.error('Failed to create content')
        } finally {
            setGenerating(false)
        }
    }

    async function generateContent(contentId: number) {
        try {
            const res = await fetch(`/api/seo/content/${projectId}/${contentId}/generate`, {
                method: 'POST'
            })

            if (res.ok) {
                toast.success('Content generated successfully!')
                fetchProjectData()
            } else {
                const data = await res.json()
                toast.error(data.error || 'Generation failed')
                fetchProjectData()
            }
        } catch (error) {
            toast.error('Generation failed')
            fetchProjectData()
        }
    }

    async function handleSaveSettings() {
        setSavingSettings(true)
        try {
            const res = await fetch(`/api/seo/projects/${projectId}/settings`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ brandStatement })
            })

            if (res.ok) {
                toast.success('Settings saved!')
                setSettingsDialogOpen(false)
            } else {
                toast.error('Failed to save settings')
            }
        } catch (error) {
            toast.error('Failed to save settings')
        } finally {
            setSavingSettings(false)
        }
    }

    async function handleDeleteContent(contentId: number) {
        if (!confirm('Delete this content?')) return

        try {
            const res = await fetch(`/api/seo/content/${projectId}/${contentId}`, {
                method: 'DELETE'
            })

            if (res.ok) {
                toast.success('Content deleted')
                fetchProjectData()
            } else {
                toast.error('Failed to delete')
            }
        } catch (error) {
            toast.error('Failed to delete')
        }
    }

    function openViewDialog(content: GeneratedContent) {
        setSelectedContent(content)
        setRefineFeedback('')
        setViewDialogOpen(true)
    }

    async function handleRefineContent(contentId: number) {
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
                toast.success('Content refined!')
                setRefineFeedback('')
                // Update selectedContent and contents list
                setSelectedContent(updated)
                setContents(prev => prev.map(c => c.id === updated.id ? updated : c))
            } else {
                const data = await res.json()
                toast.error(data.error || 'Refinement failed')
            }
        } catch (error) {
            toast.error('Refinement failed')
        } finally {
            setRefining(false)
        }
    }

    function handleCopyContent(content: GeneratedContent) {
        if (content.content) {
            navigator.clipboard.writeText(content.content)
            toast.success('HTML copied to clipboard!')
        }
    }

    async function handleExportToDocs(content: GeneratedContent) {
        setExporting(true)
        try {
            const res = await fetch(`/api/seo/content/${projectId}/${content.id}/export-gdocs`, {
                method: 'POST'
            })

            const data = await res.json()

            if (res.ok) {
                toast.success('Exported to Google Docs!')
                // Open the document in a new tab
                window.open(data.url, '_blank')
            } else {
                if (data.error?.includes('not connected')) {
                    toast.error('Google Docs not connected. Please connect in Settings first.')
                } else {
                    toast.error(data.error || 'Export failed')
                }
            }
        } catch (error) {
            toast.error('Export failed')
        } finally {
            setExporting(false)
        }
    }

    if (loading) {
        return (
            <div className="p-6 h-full flex items-center justify-center">
                <div className="animate-pulse">Loading...</div>
            </div>
        )
    }

    if (!project) return null

    return (
        <div className="h-full flex flex-col overflow-hidden">
            {/* Header */}
            <div className="shrink-0 p-4 border-b">
                <div className="flex items-center justify-between">
                    <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Link href="/projects" className="hover:text-foreground">
                                Projects
                            </Link>
                            <span>/</span>
                            <span className="text-foreground font-medium">{project.name}</span>
                            <span>/</span>
                            <span className="text-foreground font-medium">Content Factory</span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                            {project.domain || 'No domain'} · {contents.length} contents
                        </p>
                    </div>
                    <div className="flex gap-2 items-center">
                        <Button variant="outline" size="sm" onClick={() => setSettingsDialogOpen(true)}>
                            <Settings className="mr-1 h-3 w-3" />
                            Settings
                        </Button>
                        <Button size="sm" onClick={() => setCreateDialogOpen(true)}>
                            <Plus className="mr-1 h-3 w-3" />
                            New Content
                        </Button>
                    </div>
                </div>
            </div>

            {/* Content List */}
            <div className="flex-1 overflow-hidden p-4">
                {contents.length === 0 ? (
                    <div className="h-full flex items-center justify-center">
                        <div className="text-center">
                            <Sparkles className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                            <h3 className="font-medium mb-2">No content yet</h3>
                            <p className="text-sm text-muted-foreground mb-4">
                                Create your first AI-generated content
                            </p>
                            <Button onClick={() => setCreateDialogOpen(true)}>
                                <Plus className="mr-2 h-4 w-4" />
                                Create Content
                            </Button>
                        </div>
                    </div>
                ) : (
                    <ScrollArea className="h-full">
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                            {contents.map(content => {
                                const config = statusConfig[content.status] || statusConfig['DRAFT']
                                const StatusIcon = config.icon
                                const typeInfo = contentTypes.find(t => t.id === content.contentType)

                                return (
                                    <Card key={content.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => openViewDialog(content)}>
                                        <CardHeader className="pb-2">
                                            <div className="flex items-start justify-between">
                                                <Badge variant="outline" className="text-xs">
                                                    {typeInfo?.icon} {typeInfo?.name || content.contentType}
                                                </Badge>
                                                <Badge className={config.color}>
                                                    <StatusIcon className="h-3 w-3 mr-1" />
                                                    {config.label}
                                                </Badge>
                                            </div>
                                            <CardTitle className="text-lg line-clamp-1">
                                                {content.title || 'Untitled'}
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                                                {content.brief}
                                            </p>
                                            <div className="flex items-center justify-between text-xs text-muted-foreground">
                                                <span>
                                                    {new Date(content.createdAt).toLocaleDateString()}
                                                </span>
                                                <div className="flex gap-1">
                                                    {content.useGuidelines && <Badge variant="outline" className="text-[10px]">Guidelines</Badge>}
                                                    {content.useAiRules && <Badge variant="outline" className="text-[10px]">AI Rules</Badge>}
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                )
                            })}
                        </div>
                    </ScrollArea>
                )}
            </div>

            {/* Create Content Dialog */}
            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
                <DialogContent className="sm:max-w-[600px]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Sparkles className="h-5 w-5" />
                            Create New Content
                        </DialogTitle>
                        <DialogDescription>
                            Enter a brief and let AI generate content for you
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Content Type</Label>
                                <Select value={formData.contentType} onValueChange={v => setFormData({ ...formData, contentType: v })}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {contentTypes.map(type => (
                                            <SelectItem key={type.id} value={type.id}>
                                                {type.icon} {type.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Title (optional)</Label>
                                <Input
                                    value={formData.title}
                                    onChange={e => setFormData({ ...formData, title: e.target.value })}
                                    placeholder="AI will generate if empty"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>Brief / Prompt *</Label>
                            <Textarea
                                value={formData.brief}
                                onChange={e => setFormData({ ...formData, brief: e.target.value })}
                                placeholder="Describe what you want the AI to write about..."
                                className="h-[150px]"
                            />
                        </div>

                        <div className="flex gap-4">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <Checkbox
                                    checked={formData.useGuidelines}
                                    onCheckedChange={c => setFormData({ ...formData, useGuidelines: !!c })}
                                />
                                <span className="text-sm">Use Content Guidelines</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <Checkbox
                                    checked={formData.useAiRules}
                                    onCheckedChange={c => setFormData({ ...formData, useAiRules: !!c })}
                                />
                                <span className="text-sm">Apply AI Rules</span>
                            </label>
                        </div>

                        {!brandStatement && (
                            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-700">
                                ⚠️ No Brand Statement set. <button className="underline" onClick={() => { setCreateDialogOpen(false); setSettingsDialogOpen(true) }}>Add one in Settings</button> for better results.
                            </div>
                        )}
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                            Cancel
                        </Button>
                        <Button onClick={handleCreateContent} disabled={generating}>
                            <Sparkles className="mr-2 h-4 w-4" />
                            {generating ? 'Creating...' : 'Generate Content'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Settings Dialog */}
            <Dialog open={settingsDialogOpen} onOpenChange={setSettingsDialogOpen}>
                <DialogContent className="sm:max-w-[600px]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Settings className="h-5 w-5" />
                            Project Settings
                        </DialogTitle>
                        <DialogDescription>
                            Configure settings for {project.name}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label className="flex items-center gap-2">
                                <FileText className="h-4 w-4" />
                                Brand Statement
                            </Label>
                            <p className="text-sm text-muted-foreground">
                                Information about your brand that AI should incorporate into content
                            </p>
                            <Textarea
                                value={brandStatement}
                                onChange={e => setBrandStatement(e.target.value)}
                                placeholder="E.g., We are a digital marketing agency focused on SEO and automation..."
                                className="h-[200px]"
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setSettingsDialogOpen(false)}>
                            Cancel
                        </Button>
                        <Button onClick={handleSaveSettings} disabled={savingSettings}>
                            {savingSettings ? 'Saving...' : 'Save Settings'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* View Content Dialog */}
            <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
                <DialogContent className="sm:max-w-[900px] max-h-[90vh] flex flex-col">
                    <DialogHeader className="shrink-0">
                        <DialogTitle className="text-xl">{selectedContent?.title || 'Generated Content'}</DialogTitle>
                        <DialogDescription className="flex items-center gap-3 flex-wrap">
                            <span>{contentTypes.find(t => t.id === selectedContent?.contentType)?.name}</span>
                            <span className="text-xs">•</span>
                            <span className="text-xs">
                                {selectedContent?.content ?
                                    `${selectedContent.content.replace(/<[^>]*>/g, ' ').split(/\s+/).filter(Boolean).length} words`
                                    : '0 words'}
                            </span>
                            {selectedContent?.useGuidelines && (
                                <Badge variant="outline" className="text-xs bg-blue-50">✓ Guidelines</Badge>
                            )}
                            {selectedContent?.useAiRules && (
                                <Badge variant="outline" className="text-xs bg-purple-50">✓ AI Rules</Badge>
                            )}
                            {brandStatement && (
                                <Badge variant="outline" className="text-xs bg-green-50">✓ Brand</Badge>
                            )}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex-1 overflow-hidden flex flex-col gap-4 min-h-0">
                        <ScrollArea className="h-[350px] border rounded-lg p-4 bg-white">
                            {selectedContent?.status === 'GENERATING' ? (
                                <div className="flex items-center justify-center h-full py-12">
                                    <div className="text-center">
                                        <Clock className="h-8 w-8 mx-auto mb-2 animate-spin text-blue-500" />
                                        <p>Generating content...</p>
                                    </div>
                                </div>
                            ) : selectedContent?.content ? (
                                <article
                                    className="content-article max-w-none"
                                    dangerouslySetInnerHTML={{ __html: selectedContent.content }}
                                />
                            ) : (
                                <div className="text-center text-muted-foreground py-8">
                                    No content generated yet
                                </div>
                            )}
                        </ScrollArea>

                        {/* View Prompt Section (Collapsible) */}
                        {selectedContent?.llmPrompt && (
                            <details className="shrink-0 border rounded-lg">
                                <summary className="px-4 py-2 cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground bg-slate-50 rounded-t-lg">
                                    🔍 View Prompt Sent to AI
                                </summary>
                                <div className="p-4 max-h-[200px] overflow-auto bg-slate-50 rounded-b-lg">
                                    <pre className="text-xs whitespace-pre-wrap font-mono text-slate-700">
                                        {selectedContent.llmPrompt}
                                    </pre>
                                </div>
                            </details>
                        )}

                        {/* Chat Refinement Section */}
                        {selectedContent?.status === 'DONE' && selectedContent?.content && (
                            <div className="shrink-0 space-y-2">
                                <Label className="text-sm flex items-center gap-2">
                                    <Pencil className="h-3 w-3" />
                                    Refine Content
                                </Label>
                                <div className="flex gap-2">
                                    <Textarea
                                        value={refineFeedback}
                                        onChange={(e) => setRefineFeedback(e.target.value)}
                                        placeholder="Enter your feedback to refine this content... e.g., 'Make the introduction more engaging' or 'Add more details about maintenance tips'"
                                        className="flex-1 h-[60px] resize-none"
                                    />
                                    <Button
                                        className="shrink-0"
                                        onClick={() => handleRefineContent(selectedContent.id)}
                                        disabled={refining || !refineFeedback.trim()}
                                    >
                                        {refining ? (
                                            <>
                                                <Clock className="mr-2 h-4 w-4 animate-spin" />
                                                Refining...
                                            </>
                                        ) : (
                                            <>
                                                <Sparkles className="mr-2 h-4 w-4" />
                                                Refine
                                            </>
                                        )}
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>

                    <DialogFooter className="shrink-0">
                        <Button variant="destructive" size="sm" onClick={() => { setViewDialogOpen(false); handleDeleteContent(selectedContent?.id || 0) }}>
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                        </Button>
                        <Button variant="outline" onClick={() => setViewDialogOpen(false)}>
                            Close
                        </Button>
                        {selectedContent?.status === 'DONE' && (
                            <Button onClick={() => handleCopyContent(selectedContent)}>
                                Copy HTML
                            </Button>
                        )}
                        {selectedContent?.status === 'DONE' && (
                            <Button
                                variant="outline"
                                onClick={() => handleExportToDocs(selectedContent)}
                                disabled={exporting}
                            >
                                <FileUp className="mr-2 h-4 w-4" />
                                {exporting ? 'Exporting...' : 'Export to Docs'}
                            </Button>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* CSS for content article */}
            <style jsx global>{`
                .content-article h1 { font-size: 2rem; font-weight: 700; margin: 1.5rem 0 1rem; line-height: 1.2; }
                .content-article h2 { font-size: 1.5rem; font-weight: 600; margin: 1.5rem 0 0.75rem; line-height: 1.3; color: #1a1a1a; }
                .content-article h3 { font-size: 1.25rem; font-weight: 600; margin: 1.25rem 0 0.5rem; line-height: 1.4; color: #333; }
                .content-article h4 { font-size: 1.1rem; font-weight: 600; margin: 1rem 0 0.5rem; }
                .content-article p { margin: 0.75rem 0; line-height: 1.7; color: #374151; }
                .content-article ul, .content-article ol { margin: 0.75rem 0; padding-left: 1.5rem; }
                .content-article li { margin: 0.25rem 0; line-height: 1.6; }
                .content-article strong { font-weight: 600; color: #1a1a1a; }
                .content-article em { font-style: italic; }
                .content-article blockquote { border-left: 3px solid #e5e7eb; padding-left: 1rem; margin: 1rem 0; font-style: italic; color: #6b7280; }
                .content-article a { color: #2563eb; text-decoration: underline; }
                .content-article code { background: #f3f4f6; padding: 0.125rem 0.25rem; border-radius: 0.25rem; font-size: 0.875em; }
                .content-article pre { background: #f3f4f6; padding: 1rem; border-radius: 0.5rem; overflow-x: auto; }
                .content-article .content-image { margin: 1.5rem 0; }
                .content-article .content-image img { width: 100%; border-radius: 0.5rem; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
                .content-article .content-image figcaption { text-align: center; font-size: 0.875rem; color: #6b7280; margin-top: 0.5rem; font-style: italic; }
            `}</style>
        </div>
    )
}
