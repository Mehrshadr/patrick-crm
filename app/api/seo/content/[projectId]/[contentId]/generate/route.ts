import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { generateContent, generateImages, replaceImagePlaceholders } from "@/lib/llm"

// POST - Generate content using LLM with optional image generation
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

        // Check query param for image generation
        const url = new URL(request.url)
        const skipImages = url.searchParams.get('skipImages') === 'true'

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

            // Generate text content
            console.log(`[Generate] Starting text generation for content ${content.id}`)
            const result = await generateContent({
                brief: content.brief,
                contentType: content.contentType as 'BLOG_POST' | 'SERVICE_PAGE',
                brandStatement: projectSettings?.brandStatement,
                guidelines: config?.guidelines,
                aiRules: config?.aiRules,
                useGuidelines: content.useGuidelines,
                useAiRules: content.useAiRules
            })

            let finalContent = result.content

            // Generate images if available and not skipped
            if (result.images && result.images.length > 0 && !skipImages) {
                console.log(`[Generate] Starting image generation: ${result.images.length} images`)

                // Update status to show image generation
                await prisma.generatedContent.update({
                    where: { id: content.id },
                    data: { status: 'GENERATING_IMAGES' }
                })

                const generatedImages = await generateImages(result.images, content.id)

                // Replace placeholders with actual images
                finalContent = replaceImagePlaceholders(result.content, generatedImages)

                console.log(`[Generate] Generated ${generatedImages.length} images`)
            }

            // Update content with result
            const updated = await prisma.generatedContent.update({
                where: { id: content.id },
                data: {
                    title: content.title || result.title,
                    content: finalContent,
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
