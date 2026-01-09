import { NextRequest, NextResponse } from "next/server"
import { db as prisma } from "@/lib/db"
import { auth } from "@/lib/auth"

interface CloudflarePurgeResponse {
    success: boolean
    errors: Array<{ code: number; message: string }>
    messages: string[]
    result: { id: string }
}

export async function POST(request: NextRequest) {
    try {
        const session = await auth()
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const body = await request.json()
        const { projectId, urls } = body

        if (!projectId || !urls || !Array.isArray(urls) || urls.length === 0) {
            return NextResponse.json({ error: "projectId and urls array are required" }, { status: 400 })
        }

        // Get project settings
        const project = await prisma.indexingProject.findUnique({
            where: { id: parseInt(projectId) },
            include: { settings: true }
        })

        if (!project?.settings?.cloudflareApiToken || !project?.settings?.cloudflareZoneId) {
            console.log("[CloudflarePurge] Skipping - Cloudflare not configured for project", projectId)
            return NextResponse.json({
                success: false,
                skipped: true,
                message: "Cloudflare not configured for this project"
            })
        }

        const { cloudflareApiToken, cloudflareZoneId } = project.settings

        console.log(`[CloudflarePurge] Purging ${urls.length} URL(s) from Cloudflare cache`)

        // Call Cloudflare API to purge cache
        const response = await fetch(
            `https://api.cloudflare.com/client/v4/zones/${cloudflareZoneId}/purge_cache`,
            {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${cloudflareApiToken}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ files: urls })
            }
        )

        const result: CloudflarePurgeResponse = await response.json()

        if (!result.success) {
            console.error("[CloudflarePurge] Failed:", result.errors)
            return NextResponse.json({
                success: false,
                error: result.errors[0]?.message || "Unknown error",
                errors: result.errors
            }, { status: 400 })
        }

        console.log(`[CloudflarePurge] Success! Purged ${urls.length} URL(s)`)

        return NextResponse.json({
            success: true,
            purged: urls.length,
            urls
        })

    } catch (error: any) {
        console.error("[CloudflarePurge] Error:", error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
