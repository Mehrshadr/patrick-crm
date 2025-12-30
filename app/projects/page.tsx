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
    GripVertical,
    ListFilter,
    ShoppingCart,
} from "lucide-react"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
    useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useUserAccess } from "@/lib/user-access"

interface Project {
    id: number
    name: string
    slug: string
    domain: string | null
    description: string | null
    platform: string | null
    createdAt: string
    _count: {
        urls: number
    }
}

// Sortable Row Component
function SortableRow({
    project,
    onEdit,
    onDelete,
    isSuperAdmin
}: {
    project: Project;
    onEdit: () => void;
    onDelete: () => void;
    isSuperAdmin: boolean;
}) {
    const router = useRouter()
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: project.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 1 : 0,
        opacity: isDragging ? 0.5 : 1,
        position: 'relative' as 'relative',
    };

    return (
        <TableRow
            ref={setNodeRef}
            style={style}
            className="hover:bg-muted/50 transition-colors"
        >
            {/* Drag Handle */}
            <TableCell className="w-[30px] p-0 pl-2">
                {isSuperAdmin && (
                    <button
                        {...attributes}
                        {...listeners}
                        className="p-1 hover:bg-slate-200 rounded cursor-grab active:cursor-grabbing text-muted-foreground"
                        onPointerDown={(e) => {
                            listeners?.onPointerDown?.(e);
                            e.stopPropagation();
                        }}
                    >
                        <GripVertical className="h-4 w-4" />
                    </button>
                )}
            </TableCell>

            {/* Clickable Area for Navigation */}
            <TableCell
                className="cursor-pointer"
                onClick={() => router.push(`/projects/${project.slug}`)}
            >
                <div className="font-medium">{project.name}</div>
                {project.description && (
                    <div className="text-sm text-muted-foreground truncate max-w-[300px]">
                        {project.description}
                    </div>
                )}
            </TableCell>
            <TableCell
                className="cursor-pointer"
                onClick={() => router.push(`/projects/${project.slug}`)}
            >
                {project.domain ? (
                    <div className="flex items-center gap-2">
                        {project.platform === 'wordpress' && (
                            <div className="h-6 w-6 bg-[#21759b] text-white rounded-full p-1 shrink-0 flex items-center justify-center" title="WordPress">
                                <span className="font-bold text-[10px]">W</span>
                            </div>
                        )}
                        {project.platform === 'shopify' && (
                            <div className="h-6 w-6 bg-[#95BF47] text-white rounded-full p-1 shrink-0 flex items-center justify-center" title="Shopify">
                                <ShoppingCart className="h-3 w-3" />
                            </div>
                        )}
                        {(project.platform === 'custom' || !project.platform) && (
                            <Globe className="h-4 w-4 text-muted-foreground mr-1" />
                        )}
                        <Badge variant="outline" className="font-normal">
                            {project.domain}
                        </Badge>
                    </div>
                ) : (
                    <span className="text-muted-foreground">—</span>
                )}
            </TableCell>
            <TableCell
                className="cursor-pointer"
                onClick={() => router.push(`/projects/${project.slug}`)}
            >
                <Badge variant="secondary">
                    <Link2 className="h-3 w-3 mr-1" />
                    {project._count.urls}
                </Badge>
            </TableCell>
            <TableCell className="text-muted-foreground cursor-pointer" onClick={() => router.push(`/projects/${project.slug}`)}>
                {new Date(project.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
            </TableCell>

            {/* Actions */}
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
                            onEdit()
                        }}>
                            <Pencil className="h-4 w-4 mr-2" />
                            Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                            className="text-destructive"
                            onClick={(e) => {
                                e.stopPropagation()
                                onDelete()
                            }}
                        >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </TableCell>
        </TableRow>
    );
}

