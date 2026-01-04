import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const dynamic = 'force-dynamic'

// GET: Fetch snapshots for charts
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url)
        const projectId = searchParams.get('projectId')

        if (!projectId) {
            return NextResponse.json({ error: "Project ID required" }, { status: 400 })
        }

        // Get all snapshots ordered by date
        const snapshots = await prisma.imageFactorySnapshot.findMany({
            where: { projectId: parseInt(projectId) },
            orderBy: { recordedAt: 'asc' }
        })

        // Format for Recharts
        const chartData = snapshots.map(s => ({
            date: s.recordedAt.toISOString(),
            total: s.totalCount,
            heavy: s.heavyCount,
            missingAlt: s.missingAltCount
        }))

        return NextResponse.json({
            success: true,
            snapshots: chartData,
            count: chartData.length
        })

    } catch (error: any) {
        console.error("[ImageFactory Snapshots] Error:", error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
