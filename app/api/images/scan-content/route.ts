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
        const minSizeKB = searchParams.get("minSizeKB") || "0" // Default 0 = fetch ALL images
        const limit = searchParams.get("limit") || "500"
        const pageNum = searchParams.get("page") || "1"
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
                    alt: img.alt,
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

        // Get project with settings
        const project = await prisma.indexingProject.findUnique({
            where: { id: projId },
            include: { settings: true }
        })

        if (!project?.settings?.cmsUrl) {
            return NextResponse.json({ error: "Project has no CMS URL configured" }, { status: 400 })
        }

        if (!project.settings.cmsApiKey) {
            return NextResponse.json({ error: "WordPress API key not configured" }, { status: 400 })
        }

        // Call WordPress plugin with pagination
        const pluginBase = project.settings.cmsUrl.replace(/\/$/, '')
        const url = `${pluginBase}/wp-json/mehrana/v1/scan-content-images?min_size_kb=${minSizeKB}&limit=${limit}&page=${pageNum}`

        console.log(`[ScanContent] Calling WordPress: ${url} (sync=${sync}, page=${pageNum})`)

        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'X-MAP-API-Key': project.settings.cmsApiKey
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
            // Only delete old records on first page
            const currentPage = parseInt(pageNum)
            if (currentPage === 1) {
                await prisma.pageImage.deleteMany({
                    where: { projectId: projId }
                })
            }

            // Insert/upsert new records
            for (const img of data.images) {
                await prisma.pageImage.upsert({
                    where: {
                        projectId_url: {
                            projectId: projId,
                            url: img.url
                        }
                    },
                    update: {
                        filename: img.filename,
                        sizeBytes: img.size_bytes,
                        sizeKB: img.size_kb,
                        alt: img.alt || null,
                        pageCount: img.page_count,
                        pages: JSON.stringify(img.pages),
                        lastScannedAt: new Date()
                    },
                    create: {
                        projectId: projId,
                        url: img.url,
                        filename: img.filename,
                        sizeBytes: img.size_bytes,
                        sizeKB: img.size_kb,
                        alt: img.alt || null,
                        pageCount: img.page_count,
                        pages: JSON.stringify(img.pages),
                        optimized: false,
                        lastScannedAt: new Date()
                    }
                })
            }

            return NextResponse.json({
                success: true,
                synced: true,
                images: data.images,
                totalSynced: data.images.length,
                posts_scanned: data.posts_scanned,
                total_posts: data.total_posts,
                has_more: data.has_more,
                page: currentPage,
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
            total_posts: data.total_posts,
            has_more: data.has_more,
            page: parseInt(pageNum),
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