function ProjectsContent() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const userAccess = useUserAccess()
    const isSuperAdmin = userAccess.role === 'SUPER_ADMIN'
    const [projects, setProjects] = useState<Project[]>([])
    const [loading, setLoading] = useState(true)
    const [dialogOpen, setDialogOpen] = useState(searchParams.get('new') === 'true')
    const [editingProject, setEditingProject] = useState<Project | null>(null)
    const [formData, setFormData] = useState({
        name: '',
        domain: '',
        description: '',
        platform: 'wordpress'
    })
    const [saving, setSaving] = useState(false)
    const [filterPlatform, setFilterPlatform] = useState<string>('all')

    const filteredProjects = projects.filter(p => {
        if (filterPlatform === 'all') return true
        return p.platform === filterPlatform
    })

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
        setFormData({ name: '', domain: '', description: '', platform: 'wordpress' })
        setDialogOpen(true)
    }

    function openEditDialog(project: Project) {
        setEditingProject(project)
        setFormData({
            name: project.name,
            domain: project.domain || '',
            description: project.description || '',
            platform: project.platform || 'wordpress'
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

    // Drag & Drop Sensors
    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    async function handleDragEnd(event: DragEndEvent) {
        const { active, over } = event;

        if (active.id !== over?.id) {
            setProjects((items) => {
                const oldIndex = items.findIndex((i) => i.id === active.id);
                const newIndex = items.findIndex((i) => i.id === over?.id);
                const newItems = arrayMove(items, oldIndex, newIndex);

                // Save new order
                saveOrder(newItems);

                return newItems;
            });
        }
    }

    async function saveOrder(items: Project[]) {
        try {
            const orderedIds = items.map(p => p.id)
            await fetch('/api/seo/projects/reorder', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ orderedIds })
            })
            // Passively update - no toast needed for reorder
            window.dispatchEvent(new Event('project-update'))
        } catch (error) {
            console.error('Failed to save order', error)
            toast.error('Failed to save order')
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
                <div className="flex items-center gap-3">
                    <Select value={filterPlatform} onValueChange={setFilterPlatform}>
                        <SelectTrigger className="w-[180px]">
                            <ListFilter className="w-4 h-4 mr-2" />
                            <SelectValue placeholder="Filter Platform" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Platforms</SelectItem>
                            <SelectItem value="wordpress">WordPress</SelectItem>
                            <SelectItem value="shopify">Shopify</SelectItem>
                            <SelectItem value="custom">Custom/Other</SelectItem>
                        </SelectContent>
                    </Select>

                    <Button onClick={openNewDialog}>
                        <Plus className="mr-2 h-4 w-4" />
                        New Project
                    </Button>
                </div>
            </div>

            {/* Projects Sortable List */}
            <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
            >
                <Card>
                    <CardContent className="p-0">
                        {loading ? (
                            <div className="p-8 text-center text-muted-foreground">
                                Loading projects...
                            </div>
                        ) : filteredProjects.length === 0 ? (
                            <div className="p-8 text-center">
                                <Globe className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                                <h3 className="font-medium mb-1">No projects found</h3>
                                <p className="text-sm text-muted-foreground mb-4">
                                    Try adjusting your filters or create a new project
                                </p>
                                <Button onClick={openNewDialog}>
                                    <Plus className="mr-2 h-4 w-4" />
                                    Create Project
                                </Button>
                            </div>
                        ) : (
                            <SortableContext
                                items={filteredProjects.map(p => p.id)}
                                strategy={verticalListSortingStrategy}
                            >
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="w-[30px]"></TableHead>
                                            <TableHead>Name</TableHead>
                                            <TableHead>Platform & Domain</TableHead>
                                            <TableHead>URLs</TableHead>
                                            <TableHead>Created</TableHead>
                                            <TableHead className="w-[50px]"></TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredProjects.map((project) => (
                                            <SortableRow
                                                key={project.id}
                                                project={project}
                                                onEdit={() => openEditDialog(project)}
                                                onDelete={() => handleDelete(project)}
                                                isSuperAdmin={isSuperAdmin}
                                            />
                                        ))}
                                    </TableBody>
                                </Table>
                            </SortableContext>
                        )}
                    </CardContent>
                </Card>
            </DndContext>

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

                        <div className="space-y-2">
                            <Label htmlFor="platform">Platform</Label>
                            <Select
                                value={formData.platform}
                                onValueChange={(val) => setFormData({ ...formData, platform: val })}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select platform" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="wordpress">WordPress</SelectItem>
                                    <SelectItem value="shopify">Shopify</SelectItem>
                                    <SelectItem value="custom">Custom / Other</SelectItem>
                                </SelectContent>
                            </Select>
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
