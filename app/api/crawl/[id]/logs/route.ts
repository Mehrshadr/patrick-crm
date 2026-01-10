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
        const level = searchParams.get('level') // info, warn, error
        const limit = parseInt(searchParams.get('limit') || '100')

        const where: any = { jobId }
        if (level) {
            where.level = level
        }

        const logs = await prisma.crawlLog.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            take: limit
        })

        return NextResponse.json({
            success: true,
            logs
        })

    } catch (error: any) {
        console.error('[CrawlLab] Logs error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
