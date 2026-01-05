import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const dynamic = 'force-dynamic'

// POST: Replace image in WordPress with compressed version
export async function POST(req: NextRequest) {
    try {
        const body = await req.json()
        const { projectId, mediaId, imageData, mimeType } = body

        if (!projectId || !mediaId || !imageData) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
        }

        // Get project settings
        const project = await prisma.indexingProject.findUnique({
            where: { id: parseInt(projectId) },
            include: { settings: true }
        })

        if (!project || !project.settings?.pluginBase || !project.settings?.pluginApiKey) {
            return NextResponse.json({ error: "Project settings not configured" }, { status: 400 })
        }

        const pluginBase = project.settings.pluginBase
        const headers = { 'X-MAP-API-Key': project.settings.pluginApiKey }

        // Call WordPress plugin to replace media
        const wpRes = await fetch(`${pluginBase}/media/${mediaId}/replace`, {
            method: 'POST',
            headers: {
                ...headers,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                image_data: imageData, // base64 encoded
                mime_type: mimeType || 'image/webp'
            })
        })

        if (!wpRes.ok) {
            const error = await wpRes.text()
            console.error(`[ImageFactory Replace] WordPress error: ${error}`)
            return NextResponse.json({ error: 'WordPress replace failed' }, { status: 500 })
        }

        const wpData = await wpRes.json()

        // Update our database with backup URL
        await prisma.projectMedia.update({
            where: { projectId_wpId: { projectId: project.id, wpId: parseInt(mediaId) } },
            data: {
                originalUrl: wpData.backup_url,
                url: wpData.new_url,
                filesize: wpData.new_size,
                width: wpData.new_width,
                height: wpData.new_height,
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
                action: 'COMPRESS',
                details: JSON.stringify({
                    mediaId,
                    backupUrl: wpData.backup_url,
                    newUrl: wpData.new_url,
                    newSize: wpData.new_size
                })
            }
        })

        return NextResponse.json({
            success: true,
            backupUrl: wpData.backup_url,
            newUrl: wpData.new_url,
            newSize: wpData.new_size
        })

    } catch (error: any) {
        console.error("[ImageFactory Replace] Error:", error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
