import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth()
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { id } = await params
        const jobId = parseInt(id)

        if (isNaN(jobId)) {
            return NextResponse.json({ error: 'Invalid job ID' }, { status: 400 })
        }

        const { searchParams } = new URL(request.url)
        const page = parseInt(searchParams.get('page') || '1')
        const limit = parseInt(searchParams.get('limit') || '100000')
        const skip = (page - 1) * limit

        const [pages, total] = await Promise.all([
            prisma.crawledPage.findMany({
                where: { jobId },
                orderBy: { crawledAt: 'desc' },
                skip,
                take: limit,
                include: {
                    _count: {
                        select: {
                            images: true,
                            links: true
                        }
                    }
                }
            }),
            prisma.crawledPage.count({ where: { jobId } })
        ])

        return NextResponse.json({
            success: true,
            pages,
            total,
            page,
            totalPages: Math.ceil(total / limit)
        })

    } catch (error: any) {
        console.error('[CrawlLab] Pages error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
