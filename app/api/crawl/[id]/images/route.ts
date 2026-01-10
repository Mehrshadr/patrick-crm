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
        const limit = parseInt(searchParams.get('limit') || '10000')
        const missingAlt = searchParams.get('missingAlt') === 'true'
        const skip = (page - 1) * limit

        const where: any = {
            page: { jobId }
        }

        if (missingAlt) {
            where.OR = [
                { alt: null },
                { alt: '' }
            ]
        }

        const [images, total] = await Promise.all([
            prisma.crawledImage.findMany({
                where,
                orderBy: { id: 'asc' },
                skip,
                take: limit,
                include: {
                    page: {
                        select: {
                            url: true,
                            title: true
                        }
                    }
                }
            }),
            prisma.crawledImage.count({ where })
        ])

        // Stats
        const stats = {
            total: await prisma.crawledImage.count({ where: { page: { jobId } } }),
            missingAlt: await prisma.crawledImage.count({
                where: {
                    page: { jobId },
                    OR: [{ alt: null }, { alt: '' }]
                }
            })
        }

        return NextResponse.json({
            success: true,
            images,
            stats,
            total,
            page,
            totalPages: Math.ceil(total / limit)
        })

    } catch (error: any) {
        console.error('[CrawlLab] Images error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
