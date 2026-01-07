import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/db"
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

        if (!projectId) {
            return NextResponse.json({ error: "Missing projectId" }, { status: 400 })
        }

        // Get project to find WordPress URL
        const project = await prisma.project.findUnique({
            where: { id: parseInt(projectId) }
        })

        if (!project?.pluginUrl) {
            return NextResponse.json({ error: "Project has no plugin URL configured" }, { status: 400 })
        }

        // Get plugin credentials from project settings
        const credentials = await prisma.projectSettings.findFirst({
            where: { projectId: parseInt(projectId), key: 'wp_plugin_key' }
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
