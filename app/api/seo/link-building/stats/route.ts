import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// GET - Get link building statistics for a project
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const projectId = searchParams.get('projectId')

        if (!projectId) {
            return NextResponse.json({ error: 'projectId required' }, { status: 400 })
        }

        const pid = parseInt(projectId)

        // Get total links count
        const totalLinks = await prisma.linkBuildingLog.count({
            where: {
                projectId: pid,
                status: 'linked'
            }
        })

        // Get links this week
        const weekAgo = new Date()
        weekAgo.setDate(weekAgo.getDate() - 7)

        const linksThisWeek = await prisma.linkBuildingLog.count({
            where: {
                projectId: pid,
                status: 'linked',
                createdAt: { gte: weekAgo }
            }
        })

        // Get pending count
        const pendingCount = await prisma.linkBuildingLog.count({
            where: {
                projectId: pid,
                status: 'pending'
            }
        })

        // Get failed/skipped count
        const skippedCount = await prisma.linkBuildingLog.count({
            where: {
                projectId: pid,
                status: 'skipped'
            }
        })

        // Calculate success rate
        const totalProcessed = totalLinks + skippedCount
        const successRate = totalProcessed > 0 ? Math.round((totalLinks / totalProcessed) * 100) : 0

        // Get top keywords by links created
        const topKeywords = await prisma.linkBuildingKeyword.findMany({
            where: {
                projectId: pid,
                linksCreated: { gt: 0 }
            },
            orderBy: { linksCreated: 'desc' },
            take: 5,
            select: {
                id: true,
                keyword: true,
                targetUrl: true,
                linksCreated: true
            }
        })

        // Get recent activity (last 10 linked logs)
        const recentLinks = await prisma.linkBuildingLog.findMany({
            where: {
                projectId: pid,
                status: 'linked'
            },
            orderBy: { createdAt: 'desc' },
            take: 10,
            include: {
                keyword: {
                    select: { keyword: true }
                }
            }
        })

        return NextResponse.json({
            totalLinks,
            linksThisWeek,
            pendingCount,
            skippedCount,
            successRate,
            topKeywords,
            recentLinks
        })

    } catch (error: any) {
        console.error('[LinkBuilding:Stats] Error:', error)
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 })
    }
}
