import { Suspense } from "react"
import Link from "next/link"
import { prisma } from "@/lib/prisma"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
    Link2,
    FolderOpen,
    CheckCircle2,
    Clock,
    AlertCircle,
    Plus,
    ArrowRight,
    Zap
} from "lucide-react"

const DAILY_QUOTA = 200

async function getStats() {
    const [projectCount, urlStats, todaySubmissions] = await Promise.all([
        prisma.indexingProject.count(),
        prisma.indexingUrl.groupBy({
            by: ['status'],
            _count: { status: true }
        }),
        // Count submissions today
        prisma.indexingLog.count({
            where: {
                action: 'SUBMIT',
                createdAt: {
                    gte: new Date(new Date().setHours(0, 0, 0, 0))
                }
            }
        })
    ])

    const stats = {
        projects: projectCount,
        total: 0,
        pending: 0,
        submitted: 0,
        indexed: 0,
        error: 0,
        todayUsed: todaySubmissions,
        todayRemaining: Math.max(0, DAILY_QUOTA - todaySubmissions)
    }

    urlStats.forEach(s => {
        stats.total += s._count.status
        switch (s.status) {
            case 'PENDING': stats.pending = s._count.status; break
            case 'SUBMITTED': stats.submitted = s._count.status; break
            case 'INDEXED': stats.indexed = s._count.status; break
            case 'ERROR': stats.error = s._count.status; break
        }
    })

    return stats
}

async function getUrlsByStatus(status: string) {
    const whereClause = status === 'PENDING'
        ? { OR: [{ status: 'PENDING' }, { status: 'SUBMITTED' }] }
        : { status }

    return prisma.indexingUrl.findMany({
        where: whereClause,
        include: {
            project: true
        },
        orderBy: { updatedAt: 'desc' },
        take: 50
    })
}

async function getRecentActivity() {
    return prisma.indexingLog.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: {
            url: {
                include: { project: true }
            }
        }
    })
}

function StatCard({
    title,
    value,
    icon: Icon,
    description,
    variant = "default",
    href
}: {
    title: string
    value: number
    icon: React.ElementType
    description?: string
    variant?: "default" | "success" | "warning" | "error"
    href?: string
}) {
    const variantStyles = {
        default: "bg-card",
        success: "bg-green-50 border-green-200 dark:bg-green-950/20",
        warning: "bg-yellow-50 border-yellow-200 dark:bg-yellow-950/20",
        error: "bg-red-50 border-red-200 dark:bg-red-950/20",
    }

    const iconStyles = {
        default: "text-muted-foreground",
        success: "text-green-600",
        warning: "text-yellow-600",
        error: "text-red-600",
    }

    const content = (
        <Card className={`${variantStyles[variant]} ${href ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}`}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{title}</CardTitle>
                <Icon className={`h-5 w-5 ${iconStyles[variant]}`} />
            </CardHeader>
            <CardContent>
                <div className="text-3xl font-bold">{value}</div>
                {description && (
                    <p className="text-xs text-muted-foreground mt-1">{description}</p>
                )}
                {href && (
                    <p className="text-xs text-primary mt-2">Click to view →</p>
                )}
            </CardContent>
        </Card>
    )

    if (href) {
        return <Link href={href}>{content}</Link>
    }
    return content
}

