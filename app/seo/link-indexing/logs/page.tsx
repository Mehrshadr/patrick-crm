import { prisma } from "@/lib/prisma"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
    Send,
    Search,
    AlertCircle,
    CheckCircle2,
    XCircle,
} from "lucide-react"

async function getLogs() {
    const logs = await prisma.indexingLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: 100,
        include: {
            url: {
                include: {
                    project: true
                }
            }
        }
    })
    return logs
}

const actionConfig: Record<string, { label: string; icon: React.ElementType; color: string }> = {
    SUBMIT: { label: 'Submit', icon: Send, color: 'text-blue-600' },
    INSPECT: { label: 'Check Status', icon: Search, color: 'text-purple-600' },
    ERROR: { label: 'Error', icon: AlertCircle, color: 'text-red-600' },
}

const statusConfig: Record<string, { label: string; icon: React.ElementType; bgColor: string; textColor: string }> = {
    SUCCESS: { label: 'Success', icon: CheckCircle2, bgColor: 'bg-green-100', textColor: 'text-green-700' },
    FAILED: { label: 'Failed', icon: XCircle, bgColor: 'bg-red-100', textColor: 'text-red-700' },
}

function formatDate(date: Date): string {
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    })
}

function getUrlPath(url: string): string {
    try {
        const urlObj = new URL(url)
        return urlObj.pathname
    } catch {
        return url
    }
}

export default async function LogsPage() {
    const logs = await getLogs()

    return (
        <div className="p-6 space-y-6">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">Activity Logs</h1>
                <p className="text-sm text-muted-foreground">
                    Recent indexing actions and status checks
                </p>
            </div>

            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-base">Last 100 Actions</CardTitle>
                </CardHeader>
                <CardContent>
                    {logs.length === 0 ? (
                        <div className="text-center py-8">
                            <AlertCircle className="h-10 w-10 mx-auto mb-3 text-muted-foreground opacity-50" />
                            <p className="text-sm text-muted-foreground">No logs yet</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {logs.map((log) => {
                                const action = actionConfig[log.action] || actionConfig.SUBMIT
                                const status = statusConfig[log.status] || statusConfig.SUCCESS
                                const ActionIcon = action.icon
                                const StatusIcon = status.icon

                                return (
                                    <div
                                        key={log.id}
                                        className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                                    >
                                        <div className={`mt-0.5 ${action.color}`}>
                                            <ActionIcon className="h-4 w-4" />
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="font-medium text-sm">{action.label}</span>
                                                <Badge className={`text-xs ${status.bgColor} ${status.textColor}`}>
                                                    <StatusIcon className="h-3 w-3 mr-1" />
                                                    {status.label}
                                                </Badge>
                                                <span className="text-xs text-muted-foreground">
                                                    {log.url.project.name}
                                                </span>
                                            </div>

                                            <a
                                                href={log.url.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-xs text-blue-600 hover:underline truncate block"
                                            >
                                                {getUrlPath(log.url.url)}
                                            </a>

                                            {log.response && (
                                                <p className="text-xs text-muted-foreground mt-1 truncate">
                                                    {log.response.length > 100
                                                        ? log.response.substring(0, 100) + '...'
                                                        : log.response}
                                                </p>
                                            )}
                                        </div>

                                        <div className="text-xs text-muted-foreground whitespace-nowrap">
                                            {formatDate(log.createdAt)}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
