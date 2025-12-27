import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// POST - Run link building for a project (with Elementor support)
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

        // Get enabled keywords
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
        const pages = await fetchWordPressPages(siteUrl, auth)
        console.log(`[LinkBuilding] Found ${pages.length} pages to process`)

        const results = {
            processed: 0,
            linked: 0,
            skipped: 0,
            errors: 0
        }

        // Process each page
        for (const page of pages) {
            // Skip homepage
            if (page.link === siteUrl || page.link === siteUrl + '/') {
                continue
            }

            // Check page type filter
            const pageType = detectPageType(page.link)

            // Get Elementor data
            const elementorData = page.meta?._elementor_data

            if (!elementorData) {
                console.log(`[LinkBuilding] Skipping ${page.link} - no Elementor data`)
                continue
            }

            let elementorJson: any[]
            try {
                elementorJson = typeof elementorData === 'string' ? JSON.parse(elementorData) : elementorData
            } catch (e) {
                console.log(`[LinkBuilding] Skipping ${page.link} - invalid Elementor JSON`)
                continue
            }

            let modified = false

            for (const kw of keywords) {
                // Check page type filter
                const pageTypes = kw.pageTypes ? JSON.parse(kw.pageTypes) : []
                if (pageTypes.length > 0 && !pageTypes.includes(pageType)) {
                    continue
                }

                // Process Elementor widgets recursively
                const anchorId = `lb-${kw.id}-${Date.now()}`
                const result = processElementorData(elementorJson, kw, anchorId)

                if (result.modified) {
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
                            linksCreated: { increment: result.count },
                            lastRunAt: new Date()
                        }
                    })

                    results.linked += result.count
                }
            }

            // Update page if modified
            if (modified) {
                const updateSuccess = await updateElementorPage(siteUrl, auth, page, elementorJson)
                if (updateSuccess) {
                    console.log(`[LinkBuilding] Successfully updated ${page.link}`)
                } else {
                    console.error(`[LinkBuilding] Failed to update ${page.link}`)
                    results.errors++
                }
            }

            results.processed++
        }

        return NextResponse.json({ success: true, results })
    } catch (error) {
        console.error('Run link building error:', error)
        return NextResponse.json({ error: 'Failed to run link building' }, { status: 500 })
    }
}

// Process Elementor data recursively to find and modify text content
function processElementorData(elements: any[], keyword: any, anchorId: string): { modified: boolean; count: number } {
    let totalModified = false
    let totalCount = 0

    for (const element of elements) {
        // Check text widgets
        if (element.elType === 'widget' && element.settings) {
            // Text Editor widget
            if (element.widgetType === 'text-editor' && element.settings.editor) {
                const result = replaceInText(element.settings, 'editor', keyword, anchorId)
                if (result.modified) {
                    totalModified = true
                    totalCount += result.count
                }
            }

            // Heading widget
            if (element.widgetType === 'heading' && element.settings.title) {
                const result = replaceInText(element.settings, 'title', keyword, anchorId)
                if (result.modified) {
                    totalModified = true
                    totalCount += result.count
                }
            }

            // Button widget (text)
            if (element.widgetType === 'button' && element.settings.text) {
                const result = replaceInText(element.settings, 'text', keyword, anchorId)
                if (result.modified) {
                    totalModified = true
                    totalCount += result.count
                }
            }
        }

        // Recursively process nested elements
        if (element.elements && Array.isArray(element.elements)) {
            const nestedResult = processElementorData(element.elements, keyword, anchorId)
            if (nestedResult.modified) {
                totalModified = true
                totalCount += nestedResult.count
            }
        }
    }

    return { modified: totalModified, count: totalCount }
}

// Replace keyword in text field
function replaceInText(settings: any, field: string, keyword: any, anchorId: string): { modified: boolean; count: number } {
    const text = settings[field]
    if (!text || typeof text !== 'string') {
        return { modified: false, count: 0 }
    }

    // Check if keyword exists (not already linked)
    const keywordRegex = new RegExp(`(?<!<a[^>]*>)(?<![\\w/>])${escapeRegex(keyword.keyword)}(?![\\w<])(?![^<]*</a>)`, 'gi')

    if (!keywordRegex.test(text)) {
        return { modified: false, count: 0 }
    }

    // Replace (first only if onlyFirst is true)
    let count = 0
    const newText = text.replace(keywordRegex, (match: string) => {
        if (count > 0 && keyword.onlyFirst) return match
        count++
        return `<a href="${keyword.targetUrl}" id="${anchorId}" class="lb-auto-link">${match}</a>`
    })

    if (count > 0) {
        settings[field] = newText
        return { modified: true, count }
    }

    return { modified: false, count: 0 }
}

// Fetch pages from WordPress with meta data
async function fetchWordPressPages(siteUrl: string, auth: string) {
    const allPages: any[] = []

    // Fetch pages with meta
    try {
        const pagesRes = await fetch(`${siteUrl}/wp-json/wp/v2/pages?per_page=100&context=edit`, {
            headers: { 'Authorization': `Basic ${auth}` }
        })
        if (pagesRes.ok) {
            const pages = await pagesRes.json()
            allPages.push(...pages)
        } else {
            console.error('[LinkBuilding] Failed to fetch pages:', await pagesRes.text())
        }
    } catch (e) {
        console.error('Failed to fetch pages:', e)
    }

    return allPages
}

// Update Elementor page via WordPress REST API
async function updateElementorPage(siteUrl: string, auth: string, page: any, elementorData: any[]) {
    try {
        const url = `${siteUrl}/wp-json/wp/v2/pages/${page.id}`

        // Update meta with new Elementor data
        const body = {
            meta: {
                _elementor_data: JSON.stringify(elementorData)
            }
        }

        console.log(`[LinkBuilding] Updating Elementor data for page ${page.id}`)

        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${auth}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        })

        if (!res.ok) {
            const errorText = await res.text()
            console.error(`[LinkBuilding] Failed to update ${page.link}: ${res.status}`, errorText)
            return false
        }

        return true
    } catch (e) {
        console.error('[LinkBuilding] Failed to update page:', e)
        return false
    }
}

// Detect page type from URL
function detectPageType(url: string): string {
    const path = new URL(url).pathname.toLowerCase()
    if (path === '/' || path === '') return 'home'
    if (path.includes('/blog') || path.includes('/post')) return 'blog'
    if (path.includes('/service')) return 'service'
    if (path.includes('/product')) return 'product'
    if (path.includes('/category')) return 'category'
    if (path.includes('/landing')) return 'landing'
    return 'page'
}

// Escape regex special chars
function escapeRegex(str: string) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
