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
        const statusCode = searchParams.get('statusCode')
        const urlType = searchParams.get('urlType')

        // Build where clause (same as pages route)
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

        // Fetch ALL matching pages (no pagination)
        const pages = await prisma.crawledPage.findMany({
            where,
            orderBy: { crawledAt: 'desc' },
            select: {
                url: true,
                statusCode: true,
                title: true,
                loadTimeMs: true,
                wordCount: true,
                crawledAt: true
            }
        })

        // Generate CSV
        const csvHeader = 'URL,Status,Title,Load Time (ms),Word Count,Crawled At\n'
        const csvRows = pages.map(page => {
            const title = page.title ? `"${page.title.replace(/"/g, '""')}"` : ''
            const date = page.crawledAt ? new Date(page.crawledAt).toISOString() : ''
            return `"${page.url}",${page.statusCode},${title},${page.loadTimeMs || ''},${page.wordCount || ''},${date}`
        }).join('\n')

        const csvContent = csvHeader + csvRows

        // Return CSV response
        return new NextResponse(csvContent, {
            headers: {
                'Content-Type': 'text/csv',
                'Content-Disposition': `attachment; filename="crawl-${jobId}-export.csv"`
            }
        })

    } catch (error: any) {
        console.error('[CrawlLab] Export error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
