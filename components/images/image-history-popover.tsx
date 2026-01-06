"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Loader2, History, Undo2, Trash2, RefreshCw, Zap, Database } from "lucide-react"

interface MediaItem {
    id: number
    wpId: number
    filename: string
    originalUrl?: string | null
}

interface LogEntry {
    id: number
    action: string
    userName: string
    createdAt: string
    details: string
}

interface ImageHistoryProps {
    item: MediaItem
    projectId: number
    onRefresh: () => void
}

export function ImageHistoryPopover({ item, projectId, onRefresh }: ImageHistoryProps) {
    const { data: session } = useSession()
    const [open, setOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const [undoing, setUndoing] = useState(false)
    const [deleting, setDeleting] = useState(false)
    const [logs, setLogs] = useState<LogEntry[]>([])
    const [lastSynced, setLastSynced] = useState<string | null>(null)

    const fetchHistory = async () => {
        if (!open) return
        setLoading(true)
        try {
            // Fetch logs for this specific image
            const res = await fetch(`/api/images/logs?projectId=${projectId}&mediaId=${item.wpId}`)
            const data = await res.json()
            if (data.logs) {
                setLogs(data.logs)
            }
            if (data.lastSynced) {
                setLastSynced(data.lastSynced)
            }
        } catch (e) {
            console.error('Failed to fetch history:', e)
        }
        setLoading(false)
    }

    useEffect(() => {
        if (open) {
            fetchHistory()
        }
    }, [open])

    const handleUndo = async () => {
        setUndoing(true)
        try {
            const res = await fetch('/api/images/undo', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectId,
                    mediaId: item.wpId,
                    userId: session?.user?.id || 'unknown',
                    userName: session?.user?.name || 'Unknown User'
                })
            })
            if (res.ok) {
                onRefresh()
                setOpen(false)
            }
        } catch (e) {
            console.error('Undo failed:', e)
        }
        setUndoing(false)
    }

    const handleDeleteBackup = async () => {
        if (!confirm('Are you sure you want to delete the backup? This cannot be undone.')) return
        setDeleting(true)
        try {
            const res = await fetch('/api/images/delete-backup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectId,
                    mediaId: item.wpId,
                    userId: session?.user?.id || 'unknown',
                    userName: session?.user?.name || 'Unknown User'
                })
            })
            if (res.ok) {
                onRefresh()
                setOpen(false)
            }
        } catch (e) {
            console.error('Delete backup failed:', e)
        }
        setDeleting(false)
    }

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        })
    }

    const getActionIcon = (action: string) => {
        switch (action) {
            case 'COMPRESS': return <Zap className="h-3 w-3 text-orange-500" />
            case 'UNDO': return <Undo2 className="h-3 w-3 text-blue-500" />
            case 'DELETE_BACKUP': return <Trash2 className="h-3 w-3 text-red-500" />
            case 'DATABASE_CREATE':
            case 'DATABASE_UPDATE': return <Database className="h-3 w-3 text-slate-500" />
            default: return <RefreshCw className="h-3 w-3 text-slate-400" />
        }
    }

    const getActionLabel = (action: string) => {
        switch (action) {
            case 'COMPRESS': return 'Compressed & Replaced'
            case 'UNDO': return 'Restored from backup'
            case 'DELETE_BACKUP': return 'Backup deleted'
            case 'DATABASE_CREATE': return 'Added to database'
            case 'DATABASE_UPDATE': return 'Database synced'
            default: return action
        }
    }

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6 shrink-0"
                    onClick={(e) => e.stopPropagation()}
                    title="Image History"
                >
                    <History className="h-3.5 w-3.5" />
                </Button>
            </PopoverTrigger>
            <PopoverContent
                className="w-72 p-0"
                align="end"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="p-3 border-b">
                    <p className="font-medium text-sm truncate">{item.filename}</p>
                    <p className="text-xs text-muted-foreground">History & Actions</p>
                </div>

                {/* Action buttons */}
                {item.originalUrl && (
                    <div className="p-2 border-b flex gap-2">
                        <Button
                            size="sm"
                            variant="outline"
                            className="flex-1 h-8"
                            onClick={handleUndo}
                            disabled={undoing}
                        >
                            {undoing ? (
                                <Loader2 className="h-3 w-3 animate-spin mr-1" />
                            ) : (
                                <Undo2 className="h-3 w-3 mr-1" />
                            )}
                            Undo
                        </Button>
                        <Button
                            size="sm"
                            variant="outline"
                            className="flex-1 h-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={handleDeleteBackup}
                            disabled={deleting}
                        >
                            {deleting ? (
                                <Loader2 className="h-3 w-3 animate-spin mr-1" />
                            ) : (
                                <Trash2 className="h-3 w-3 mr-1" />
                            )}
                            Delete Backup
                        </Button>
                    </div>
                )}

                {/* History logs */}
                <div className="max-h-48 overflow-y-auto">
                    {loading ? (
                        <div className="p-4 flex items-center justify-center">
                            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        </div>
                    ) : logs.length === 0 ? (
                        <div className="p-4 text-center text-xs text-muted-foreground">
                            No history yet
                        </div>
                    ) : (
                        <div className="divide-y">
                            {logs.map(log => (
                                <div key={log.id} className="p-2 text-xs">
                                    <div className="flex items-center gap-2">
                                        {getActionIcon(log.action)}
                                        <span className="font-medium">{getActionLabel(log.action)}</span>
                                    </div>
                                    <div className="flex items-center justify-between mt-1 text-muted-foreground">
                                        <span>{log.userName}</span>
                                        <span>{formatDate(log.createdAt)}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </PopoverContent>
        </Popover>
    )
}
