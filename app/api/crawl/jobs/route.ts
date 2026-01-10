import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
    try {
        const session = await auth()
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const jobs = await prisma.crawlJob.findMany({
            orderBy: { createdAt: 'desc' },
            take: 50,
            include: {
                _count: {
                    select: {
                        pages: true,
                        logs: true
                    }
                }
            }
        })

        // Get image counts for each job
        const jobsWithStats = await Promise.all(jobs.map(async (job) => {
            const imageCount = await prisma.crawledImage.count({
                where: { page: { jobId: job.id } }
            })
            const linkCount = await prisma.crawledLink.count({
                where: { page: { jobId: job.id } }
            })
            return {
                ...job,
                pageCount: job._count.pages,
                imageCount,
                linkCount
            }
        }))

        return NextResponse.json({
            success: true,
            jobs: jobsWithStats
        })

    } catch (error: any) {
        console.error('[CrawlLab] Jobs list error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
