import { notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { ImageCompressor } from "@/components/images/image-compressor"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ImageIcon, ScanSearch } from "lucide-react"
import Link from "next/link"

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