async function DashboardContent() {
    const [stats, pendingUrls, errorUrls, recentActivity] = await Promise.all([
        getStats(),
        getUrlsByStatus('PENDING'),
        getUrlsByStatus('ERROR'),
        getRecentActivity()
    ])

    const quotaPercent = (stats.todayUsed / DAILY_QUOTA) * 100

    return (
        <div className="space-y-6">

            {/* Daily Quota Card */}
            <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 border-blue-200">
                <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Zap className="h-5 w-5 text-blue-600" />
                            <CardTitle className="text-base">Daily Quota</CardTitle>
                        </div>
                        <Badge variant="outline" className="text-blue-600 border-blue-300">
                            {stats.todayRemaining} remaining
                        </Badge>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Used today</span>
                            <span className="font-medium">{stats.todayUsed} / {DAILY_QUOTA}</span>
                        </div>
                        <Progress value={quotaPercent} className="h-2" />
                        <p className="text-xs text-muted-foreground">
                            Google allows ~200 indexing requests per day per property
                        </p>
                    </div>
                </CardContent>
            </Card>

            {/* Stats Grid */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <StatCard
                    title="Total Projects"
                    value={stats.projects}
                    icon={FolderOpen}
                    description="Active indexing projects"
                />
                <StatCard
                    title="Indexed"
                    value={stats.indexed}
                    icon={CheckCircle2}
                    variant="success"
                    description="Successfully indexed"
                />
                <StatCard
                    title="Pending"
                    value={stats.pending + stats.submitted}
                    icon={Clock}
                    variant="warning"
                    description="Awaiting indexing"
                    href={`/seo/link-indexing?status=pending`}
                />
                <StatCard
                    title="Errors"
                    value={stats.error}
                    icon={AlertCircle}
                    variant="error"
                    description="Failed submissions"
                    href={`/seo/link-indexing?status=error`}
                />
            </div>

            {/* Pending URLs Section */}
            {(stats.pending + stats.submitted) > 0 && (
                <Card>
                    <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle className="text-base flex items-center gap-2">
                                    <Clock className="h-4 w-4 text-yellow-600" />
                                    Pending URLs
                                </CardTitle>
                                <CardDescription>URLs awaiting indexing</CardDescription>
                            </div>
                            <Button size="sm" disabled>
                                Resubmit All
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent>
                        {pendingUrls.length === 0 ? (
                            <p className="text-sm text-muted-foreground">No pending URLs</p>
                        ) : (
                            <div className="space-y-2">
                                {pendingUrls.slice(0, 10).map(url => (
                                    <div key={url.id} className="flex items-center justify-between py-2 border-b last:border-0">
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm truncate max-w-[400px]">
                                                {new URL(url.url).pathname}
                                            </p>
                                            <p className="text-xs text-muted-foreground">{url.project.name}</p>
                                        </div>
                                        <Link href={`/seo/link-indexing/projects/${url.projectId}`}>
                                            <Button size="sm" variant="outline" className="h-7 text-xs">
                                                View
                                            </Button>
                                        </Link>
                                    </div>
                                ))}
                                {pendingUrls.length > 10 && (
                                    <p className="text-xs text-muted-foreground text-center pt-2">
                                        +{pendingUrls.length - 10} more
                                    </p>
                                )}
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* Error URLs Section */}
            {stats.error > 0 && (
                <Card className="border-red-200">
                    <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle className="text-base flex items-center gap-2">
                                    <AlertCircle className="h-4 w-4 text-red-600" />
                                    Failed URLs
                                </CardTitle>
                                <CardDescription>URLs that encountered errors</CardDescription>
                            </div>
                            <Button size="sm" variant="destructive" disabled>
                                Retry All
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent>
                        {errorUrls.length === 0 ? (
                            <p className="text-sm text-muted-foreground">No error URLs</p>
                        ) : (
                            <div className="space-y-2">
                                {errorUrls.slice(0, 10).map(url => (
                                    <div key={url.id} className="flex items-center justify-between py-2 border-b last:border-0">
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm truncate max-w-[400px]">
                                                {new URL(url.url).pathname}
                                            </p>
                                            <p className="text-xs text-muted-foreground">{url.project.name}</p>
                                        </div>
                                        <Link href={`/seo/link-indexing/projects/${url.projectId}`}>
                                            <Button size="sm" variant="outline" className="h-7 text-xs">
                                                View
                                            </Button>
                                        </Link>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* Quick Actions & Overview */}
            <div className="grid gap-4 md:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle>Quick Actions</CardTitle>
                        <CardDescription>Common tasks</CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-wrap gap-2">
                        <Button asChild>
                            <Link href="/seo/link-indexing/projects">
                                <FolderOpen className="mr-2 h-4 w-4" />
                                View Projects
                            </Link>
                        </Button>
                        <Button variant="outline" asChild>
                            <Link href="/seo/link-indexing/projects?new=true">
                                <Plus className="mr-2 h-4 w-4" />
                                New Project
                            </Link>
                        </Button>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Stats Overview</CardTitle>
                        <CardDescription>URL status breakdown</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2">
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-muted-foreground">Total URLs</span>
                                <Badge variant="secondary">{stats.total}</Badge>
                            </div>
                            <div className="w-full bg-secondary rounded-full h-2 overflow-hidden">
                                {stats.total > 0 && (
                                    <div className="flex h-full">
                                        <div
                                            className="bg-green-500"
                                            style={{ width: `${(stats.indexed / stats.total) * 100}%` }}
                                        />
                                        <div
                                            className="bg-yellow-500"
                                            style={{ width: `${((stats.pending + stats.submitted) / stats.total) * 100}%` }}
                                        />
                                        <div
                                            className="bg-red-500"
                                            style={{ width: `${(stats.error / stats.total) * 100}%` }}
                                        />
                                    </div>
                                )}
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Recent Activity */}
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle>Recent Activity</CardTitle>
                        <CardDescription>Latest operations</CardDescription>
                    </div>
                    <Button variant="outline" size="sm" asChild>
                        <Link href="/seo/link-indexing/logs">
                            View All
                        </Link>
                    </Button>
                </CardHeader>
                <CardContent>
                    {recentActivity.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            <Link2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                            <p>No activity yet</p>
                            <p className="text-sm">Start by creating a project and adding URLs</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {recentActivity.map((log) => (
                                <div key={log.id} className="flex items-center justify-between py-2 border-b last:border-0">
                                    <div className="flex items-center gap-3">
                                        <Badge variant={log.status === 'SUCCESS' ? 'default' : 'destructive'}>
                                            {log.action}
                                        </Badge>
                                        <div>
                                            <p className="text-sm font-medium truncate max-w-[300px]">
                                                {new URL(log.url.url).pathname}
                                            </p>
                                            <p className="text-xs text-muted-foreground">
                                                {log.url.project.name}
                                            </p>
                                        </div>
                                    </div>
                                    <span className="text-xs text-muted-foreground">
                                        {new Date(log.createdAt).toLocaleString('en-US')}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}

export default function LinkIndexingDashboard() {
    return (
        <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Link Indexing</h1>
                    <p className="text-muted-foreground">
                        Submit URLs to Google for faster indexing
                    </p>
                </div>
                <Button asChild>
                    <Link href="/seo/link-indexing/projects">
                        View All Projects
                        <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                </Button>
            </div>

            <Suspense fallback={<div className="animate-pulse">Loading...</div>}>
                <DashboardContent />
            </Suspense>
        </div>
    )
}
