import { NextRequest, NextResponse } from "next/server"
import { db as prisma } from "@/lib/db"
import { auth } from "@/lib/auth"
import { logActivity } from "@/lib/activity-logger"

// POST - Restore original image from backup
export async function POST(request: NextRequest) {
    try {
        const session = await auth()
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const body = await request.json()
        const { projectId, mediaId, backupPath } = body

        if (!projectId || !mediaId) {
            return NextResponse.json({
                error: "projectId and mediaId are required"
            }, { status: 400 })
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

        console.log(`[RestoreImage] Restoring media ID: ${mediaId}`)

        // Call WordPress restore endpoint
        const pluginBase = project.settings.cmsUrl.replace(/\/$/, '')
        const restoreUrl = `${pluginBase}/wp-json/mehrana/v1/media/${mediaId}/restore`

        const restoreRes = await fetch(restoreUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-MAP-API-Key': project.settings.cmsApiKey
            },
            body: JSON.stringify({
                backup_path: backupPath
            })
        })

        if (!restoreRes.ok) {
            const errorText = await restoreRes.text()
            console.error(`[RestoreImage] Restore failed:`, errorText)
            return NextResponse.json({
                error: `Failed to restore media: ${restoreRes.status}`
            }, { status: restoreRes.status })
        }

        const restoreData = await restoreRes.json()

        if (!restoreData.success) {
            return NextResponse.json({
                error: restoreData.error || "Failed to restore media"
            }, { status: 500 })
        }

        console.log(`[RestoreImage] Successfully restored media ${mediaId}`)

        // Log activity
        logActivity({
            userId: session?.user?.email,
            userName: session?.user?.name,
            projectId: parseInt(projectId),
            category: 'IMAGE_FACTORY',
            action: 'RESTORED',
            description: `Restored original image from backup (ID: ${mediaId})`,
            details: {
                mediaId,
                backupPath
            }
        })

        return NextResponse.json({
            success: true,
            mediaId,
            restoredUrl: restoreData.restored_url,
            restoredSize: restoreData.restored_size
        })

    } catch (error: any) {
        console.error("[RestoreImage] Error:", error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
