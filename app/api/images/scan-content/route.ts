import { NextRequest, NextResponse } from "next/server"
import { db as prisma } from "@/lib/db"
import { auth } from "@/lib/auth"

// GET - Scan content for in-use images
export async function GET(request: NextRequest) {
    try {
        const session = await auth()
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const { searchParams } = new URL(request.url)
        const projectId = searchParams.get("projectId")
        const minSizeKB = searchParams.get("minSizeKB") || "50"
        const limit = searchParams.get("limit") || "100"
        const sync = searchParams.get("sync") === "true"

        if (!projectId) {
            return NextResponse.json({ error: "Missing projectId" }, { status: 400 })
        }

        const projId = parseInt(projectId)

        // If NOT syncing, try to return from database first
        if (!sync) {
            const existingImages = await prisma.pageImage.findMany({
                where: {
                    projectId: projId,
                    sizeKB: { gte: parseFloat(minSizeKB) }
                },
                orderBy: { sizeBytes: 'desc' },
                take: parseInt(limit)
            })

            if (existingImages.length > 0) {
                // Return from database
                const images = existingImages.map(img => ({
                    url: img.url,
                    filename: img.filename,
                    size_bytes: img.sizeBytes,
                    size_kb: img.sizeKB,
                    pages: JSON.parse(img.pages),
                    page_count: img.pageCount,
                    optimized: img.optimized
                }))

                return NextResponse.json({
                    success: true,
                    fromDatabase: true,
                    images,
                    stats: {
                        totalScanned: existingImages.length,
                        heavyImages: images.length,
                        lastSyncedAt: existingImages[0]?.lastScannedAt
                    }
                })
            }
        }

        // Get project to find WordPress URL
        const project = await prisma.project.findUnique({
            where: { id: projId }
        })

        if (!project?.pluginUrl) {
            return NextResponse.json({ error: "Project has no plugin URL configured" }, { status: 400 })
        }

        // Get plugin credentials
        const credentials = await prisma.projectSettings.findFirst({
            where: { projectId: projId, key: 'wp_plugin_key' }
        })

        if (!credentials?.value) {
            return NextResponse.json({ error: "WordPress plugin key not configured" }, { status: 400 })
        }

        // Call WordPress plugin
        const pluginBase = project.pluginUrl.replace(/\/$/, '')
        const url = `${pluginBase}/scan-content-images?min_size_kb=${minSizeKB}&limit=${limit}`

        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'X-Mehrana-Key': credentials.value
            }
        })

        if (!response.ok) {
            const errorText = await response.text()
            console.error("[ScanContent] WordPress error:", errorText)
            return NextResponse.json({
                error: `WordPress request failed: ${response.status}`,
                details: errorText
            }, { status: response.status })
        }

        const data = await response.json()

        if (!data.success) {
            return NextResponse.json({ error: data.error || "WordPress scan failed" }, { status: 500 })
        }

        // If syncing, save to database
        if (sync && data.images) {
            // Delete old records for this project
            await prisma.pageImage.deleteMany({
                where: { projectId: projId }
            })

            // Insert new records
            const imageRecords = data.images.map((img: any) => ({
                projectId: projId,
                url: img.url,
                filename: img.filename,
                sizeBytes: img.size_bytes,
                sizeKB: img.size_kb,
                pageCount: img.page_count,
                pages: JSON.stringify(img.pages),
                optimized: false,
                lastScannedAt: new Date()
            }))

            await prisma.pageImage.createMany({
                data: imageRecords
            })

            return NextResponse.json({
                success: true,
                synced: true,
                totalSynced: imageRecords.length,
                stats: {
                    totalScanned: data.total_scanned,
                    postsScanned: data.posts_scanned,
                    heavyImages: data.images.length
                }
            })
        }

        // Live scan without saving
        return NextResponse.json({
            success: true,
            images: data.images,
            stats: {
                totalScanned: data.total_scanned,
                postsScanned: data.posts_scanned,
                heavyImages: data.images?.length || 0
            }
        })

    } catch (error: any) {
        console.error("[ScanContent] Error:", error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
