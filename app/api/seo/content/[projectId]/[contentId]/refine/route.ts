import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { refineContent } from "@/lib/llm"

// POST - Refine content based on feedback
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ projectId: string; contentId: string }> }
) {
    try {
        // DEV_BYPASS: Skip auth
        if (process.env.DEV_BYPASS !== 'true') {
            const session = await auth()
            if (!session?.user) {
                return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
            }
        }

        const { projectId, contentId } = await params
        const body = await request.json()
        const { feedback } = body

        if (!feedback?.trim()) {
            return NextResponse.json({ error: "Feedback is required" }, { status: 400 })
        }

        // Get the content record
        const content = await prisma.generatedContent.findFirst({
            where: {
                id: parseInt(contentId),
                projectId: parseInt(projectId)
            }
        })

        if (!content) {
            return NextResponse.json({ error: "Content not found" }, { status: 404 })
        }

        if (!content.content) {
            return NextResponse.json({ error: "Content has not been generated yet" }, { status: 400 })
        }

        // Get project settings (brand statement)
        const projectSettings = await prisma.projectSettings.findUnique({
            where: { projectId: parseInt(projectId) }
        })

        // Refine content
        const result = await refineContent(
            content.content,
            feedback,
            projectSettings?.brandStatement
        )

        // Update content with refined version
        const updated = await prisma.generatedContent.update({
            where: { id: content.id },
            data: {
                content: result.content,
                updatedAt: new Date()
            }
        })

        return NextResponse.json(updated)
    } catch (error: any) {
        console.error("Failed to refine content:", error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
