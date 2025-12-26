import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { improveSection } from "@/lib/llm"

// POST - Improve a specific section of content based on feedback
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ projectId: string; contentId: string }> }
) {
    try {
        // Auth check
        if (process.env.DEV_BYPASS !== 'true') {
            const session = await auth()
            if (!session?.user) {
                return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
            }
        }

        const { projectId, contentId } = await params
        const body = await request.json()
        const { selectedText, feedback, surroundingContext } = body

        if (!selectedText?.trim()) {
            return NextResponse.json({ error: "No text selected" }, { status: 400 })
        }

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
            return NextResponse.json({ error: "No content to improve" }, { status: 400 })
        }

        // Get project settings for brand context
        const projectSettings = await prisma.projectSettings.findUnique({
            where: { projectId: parseInt(projectId) }
        })

        // Improve the selected section
        const result = await improveSection({
            selectedText,
            feedback,
            surroundingContext,
            brandStatement: projectSettings?.brandStatement
        })

        // Replace the old text with improved text in content
        const updatedContent = content.content.replace(selectedText, result.improvedText)

        // Save updated content
        const updated = await prisma.generatedContent.update({
            where: { id: content.id },
            data: {
                content: updatedContent,
                updatedAt: new Date()
            }
        })

        return NextResponse.json({
            success: true,
            improvedText: result.improvedText,
            content: updated
        })
    } catch (error: any) {
        console.error("Failed to improve section:", error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
