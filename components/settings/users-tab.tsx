"use client"

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Users, Shield, Eye, Clock, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'

interface User {
    id: number
    email: string
    name: string | null
    role: 'ADMIN' | 'VIEWER'
    createdAt: string
    lastLogin: string | null
    lastLoginIp: string | null
    loginLogs: {
        id: number
        ip: string | null
        userAgent: string | null
        createdAt: string
    }[]
}

export function UsersTab() {
    const [users, setUsers] = useState<User[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        fetchUsers()
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

    async function updateRole(userId: number, newRole: string) {
        try {
            const res = await fetch('/api/users', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, role: newRole })
            }).then(r => r.json())

            if (res.success) {
                toast.success('Role updated!')
                setUsers(users.map(u => u.id === userId ? { ...u, role: newRole as 'ADMIN' | 'VIEWER' } : u))
            } else {
                toast.error(res.error)
            }
        } catch (e) {
            toast.error('Failed to update role')
        }
    }

    function formatDate(dateStr: string | null) {
        if (!dateStr) return 'Never'
        const date = new Date(dateStr)
        return date.toLocaleString('fa-IR', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        })
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
                    <p className="text-sm text-slate-500">Manage access and view login history</p>
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
                            <div className="p-2 bg-amber-100 rounded-lg">
                                <Shield className="h-5 w-5 text-amber-600" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold">{users.filter(u => u.role === 'ADMIN').length}</p>
                                <p className="text-sm text-slate-500">Admins</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-slate-100 rounded-lg">
                                <Eye className="h-5 w-5 text-slate-600" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold">{users.filter(u => u.role === 'VIEWER').length}</p>
                                <p className="text-sm text-slate-500">Viewers</p>
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
                        Users
                    </CardTitle>
                    <CardDescription>
                        Users who have logged in to Patrick CRM
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        {users.map(user => (
                            <div
                                key={user.id}
                                className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border"
                            >
                                <div className="flex items-center gap-4">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold ${user.role === 'ADMIN' ? 'bg-amber-500' : 'bg-slate-400'
                                        }`}>
                                        {user.name?.[0]?.toUpperCase() || user.email[0].toUpperCase()}
                                    </div>
                                    <div>
                                        <p className="font-medium">{user.name || 'Unknown'}</p>
                                        <p className="text-sm text-slate-500">{user.email}</p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-6">
                                    {/* Last Login */}
                                    <div className="text-right">
                                        <div className="flex items-center gap-1 text-xs text-slate-400">
                                            <Clock className="h-3 w-3" />
                                            Last Login
                                        </div>
                                        <p className="text-sm">{formatDate(user.lastLogin)}</p>
                                    </div>

                                    {/* Login Count */}
                                    <div className="text-right">
                                        <div className="text-xs text-slate-400">Logins</div>
                                        <p className="text-sm font-medium">{user.loginLogs.length}</p>
                                    </div>

                                    {/* Role Selector */}
                                    <Select
                                        value={user.role}
                                        onValueChange={(val) => updateRole(user.id, val)}
                                    >
                                        <SelectTrigger className="w-28">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="ADMIN">
                                                <div className="flex items-center gap-2">
                                                    <Shield className="h-3 w-3 text-amber-500" />
                                                    Admin
                                                </div>
                                            </SelectItem>
                                            <SelectItem value="VIEWER">
                                                <div className="flex items-center gap-2">
                                                    <Eye className="h-3 w-3 text-slate-500" />
                                                    Viewer
                                                </div>
                                            </SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        ))}

                        {users.length === 0 && (
                            <div className="text-center py-8 text-slate-500">
                                No users have logged in yet
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Info Box */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-medium text-blue-800 mb-2">📌 Tips</h4>
                <ul className="text-sm text-blue-700 space-y-1">
                    <li>• <strong>Admin:</strong> Can create, edit, and delete leads</li>
                    <li>• <strong>Viewer:</strong> Can only view leads (read-only)</li>
                    <li>• Users must log in once before they appear here</li>
                </ul>
            </div>
        </div>
    )
}
