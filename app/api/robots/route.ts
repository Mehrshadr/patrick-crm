import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { fetchRobotsTxt } from '@/lib/robots-parser'

/**
 * Fetch and parse robots.txt for any URL
 * 
 * GET /api/robots?url=https://example.com
 * 
 * Returns parsed robots.txt data including:
 * - User-agent rules (disallow/allow)
 * - Sitemaps
 * - Crawl delay
 */
export async function GET(request: NextRequest) {
    try {
        const session = await auth()
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const url = request.nextUrl.searchParams.get('url')

        if (!url) {
            return NextResponse.json({ error: 'URL is required' }, { status: 400 })
        }

        const robotsData = await fetchRobotsTxt(url)

        return NextResponse.json({
            success: true,
            data: robotsData
        })

    } catch (error: any) {
        console.error('[Robots] Error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
