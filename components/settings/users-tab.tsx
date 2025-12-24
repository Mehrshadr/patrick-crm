"use client"

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Users, Shield, Eye, Clock, RefreshCw, FolderOpen, Star, ChevronRight } from 'lucide-react'
import { toast } from 'sonner'

interface ProjectAccess {
    id: number
    projectId: number
    project: {
        id: number
        name: string
    }
}

interface User {
    id: number
    email: string
    name: string | null
    role: 'SUPER_ADMIN' | 'ADMIN' | 'USER'
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
    const [userProjects, setUserProjects] = useState<number[]>([])
    const [savingAccess, setSavingAccess] = useState(false)

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

    function openAccessDialog(user: User) {
        setSelectedUser(user)
        setUserProjects(user.projectAccess.map(pa => pa.projectId))
        setShowAccessDialog(true)
    }

    async function saveProjectAccess() {
        if (!selectedUser) return
        setSavingAccess(true)
        try {
            const res = await fetch('/api/users/project-access', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: selectedUser.id,
                    projectIds: userProjects
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

    function toggleProject(projectId: number) {
        if (userProjects.includes(projectId)) {
            setUserProjects(userProjects.filter(id => id !== projectId))
        } else {
            setUserProjects([...userProjects, projectId])
        }
    }

    function formatDate(dateStr: string | null) {
        if (!dateStr) return 'Never'
        const date = new Date(dateStr)
        return date.toLocaleString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        })
    }

    function getRoleBadge(role: string) {
        switch (role) {
            case 'SUPER_ADMIN':
                return <Badge className="bg-purple-100 text-purple-800 border-purple-300">Super Admin</Badge>
            case 'ADMIN':
                return <Badge className="bg-amber-100 text-amber-800 border-amber-300">Admin</Badge>
            default:
                return <Badge variant="outline">User</Badge>
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
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-semibold">User Management</h2>
                    <p className="text-sm text-slate-500">Manage access and project assignments</p>
                </div>
                <Button variant="outline" onClick={fetchUsers}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh
                </Button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4">
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-100 rounded-lg">
                                <Users className="h-5 w-5 text-blue-600" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold">{users.length}</p>
                                <p className="text-sm text-slate-500">Total Users</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-purple-100 rounded-lg">
                                <Star className="h-5 w-5 text-purple-600" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold">{users.filter(u => u.role === 'SUPER_ADMIN').length}</p>
                                <p className="text-sm text-slate-500">Super Admins</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-slate-100 rounded-lg">
                                <FolderOpen className="h-5 w-5 text-slate-600" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold">{projects.length}</p>
                                <p className="text-sm text-slate-500">Projects</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Users List */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Users className="h-5 w-5" />
                        Users & Project Access
                    </CardTitle>
                    <CardDescription>
                        Manage user roles and which projects they can access
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-3">
                        {users.map(user => (
                            <div
                                key={user.id}
                                className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border hover:bg-slate-100 transition-colors"
                            >
                                <div className="flex items-center gap-4">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold ${user.role === 'SUPER_ADMIN' ? 'bg-purple-500' :
                                            user.role === 'ADMIN' ? 'bg-amber-500' : 'bg-slate-400'
                                        }`}>
                                        {user.name?.[0]?.toUpperCase() || user.email[0].toUpperCase()}
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <p className="font-medium">{user.name || 'Unknown'}</p>
                                            {getRoleBadge(user.role)}
                                        </div>
                                        <p className="text-sm text-slate-500">{user.email}</p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-4">
                                    {/* Project Count */}
                                    <div className="text-right">
                                        <div className="text-xs text-slate-400">Projects</div>
                                        <p className="text-sm font-medium">
                                            {user.role === 'SUPER_ADMIN' ? (
                                                <span className="text-purple-600">All</span>
                                            ) : (
                                                user.projectAccess.length
                                            )}
                                        </p>
                                    </div>

                                    {/* Last Login */}
                                    <div className="text-right">
                                        <div className="flex items-center gap-1 text-xs text-slate-400">
                                            <Clock className="h-3 w-3" />
                                            Last Login
                                        </div>
                                        <p className="text-sm">{formatDate(user.lastLogin)}</p>
                                    </div>

                                    {/* Role Selector */}
                                    <Select
                                        value={user.role}
                                        onValueChange={(val) => updateRole(user.id, val)}
                                    >
                                        <SelectTrigger className="w-32">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="SUPER_ADMIN">
                                                <div className="flex items-center gap-2">
                                                    <Star className="h-3 w-3 text-purple-500" />
                                                    Super Admin
                                                </div>
                                            </SelectItem>
                                            <SelectItem value="ADMIN">
                                                <div className="flex items-center gap-2">
                                                    <Shield className="h-3 w-3 text-amber-500" />
                                                    Admin
                                                </div>
                                            </SelectItem>
                                            <SelectItem value="USER">
                                                <div className="flex items-center gap-2">
                                                    <Eye className="h-3 w-3 text-slate-500" />
                                                    User
                                                </div>
                                            </SelectItem>
                                        </SelectContent>
                                    </Select>

                                    {/* Edit Access Button */}
                                    {user.role !== 'SUPER_ADMIN' && (
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => openAccessDialog(user)}
                                        >
                                            <FolderOpen className="h-4 w-4 mr-1" />
                                            Access
                                            <ChevronRight className="h-4 w-4 ml-1" />
                                        </Button>
                                    )}
                                </div>
                            </div>
                        ))}

                        {users.length === 0 && (
                            <div className="text-center py-8 text-slate-500">
                                No users found
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Info Box */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-medium text-blue-800 mb-2">📌 Role Descriptions</h4>
                <ul className="text-sm text-blue-700 space-y-1">
                    <li>• <strong>Super Admin:</strong> Full access to all projects and settings</li>
                    <li>• <strong>Admin:</strong> Can manage leads and tasks</li>
                    <li>• <strong>User:</strong> Access only to assigned projects</li>
                </ul>
            </div>

            {/* Project Access Dialog */}
            <Dialog open={showAccessDialog} onOpenChange={setShowAccessDialog}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle>Project Access</DialogTitle>
                        <DialogDescription>
                            Select which projects {selectedUser?.name || selectedUser?.email} can access
                        </DialogDescription>
                    </DialogHeader>

                    <ScrollArea className="h-[300px] pr-4">
                        <div className="space-y-2">
                            {projects.map(project => (
                                <label
                                    key={project.id}
                                    className="flex items-center gap-3 p-3 rounded-lg border hover:bg-slate-50 cursor-pointer"
                                >
                                    <Checkbox
                                        checked={userProjects.includes(project.id)}
                                        onCheckedChange={() => toggleProject(project.id)}
                                    />
                                    <FolderOpen className="h-4 w-4 text-slate-400" />
                                    <span className="font-medium">{project.name}</span>
                                </label>
                            ))}
                        </div>
                    </ScrollArea>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowAccessDialog(false)}>
                            Cancel
                        </Button>
                        <Button onClick={saveProjectAccess} disabled={savingAccess}>
                            {savingAccess ? 'Saving...' : 'Save Access'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
