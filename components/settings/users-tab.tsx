"use client"

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Users, Shield, Eye, Clock, RefreshCw, FolderOpen, Star, ChevronRight, ChevronDown, Plus, Trash2, UserPlus } from 'lucide-react'
import { toast } from 'sonner'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'

interface AppAccess {
    id: number
    appType: string
}

interface ProjectAccess {
    id: number
    projectId: number
    project: {
        id: number
        name: string
    }
    appAccess: AppAccess[]
}

// Available apps for project access
const AVAILABLE_APPS = [
    { id: 'LINK_INDEXING', name: 'Link Indexing', icon: '🔗' },
    { id: 'LINK_BUILDING', name: 'Link Building', icon: '🧱' },
    { id: 'CONTENT_FACTORY', name: 'Content Factory', icon: '✨' },
    { id: 'IMAGE_FACTORY', name: 'Image Factory', icon: '🖼️' },
    { id: 'DASHBOARD', name: 'Dashboard', icon: '📊', disabled: true, comingSoon: true }
]

interface User {
    id: number
    email: string
    name: string | null
    role: 'SUPER_ADMIN' | 'ADMIN' | 'USER'
    patrickAccess: 'EDITOR' | 'VIEWER' | 'HIDDEN'
    createdAt: string
    lastLogin: string | null
    lastLoginIp: string | null
    projectAccess: ProjectAccess[]
    loginLogs: {
        id: number
        ip: string | null
        userAgent: string | null
        createdAt: string
    }[]
}

interface Project {
    id: number
    name: string
}

