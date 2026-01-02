import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET - Debug cached page content
export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url)
    const projectId = searchParams.get('projectId')
    const pageUrl = searchParams.get('pageUrl')
    const keyword = searchParams.get('keyword')

    if (!projectId) {
        return NextResponse.json({ error: 'projectId required' }, { status: 400 })
    }

    // If pageUrl provided, show that specific page
    if (pageUrl) {
        const page = await prisma.projectPage.findFirst({
            where: {
                projectId: parseInt(projectId),
                url: { contains: pageUrl }
            }
        })

        if (!page) {
            return NextResponse.json({ error: 'Page not found in cache', searchedUrl: pageUrl })
        }

        const content = page.content || ''
        const contentLower = content.toLowerCase()
        const keywordLower = keyword?.toLowerCase() || ''

        return NextResponse.json({
            page: {
                id: page.id,
                cmsId: page.cmsId,
                url: page.url,
                title: page.title,
                pageType: page.pageType,
                hasRedirect: page.hasRedirect,
                redirectUrl: page.redirectUrl,
                lastSyncedAt: page.lastSyncedAt,
                contentLength: content.length,
                contentPreview: content.substring(0, 500) + (content.length > 500 ? '...' : ''),
            },
            keywordCheck: keyword ? {
                keyword: keyword,
                found: contentLower.includes(keywordLower),
                occurrences: (contentLower.match(new RegExp(keywordLower, 'g')) || []).length
            } : null
        })
    }

    // If keyword provided, show all pages where keyword was found
    if (keyword) {
        const allPages = await prisma.projectPage.findMany({
            where: { projectId: parseInt(projectId) },
            select: { id: true, cmsId: true, url: true, title: true, content: true }
        })

        const keywordLower = keyword.toLowerCase()
        const matchingPages = allPages
            .filter(p => p.content?.toLowerCase().includes(keywordLower))
            .map(p => ({
                id: p.id,
                cmsId: p.cmsId,
                url: p.url,
                title: p.title,
                contentPreview: p.content?.substring(0, 200) || ''
            }))

        return NextResponse.json({
            keyword,
            totalPages: allPages.length,
            matchingCount: matchingPages.length,
            matchingPages
        })
    }

    // Default: show summary
    const pages = await prisma.projectPage.findMany({
        where: { projectId: parseInt(projectId) },
        select: { id: true, url: true, title: true, hasRedirect: true }
    })

    return NextResponse.json({
        projectId,
        totalPages: pages.length,
        pages: pages.slice(0, 20) // Show first 20
    })
}
