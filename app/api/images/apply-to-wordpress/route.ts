import { NextRequest, NextResponse } from "next/server"
import { db as prisma } from "@/lib/db"
import { auth } from "@/lib/auth"
import { logActivity } from "@/lib/activity-logger"

// POST - Apply compressed image to WordPress (replace media)
export async function POST(request: NextRequest) {
    try {
        const session = await auth()
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const body = await request.json()
        const { projectId, imageUrl, base64, mimeType } = body

        if (!projectId || !imageUrl || !base64) {
            return NextResponse.json({
                error: "projectId, imageUrl, and base64 are required"
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

        console.log(`[ApplyToWP] Looking for media ID for: ${imageUrl}`)

        // Step 1: Get media ID from URL
        // First try to extract from uploads path
        const pluginBase = project.settings.cmsUrl.replace(/\/$/, '')

        // Try to find media by URL
        const searchUrl = `${pluginBase}/wp-json/mehrana/v1/find-media?url=${encodeURIComponent(imageUrl)}`

        const searchRes = await fetch(searchUrl, {
            method: 'GET',
            headers: {
                'X-MAP-API-Key': project.settings.cmsApiKey
            }
        })

        if (!searchRes.ok) {
            console.error(`[ApplyToWP] Find media failed:`, await searchRes.text())
            return NextResponse.json({
                error: "Could not find media in WordPress. Image might be from external source."
            }, { status: 400 })
        }

        const searchData = await searchRes.json()

        if (!searchData.success || !searchData.media_id) {
            return NextResponse.json({
                error: "Could not find media ID. Image might be from external source or not in media library."
            }, { status: 400 })
        }

        const mediaId = searchData.media_id
        console.log(`[ApplyToWP] Found media ID: ${mediaId}`)

        // Step 2: Replace media with compressed version
        const replaceUrl = `${pluginBase}/wp-json/mehrana/v1/media/${mediaId}/replace`

        const replaceRes = await fetch(replaceUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-MAP-API-Key': project.settings.cmsApiKey
            },
            body: JSON.stringify({
                image_data: base64,
                mime_type: mimeType || 'image/webp'
            })
        })

        if (!replaceRes.ok) {
            const errorText = await replaceRes.text()
            console.error(`[ApplyToWP] Replace failed:`, errorText)
            return NextResponse.json({
                error: `Failed to replace media: ${replaceRes.status}`
            }, { status: replaceRes.status })
        }

        const replaceData = await replaceRes.json()

        if (!replaceData.success) {
            return NextResponse.json({
                error: replaceData.error || "Failed to replace media"
            }, { status: 500 })
        }

        console.log(`[ApplyToWP] Successfully replaced media ${mediaId}`)

        // Update PageImage in database with new size
        const newSizeBytes = body.newSizeBytes || replaceData.new_size || 0
        if (newSizeBytes > 0) {
            await prisma.pageImage.updateMany({
                where: {
                    projectId: parseInt(projectId),
                    url: imageUrl
                },
                data: {
                    sizeBytes: newSizeBytes,
                    sizeKB: newSizeBytes / 1024,
                    optimized: true
                }
            })
        }

        // Log activity
        logActivity({
            userId: session?.user?.email,
            userName: session?.user?.name,
            projectId: parseInt(projectId),
            category: 'IMAGE_FACTORY',
            action: 'APPLIED',
            description: `Applied compressed image to WordPress (ID: ${mediaId})`,
            details: {
                mediaId,
                imageUrl,
                backupPath: replaceData.backup_path,
                newSizeBytes
            }
        })

        return NextResponse.json({
            success: true,
            mediaId,
            backupPath: replaceData.backup_path,
            newUrl: replaceData.new_url,
            newSize: replaceData.new_size
        })

    } catch (error: any) {
        console.error("[ApplyToWP] Error:", error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
