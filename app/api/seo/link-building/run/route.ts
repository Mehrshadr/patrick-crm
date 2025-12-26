import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// POST - Run link building for a project
export async function POST(request: NextRequest) {
    try {
        const { projectId, keywordIds } = await request.json()

        if (!projectId) {
            return NextResponse.json({ error: 'projectId required' }, { status: 400 })
        }

        // Get project settings
        const settings = await prisma.projectSettings.findUnique({
            where: { projectId: parseInt(projectId) }
        })

        if (!settings?.cmsUsername || !settings?.cmsAppPassword) {
            return NextResponse.json({ error: 'WordPress credentials not configured' }, { status: 400 })
        }

        // Get project domain
        const project = await prisma.indexingProject.findUnique({
            where: { id: parseInt(projectId) }
        })

        if (!project?.domain) {
            return NextResponse.json({ error: 'Project domain not set' }, { status: 400 })
        }

        const siteUrl = project.domain.startsWith('http') ? project.domain : `https://${project.domain}`
        const auth = Buffer.from(`${settings.cmsUsername}:${settings.cmsAppPassword}`).toString('base64')

        // Get enabled keywords (or specific ones if provided)
        const keywords = await prisma.linkBuildingKeyword.findMany({
            where: {
                projectId: parseInt(projectId),
                isEnabled: true,
                ...(keywordIds?.length && { id: { in: keywordIds } })
            },
            orderBy: { priority: 'desc' }
        })

        if (keywords.length === 0) {
            return NextResponse.json({ error: 'No keywords to process' }, { status: 400 })
        }

        // Fetch pages from WordPress
        const pages = await fetchWordPressPages(siteUrl, auth, keywords)

        const results = {
            processed: 0,
            linked: 0,
            skipped: 0,
            errors: 0,
            logs: [] as { pageUrl: string; keyword: string; status: string; message: string }[]
        }

        // Process each page
        for (const page of pages) {
            // Skip homepage
            if (page.link === siteUrl || page.link === siteUrl + '/') {
                continue
            }

            let content = page.content?.rendered || ''
            let modified = false

            for (const kw of keywords) {
                // Check page type filter
                const pageTypes = kw.pageTypes ? JSON.parse(kw.pageTypes) : []
                const pageType = detectPageType(page.link)

                if (pageTypes.length > 0 && !pageTypes.includes(pageType)) {
                    continue
                }

                // Check if keyword exists in content (not already linked)
                const keywordRegex = new RegExp(`(?<!<a[^>]*>)(?<![\\w/>])${escapeRegex(kw.keyword)}(?![\\w<])(?![^<]*</a>)`, 'gi')

                if (keywordRegex.test(content)) {
                    // Generate anchor ID
                    const anchorId = `lb-${kw.id}-${Date.now()}`

                    // Replace first occurrence only (if onlyFirst is true)
                    let replaced = false
                    content = content.replace(keywordRegex, (match: string) => {
                        if (replaced && kw.onlyFirst) return match
                        replaced = true
                        return `<a href="${kw.targetUrl}" id="${anchorId}" class="lb-auto-link">${match}</a>`
                    })

                    if (replaced) {
                        modified = true

                        // Log the insertion
                        await prisma.linkBuildingLog.create({
                            data: {
                                projectId: parseInt(projectId),
                                keywordId: kw.id,
                                pageUrl: page.link,
                                pageTitle: page.title?.rendered || '',
                                anchorId,
                                status: 'linked',
                                message: `Linked "${kw.keyword}" to ${kw.targetUrl}`
                            }
                        })

                        // Update keyword stats
                        await prisma.linkBuildingKeyword.update({
                            where: { id: kw.id },
                            data: {
                                linksCreated: { increment: 1 },
                                lastRunAt: new Date()
                            }
                        })

                        results.linked++
                        results.logs.push({
                            pageUrl: page.link,
                            keyword: kw.keyword,
                            status: 'linked',
                            message: `Added link to ${kw.targetUrl}`
                        })
                    }
                }
            }

            // Update page if modified
            if (modified) {
                const updateSuccess = await updateWordPressPage(siteUrl, auth, page, content)
                if (!updateSuccess) {
                    results.errors++
                }
            }

            results.processed++
        }

        return NextResponse.json({
            success: true,
            results
        })
    } catch (error) {
        console.error('Run link building error:', error)
        return NextResponse.json({ error: 'Failed to run link building' }, { status: 500 })
    }
}

// Helper: Fetch pages from WordPress
async function fetchWordPressPages(siteUrl: string, auth: string, keywords: any[]) {
    const allPages: any[] = []

    // Fetch pages
    try {
        const pagesRes = await fetch(`${siteUrl}/wp-json/wp/v2/pages?per_page=100`, {
            headers: { 'Authorization': `Basic ${auth}` }
        })
        if (pagesRes.ok) {
            const pages = await pagesRes.json()
            allPages.push(...pages)
        }
    } catch (e) {
        console.error('Failed to fetch pages:', e)
    }

    // Fetch posts
    try {
        const postsRes = await fetch(`${siteUrl}/wp-json/wp/v2/posts?per_page=100`, {
            headers: { 'Authorization': `Basic ${auth}` }
        })
        if (postsRes.ok) {
            const posts = await postsRes.json()
            allPages.push(...posts.map((p: any) => ({ ...p, _type: 'post' })))
        }
    } catch (e) {
        console.error('Failed to fetch posts:', e)
    }

    return allPages
}

// Helper: Update WordPress page
async function updateWordPressPage(siteUrl: string, auth: string, page: any, content: string) {
    try {
        const endpoint = page._type === 'post' ? 'posts' : 'pages'
        const res = await fetch(`${siteUrl}/wp-json/wp/v2/${endpoint}/${page.id}`, {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${auth}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ content })
        })
        return res.ok
    } catch (e) {
        console.error('Failed to update page:', e)
        return false
    }
}

// Helper: Detect page type from URL
function detectPageType(url: string): string {
    const path = new URL(url).pathname.toLowerCase()
    if (path === '/' || path === '') return 'home'
    if (path.includes('/blog') || path.includes('/post')) return 'blog'
    if (path.includes('/service')) return 'service'
    if (path.includes('/product')) return 'product'
    if (path.includes('/category')) return 'category'
    return 'page'
}

// Helper: Escape regex special chars
function escapeRegex(str: string) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
