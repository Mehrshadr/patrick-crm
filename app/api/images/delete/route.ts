import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const dynamic = 'force-dynamic'

// POST: Delete all media data for a project (Admin only)
export async function POST(req: NextRequest) {
    try {
        const body = await req.json()
        const { projectId } = body

        if (!projectId) {
            return NextResponse.json({ error: "Project ID required" }, { status: 400 })
        }

        // Delete all media for this project (cascades to MediaChangeLog)
        const deleteMedia = await prisma.projectMedia.deleteMany({
            where: { projectId: parseInt(projectId) }
        })

        // Delete all logs for this project
        const deleteLogs = await prisma.imageFactoryLog.deleteMany({
            where: { projectId: parseInt(projectId) }
        })

        // Delete all snapshots for this project
        const deleteSnapshots = await prisma.imageFactorySnapshot.deleteMany({
            where: { projectId: parseInt(projectId) }
        })

        console.log(`[ImageFactory] Deleted ${deleteMedia.count} media, ${deleteLogs.count} logs, ${deleteSnapshots.count} snapshots for project ${projectId}`)

        return NextResponse.json({
            success: true,
            deleted: {
                media: deleteMedia.count,
                logs: deleteLogs.count,
                snapshots: deleteSnapshots.count
            }
        })

    } catch (error: any) {
        console.error("[ImageFactory Delete] Error:", error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
