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
        const limit = parseInt(searchParams.get('limit') || '25')
        const skip = (page - 1) * limit

        // Filters
        const statusCode = searchParams.get('statusCode') // e.g., '200', '404', 'error' (4xx/5xx)
        const urlType = searchParams.get('urlType') // e.g., 'product', 'blog', 'category', 'page'

        // Build where clause
        const where: any = { jobId }

        if (statusCode) {
            if (statusCode === '200') {
                where.statusCode = 200
            } else if (statusCode === '404') {
                where.statusCode = 404
            } else if (statusCode === 'error') {
                where.statusCode = { gte: 400 }
            } else if (statusCode === '3xx') {
                where.statusCode = { gte: 300, lt: 400 }
            }
        }

        if (urlType && urlType !== 'all') {
            // URL type filtering using database patterns
            if (urlType === 'product') {
                where.url = { contains: '/product' }
            } else if (urlType === 'blog') {
                where.OR = [
                    { url: { contains: '/blog' } },
                    { url: { contains: '/Blog' } },
                    { url: { contains: '/BLOG' } },
                    { url: { contains: '/post' } },
                    { url: { contains: '/Post' } },
                    { url: { contains: '/article' } },
                    { url: { contains: '/news' } }
                ]
            } else if (urlType === 'category') {
                where.OR = [
                    { url: { contains: '/category' } },
                    { url: { contains: '/Category' } },
                    { url: { contains: '/collection' } },
                    { url: { contains: '/Collection' } }
                ]
            }
        }

        const [pages, total] = await Promise.all([
            prisma.crawledPage.findMany({
                where,
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
            prisma.crawledPage.count({ where })
        ])

        // Get counts for each filter type (for badges)
        const counts = await Promise.all([
            prisma.crawledPage.count({ where: { jobId } }),
            prisma.crawledPage.count({ where: { jobId, statusCode: 200 } }),
            prisma.crawledPage.count({ where: { jobId, statusCode: 404 } }),
            prisma.crawledPage.count({ where: { jobId, statusCode: { gte: 400 } } }),
            prisma.crawledPage.count({ where: { jobId, url: { contains: '/product' } } }),
            prisma.crawledPage.count({
                where: {
                    jobId, OR: [
                        { url: { contains: '/blog' } },
                        { url: { contains: '/Blog' } },
                        { url: { contains: '/BLOG' } },
                        { url: { contains: '/post' } },
                        { url: { contains: '/Post' } },
                        { url: { contains: '/article' } },
                        { url: { contains: '/news' } }
                    ]
                }
            }),
            prisma.crawledPage.count({
                where: {
                    jobId, OR: [
                        { url: { contains: '/category' } },
                        { url: { contains: '/Category' } },
                        { url: { contains: '/collection' } },
                        { url: { contains: '/Collection' } }
                    ]
                }
            })
        ])

        return NextResponse.json({
            success: true,
            pages,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
            counts: {
                all: counts[0],
                ok: counts[1],
                notFound: counts[2],
                errors: counts[3],
                products: counts[4],
                blog: counts[5],
                categories: counts[6]
            }
        })

    } catch (error: any) {
        console.error('[CrawlLab] Pages error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
