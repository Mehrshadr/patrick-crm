"use client"

import { useState, useEffect, use } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
    Link2,
    Anchor,
    Sparkles,
    Image as ImageIcon,
    Globe,
    ArrowLeft,
    Bot,
    Lock,
} from "lucide-react"
import { toast } from "sonner"
import { useProjectAccess } from "@/lib/project-access"

interface Project {
    id: number
    name: string
    slug: string
    domain: string | null
    description: string | null
    _count: {
        urls: number
        linkBuildingKeywords: number
        contents: number
    }
}

export default function ProjectDashboardPage({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = use(params)
    const router = useRouter()
    const [project, setProject] = useState<Project | null>(null)
    const [loading, setLoading] = useState(true)

    // Access check - pass project ID once we have it
    const [projectId, setProjectId] = useState<number | null>(null)
    const access = useProjectAccess(projectId)

    useEffect(() => {
        fetchProject()
    }, [slug])

    async function fetchProject() {
        try {
            const res = await fetch(`/api/seo/projects/by-slug/${slug}`)
            if (!res.ok) {
                toast.error('Project not found')
                router.push('/projects')
                return
            }
            const data = await res.json()
            setProject(data)
            setProjectId(data.id)
        } catch (error) {
            toast.error('Failed to load project')
        } finally {
            setLoading(false)
        }
    }

    if (loading || access.loading) {
        return (
            <div className="p-6 h-full flex items-center justify-center">
                <div className="animate-pulse">Loading...</div>
            </div>
        )
    }

    // Access check happens in hook - redirects if no project access
    if (!project) return null

    // Map app types to tool configs
    const APP_TYPE_MAP: Record<string, string> = {
        'Link Indexing': 'LINK_INDEXING',
        'Link Building': 'LINK_BUILDING',
        'Content Factory': 'CONTENT_FACTORY',
        'Image Factory': 'IMAGE_FACTORY',
    }

    const tools = [
        {
            name: 'Link Indexing',
            description: 'Submit URLs to Google for indexing',
            icon: Link2,
            href: `/projects/${slug}/link-indexing`,
            color: 'bg-green-100 text-green-700',
            count: project._count.urls,
            countLabel: 'URLs'
        },
        {
            name: 'Link Building',
            description: 'Internal link automation for SEO',
            icon: Anchor,
            href: `/projects/${slug}/link-building`,
            color: 'bg-blue-100 text-blue-700',
            count: project._count.linkBuildingKeywords,
            countLabel: 'keywords'
        },
        {
            name: 'Content Factory',
            description: 'AI-powered content generation',
            icon: Sparkles,
            href: `/projects/${slug}/content-factory`,
            color: 'bg-purple-100 text-purple-700',
            count: project._count.contents,
            countLabel: 'contents'
        },
        {
            name: 'Image Factory',
            description: 'Compress and optimize images',
            icon: ImageIcon,
            href: `/projects/${slug}/image-factory`,
            color: 'bg-amber-100 text-amber-700',
            count: null,
            countLabel: null
        },
        {
            name: 'Jarvis',
            description: 'Build automations with visual flows',
            icon: Bot,
            href: `/projects/${slug}/jarvis`,
            color: 'bg-violet-100 text-violet-700',
            count: null,
            countLabel: null,
            comingSoon: true
        },
        {
            name: 'Deepcrawl',
            description: 'Site analysis & structure mapping',
            icon: Globe,
            href: `/projects/${slug}/deepcrawl`,
            color: 'bg-teal-100 text-teal-700',
            count: null,
            countLabel: null,
            superAdminOnly: true
        },
    ]

    // Filter tools based on user's app access
    const accessibleTools = tools.filter(tool => {
        // superAdminOnly tools are only visible to SUPER_ADMIN
        if ('superAdminOnly' in tool && tool.superAdminOnly) {
            return access.accessLevel === 'SUPER_ADMIN'
        }
        const appType = APP_TYPE_MAP[tool.name]
        // If no appType mapping (like Jarvis), show as coming soon
        if (!appType) return true
        // SUPER_ADMIN sees all
        if (access.accessLevel === 'SUPER_ADMIN') return true
        // Check if user has access to this app
        return access.apps.includes(appType)
    })

    return (
        <div className="h-full flex flex-col overflow-hidden">
            {/* Header */}
            <div className="shrink-0 p-4 border-b">
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Link href="/projects" className="hover:text-foreground">
                        Projects
                    </Link>
                    <span>/</span>
                    <span className="text-foreground font-semibold">{project.name}</span>
                </div>
                <div className="flex items-center gap-2 mt-1">
                    {project.domain && (
                        <Badge variant="outline" className="text-xs">
                            <Globe className="h-3 w-3 mr-1" />
                            {project.domain}
                        </Badge>
                    )}
                </div>
            </div>

            {/* Tools Grid */}
            <div className="flex-1 overflow-auto p-6">
                <div className="max-w-4xl mx-auto">
                    <h2 className="text-lg font-semibold mb-4">SEO Tools</h2>

                    {accessibleTools.length === 0 ? (
                        <div className="text-center py-12">
                            <Lock className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                            <h3 className="font-medium mb-2">No Tools Available</h3>
                            <p className="text-muted-foreground text-sm">
                                You don't have access to any tools for this project.<br />
                                Contact an administrator to request access.
                            </p>
                        </div>
                    ) : (
                        <div className="grid gap-4 md:grid-cols-2">
                            {accessibleTools.map((tool) => {
                                const Icon = tool.icon
                                const isComingSoon = 'comingSoon' in tool && tool.comingSoon
                                return (
                                    <Card
                                        key={tool.name}
                                        className={`transition-shadow ${isComingSoon ? 'opacity-60' : 'cursor-pointer hover:shadow-md'}`}
                                        onClick={() => !isComingSoon && router.push(tool.href)}
                                    >
                                        <CardHeader className="pb-2">
                                            <div className="flex items-center justify-between">
                                                <div className={`p-2 rounded-lg ${tool.color}`}>
                                                    <Icon className="h-5 w-5" />
                                                </div>
                                                {isComingSoon ? (
                                                    <Badge variant="outline" className="text-muted-foreground">
                                                        Coming Soon
                                                    </Badge>
                                                ) : tool.count !== null && (
                                                    <Badge variant="secondary">
                                                        {tool.count} {tool.countLabel}
                                                    </Badge>
                                                )}
                                            </div>
                                            <CardTitle className="text-lg">{tool.name}</CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <CardDescription>{tool.description}</CardDescription>
                                        </CardContent>
                                    </Card>
                                )
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
