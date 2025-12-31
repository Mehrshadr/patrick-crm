import { notFound, redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { ImageCompressor } from "@/components/images/image-compressor"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ImageIcon, ScanSearch, Lock } from "lucide-react"
import Link from "next/link"
import { checkProjectAppAccess } from "@/lib/project-access-server"
import { Button } from "@/components/ui/button"

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
                <Tabs defaultValue="compress" className="space-y-6">
                    <TabsList>
                        <TabsTrigger value="compress" className="gap-2">
                            <ImageIcon className="h-4 w-4" />
                            Manual Compress
                        </TabsTrigger>
                        <TabsTrigger value="scan" className="gap-2" disabled>
                            <ScanSearch className="h-4 w-4" />
                            Scan Project
                            <span className="text-xs bg-slate-100 px-2 py-0.5 rounded">Soon</span>
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="compress">
                        <ImageCompressor />
                    </TabsContent>

                    <TabsContent value="scan">
                        <div className="text-center py-12 text-slate-500">
                            This feature will be added in the next phase
                        </div>
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    )
}
