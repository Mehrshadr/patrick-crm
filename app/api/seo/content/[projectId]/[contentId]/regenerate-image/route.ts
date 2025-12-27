import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import OpenAI from 'openai'
import fs from 'fs'
import path from 'path'

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
})

// POST - Regenerate a specific image
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
        const { imageIndex, currentSrc, prompt } = await request.json()

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

        // Generate new image
        console.log(`[Regenerate] Generating new image for content ${content.id}, index ${imageIndex}`)
        console.log(`[Regenerate] Prompt received: "${prompt}"`)

        // Use prompt if provided, otherwise generate a generic one
        const imagePrompt = prompt && prompt.trim()
            ? `High quality, photorealistic 16:9 image: ${prompt}. Professional photography style, cinematic lighting.`
            : `High quality, photorealistic 16:9 image. Professional photography style.`

        console.log(`[Regenerate] Final prompt: "${imagePrompt}"`)

        const response = await openai.images.generate({
            model: "dall-e-3",
            prompt: imagePrompt,
            n: 1,
            size: "1792x1024",
            quality: "standard"
        })

        const imageUrl = response.data?.[0]?.url
        if (!imageUrl) {
            return NextResponse.json({ error: "Failed to generate image" }, { status: 500 })
        }

        // Download and save the image
        const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'content', contentId)
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true })
        }

        const imageRes = await fetch(imageUrl)
        const arrayBuffer = await imageRes.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)

        const filename = `regenerated-${imageIndex}-${Date.now()}.png`
        const filepath = path.join(uploadDir, filename)
        fs.writeFileSync(filepath, buffer)

        const newSrc = `/api/images/content/${contentId}/${filename}`

        console.log(`[Regenerate] Saved new image: ${newSrc}`)

        return NextResponse.json({
            success: true,
            newSrc,
            oldSrc: currentSrc
        })
    } catch (error: any) {
        console.error("Failed to regenerate image:", error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
