import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// Start a new background sync job
export async function POST(request: Request) {
    try {
        const { searchParams } = new URL(request.url)
        const projectId = searchParams.get("projectId")
        const resume = searchParams.get("resume") === "true"

        if (!projectId) {
            return NextResponse.json({ error: "Missing projectId" }, { status: 400 })
        }

        const projId = parseInt(projectId)

        // Check if project exists and has CMS configured
        const project = await prisma.indexingProject.findUnique({
            where: { id: projId },
            include: { settings: true }
        })

        if (!project?.settings?.cmsUrl) {
            return NextResponse.json({ error: "Project has no CMS URL configured" }, { status: 400 })
        }

        // Check if there's already an existing sync job
        const existingJob = await prisma.imageSyncJob.findUnique({
            where: { projectId: projId }
        })

        // If already running, just return
        if (existingJob && (existingJob.status === "pending" || existingJob.status === "running")) {
            return NextResponse.json({
                success: true,
                message: "Sync job already in progress",
                job: existingJob
            })
        }

        // RESUME: If resume=true and there's a failed job, just restart from where it left off
        if (resume && existingJob && existingJob.status === "failed") {
            const resumedJob = await prisma.imageSyncJob.update({
                where: { projectId: projId },
                data: {
                    status: "pending",
                    error: null,
                    lastRunAt: null,
                    completedAt: null
                }
            })

            console.log(`[ImageSync] Resuming project ${projId} from page ${resumedJob.currentPage}`)

            return NextResponse.json({
                success: true,
                message: `Sync job resumed from page ${resumedJob.currentPage}`,
                job: resumedJob
            })
        }

        // First, get total pages count from WordPress
        const pluginBase = project.settings.cmsUrl.replace(/\/$/, '')
        const countUrl = `${pluginBase}/wp-json/mehrana/v1/scan-content-images?count_only=true`

        let totalPages = 1
        let totalImages = 0

        try {
            const countResponse = await fetch(countUrl, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Mehrana-API-Key': project.settings.cmsApiKey || ''
                }
            })

            if (countResponse.ok) {
                const countData = await countResponse.json()
                totalPages = countData.total_pages || 1
                totalImages = countData.total_images || 0
            }
        } catch (err) {
            console.log('[ImageSync] Could not get count, will discover during sync')
        }

        // Create or update the sync job
        const job = await prisma.imageSyncJob.upsert({
            where: { projectId: projId },
            update: {
                status: "pending",
                currentPage: 1,
                totalPages: totalPages,
                totalImages: totalImages,
                processedImages: 0,
                startedAt: new Date(),
                lastRunAt: null,
                completedAt: null,
                error: null
            },
            create: {
                projectId: projId,
                status: "pending",
                currentPage: 1,
                totalPages: totalPages,
                totalImages: totalImages,
                processedImages: 0,
                startedAt: new Date()
            }
        })

        // Note: We don't delete existing images here anymore
        // The cron job will upsert images, updating existing ones and adding new ones

        return NextResponse.json({
            success: true,
            message: "Sync job started",
            job
        })

    } catch (error) {
        console.error('[ImageSync] Start error:', error)
        return NextResponse.json({
            error: error instanceof Error ? error.message : "Failed to start sync"
        }, { status: 500 })
    }
}

// Get sync status
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url)
        const projectId = searchParams.get("projectId")

        if (!projectId) {
            return NextResponse.json({ error: "Missing projectId" }, { status: 400 })
        }

        const projId = parseInt(projectId)

        const job = await prisma.imageSyncJob.findUnique({
            where: { projectId: projId }
        })

        if (!job) {
            return NextResponse.json({
                success: true,
                hasJob: false,
                status: "idle"
            })
        }

        const progress = job.totalPages
            ? Math.round((job.currentPage - 1) / job.totalPages * 100)
            : 0

        return NextResponse.json({
            success: true,
            hasJob: true,
            job: {
                status: job.status,
                currentPage: job.currentPage,
                totalPages: job.totalPages,
                totalImages: job.totalImages,
                processedImages: job.processedImages,
                progress: progress,
                startedAt: job.startedAt,
                lastRunAt: job.lastRunAt,
                completedAt: job.completedAt,
                error: job.error
            }
        })

    } catch (error) {
        console.error('[ImageSync] Status error:', error)
        return NextResponse.json({ error: "Failed to get status" }, { status: 500 })
    }
}

// Cancel sync job
export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url)
        const projectId = searchParams.get("projectId")

        if (!projectId) {
            return NextResponse.json({ error: "Missing projectId" }, { status: 400 })
        }

        const projId = parseInt(projectId)

        await prisma.imageSyncJob.update({
            where: { projectId: projId },
            data: {
                status: "cancelled",
                completedAt: new Date()
            }
        })

        return NextResponse.json({ success: true, message: "Sync cancelled" })

    } catch (error) {
        console.error('[ImageSync] Cancel error:', error)
        return NextResponse.json({ error: "Failed to cancel sync" }, { status: 500 })
    }
}
