import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { prisma } from "@/lib/prisma"
import { notFound } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Link2, BarChart3, FileText, Sparkles, Anchor, ImageIcon } from "lucide-react"

async function getProject(id: number) {
    return prisma.indexingProject.findUnique({
        where: { id },
        include: {
            _count: {
                select: { urls: true }
            }
        }
    })
}

export default async function ProjectDashboard({
    params
}: {
    params: Promise<{ id: string }>
}) {
    const { id } = await params
    const project = await getProject(parseInt(id))

    if (!project) {
        notFound()
    }

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" asChild>
                    <Link href="/projects">
                        <ArrowLeft className="h-4 w-4" />
                    </Link>
                </Button>
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">{project.name}</h1>
                    {project.domain && (
                        <p className="text-muted-foreground">{project.domain}</p>
                    )}
                </div>
            </div>

            {/* Tools Grid */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {/* Link Indexing */}
                <Link href={`/projects/${id}/link-indexing`}>
                    <Card className="cursor-pointer hover:shadow-md transition-shadow h-full">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Link2 className="h-5 w-5 text-blue-600" />
                                Link Indexing
                            </CardTitle>
                            <CardDescription>
                                Submit URLs to Google for faster indexing
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <p className="text-2xl font-bold">{project._count.urls}</p>
                            <p className="text-sm text-muted-foreground">URLs tracked</p>
                        </CardContent>
                    </Card>
                </Link>

                {/* Link Building */}
                <Link href={`/seo/link-building/projects/${id}`}>
                    <Card className="cursor-pointer hover:shadow-md transition-shadow h-full">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Anchor className="h-5 w-5 text-indigo-600" />
                                Link Building
                            </CardTitle>
                            <CardDescription>
                                Internal linking automation
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm text-indigo-700 font-medium">✨ NEW</p>
                        </CardContent>
                    </Card>
                </Link>

                {/* Content Factory */}
                <Link href={`/seo/content-factory/projects/${id}`}>
                    <Card className="cursor-pointer hover:shadow-md transition-shadow h-full border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Sparkles className="h-5 w-5 text-amber-600" />
                                Content Factory
                            </CardTitle>
                            <CardDescription>
                                Generate AI-powered content
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm text-amber-700 font-medium">✨ NEW</p>
                        </CardContent>
                    </Card>
                </Link>

                {/* Image Factory */}
                <Link href={`/seo/image-factory/projects/${id}`}>
                    <Card className="cursor-pointer hover:shadow-md transition-shadow h-full border-cyan-200 bg-gradient-to-br from-cyan-50 to-sky-50">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <ImageIcon className="h-5 w-5 text-cyan-600" />
                                Image Factory
                            </CardTitle>
                            <CardDescription>
                                Compress & optimize images
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm text-cyan-700 font-medium">✨ NEW</p>
                        </CardContent>
                    </Card>
                </Link>

                {/* Dashboard - Coming Soon */}
                <Card className="opacity-60">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <BarChart3 className="h-5 w-5 text-green-600" />
                            Analytics Dashboard
                        </CardTitle>
                        <CardDescription>
                            Track your SEO performance
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm text-muted-foreground italic">🚧 Coming Soon</p>
                    </CardContent>
                </Card>

                {/* Reports - Coming Soon */}
                <Card className="opacity-60">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <FileText className="h-5 w-5 text-purple-600" />
                            Reports
                        </CardTitle>
                        <CardDescription>
                            Generate SEO reports
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm text-muted-foreground italic">🚧 Coming Soon</p>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
