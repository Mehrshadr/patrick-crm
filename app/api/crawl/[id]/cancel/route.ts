import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(
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

        // Update job status to cancelled
        const job = await prisma.crawlJob.update({
            where: { id: jobId },
            data: {
                status: 'cancelled',
                completedAt: new Date()
            }
        })

        // Log cancellation
        await prisma.crawlLog.create({
            data: {
                jobId,
                level: 'warn',
                message: 'Job cancelled by user'
            }
        })

        return NextResponse.json({
            success: true,
            message: `Job ${jobId} cancelled`
        })

    } catch (error: any) {
        console.error('[CrawlLab] Cancel error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
