import { notFound, redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ImageIcon, ScanSearch, Lock } from "lucide-react"
import Link from "next/link"
import { checkProjectAppAccess } from "@/lib/project-access-server"
import { Button } from "@/components/ui/button"
import { MediaScanner } from "@/components/images/media-scanner"
import { ImageCompressor } from "@/components/images/image-compressor"
import { auth } from "@/lib/auth"
import { isAdmin as checkIsAdmin } from "@/lib/permissions"

// Force dynamic since we use headers/cookies
export const dynamic = 'force-dynamic'

interface PageProps {
    params: Promise<{ slug: string }>
}

export default async function ImageFactoryPage({ params }: PageProps) {
    const { slug } = await params

    const project = await prisma.indexingProject.findUnique({
        where: { slug },
        include: { settings: true }
    })

    if (!project) {
        notFound()
    }

    // Check access
    const { hasProjectAccess, hasAppAccess } = await checkProjectAppAccess(project.id, 'IMAGE_FACTORY')

    // No project access at all - redirect to projects list
    if (!hasProjectAccess) {
        redirect('/projects')
    }

    // Check if user is admin
    const session = await auth()
    const userIsAdmin = session?.user?.email ? checkIsAdmin(session.user.email) : false

    // Has project access but no app access
    if (!hasAppAccess) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="text-6xl mb-4">🔒</div>
                <h2 className="text-2xl font-semibold mb-2">Access Denied</h2>
                <p className="text-muted-foreground max-w-md mb-4">
                    You don't have access to Image Factory for this project.
                </p>
                <Button variant="outline" asChild>
                    <Link href={`/projects/${slug}`}>← Back to Project</Link>
                </Button>
            </div>
        )
    }

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
                    <span className="text-foreground font-semibold">Image Factory</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                    Optimize and manage images for {project.name}
                </p>
            </div>

            <div className="flex-1 overflow-auto p-4">
                <Tabs defaultValue="scan" className="space-y-6">
                    <TabsList>
                        <TabsTrigger value="scan" className="gap-2">
                            <ScanSearch className="h-4 w-4" />
                            Scan Website
                        </TabsTrigger>
                        <TabsTrigger value="compress" className="gap-2">
                            <ImageIcon className="h-4 w-4" />
                            Manual Compress
                        </TabsTrigger>
                    </TabsList>


                    <TabsContent value="compress">
                        <ImageCompressor />
                    </TabsContent>

                    <TabsContent value="scan">
                        <MediaScanner projectId={project.id} isAdmin={userIsAdmin} />
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    )
}
