import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { crawlSitemap, detectPageType } from "@/lib/link-building"

// POST - Crawl site and detect page types
export async function POST(request: NextRequest) {
    try {
        const { projectId, siteUrl } = await request.json()

        if (!projectId || !siteUrl) {
            return NextResponse.json({ error: 'projectId and siteUrl required' }, { status: 400 })
        }

        // Ensure siteUrl has protocol
        const url = siteUrl.startsWith('http') ? siteUrl : `https://${siteUrl}`

        const pages = await crawlSitemap(url)

        // Group by page type
        const byType: Record<string, { count: number; examples: string[] }> = {}
        for (const page of pages) {
            if (!byType[page.type]) {
                byType[page.type] = { count: 0, examples: [] }
            }
            byType[page.type].count++
            if (byType[page.type].examples.length < 3) {
                byType[page.type].examples.push(page.url)
            }
        }

        return NextResponse.json({
            success: true,
            totalPages: pages.length,
            byType,
            pages: pages.slice(0, 50)  // Return first 50 for preview
        })
    } catch (error) {
        console.error('Crawl error:', error)
        return NextResponse.json({ error: 'Failed to crawl site' }, { status: 500 })
    }
}
