import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { startCrawl } from '@/lib/crawler/engine'

export async function POST(request: NextRequest) {
    try {
        const session = await auth()
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const body = await request.json()
        const { url, maxPages, delayMs } = body

        if (!url) {
            return NextResponse.json({ error: 'URL is required' }, { status: 400 })
        }

        // Start crawl in background (don't await)
        const jobId = await startCrawl(url, {
            maxPages: maxPages || 500,
            delayMs: delayMs || 1000
        })

        return NextResponse.json({
            success: true,
            jobId,
            message: `Crawl started for ${url}`
        })

    } catch (error: any) {
        console.error('[CrawlLab] Start error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
