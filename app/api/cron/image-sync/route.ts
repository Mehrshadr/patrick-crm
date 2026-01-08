import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// This endpoint is called by cron scheduler to process pending sync jobs
export async function POST(request: Request) {
    try {
        // Verify cron secret
        const authHeader = request.headers.get('Authorization')
        const cronSecret = process.env.CRON_SECRET

        if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
            console.log('[ImageSyncProcess] Unauthorized access attempt')
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        // Find jobs that need processing (pending or running)
        const jobs = await prisma.imageSyncJob.findMany({
            where: {
                status: { in: ["pending", "running"] }
            },
            include: {
                project: {
                    include: { settings: true }
                }
            }
        })

        if (jobs.length === 0) {
            return NextResponse.json({
                success: true,
                message: "No active sync jobs",
                processed: 0
            })
        }

        console.log(`[ImageSyncProcess] Found ${jobs.length} active sync jobs`)

        const results = []

        for (const job of jobs) {
            if (!job.project?.settings?.cmsUrl) {
                await prisma.imageSyncJob.update({
                    where: { id: job.id },
                    data: {
                        status: "failed",
                        error: "No CMS URL configured",
                        completedAt: new Date()
                    }
                })
                results.push({ projectId: job.projectId, status: "failed", error: "No CMS URL" })
                continue
            }

            try {
                // Update status to running
                await prisma.imageSyncJob.update({
                    where: { id: job.id },
                    data: { status: "running" }
                })

                // Call WordPress to get images for current page
                const pluginBase = job.project.settings.cmsUrl.replace(/\/$/, '')
                const minSizeKB = 0 // Get all images
                const limit = 500 // Per page
                const url = `${pluginBase}/wp-json/mehrana/v1/scan-content-images?min_size_kb=${minSizeKB}&limit=${limit}&page=${job.currentPage}`

                console.log(`[ImageSyncProcess] Project ${job.projectId}: Fetching page ${job.currentPage}/${job.totalPages || '?'}`)

                const response = await fetch(url, {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Mehrana-API-Key': job.project.settings.cmsApiKey || ''
                    }
                })

                if (!response.ok) {
                    const errorText = await response.text()
                    throw new Error(`WordPress returned ${response.status}: ${errorText.substring(0, 200)}`)
                }

                const data = await response.json()

                if (!data.success) {
                    throw new Error(data.error || "WordPress scan failed")
                }

                // Save images to database
                const images = data.images || []
                let savedCount = 0

                for (const img of images) {
                    try {
                        await prisma.pageImage.upsert({
                            where: {
                                projectId_url: {
                                    projectId: job.projectId,
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
                                projectId: job.projectId,
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
                        savedCount++
                    } catch (err) {
                        console.error(`[ImageSyncProcess] Failed to save image: ${img.url}`, err)
                    }
                }

                // Update job progress
                const newProcessedImages = job.processedImages + savedCount
                const totalPages = data.total_pages || job.totalPages || 1
                const hasMore = data.has_more || job.currentPage < totalPages

                if (hasMore) {
                    // More pages to process
                    await prisma.imageSyncJob.update({
                        where: { id: job.id },
                        data: {
                            currentPage: job.currentPage + 1,
                            totalPages: totalPages,
                            totalImages: data.total_images || job.totalImages,
                            processedImages: newProcessedImages,
                            lastRunAt: new Date()
                        }
                    })
                    results.push({
                        projectId: job.projectId,
                        status: "running",
                        page: job.currentPage,
                        totalPages: totalPages,
                        imagesThisBatch: savedCount
                    })
                } else {
                    // Sync complete!
                    await prisma.imageSyncJob.update({
                        where: { id: job.id },
                        data: {
                            status: "completed",
                            currentPage: totalPages,
                            totalPages: totalPages,
                            processedImages: newProcessedImages,
                            lastRunAt: new Date(),
                            completedAt: new Date()
                        }
                    })
                    results.push({
                        projectId: job.projectId,
                        status: "completed",
                        totalImages: newProcessedImages
                    })
                    console.log(`[ImageSyncProcess] Project ${job.projectId}: Sync completed! ${newProcessedImages} images`)
                }

            } catch (error) {
                console.error(`[ImageSyncProcess] Project ${job.projectId} error:`, error)

                // Update job with error
                await prisma.imageSyncJob.update({
                    where: { id: job.id },
                    data: {
                        status: "failed",
                        error: error instanceof Error ? error.message : "Unknown error",
                        lastRunAt: new Date(),
                        completedAt: new Date()
                    }
                })

                results.push({
                    projectId: job.projectId,
                    status: "failed",
                    error: error instanceof Error ? error.message : "Unknown error"
                })
            }
        }

        return NextResponse.json({
            success: true,
            processed: jobs.length,
            results
        })

    } catch (error) {
        console.error('[ImageSyncProcess] Error:', error)
        return NextResponse.json({
            error: error instanceof Error ? error.message : "Failed to process sync jobs"
        }, { status: 500 })
    }
}
