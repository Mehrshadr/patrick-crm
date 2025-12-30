import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { logActivity } from "@/lib/activity-logger"
import { auth } from "@/lib/auth"

// GET /api/seo/projects/[id]/urls - List URLs for a project
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const projectId = parseInt(id)

        if (isNaN(projectId)) {
            return NextResponse.json({ error: 'Invalid project ID' }, { status: 400 })
        }

        const urls = await prisma.indexingUrl.findMany({
            where: { projectId },
            orderBy: { createdAt: 'desc' }
        })

        return NextResponse.json(urls)
    } catch (error) {
        console.error('Failed to fetch URLs:', error)
        return NextResponse.json({ error: 'Failed to fetch URLs' }, { status: 500 })
    }
}

// POST /api/seo/projects/[id]/urls - Add URLs to a project
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const projectId = parseInt(id)
        const body = await request.json()
        const { urls, interval } = body

        if (isNaN(projectId)) {
            return NextResponse.json({ error: 'Invalid project ID' }, { status: 400 })
        }

        if (!urls || !Array.isArray(urls) || urls.length === 0) {
            return NextResponse.json({ error: 'URLs array is required' }, { status: 400 })
        }

        // Validate URLs
        const validUrls: string[] = []
        for (const url of urls) {
            const trimmed = url.trim()
            if (trimmed) {
                try {
                    new URL(trimmed)
                    validUrls.push(trimmed)
                } catch {
                    // Skip invalid URLs
                }
            }
        }

        if (validUrls.length === 0) {
            return NextResponse.json({ error: 'No valid URLs provided' }, { status: 400 })
        }

        // Check for existing URLs
        const existingUrls = await prisma.indexingUrl.findMany({
            where: {
                projectId,
                url: { in: validUrls }
            },
            select: { url: true }
        })

        const existingSet = new Set(existingUrls.map(u => u.url))
        const newUrls = validUrls.filter(url => !existingSet.has(url))

        if (newUrls.length === 0) {
            return NextResponse.json({
                added: 0,
                skipped: validUrls.length,
                message: 'All URLs already exist'
            })
        }

        // Create new URLs (using transaction for SQLite compatibility)
        await prisma.$transaction(
            newUrls.map(url =>
                prisma.indexingUrl.create({
                    data: {
                        projectId,
                        url,
                        status: 'PENDING',
                        interval: interval || null
                    }
                })
            )
        )

        return NextResponse.json({
            added: newUrls.length,
            skipped: validUrls.length - newUrls.length
        }, { status: 201 })

        // Log Activity
        const session = await auth()
        await logActivity({
            userId: session?.user?.email,
            userName: session?.user?.name,
            projectId,
            category: 'LINK_INDEXING',
            action: 'ADDED',
            description: `Added ${newUrls.length} URLs to index`,
            details: { count: newUrls.length, skipped: validUrls.length - newUrls.length },
            entityType: 'IndexingProject',
            entityId: projectId,
            entityName: `Batch Import`
        })
    } catch (error) {
        console.error('Failed to add URLs:', error)
        return NextResponse.json({ error: 'Failed to add URLs' }, { status: 500 })
    }
}
