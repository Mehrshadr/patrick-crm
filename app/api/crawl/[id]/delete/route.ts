import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function DELETE(
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

        // Delete in order: images -> links -> pages -> pagespeed -> logs -> job
        await prisma.$transaction([
            prisma.crawledImage.deleteMany({ where: { page: { jobId } } }),
            prisma.crawledLink.deleteMany({ where: { page: { jobId } } }),
            prisma.crawledPage.deleteMany({ where: { jobId } }),
            prisma.pageSpeedResult.deleteMany({ where: { jobId } }),
            prisma.crawlLog.deleteMany({ where: { jobId } }),
            prisma.crawlJob.delete({ where: { id: jobId } })
        ])

        return NextResponse.json({ success: true, message: 'Crawl job deleted' })

    } catch (error: any) {
        console.error('[CrawlLab] Delete error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
