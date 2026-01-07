import { NextRequest, NextResponse } from "next/server"
import sharp from "sharp"
import { db as prisma } from "@/lib/db"
import { auth } from "@/lib/auth"
import { logActivity } from "@/lib/activity-logger"

// POST - Compress an image from URL and apply to WordPress
export async function POST(request: NextRequest) {
    try {
        const session = await auth()
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const body = await request.json()
        const { projectId, imageUrl, maxSizeKB = 100 } = body

        if (!projectId || !imageUrl) {
            return NextResponse.json({ error: "projectId and imageUrl are required" }, { status: 400 })
        }

        // Get project settings
        const project = await prisma.indexingProject.findUnique({
            where: { id: parseInt(projectId) },
            include: { settings: true }
        })

        if (!project?.settings?.cmsUrl) {
            return NextResponse.json({ error: "Project CMS URL not configured" }, { status: 400 })
        }

        if (!project.settings.cmsApiKey) {
            return NextResponse.json({ error: "WordPress API key not configured" }, { status: 400 })
        }

        console.log(`[CompressApply] Compressing image: ${imageUrl}`)

        // Step 1: Fetch the image
        const imageResponse = await fetch(imageUrl)
        if (!imageResponse.ok) {
            return NextResponse.json({ error: "Failed to fetch image" }, { status: 400 })
        }

        const originalBuffer = Buffer.from(await imageResponse.arrayBuffer())
        const originalSizeKB = originalBuffer.length / 1024
        const originalMetadata = await sharp(originalBuffer).metadata()

        // Step 2: Compress to WebP
        const targetSizeBytes = maxSizeKB * 1024
        let bestResult: Buffer | null = null
        let bestQuality = 85

        // Width constraint
        const maxWidth = 1200
        let pipeline = sharp(originalBuffer)
        let currentWidth = originalMetadata.width || 0

        if (currentWidth > maxWidth) {
            const aspectRatio = (originalMetadata.height || 800) / currentWidth
            pipeline = pipeline.resize(maxWidth, Math.round(maxWidth * aspectRatio))
        }

        // Try different quality levels
        const qualitySteps = [90, 85, 80, 75, 70, 65, 60]

        for (const quality of qualitySteps) {
            const result = await pipeline.clone().webp({ quality }).toBuffer()

            if (result.length <= targetSizeBytes) {
                bestResult = result
                bestQuality = quality
                break
            }

            // Keep last result as fallback
            bestResult = result
            bestQuality = quality
        }

        // If still too big, resize further
        if (bestResult && bestResult.length > targetSizeBytes) {
            const scaleSteps = [0.8, 0.7, 0.6, 0.5]
            for (const scale of scaleSteps) {
                const newWidth = Math.round((originalMetadata.width || 1200) * scale)
                if (newWidth < 400) break

                const result = await sharp(originalBuffer)
                    .resize(newWidth)
                    .webp({ quality: 75 })
                    .toBuffer()

                if (result.length <= targetSizeBytes) {
                    bestResult = result
                    break
                }
            }
        }

        if (!bestResult) {
            return NextResponse.json({ error: "Failed to compress image" }, { status: 500 })
        }

        const finalSizeKB = bestResult.length / 1024
        const savings = Math.round((1 - finalSizeKB / originalSizeKB) * 100)

        console.log(`[CompressApply] Compressed: ${Math.round(originalSizeKB)}KB -> ${Math.round(finalSizeKB)}KB (${savings}% savings)`)

        // Step 3: Try to find media ID from URL or extract from WordPress
        // For now, return compressed image. User can manually apply or we enhance later.
        const base64 = bestResult.toString("base64")

        // Get final metadata
        const finalMetadata = await sharp(bestResult).metadata()

        // Log activity
        logActivity({
            userId: session?.user?.email,
            userName: session?.user?.name,
            projectId: parseInt(projectId),
            category: 'IMAGE_FACTORY',
            action: 'COMPRESSED',
            description: `Compressed image to WebP (${savings}% savings)`,
            details: {
                imageUrl,
                originalSize: Math.round(originalSizeKB),
                finalSize: Math.round(finalSizeKB),
                savings
            }
        })

        return NextResponse.json({
            success: true,
            compressed: {
                base64,
                mimeType: "image/webp",
                sizeKB: Math.round(finalSizeKB * 10) / 10,
                width: finalMetadata.width,
                height: finalMetadata.height,
                quality: bestQuality
            },
            original: {
                sizeKB: Math.round(originalSizeKB * 10) / 10,
                width: originalMetadata.width,
                height: originalMetadata.height,
                format: originalMetadata.format
            },
            savings
        })

    } catch (error: any) {
        console.error("[CompressApply] Error:", error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
