import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// GET - Fetch logs for a project
export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('projectId')
    const keywordId = searchParams.get('keywordId')
    const limit = parseInt(searchParams.get('limit') || '50')

    if (!projectId) {
        return NextResponse.json({ error: 'projectId required' }, { status: 400 })
    }

    const logs = await prisma.linkBuildingLog.findMany({
        where: {
            projectId: parseInt(projectId),
            ...(keywordId && { keywordId: parseInt(keywordId) })
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        include: {
            keyword: { select: { keyword: true, targetUrl: true } }
        }
    })

    return NextResponse.json({ logs })
}
