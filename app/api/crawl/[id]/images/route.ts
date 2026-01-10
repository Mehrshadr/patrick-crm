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
        const filter = searchParams.get('filter') // 'all', 'missing-alt', 'duplicates'
        const skip = (page - 1) * limit

        // Get all unique image URLs for this job first
        const allImages = await prisma.crawledImage.findMany({
            where: { page: { jobId } },
            select: { url: true, alt: true },
            distinct: ['url']
        })

        // Build URL counts for duplicate detection
        const urlCounts = new Map<string, number>()
        const allImagesFull = await prisma.crawledImage.findMany({
            where: { page: { jobId } },
            select: { url: true }
        })
        allImagesFull.forEach(img => {
            const filename = img.url.split('/').pop() || ''
            urlCounts.set(filename, (urlCounts.get(filename) || 0) + 1)
        })

        // Filter for duplicates (filename seen more than once)
        const duplicateFilenames = new Set<string>()
        urlCounts.forEach((count, filename) => {
            if (count > 1) duplicateFilenames.add(filename)
        })

        // Build where clause based on filter
        const where: any = { page: { jobId } }
        if (filter === 'missing-alt') {
            where.OR = [{ alt: null }, { alt: '' }]
        }

        // For duplicates, we need to get IDs of duplicate images
        let imageIds: number[] | undefined
        if (filter === 'duplicates') {
            const dupeImages = await prisma.crawledImage.findMany({
                where: { page: { jobId } },
                select: { id: true, url: true }
            })
            imageIds = dupeImages
                .filter(img => duplicateFilenames.has(img.url.split('/').pop() || ''))
                .map(img => img.id)
            where.id = { in: imageIds.slice(skip, skip + limit) }
        }

        const [images, total] = await Promise.all([
            filter === 'duplicates'
                ? prisma.crawledImage.findMany({
                    where: { id: { in: imageIds?.slice(skip, skip + limit) || [] } },
                    include: { page: { select: { url: true, title: true } } }
                })
                : prisma.crawledImage.findMany({
                    where,
                    orderBy: { id: 'asc' },
                    skip,
                    take: limit,
                    distinct: filter === 'all' ? ['url'] : undefined,
                    include: { page: { select: { url: true, title: true } } }
                }),
            filter === 'duplicates'
                ? imageIds?.length || 0
                : prisma.crawledImage.count({ where })
        ])

        // Stats - unique counts
        const uniqueImages = allImages.length
        const missingAltUnique = allImages.filter(img => !img.alt).length
        const duplicateCount = Array.from(urlCounts.values()).filter(c => c > 1).length

        return NextResponse.json({
            success: true,
            images,
            total: filter === 'duplicates' ? (imageIds?.length || 0) : total,
            page,
            limit,
            totalPages: Math.ceil((filter === 'duplicates' ? (imageIds?.length || 0) : (total as number)) / limit),
            stats: {
                totalUsage: allImagesFull.length,    // Total image usages across all pages
                uniqueImages: uniqueImages,          // Unique image URLs
                missingAlt: missingAltUnique,        // Unique images without alt
                duplicates: duplicateCount           // Images used on multiple pages
            }
        })

    } catch (error: any) {
        console.error('[CrawlLab] Images error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
