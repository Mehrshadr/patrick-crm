import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// GET - Fetch logs for a project
export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('projectId')
    const status = searchParams.get('status')
    const keywordId = searchParams.get('keywordId')
    const limit = parseInt(searchParams.get('limit') || '50')

    if (!projectId) {
        return NextResponse.json({ error: 'projectId required' }, { status: 400 })
    }

    const where = {
        projectId: parseInt(projectId),
        ...(keywordId && { keywordId: parseInt(keywordId) }),
        ...(status && { status })
    }

    const [logs, total] = await Promise.all([
        prisma.linkBuildingLog.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            take: limit,
            include: {
                keyword: { select: { keyword: true, targetUrl: true } }
            }
        }),
        prisma.linkBuildingLog.count({ where })
    ])

    return NextResponse.json({ logs, total })
}
