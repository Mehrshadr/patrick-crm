import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getCrawlStatus } from '@/lib/crawler/engine'

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

        const status = await getCrawlStatus(jobId)

        if (!status) {
            return NextResponse.json({ error: 'Job not found' }, { status: 404 })
        }

        return NextResponse.json({
            success: true,
            job: status
        })

    } catch (error: any) {
        console.error('[CrawlLab] Status error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
