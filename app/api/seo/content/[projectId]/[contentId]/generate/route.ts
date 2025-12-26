import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { generateContent } from "@/lib/llm"

// POST - Generate content using LLM
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

        // Update status to GENERATING
        await prisma.generatedContent.update({
            where: { id: content.id },
            data: { status: 'GENERATING' }
        })

        try {
            // Get project settings (brand statement)
            const projectSettings = await prisma.projectSettings.findUnique({
                where: { projectId: parseInt(projectId) }
            })

            // Get global content generator config
            const config = await prisma.contentGeneratorConfig.findFirst()

            // Generate content
            const result = await generateContent({
                brief: content.brief,
                contentType: content.contentType as 'BLOG_POST' | 'SERVICE_PAGE',
                brandStatement: projectSettings?.brandStatement,
                guidelines: config?.guidelines,
                aiRules: config?.aiRules,
                useGuidelines: content.useGuidelines,
                useAiRules: content.useAiRules
            })

            // Update content with result
            const updated = await prisma.generatedContent.update({
                where: { id: content.id },
                data: {
                    title: content.title || result.title,
                    content: result.content,
                    llmPrompt: result.fullPrompt,
                    status: 'DONE'
                }
            })

            return NextResponse.json(updated)
        } catch (error: any) {
            // Update status to ERROR
            await prisma.generatedContent.update({
                where: { id: content.id },
                data: { status: 'ERROR' }
            })
            throw error
        }
    } catch (error: any) {
        console.error("Failed to generate content:", error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