export function UsersTab() {
    const [users, setUsers] = useState<User[]>([])
    const [projects, setProjects] = useState<Project[]>([])
    const [loading, setLoading] = useState(true)
    const [selectedUser, setSelectedUser] = useState<User | null>(null)
    const [showAccessDialog, setShowAccessDialog] = useState(false)
    const [expandedUsers, setExpandedUsers] = useState<Set<number>>(new Set())
    // Map of projectId -> selected app types
    const [projectApps, setProjectApps] = useState<Record<number, string[]>>({})
    const [savingAccess, setSavingAccess] = useState(false)

    // Create user dialog
    const [showCreateDialog, setShowCreateDialog] = useState(false)
    const [newUserEmail, setNewUserEmail] = useState('')
    const [newUserName, setNewUserName] = useState('')
    const [newUserRole, setNewUserRole] = useState('USER')
    const [newUserPatrick, setNewUserPatrick] = useState('HIDDEN')
    const [creatingUser, setCreatingUser] = useState(false)

    // Delete user dialog
    const [showDeleteDialog, setShowDeleteDialog] = useState(false)
    const [userToDelete, setUserToDelete] = useState<User | null>(null)
    const [deletingUser, setDeletingUser] = useState(false)

    useEffect(() => {
        fetchUsers()
        fetchProjects()
    }, [])

    async function fetchUsers() {
        setLoading(true)
        try {
            const res = await fetch('/api/users').then(r => r.json())
            if (res.success) {
                setUsers(res.users)
            } else {
                toast.error(res.error || 'Failed to load users')
            }
        } catch (e) {
            toast.error('Failed to fetch users')
        }
        setLoading(false)
    }

    async function createUser() {
        if (!newUserEmail.trim()) {
            toast.error('Email is required')
            return
        }

        setCreatingUser(true)
        try {
            const res = await fetch('/api/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: newUserEmail.trim(),
                    name: newUserName.trim() || null,
                    role: newUserRole,
                    patrickAccess: newUserPatrick
                })
            }).then(r => r.json())

            if (res.success) {
                toast.success('User created successfully!')
                setShowCreateDialog(false)
                setNewUserEmail('')
                setNewUserName('')
                setNewUserRole('USER')
                setNewUserPatrick('HIDDEN')
                fetchUsers()
            } else {
                toast.error(res.error || 'Failed to create user')
            }
        } catch (e) {
            toast.error('Failed to create user')
        }
        setCreatingUser(false)
    }

    async function deleteUser() {
        if (!userToDelete) return

        setDeletingUser(true)
        try {
            const res = await fetch(`/api/users?userId=${userToDelete.id}`, {
                method: 'DELETE'
            }).then(r => r.json())

            if (res.success) {
                toast.success(res.message || 'User deleted')
                setShowDeleteDialog(false)
                setUserToDelete(null)
                fetchUsers()
            } else {
                toast.error(res.error || 'Failed to delete user')
            }
        } catch (e) {
            toast.error('Failed to delete user')
        }
        setDeletingUser(false)
    }

    function openDeleteDialog(user: User) {
        setUserToDelete(user)
        setShowDeleteDialog(true)
    }

    async function fetchProjects() {
        try {
            const res = await fetch('/api/seo/projects/all').then(r => r.json())
            setProjects(res)
        } catch (e) {
            console.error('Failed to fetch projects:', e)
        }
    }

    async function updateRole(userId: number, newRole: string) {
        try {
            const res = await fetch('/api/users', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, role: newRole })
            }).then(r => r.json())

            if (res.success) {
                toast.success('Role updated!')
                setUsers(users.map(u => u.id === userId ? { ...u, role: newRole as User['role'] } : u))
            } else {
                toast.error(res.error)
            }
        } catch (e) {
            toast.error('Failed to update role')
        }
    }

    async function updatePatrickAccess(userId: number, newAccess: string) {
        try {
            const res = await fetch('/api/users', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, patrickAccess: newAccess })
            }).then(r => r.json())

            if (res.success) {
                toast.success('Patrick CRM access updated!')
                setUsers(users.map(u => u.id === userId ? { ...u, patrickAccess: newAccess as User['patrickAccess'] } : u))
            } else {
                toast.error(res.error)
            }
        } catch (e) {
            toast.error('Failed to update access')
        }
    }

    function openAccessDialog(user: User) {
        setSelectedUser(user)
        // Build projectApps from user's current access
        const apps: Record<number, string[]> = {}
        for (const pa of user.projectAccess) {
            apps[pa.projectId] = pa.appAccess.map(a => a.appType)
        }
        setProjectApps(apps)
        setShowAccessDialog(true)
    }

    async function saveProjectAccess() {
        if (!selectedUser) return
        setSavingAccess(true)
        try {
            const projectsWithApps = Object.entries(projectApps)
                .filter(([_, apps]) => apps.length > 0)
                .map(([projectId, apps]) => ({
                    projectId: parseInt(projectId),
                    apps
                }))

            const res = await fetch('/api/users/project-access', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: selectedUser.id,
                    projectsWithApps
                })
            }).then(r => r.json())

            if (res.success) {
                toast.success('Project access updated!')
                fetchUsers()
                setShowAccessDialog(false)
            } else {
                toast.error(res.error || 'Failed to update access')
            }
        } catch (e) {
            toast.error('Failed to save access')
        }
        setSavingAccess(false)
    }

    function toggleProjectApp(projectId: number, appType: string) {
        setProjectApps(prev => {
            const currentApps = prev[projectId] || []
            if (currentApps.includes(appType)) {
                const newApps = currentApps.filter(a => a !== appType)
                if (newApps.length === 0) {
                    const { [projectId]: _, ...rest } = prev
                    return rest
                }
                return { ...prev, [projectId]: newApps }
            } else {
                return { ...prev, [projectId]: [...currentApps, appType] }
            }
        })
    }

    function isProjectSelected(projectId: number): boolean {
        return (projectApps[projectId]?.length || 0) > 0
    }

    function isAppSelected(projectId: number, appType: string): boolean {
        return projectApps[projectId]?.includes(appType) || false
    }

    function toggleUserExpand(userId: number) {
        setExpandedUsers(prev => {
            const next = new Set(prev)
            if (next.has(userId)) {
                next.delete(userId)
            } else {
                next.add(userId)
            }
            return next
        })
    }

    function formatDate(dateStr: string | null) {
        if (!dateStr) return 'Never'
        const date = new Date(dateStr)
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        })
    }

    function getRoleBadge(role: string) {
        switch (role) {
            case 'SUPER_ADMIN':
                return <Badge className="bg-purple-100 text-purple-800 border-purple-300 text-[10px]">Super Admin</Badge>
            case 'ADMIN':
                return <Badge className="bg-amber-100 text-amber-800 border-amber-300 text-[10px]">Admin</Badge>
            default:
                return <Badge variant="outline" className="text-[10px]">User</Badge>
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <RefreshCw className="h-6 w-6 animate-spin text-slate-400" />
            </div>
        )
    }

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                    <h2 className="text-lg font-semibold">User Management</h2>
                    <p className="text-xs text-muted-foreground">Manage access and project assignments</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={fetchUsers}>
                        <RefreshCw className="h-3 w-3 mr-1" />
                        Refresh
                    </Button>
                    <Button size="sm" onClick={() => setShowCreateDialog(true)}>
                        <UserPlus className="h-3 w-3 mr-1" />
                        Add User
                    </Button>
                </div>
            </div>

            {/* Stats - responsive grid */}
            <div className="grid grid-cols-3 gap-2">
                <Card className="p-3">
                    <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-blue-100 rounded-md">
                            <Users className="h-4 w-4 text-blue-600" />
                        </div>
                        <div>
                            <p className="text-lg font-bold">{users.length}</p>
                            <p className="text-[10px] text-muted-foreground">Users</p>
                        </div>
                    </div>
                </Card>
                <Card className="p-3">
                    <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-purple-100 rounded-md">
                            <Star className="h-4 w-4 text-purple-600" />
                        </div>
                        <div>
                            <p className="text-lg font-bold">{users.filter(u => u.role === 'SUPER_ADMIN').length}</p>
                            <p className="text-[10px] text-muted-foreground">Admins</p>
                        </div>
                    </div>
                </Card>
                <Card className="p-3">
                    <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-slate-100 rounded-md">
                            <FolderOpen className="h-4 w-4 text-slate-600" />
                        </div>
                        <div>
                            <p className="text-lg font-bold">{projects.length}</p>
                            <p className="text-[10px] text-muted-foreground">Projects</p>
                        </div>
                    </div>
                </Card>
            </div>

            {/* Users List - Mobile-first card design */}
            <div className="space-y-2">
                {users.map(user => (
                    <Card key={user.id} className="overflow-hidden">
                        <Collapsible open={expandedUsers.has(user.id)} onOpenChange={() => toggleUserExpand(user.id)}>
                            {/* User Header - Always visible */}
                            <CollapsibleTrigger asChild>
                                <div className="flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/50">
                                    {/* Avatar */}
                                    <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white font-semibold text-sm shrink-0 ${user.role === 'SUPER_ADMIN' ? 'bg-purple-500' :
                                        user.role === 'ADMIN' ? 'bg-amber-500' : 'bg-slate-400'
                                        }`}>
                                        {user.name?.[0]?.toUpperCase() || user.email[0].toUpperCase()}
                                    </div>

                                    {/* Name & Email */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                            <span className="font-medium text-sm truncate">{user.name || 'Unknown'}</span>
                                            {getRoleBadge(user.role)}
                                        </div>
                                        <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                                    </div>

                                    {/* Expand Icon */}
                                    <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform shrink-0 ${expandedUsers.has(user.id) ? 'rotate-180' : ''}`} />
                                </div>
                            </CollapsibleTrigger>

                            {/* Expanded Content */}
                            <CollapsibleContent>
                                <div className="px-3 pb-3 pt-0 space-y-3 border-t">
                                    {/* Last Login */}
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground pt-3">
                                        <Clock className="h-3 w-3" />
                                        Last login: {formatDate(user.lastLogin)}
                                    </div>

                                    {/* Projects Count */}
                                    <div className="flex items-center gap-2 text-xs">
                                        <FolderOpen className="h-3 w-3 text-muted-foreground" />
                                        <span className="text-muted-foreground">Projects:</span>
                                        {user.role === 'SUPER_ADMIN' ? (
                                            <span className="text-purple-600 font-medium">All</span>
                                        ) : (
                                            <span className="font-medium">{user.projectAccess.length}</span>
                                        )}
                                    </div>

                                    {/* Controls */}
                                    <div className="grid grid-cols-2 gap-2">
                                        {/* Role Selector */}
                                        <div>
                                            <label className="text-[10px] text-muted-foreground block mb-1">Role</label>
                                            <Select
                                                value={user.role}
                                                onValueChange={(val) => updateRole(user.id, val)}
                                            >
                                                <SelectTrigger className="h-8 text-xs">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="SUPER_ADMIN">
                                                        <div className="flex items-center gap-1.5">
                                                            <Star className="h-3 w-3 text-purple-500" />
                                                            Super Admin
                                                        </div>
                                                    </SelectItem>
                                                    <SelectItem value="ADMIN">
                                                        <div className="flex items-center gap-1.5">
                                                            <Shield className="h-3 w-3 text-amber-500" />
                                                            Admin
                                                        </div>
                                                    </SelectItem>
                                                    <SelectItem value="USER">
                                                        <div className="flex items-center gap-1.5">
                                                            <Eye className="h-3 w-3 text-slate-500" />
                                                            User
                                                        </div>
                                                    </SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        {/* Patrick CRM Access */}
                                        <div>
                                            <label className="text-[10px] text-muted-foreground block mb-1">Patrick CRM</label>
                                            <Select
                                                value={user.patrickAccess}
                                                onValueChange={(val) => updatePatrickAccess(user.id, val)}
                                            >
                                                <SelectTrigger className="h-8 text-xs">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="EDITOR">
                                                        <div className="flex items-center gap-1.5">
                                                            <Shield className="h-3 w-3 text-green-500" />
                                                            Editor
                                                        </div>
                                                    </SelectItem>
                                                    <SelectItem value="VIEWER">
                                                        <div className="flex items-center gap-1.5">
                                                            <Eye className="h-3 w-3 text-blue-500" />
                                                            Viewer
                                                        </div>
                                                    </SelectItem>
                                                    <SelectItem value="HIDDEN">
                                                        <div className="flex items-center gap-1.5">
                                                            <Eye className="h-3 w-3 text-slate-300" />
                                                            Hidden
                                                        </div>
                                                    </SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>

                                    {/* Project Access Button */}
                                    {user.role !== 'SUPER_ADMIN' && (
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="w-full h-8 text-xs"
                                            onClick={() => openAccessDialog(user)}
                                        >
                                            <FolderOpen className="h-3 w-3 mr-1.5" />
                                            Manage Projects
                                            <ChevronRight className="h-3 w-3 ml-auto" />
                                        </Button>
                                    )}

                                    {/* Delete User Button */}
                                    {user.role !== 'SUPER_ADMIN' && (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="w-full h-8 text-xs text-red-500 hover:text-red-700 hover:bg-red-50"
                                            onClick={() => openDeleteDialog(user)}
                                        >
                                            <Trash2 className="h-3 w-3 mr-1.5" />
                                            Delete User
                                        </Button>
                                    )}
                                </div>
                            </CollapsibleContent>
                        </Collapsible>
                    </Card>
                ))}

                {users.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                        No users found
                    </div>
                )}
            </div>

            {/* Project Access Dialog */}
            <Dialog open={showAccessDialog} onOpenChange={setShowAccessDialog}>
                <DialogContent className="max-w-[95vw] sm:max-w-[500px] max-h-[80vh]">
                    <DialogHeader>
                        <DialogTitle className="text-base">Project Access</DialogTitle>
                        <DialogDescription className="text-xs">
                            Select projects for {selectedUser?.name || selectedUser?.email}
                        </DialogDescription>
                    </DialogHeader>

                    <ScrollArea className="h-[50vh] pr-4">
                        <div className="space-y-2">
                            {projects.map(project => (
                                <div
                                    key={project.id}
                                    className={`p-3 rounded-lg border transition-colors ${isProjectSelected(project.id)
                                        ? 'border-blue-300 bg-blue-50/50'
                                        : 'border-border hover:border-muted-foreground/30'
                                        }`}
                                >
                                    <div className="flex items-center gap-2 mb-2">
                                        <FolderOpen className={`h-4 w-4 ${isProjectSelected(project.id) ? 'text-blue-500' : 'text-muted-foreground'}`} />
                                        <span className="font-medium text-sm">{project.name}</span>
                                    </div>

                                    {/* App checkboxes - 2 columns on mobile */}
                                    <div className="grid grid-cols-2 gap-1.5 pl-6">
                                        {AVAILABLE_APPS.map(app => (
                                            <label
                                                key={app.id}
                                                className={`flex items-center gap-1.5 p-2 rounded border cursor-pointer text-xs ${app.disabled
                                                    ? 'opacity-50 cursor-not-allowed bg-muted'
                                                    : isAppSelected(project.id, app.id)
                                                        ? 'border-blue-300 bg-blue-100'
                                                        : 'border-border hover:bg-muted/50'
                                                    }`}
                                            >
                                                <Checkbox
                                                    checked={isAppSelected(project.id, app.id)}
                                                    onCheckedChange={() => !app.disabled && toggleProjectApp(project.id, app.id)}
                                                    disabled={app.disabled}
                                                    className="h-3.5 w-3.5"
                                                />
                                                <span>{app.icon}</span>
                                                <span className="truncate">{app.name}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </ScrollArea>

                    <DialogFooter className="gap-2">
                        <Button variant="outline" size="sm" onClick={() => setShowAccessDialog(false)}>
                            Cancel
                        </Button>
                        <Button size="sm" onClick={saveProjectAccess} disabled={savingAccess}>
                            {savingAccess ? 'Saving...' : 'Save'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Create User Dialog */}
            <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Add New User</DialogTitle>
                        <DialogDescription>
                            Create a new user account. They can log in with their email via Google.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-2">
                        <div className="space-y-2">
                            <Label htmlFor="email">Email *</Label>
                            <Input
                                id="email"
                                type="email"
                                placeholder="user@mehrana.agency"
                                value={newUserEmail}
                                onChange={(e) => setNewUserEmail(e.target.value)}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="name">Name</Label>
                            <Input
                                id="name"
                                placeholder="Full Name"
                                value={newUserName}
                                onChange={(e) => setNewUserName(e.target.value)}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Role</Label>
                                <Select value={newUserRole} onValueChange={setNewUserRole}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="USER">User</SelectItem>
                                        <SelectItem value="ADMIN">Admin</SelectItem>
                                        <SelectItem value="SUPER_ADMIN">Super Admin</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label>Patrick CRM</Label>
                                <Select value={newUserPatrick} onValueChange={setNewUserPatrick}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="HIDDEN">Hidden</SelectItem>
                                        <SelectItem value="VIEWER">Viewer</SelectItem>
                                        <SelectItem value="EDITOR">Editor</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                            Cancel
                        </Button>
                        <Button onClick={createUser} disabled={creatingUser}>
                            {creatingUser ? 'Creating...' : 'Create User'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete User Confirmation */}
            <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete User</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete <strong>{userToDelete?.name || userToDelete?.email}</strong>?
                            <br /><br />
                            • Project access will be removed<br />
                            • Login history will be deleted<br />
                            • <strong>Activity logs will be preserved</strong> for audit purposes
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={deleteUser}
                            disabled={deletingUser}
                            className="bg-red-500 hover:bg-red-600"
                        >
                            {deletingUser ? 'Deleting...' : 'Delete'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}
