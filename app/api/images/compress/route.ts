import { NextRequest, NextResponse } from "next/server"
import sharp from "sharp"

// POST - Compress image with smart algorithm
export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData()
        const file = formData.get("file") as File
        const maxSizeKB = parseInt(formData.get("maxSizeKB") as string) || 100
        const maxWidth = parseInt(formData.get("maxWidth") as string) || 1200
        const outputFormat = (formData.get("format") as string) || "webp"

        if (!file) {
            return NextResponse.json({ error: "No file provided" }, { status: 400 })
        }

        // Get original file info
        const originalBuffer = Buffer.from(await file.arrayBuffer())
        const originalSizeKB = originalBuffer.length / 1024
        const originalMetadata = await sharp(originalBuffer).metadata()

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

        // Step 2: Convert to target format with quality optimization
        const targetSizeBytes = maxSizeKB * 1024
        let quality = 85
        let result: Buffer

        // Binary search for optimal quality
        let minQuality = 10
        let maxQuality = 95
        let bestResult: Buffer | null = null
        let bestQuality = quality

        for (let i = 0; i < 8; i++) {
            quality = Math.round((minQuality + maxQuality) / 2)

            if (outputFormat === "webp") {
                result = await pipeline.clone().webp({ quality }).toBuffer()
            } else if (outputFormat === "jpeg" || outputFormat === "jpg") {
                result = await pipeline.clone().jpeg({ quality }).toBuffer()
            } else {
                result = await pipeline.clone().png({ quality: Math.round(quality / 10) }).toBuffer()
            }

            if (result.length <= targetSizeBytes) {
                bestResult = result
                bestQuality = quality
                minQuality = quality + 1
            } else {
                maxQuality = quality - 1
            }

            // If we're very close to target, stop
            if (Math.abs(result.length - targetSizeBytes) < 5000) {
                bestResult = result
                bestQuality = quality
                break
            }
        }

        // Step 3: If still too large, reduce dimensions
        if (!bestResult || bestResult.length > targetSizeBytes) {
            let scale = 0.9
            while (scale > 0.3) {
                const newWidth = Math.round(currentWidth * scale)
                const newHeight = Math.round(currentHeight * scale)

                pipeline = sharp(originalBuffer).resize(newWidth, newHeight)

                if (outputFormat === "webp") {
                    result = await pipeline.webp({ quality: 80 }).toBuffer()
                } else if (outputFormat === "jpeg" || outputFormat === "jpg") {
                    result = await pipeline.jpeg({ quality: 80 }).toBuffer()
                } else {
                    result = await pipeline.png({ quality: 8 }).toBuffer()
                }

                if (result.length <= targetSizeBytes) {
                    bestResult = result
                    currentWidth = newWidth
                    currentHeight = newHeight
                    break
                }

                scale -= 0.1
            }
        }

        // Fallback to last result if nothing worked
        if (!bestResult) {
            bestResult = result!
        }

        const finalSizeKB = bestResult.length / 1024
        const savings = Math.round((1 - finalSizeKB / originalSizeKB) * 100)

        // Get final metadata
        const finalMetadata = await sharp(bestResult).metadata()

        // Return image as base64 with stats
        const base64 = bestResult.toString("base64")
        const mimeType = outputFormat === "webp" ? "image/webp" :
            outputFormat === "jpeg" || outputFormat === "jpg" ? "image/jpeg" : "image/png"

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
