import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { logActivity } from "@/lib/activity-logger"
import { auth } from "@/lib/auth"

// GET - List keywords for a project
export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('projectId')

    if (!projectId) {
        return NextResponse.json({ error: 'projectId required' }, { status: 400 })
    }

    const keywords = await prisma.linkBuildingKeyword.findMany({
        where: { projectId: parseInt(projectId) },
        orderBy: [{ priority: 'desc' }, { keyword: 'asc' }],
        include: {
            logs: {
                where: { status: { in: ['linked', 'pending'] } },
                orderBy: { createdAt: 'desc' }
            },
            _count: { select: { logs: true } }
        }
    })

    return NextResponse.json({ keywords })
}

// POST - Add a new keyword
export async function POST(request: NextRequest) {
    try {
        const data = await request.json()
        const { projectId, keyword, targetUrl, pageTypes, onlyFirst, onlyFirstP } = data

        if (!projectId || !keyword || !targetUrl) {
            return NextResponse.json({ error: 'projectId, keyword, targetUrl required' }, { status: 400 })
        }

        // Auto-calculate priority based on keyword length (longer = higher priority)
        const priority = keyword.length

        const newKeyword = await prisma.linkBuildingKeyword.create({
            data: {
                projectId: parseInt(projectId),
                keyword,
                targetUrl,
                priority,
                pageTypes: pageTypes ? JSON.stringify(pageTypes) : null,
                onlyFirst: onlyFirst ?? true,
                onlyFirstP: onlyFirstP ?? false
            }
        })

        // Log Activity
        const session = await auth()
        await logActivity({
            userId: session?.user?.email,
            userName: session?.user?.name,
            projectId: parseInt(projectId),
            category: 'LINK_BUILDING',
            action: 'CREATED',
            description: `Added keyword: "${keyword}"`,
            details: { targetUrl, priority },
            entityType: 'LinkBuildingKeyword',
            entityId: newKeyword.id,
            entityName: keyword
        })

        return NextResponse.json({ success: true, keyword: newKeyword })
    } catch (error) {
        console.error('Error creating keyword:', error)
        return NextResponse.json({ error: 'Failed to create keyword' }, { status: 500 })
    }
}
