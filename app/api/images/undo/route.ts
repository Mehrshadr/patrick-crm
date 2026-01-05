import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const dynamic = 'force-dynamic'

// POST: Undo/restore image from backup
export async function POST(req: NextRequest) {
    try {
        const body = await req.json()
        const { projectId, mediaId } = body

        if (!projectId || !mediaId) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
        }

        // Get media item with backup URL
        const project = await prisma.indexingProject.findUnique({
            where: { id: parseInt(projectId) },
            include: { settings: true }
        })

        if (!project || !project.domain || !project.settings?.cmsApiKey) {
            return NextResponse.json({ error: "Project settings not configured" }, { status: 400 })
        }

        const media = await prisma.projectMedia.findUnique({
            where: { projectId_wpId: { projectId: project.id, wpId: parseInt(mediaId) } }
        })

        if (!media) {
            return NextResponse.json({ error: "Media not found" }, { status: 404 })
        }

        if (!media.originalUrl) {
            return NextResponse.json({ error: "No backup available for this image" }, { status: 400 })
        }

        // Extract backup path from URL
        // URL format: https://domain.com/wp-content/uploads/mehrana-backups/2024-01-05_143000_image.jpg
        // Path format: /var/www/html/wp-content/uploads/mehrana-backups/2024-01-05_143000_image.jpg
        const backupFilename = media.originalUrl.split('/mehrana-backups/')[1]
        if (!backupFilename) {
            return NextResponse.json({ error: "Invalid backup URL format" }, { status: 400 })
        }

        const siteUrl = project.domain.startsWith('http') ? project.domain : `https://${project.domain}`
        const pluginBase = `${siteUrl.replace(/\/$/, '')}/wp-json/mehrana/v1`
        const headers = { 'X-MAP-API-Key': project.settings.cmsApiKey }

        // Call WordPress plugin to restore
        // We need to send the backup path, which WordPress will construct
        const wpRes = await fetch(`${pluginBase}/media/${mediaId}/restore`, {
            method: 'POST',
            headers: {
                ...headers,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                backup_filename: backupFilename
            })
        })

        if (!wpRes.ok) {
            const error = await wpRes.text()
            console.error(`[ImageFactory Undo] WordPress error: ${error}`)
            return NextResponse.json({ error: 'WordPress restore failed' }, { status: 500 })
        }

        const wpData = await wpRes.json()

        // Update our database - clear originalUrl since backup is restored
        await prisma.projectMedia.update({
            where: { projectId_wpId: { projectId: project.id, wpId: parseInt(mediaId) } },
            data: {
                originalUrl: null, // Clear backup reference
                url: wpData.restored_url,
                filesize: wpData.size,
                width: wpData.width,
                height: wpData.height,
                lastSyncedAt: new Date()
            }
        })

        // Log the action
        const { userId = 'system', userName = 'System' } = body
        await prisma.imageFactoryLog.create({
            data: {
                projectId: project.id,
                userId,
                userName,
                action: 'UNDO',
                details: JSON.stringify({
                    mediaId,
                    restoredUrl: wpData.restored_url,
                    size: wpData.size
                })
            }
        })

        return NextResponse.json({
            success: true,
            restoredUrl: wpData.restored_url,
            size: wpData.size
        })

    } catch (error: any) {
        console.error("[ImageFactory Undo] Error:", error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
