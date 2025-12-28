import { notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { ImageCompressor } from "@/components/images/image-compressor"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ImageIcon, ScanSearch } from "lucide-react"

interface PageProps {
    params: Promise<{ id: string }>
}

export default async function ImageFactoryPage({ params }: PageProps) {
    const { id } = await params
    const projectId = parseInt(id)

    const project = await prisma.indexingProject.findUnique({
        where: { id: projectId },
        include: { settings: true }
    })

    if (!project) {
        notFound()
    }

    return (
        <div className="p-6 max-w-6xl mx-auto">
            <div className="mb-8">
                <h1 className="text-2xl font-bold flex items-center gap-2">
                    <ImageIcon className="h-6 w-6" />
                    Image Factory
                </h1>
                <p className="text-slate-500 mt-1">
                    Optimize and manage images for {project.name}
                </p>
            </div>

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
    )
}
