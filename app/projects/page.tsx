"use client"

import { useState, useEffect, Suspense } from "react"
import Link from "next/link"
import { useSearchParams, useRouter } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
    Plus,
    MoreHorizontal,
    Pencil,
    Trash2,
    Globe,
    Link2,
} from "lucide-react"
import { toast } from "sonner"

interface Project {
    id: number
    name: string
    domain: string | null
    description: string | null
    createdAt: string
    _count: {
        urls: number
    }
}

function ProjectsContent() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const [projects, setProjects] = useState<Project[]>([])
    const [loading, setLoading] = useState(true)
    const [dialogOpen, setDialogOpen] = useState(searchParams.get('new') === 'true')
    const [editingProject, setEditingProject] = useState<Project | null>(null)
    const [formData, setFormData] = useState({
        name: '',
        domain: '',
        description: ''
    })
    const [saving, setSaving] = useState(false)

    useEffect(() => {
        fetchProjects()
    }, [])

    async function fetchProjects() {
        try {
            const res = await fetch('/api/seo/projects')
            if (res.ok) {
                const data = await res.json()
                setProjects(data)
            }
        } catch (error) {
            toast.error('Failed to load projects')
        } finally {
            setLoading(false)
        }
    }

    function openNewDialog() {
        setEditingProject(null)
        setFormData({ name: '', domain: '', description: '' })
        setDialogOpen(true)
    }

    function openEditDialog(project: Project) {
        setEditingProject(project)
        setFormData({
            name: project.name,
            domain: project.domain || '',
            description: project.description || ''
        })
        setDialogOpen(true)
    }

    async function handleSave() {
        if (!formData.name.trim()) {
            toast.error('Project name is required')
            return
        }

        setSaving(true)
        try {
            const url = editingProject
                ? `/api/seo/projects/${editingProject.id}`
                : '/api/seo/projects'

            const res = await fetch(url, {
                method: editingProject ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            })

            if (res.ok) {
                toast.success(editingProject ? 'Project updated' : 'Project created')
                setDialogOpen(false)
                fetchProjects()
            } else {
                const data = await res.json()
                toast.error(data.error || 'Failed to save project')
            }
        } catch (error) {
            toast.error('Failed to save project')
        } finally {
            setSaving(false)
        }
    }

    async function handleDelete(project: Project) {
        if (!confirm(`Delete "${project.name}"? This will also delete all URLs.`)) return

        try {
            const res = await fetch(`/api/seo/projects/${project.id}`, {
                method: 'DELETE'
            })

            if (res.ok) {
                toast.success('Project deleted')
                fetchProjects()
            } else {
                toast.error('Failed to delete project')
            }
        } catch (error) {
            toast.error('Failed to delete project')
        }
    }

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Projects</h1>
                    <p className="text-muted-foreground">
                        Manage your SEO projects and tools
                    </p>
                </div>
                <Button onClick={openNewDialog}>
                    <Plus className="mr-2 h-4 w-4" />
                    New Project
                </Button>
            </div>

            {/* Projects Table */}
            <Card>
                <CardContent className="p-0">
                    {loading ? (
                        <div className="p-8 text-center text-muted-foreground">
                            Loading projects...
                        </div>
                    ) : projects.length === 0 ? (
                        <div className="p-8 text-center">
                            <Globe className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                            <h3 className="font-medium mb-1">No projects yet</h3>
                            <p className="text-sm text-muted-foreground mb-4">
                                Create your first project to start using SEO tools
                            </p>
                            <Button onClick={openNewDialog}>
                                <Plus className="mr-2 h-4 w-4" />
                                Create Project
                            </Button>
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Name</TableHead>
                                    <TableHead>Domain</TableHead>
                                    <TableHead>URLs</TableHead>
                                    <TableHead>Created</TableHead>
                                    <TableHead className="w-[50px]"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {projects.map((project) => (
                                    <TableRow
                                        key={project.id}
                                        className="cursor-pointer hover:bg-muted/50"
                                        onClick={() => router.push(`/projects/${project.id}`)}
                                    >
                                        <TableCell>
                                            <div className="font-medium">{project.name}</div>
                                            {project.description && (
                                                <div className="text-sm text-muted-foreground truncate max-w-[300px]">
                                                    {project.description}
                                                </div>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            {project.domain ? (
                                                <Badge variant="outline">
                                                    <Globe className="h-3 w-3 mr-1" />
                                                    {project.domain}
                                                </Badge>
                                            ) : (
                                                <span className="text-muted-foreground">—</span>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="secondary">
                                                <Link2 className="h-3 w-3 mr-1" />
                                                {project._count.urls}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-muted-foreground">
                                            {new Date(project.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                                        </TableCell>
                                        <TableCell>
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                                    <Button variant="ghost" size="icon">
                                                        <MoreHorizontal className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuItem onClick={(e) => {
                                                        e.stopPropagation()
                                                        openEditDialog(project)
                                                    }}>
                                                        <Pencil className="h-4 w-4 mr-2" />
                                                        Edit
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem
                                                        className="text-destructive"
                                                        onClick={(e) => {
                                                            e.stopPropagation()
                                                            handleDelete(project)
                                                        }}
                                                    >
                                                        <Trash2 className="h-4 w-4 mr-2" />
                                                        Delete
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            {/* Create/Edit Dialog */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>
                            {editingProject ? 'Edit Project' : 'New Project'}
                        </DialogTitle>
                        <DialogDescription>
                            {editingProject
                                ? 'Update project details'
                                : 'Create a new project to organize your SEO tools'}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="name">Project Name *</Label>
                            <Input
                                id="name"
                                placeholder="e.g., Mehrana Agency"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="domain">Domain</Label>
                            <Input
                                id="domain"
                                placeholder="e.g., mehrana.agency"
                                value={formData.domain}
                                onChange={(e) => setFormData({ ...formData, domain: e.target.value })}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="description">Description</Label>
                            <Textarea
                                id="description"
                                placeholder="Optional notes about this project"
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDialogOpen(false)}>
                            Cancel
                        </Button>
                        <Button onClick={handleSave} disabled={saving}>
                            {saving ? 'Saving...' : editingProject ? 'Update' : 'Create'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}

export default function ProjectsPage() {
    return (
        <Suspense fallback={<div className="p-6">Loading...</div>}>
            <ProjectsContent />
        </Suspense>
    )
}
