"use client"

import { useState, useEffect, use } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
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
    ArrowLeft,
    Plus,
    Trash2,
    Play,
    Search,
    ExternalLink,
    CheckCircle2,
    XCircle,
    Link2,
} from "lucide-react"
import { toast } from "sonner"

interface Keyword {
    id: number
    keyword: string
    targetUrl: string
    pageTypes: string | null
    onlyFirst: boolean
    onlyFirstP: boolean
    isEnabled: boolean
    linksCreated: number
    _count?: { logs: number }
}

interface Log {
    id: number
    pageUrl: string
    pageTitle: string | null
    anchorId: string | null
    status: string
    message: string | null
    createdAt: string
    keyword: { keyword: string; targetUrl: string }
}

const PAGE_TYPES = [
    { value: 'blog', label: 'Blog' },
    { value: 'service', label: 'Service' },
    { value: 'product', label: 'Product' },
    { value: 'page', label: 'Page' },
    { value: 'category', label: 'Category' },
]

export default function LinkBuildingPage({ params }: { params: Promise<{ projectId: string }> }) {
    const { projectId } = use(params)
    const [keywords, setKeywords] = useState<Keyword[]>([])
    const [logs, setLogs] = useState<Log[]>([])
    const [loading, setLoading] = useState(true)
    const [project, setProject] = useState<{ name: string; domain: string | null } | null>(null)

    // New keyword form
    const [newKeyword, setNewKeyword] = useState('')
    const [newUrl, setNewUrl] = useState('')
    const [newPageTypes, setNewPageTypes] = useState<string[]>(['blog'])

    useEffect(() => {
        fetchData()
    }, [projectId])

    async function fetchData() {
        setLoading(true)
        try {
            // Fetch project info
            const projectRes = await fetch(`/api/seo/projects/${projectId}`)
            if (projectRes.ok) {
                const data = await projectRes.json()
                setProject(data)
            }

            // Fetch keywords
            const kwRes = await fetch(`/api/seo/link-building/keywords?projectId=${projectId}`)
            if (kwRes.ok) {
                const data = await kwRes.json()
                setKeywords(data.keywords || [])
            }

            // Fetch recent logs
            const logsRes = await fetch(`/api/seo/link-building/logs?projectId=${projectId}&limit=20`)
            if (logsRes.ok) {
                const data = await logsRes.json()
                setLogs(data.logs || [])
            }
        } catch (e) {
            toast.error('Failed to load data')
        }
        setLoading(false)
    }

    async function addKeyword() {
        if (!newKeyword.trim() || !newUrl.trim()) {
            toast.error('Keyword and URL required')
            return
        }

        try {
            const res = await fetch('/api/seo/link-building/keywords', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectId: parseInt(projectId),
                    keyword: newKeyword.trim(),
                    targetUrl: newUrl.trim(),
                    pageTypes: newPageTypes
                })
            })

            if (res.ok) {
                toast.success('Keyword added')
                setNewKeyword('')
                setNewUrl('')
                fetchData()
            } else {
                const err = await res.json()
                toast.error(err.error || 'Failed to add keyword')
            }
        } catch (e) {
            toast.error('Failed to add keyword')
        }
    }

    async function toggleKeyword(id: number, enabled: boolean) {
        try {
            await fetch(`/api/seo/link-building/keywords/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ isEnabled: enabled })
            })
            setKeywords(keywords.map(k => k.id === id ? { ...k, isEnabled: enabled } : k))
        } catch (e) {
            toast.error('Failed to update')
        }
    }

    async function deleteKeyword(id: number) {
        if (!confirm('Delete this keyword?')) return

        try {
            await fetch(`/api/seo/link-building/keywords/${id}`, { method: 'DELETE' })
            setKeywords(keywords.filter(k => k.id !== id))
            toast.success('Keyword deleted')
        } catch (e) {
            toast.error('Failed to delete')
        }
    }

    if (loading) {
        return <div className="p-6 text-center text-slate-500">Loading...</div>
    }

    return (
        <div className="p-6 max-w-6xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Link href="/projects">
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                    </Link>
                    <div>
                        <h1 className="text-xl font-semibold">{project?.name} - Link Building</h1>
                        <p className="text-sm text-slate-500">{project?.domain}</p>
                    </div>
                </div>
                <Button disabled className="gap-2">
                    <Play className="h-4 w-4" /> Run All
                </Button>
            </div>

            {/* Add Keyword */}
            <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-lg border">
                <Input
                    placeholder="کلمه کلیدی"
                    value={newKeyword}
                    onChange={e => setNewKeyword(e.target.value)}
                    className="flex-1 h-9 bg-white"
                />
                <Input
                    placeholder="/target-url"
                    value={newUrl}
                    onChange={e => setNewUrl(e.target.value)}
                    className="flex-1 h-9 bg-white"
                />
                <Select
                    value={newPageTypes[0]}
                    onValueChange={v => setNewPageTypes([v])}
                >
                    <SelectTrigger className="w-32 h-9 bg-white">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {PAGE_TYPES.map(pt => (
                            <SelectItem key={pt.value} value={pt.value}>{pt.label}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <Button size="sm" onClick={addKeyword} className="h-9 px-4">
                    <Plus className="h-4 w-4 mr-1" /> Add
                </Button>
            </div>

            {/* Keywords Table */}
            <div className="border rounded-lg overflow-hidden bg-white">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-slate-50">
                            <TableHead className="w-[200px]">Keyword</TableHead>
                            <TableHead>Target URL</TableHead>
                            <TableHead className="w-[100px]">Pages</TableHead>
                            <TableHead className="w-[80px] text-center">Links</TableHead>
                            <TableHead className="w-[60px] text-center">Active</TableHead>
                            <TableHead className="w-[50px]"></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {keywords.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center text-slate-400 py-8">
                                    No keywords yet. Add your first one above.
                                </TableCell>
                            </TableRow>
                        ) : (
                            keywords.map(kw => {
                                const pageTypes = kw.pageTypes ? JSON.parse(kw.pageTypes) : []
                                return (
                                    <TableRow key={kw.id} className={!kw.isEnabled ? 'opacity-50' : ''}>
                                        <TableCell className="font-medium">{kw.keyword}</TableCell>
                                        <TableCell className="text-sm text-slate-600">
                                            <a href={kw.targetUrl} target="_blank" rel="noopener noreferrer" className="hover:underline flex items-center gap-1">
                                                {kw.targetUrl}
                                                <ExternalLink className="h-3 w-3" />
                                            </a>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex gap-1 flex-wrap">
                                                {pageTypes.map((pt: string) => (
                                                    <Badge key={pt} variant="outline" className="text-xs">{pt}</Badge>
                                                ))}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <Badge variant="secondary">{kw.linksCreated}</Badge>
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <Switch
                                                checked={kw.isEnabled}
                                                onCheckedChange={v => toggleKeyword(kw.id, v)}
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-slate-400 hover:text-red-500"
                                                onClick={() => deleteKeyword(kw.id)}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                )
                            })
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* Recent Logs */}
            {logs.length > 0 && (
                <div className="space-y-2">
                    <h3 className="text-sm font-medium text-slate-500">Recent Activity</h3>
                    <div className="space-y-1">
                        {logs.map(log => (
                            <div key={log.id} className="flex items-center gap-2 text-sm py-1.5 px-2 rounded hover:bg-slate-50">
                                {log.status === 'linked' ? (
                                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                                ) : (
                                    <XCircle className="h-4 w-4 text-slate-400" />
                                )}
                                <a
                                    href={`${log.pageUrl}${log.anchorId ? '#' + log.anchorId : ''}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-600 hover:underline flex-1 truncate"
                                >
                                    {log.pageUrl}{log.anchorId && `#${log.anchorId}`}
                                </a>
                                <span className="text-slate-400">"{log.keyword.keyword}"</span>
                                <span className="text-xs text-slate-300">
                                    {new Date(log.createdAt).toLocaleTimeString()}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}
