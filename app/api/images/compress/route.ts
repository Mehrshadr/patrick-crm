import { NextRequest, NextResponse } from "next/server"
import sharp from "sharp"
import { logActivity } from "@/lib/activity-logger"
import { auth } from "@/lib/auth"

// POST - Compress image with smart algorithm
// Target: Get as close to maxSize as possible without going over
// User can set quality threshold (default 90%)
// Supports: file upload OR imageUrl for remote images
export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData()
        const file = formData.get("file") as File | null
        const imageUrl = formData.get("imageUrl") as string | null
        const maxSizeKB = parseInt(formData.get("maxSizeKB") as string) || 100
        const maxWidth = parseInt(formData.get("maxWidth") as string) || 1200
        const outputFormat = (formData.get("format") as string) || "webp"
        const qualityThreshold = parseInt(formData.get("qualityThreshold") as string) || 90

        let originalBuffer: Buffer

        // Support both file upload and URL fetch
        if (file) {
            originalBuffer = Buffer.from(await file.arrayBuffer())
        } else if (imageUrl) {
            // Fetch image from URL
            const response = await fetch(imageUrl)
            if (!response.ok) {
                return NextResponse.json({ error: "Failed to fetch image from URL" }, { status: 400 })
            }
            const arrayBuffer = await response.arrayBuffer()
            originalBuffer = Buffer.from(arrayBuffer)
        } else {
            return NextResponse.json({ error: "No file or imageUrl provided" }, { status: 400 })
        }

        // Get original file info
        const originalSizeKB = originalBuffer.length / 1024
        const originalMetadata = await sharp(originalBuffer).metadata()

        // If already under target, just convert format
        const targetSizeBytes = maxSizeKB * 1024
        const minTargetBytes = targetSizeBytes * (qualityThreshold / 100) // Use user-defined threshold

        // Start compression pipeline
        let pipeline = sharp(originalBuffer)
        let currentWidth = originalMetadata.width || 0
        let currentHeight = originalMetadata.height || 0

        // Step 1: Resize if wider than maxWidth
        if (currentWidth > maxWidth) {
            const aspectRatio = currentHeight / currentWidth
            currentWidth = maxWidth
            currentHeight = Math.round(maxWidth * aspectRatio)
            pipeline = pipeline.resize(currentWidth, currentHeight)
        }

        // Step 2: Try high quality first
        let result: Buffer
        let bestResult: Buffer | null = null
        let bestQuality = 95

        // Start with high quality and work down only if needed
        const qualitySteps = [95, 90, 85, 80, 75, 70, 65, 60]

        for (const quality of qualitySteps) {
            if (outputFormat === "webp") {
                result = await pipeline.clone().webp({ quality }).toBuffer()
            } else if (outputFormat === "jpeg" || outputFormat === "jpg") {
                result = await pipeline.clone().jpeg({ quality }).toBuffer()
            } else {
                result = await pipeline.clone().png({ compressionLevel: Math.round((100 - quality) / 10) }).toBuffer()
            }

            // If under target size, this is our best result
            if (result.length <= targetSizeBytes) {
                bestResult = result
                bestQuality = quality

                // If we're in the optimal range (90-100% of target), stop here
                if (result.length >= minTargetBytes) {
                    break
                }

                // Otherwise keep looking for a higher quality that still fits
                // But if we're already at 95, just use it
                if (quality === 95) {
                    break
                }
            }
        }

        // Step 3: If still too large after quality reduction, try resizing
        if (!bestResult) {
            const scaleSteps = [0.9, 0.8, 0.7, 0.6, 0.5]

            for (const scale of scaleSteps) {
                const newWidth = Math.round((originalMetadata.width || 1200) * scale)
                const newHeight = Math.round((originalMetadata.height || 800) * scale)

                // Don't go below reasonable size
                if (newWidth < 400) break

                pipeline = sharp(originalBuffer).resize(newWidth, newHeight)

                // Try with good quality first
                for (const quality of [85, 75, 65]) {
                    if (outputFormat === "webp") {
                        result = await pipeline.clone().webp({ quality }).toBuffer()
                    } else if (outputFormat === "jpeg" || outputFormat === "jpg") {
                        result = await pipeline.clone().jpeg({ quality }).toBuffer()
                    } else {
                        result = await pipeline.clone().png({ compressionLevel: 6 }).toBuffer()
                    }

                    if (result.length <= targetSizeBytes) {
                        bestResult = result
                        bestQuality = quality
                        currentWidth = newWidth
                        currentHeight = newHeight

                        // If in optimal range, stop
                        if (result.length >= minTargetBytes) {
                            break
                        }
                    }
                }

                if (bestResult && bestResult.length >= minTargetBytes) {
                    break
                }
            }
        }

        // Fallback: if nothing worked, use last result
        if (!bestResult) {
            if (outputFormat === "webp") {
                bestResult = await sharp(originalBuffer).resize(800).webp({ quality: 60 }).toBuffer()
            } else if (outputFormat === "jpeg" || outputFormat === "jpg") {
                bestResult = await sharp(originalBuffer).resize(800).jpeg({ quality: 60 }).toBuffer()
            } else {
                bestResult = await sharp(originalBuffer).resize(800).png({ compressionLevel: 8 }).toBuffer()
            }
            bestQuality = 60
        }

        const finalSizeKB = bestResult.length / 1024
        const savings = Math.round((1 - finalSizeKB / originalSizeKB) * 100)

        // Get final metadata
        const finalMetadata = await sharp(bestResult).metadata()

        // Return image as base64 with stats
        const base64 = bestResult.toString("base64")
        const mimeType = outputFormat === "webp" ? "image/webp" :
            outputFormat === "jpeg" || outputFormat === "jpg" ? "image/jpeg" : "image/png"


        // Log Activity (Fire and forget)
        // Note: ProjectId is not currently passed in formData, logging as general tool usage
        const session = await auth()
        logActivity({
            userId: session?.user?.email,
            userName: session?.user?.name,
            projectId: null,
            category: 'IMAGE_FACTORY',
            action: 'COMPRESSED',
            description: `Compressed image (Savings: ${savings}%)`,
            details: {
                originalSize: originalSizeKB,
                finalSize: finalSizeKB,
                format: outputFormat,
                savings
            }
        })

        return NextResponse.json({
            success: true,
            image: `data:${mimeType};base64,${base64}`,
            stats: {
                original: {
                    sizeKB: Math.round(originalSizeKB * 10) / 10,
                    width: originalMetadata.width,
                    height: originalMetadata.height,
                    format: originalMetadata.format
                },
                compressed: {
                    sizeKB: Math.round(finalSizeKB * 10) / 10,
                    width: finalMetadata.width,
                    height: finalMetadata.height,
                    format: outputFormat
                },
                savings: savings,
                quality: bestQuality
            }
        })
    } catch (error: any) {
        console.error("Compression error:", error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
