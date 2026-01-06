import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const dynamic = 'force-dynamic'

// POST: Delete backup for an image
export async function POST(req: NextRequest) {
    try {
        const body = await req.json()
        const { projectId, mediaId, userId, userName } = body

        if (!projectId || !mediaId) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
        }

        // Get project settings
        const project = await prisma.indexingProject.findUnique({
            where: { id: parseInt(projectId) },
            include: { settings: true }
        })

        if (!project || !project.domain || !project.settings?.cmsApiKey) {
            return NextResponse.json({ error: "Project settings not configured" }, { status: 400 })
        }

        // Get the media item to find backup URL
        const mediaItem = await prisma.projectMedia.findFirst({
            where: {
                projectId: project.id,
                wpId: parseInt(mediaId)
            }
        })

        if (!mediaItem || !mediaItem.originalUrl) {
            return NextResponse.json({ error: "No backup found for this image" }, { status: 404 })
        }

        // Extract backup filename from URL
        const backupFilename = mediaItem.originalUrl.split('/').pop()
        if (!backupFilename) {
            return NextResponse.json({ error: "Invalid backup URL" }, { status: 400 })
        }

        const siteUrl = project.domain.startsWith('http') ? project.domain : `https://${project.domain}`
        const pluginBase = `${siteUrl.replace(/\/$/, '')}/wp-json/mehrana/v1`
        const headers = { 'X-MAP-API-Key': project.settings.cmsApiKey }

        // Call WordPress plugin to delete backup
        const wpRes = await fetch(`${pluginBase}/media/${mediaId}/delete-backup`, {
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
            console.error(`[ImageFactory DeleteBackup] WordPress error: ${error}`)
            return NextResponse.json({ error: 'WordPress delete backup failed' }, { status: 500 })
        }

        // Clear originalUrl in database
        await prisma.projectMedia.update({
            where: { projectId_wpId: { projectId: project.id, wpId: parseInt(mediaId) } },
            data: {
                originalUrl: null,
                lastSyncedAt: new Date()
            }
        })

        // Log the action
        await prisma.imageFactoryLog.create({
            data: {
                projectId: project.id,
                userId: userId || 'system',
                userName: userName || 'System',
                action: 'DELETE_BACKUP',
                details: JSON.stringify({
                    mediaId,
                    deletedBackup: backupFilename
                })
            }
        })

        return NextResponse.json({
            success: true,
            message: 'Backup deleted successfully'
        })

    } catch (error: any) {
        console.error("[ImageFactory DeleteBackup] Error:", error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
