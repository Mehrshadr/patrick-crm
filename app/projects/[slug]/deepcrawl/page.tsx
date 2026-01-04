import { notFound, redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import Link from "next/link"
import { DeepcrawlDashboard } from "@/components/deepcrawl/deepcrawl-dashboard"

// Force dynamic since we use headers/cookies
export const dynamic = 'force-dynamic'

interface PageProps {
    params: Promise<{ slug: string }>
}

export default async function DeepcrawlPage({ params }: PageProps) {
    const { slug } = await params

    // Get session and check SUPER_ADMIN
    const session = await auth()
    if (!session?.user?.email) {
        redirect('/login')
    }

    const user = await prisma.user.findUnique({
        where: { email: session.user.email }
    })

    if (user?.role !== 'SUPER_ADMIN') {
        redirect('/projects')
    }

    // Get project
    const project = await prisma.indexingProject.findUnique({
        where: { slug },
        include: { settings: true }
    })

    if (!project) {
        notFound()
    }

    // Get site URL from project settings (use cmsUrl or domain fallback)
    const siteUrl = project.settings?.cmsUrl || `https://${project.domain}`

    return (
        <div className="h-full flex flex-col overflow-hidden">
            {/* Header */}
            <div className="shrink-0 p-4 border-b">
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Link href="/projects" className="hover:text-foreground">
                        Projects
                    </Link>
                    <span>/</span>
                    <Link href={`/projects/${slug}`} className="hover:text-foreground">
                        {project.name}
                    </Link>
                    <span>/</span>
                    <span className="text-foreground font-semibold">Deepcrawl</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                    Site analysis powered by Deepcrawl API
                </p>
            </div>

            <div className="flex-1 overflow-auto p-4">
                <DeepcrawlDashboard
                    siteUrl={siteUrl}
                    projectName={project.name}
                />
            </div>
        </div>
    )
}
