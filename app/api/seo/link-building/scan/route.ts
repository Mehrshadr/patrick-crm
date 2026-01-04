import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

/**
 * Extract only linkable text from HTML content.
 * Excludes: headings (h1-h6), bold/strong, links, alt text, scripts, styles
 * Keeps: paragraph text, spans, divs (plain text only)
 */
function extractLinkableText(html: string): string {
    if (!html) return ''

    return html
        // Remove scripts and styles completely
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        // Remove headings (h1-h6) - these shouldn't be linked
        .replace(/<h[1-6][^>]*>[\s\S]*?<\/h[1-6]>/gi, '')
        // Remove links (already linked text)
        .replace(/<a[^>]*>[\s\S]*?<\/a>/gi, '')
        // Remove bold/strong (often keywords, shouldn't be linked)
        .replace(/<(strong|b)[^>]*>[\s\S]*?<\/(strong|b)>/gi, '')
        // Remove images and their alt text
        .replace(/<img[^>]*>/gi, '')
        // Remove figure/figcaption (image captions)
        .replace(/<figcaption[^>]*>[\s\S]*?<\/figcaption>/gi, '')
        // Remove buttons
        .replace(/<button[^>]*>[\s\S]*?<\/button>/gi, '')
        // Remove all remaining HTML tags but keep text
        .replace(/<[^>]+>/g, ' ')
        // Clean up entities and whitespace
        .replace(/&nbsp;/g, ' ')
        .replace(/&[a-z]+;/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim()
}

// POST - Scan content for link building candidates
export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { action, projectId, pageId, keywordIds } = body

        if (!projectId) {
            console.error('[Scan] Missing projectId in body:', body)
            return NextResponse.json({ error: 'projectId required' }, { status: 400 })
        }

        // Get project settings
        const settings = await prisma.projectSettings.findUnique({
            where: { projectId: parseInt(projectId) }
        })

        if (!settings?.cmsApiKey && (!settings?.cmsUsername || !settings?.cmsAppPassword)) {
            return NextResponse.json({ error: 'WordPress credentials not configured.' }, { status: 400 })
        }

        // Get project domain
        const project = await prisma.indexingProject.findUnique({
            where: { id: parseInt(projectId) }
        })

        if (!project?.domain) {
            return NextResponse.json({ error: 'Project domain not set' }, { status: 400 })
        }

        const siteUrl = project.domain.startsWith('http') ? project.domain : `https://${project.domain}`
        const pluginBase = `${siteUrl}/wp-json/mehrana/v1`

        // Build auth headers
        const authHeaders: Record<string, string> = {}
        if (settings.cmsApiKey) {
            authHeaders['X-MAP-API-Key'] = settings.cmsApiKey
        } else {
            const auth = Buffer.from(`${settings.cmsUsername}:${settings.cmsAppPassword}`).toString('base64')
            authHeaders['Authorization'] = `Basic ${auth}`
        }

        // === ACTION: INIT (Get Pages) ===
        if (action === 'init') {
            // 1. Try fetching from Local DB (ProjectPage)
            const localPages = await prisma.projectPage.findMany({
                where: { projectId: parseInt(projectId) },
                select: {
                    cmsId: true,
                    title: true,
                    url: true,
                    pageType: true,
                    hasRedirect: true,
                    redirectUrl: true,
                    lastSyncedAt: true
                }
            })

            if (localPages.length > 0) {
                console.log(`[Scan] Loaded ${localPages.length} pages from local cache (ProjectPage)`)
                const formattedPages = localPages.map(p => ({
                    id: parseInt(p.cmsId) || p.cmsId,
                    title: p.title,
                    url: p.url,
                    type: p.pageType,
                    has_redirect: p.hasRedirect,
                    redirect_url: p.redirectUrl,
                    local_synced: true,
                    last_synced: p.lastSyncedAt
                }))
                return NextResponse.json({ success: true, pages: formattedPages, source: 'local' })
            }

            // 2. Fallback: Remote Fetch logic
            const scanUrl = `${pluginBase}/pages`
            console.log('[Scan] Fetching pages from remote:', scanUrl)

            const pagesRes = await fetch(scanUrl, {
                headers: authHeaders
            })

            if (!pagesRes.ok) {
                const errText = await pagesRes.text()
                console.error('[LinkBuilding:Scan] Failed to fetch pages:', errText)
                return NextResponse.json({
                    error: `WP Error (${pagesRes.status}): ${errText.substring(0, 200)}`,
                    details: { url: scanUrl, status: pagesRes.status }
                }, { status: 500 })
            }

            const pagesData = await pagesRes.json()
            const pages = pagesData.pages || pagesData
            return NextResponse.json({ success: true, pages, debug: pagesData.debug, source: 'remote' })
        }

        // === ACTION: SCAN PAGE ===
        if (action === 'scan_page') {
            if (!pageId) {
                console.error('[Scan] Missing pageId for scan_page:', body)
                return NextResponse.json({ error: 'pageId required for scan_page' }, { status: 400 })
            }

            const { pageType, pageUrl, pageTitle } = body // Get page info from request

            // Get enabled keywords
            let keywords = await prisma.linkBuildingKeyword.findMany({
                where: {
                    projectId: parseInt(projectId),
                    isEnabled: true,
                    ...(keywordIds?.length && { id: { in: keywordIds } })
                },
                orderBy: { priority: 'desc' }
            })

            // Filter keywords by pageType if specified
            if (pageType) {
                keywords = keywords.filter(kw => {
                    if (!kw.pageTypes) return true // No pageTypes restriction = all pages
                    const allowedTypes = JSON.parse(kw.pageTypes)
                    if (allowedTypes.length === 0) return true // Empty array = all pages
                    return allowedTypes.includes(pageType)
                })
            }

            // Filter out keywords whose targetUrl matches the current page URL
            // This prevents linking a page to itself
            if (pageUrl) {
                const normalizedPageUrl = pageUrl.replace(/\/$/, '').toLowerCase()
                keywords = keywords.filter(kw => {
                    const normalizedTargetUrl = kw.targetUrl.replace(/\/$/, '').toLowerCase()
                    return normalizedTargetUrl !== normalizedPageUrl
                })
            }

            if (keywords.length === 0) {
                return NextResponse.json({ success: true, processed: 0, candidates: 0 })
            }

            // Get redirect check method from body (meta, http, both) - default to 'both'
            const redirectCheckMethod = body.redirectCheckMethod || 'both'
            const checkHttp = redirectCheckMethod === 'http' || redirectCheckMethod === 'both'

            // === LOCAL CACHE SCAN ===
            try {
                const localPage = await prisma.projectPage.findUnique({
                    where: {
                        projectId_cmsId: {
                            projectId: parseInt(projectId),
                            cmsId: String(pageId)
                        }
                    }
                })

                if (localPage && localPage.content) {
                    console.log(`[Scan] Scanning page ${pageId} using LOCAL CACHE`)

                    // Extract only linkable text (excludes headings, links, bold, alt, etc.)
                    const linkableText = extractLinkableText(localPage.content)
                    const contentLower = linkableText.toLowerCase()
                    let newCandidates = 0
                    const hasRedirect = localPage.hasRedirect
                    const redirectUrl = localPage.redirectUrl

                    for (const kw of keywords) {
                        const keywordLower = kw.keyword.toLowerCase()
                        // Basic inclusion check (TODO: improve with regex for whole words if needed)
                        if (contentLower.includes(keywordLower)) {

                            // Check existing log
                            const existingLog = await prisma.linkBuildingLog.findFirst({
                                where: {
                                    projectId: parseInt(projectId),
                                    keywordId: kw.id,
                                    pageId: parseInt(pageId)
                                }
                            })

                            if (existingLog) {
                                // If log exists, update redirect info if needed
                                if (hasRedirect && !existingLog.redirectUrl) {
                                    await prisma.linkBuildingLog.update({
                                        where: { id: existingLog.id },
                                        data: {
                                            redirectUrl: redirectUrl,
                                            message: existingLog.message + (existingLog.message?.includes('[REDIRECT:') ? '' : ` [REDIRECT: ${redirectUrl}]`)
                                        }
                                    })
                                }
                            } else {
                                // Create new log
                                const messageBase = `Found keyword "${kw.keyword}" in synced content.`
                                const redirectMsg = hasRedirect ? ` [REDIRECT: ${redirectUrl}]` : ''

                                await prisma.linkBuildingLog.create({
                                    data: {
                                        projectId: parseInt(projectId),
                                        keywordId: kw.id,
                                        pageId: parseInt(pageId),
                                        pageUrl: pageUrl,
                                        pageTitle: pageTitle || localPage.title || `Page ${pageId}`,
                                        status: 'pending',
                                        message: messageBase + redirectMsg,
                                        redirectUrl: hasRedirect ? redirectUrl : null
                                    }
                                })
                                newCandidates++
                            }
                        }
                    }

                    return NextResponse.json({
                        success: true,
                        processed: 1,
                        candidates: newCandidates,
                        source: 'local_db',
                        redirect_detected: hasRedirect
                    })
                }
            } catch (e) {
                console.error('[Scan] Local cache scan error:', e)
                // Fallback to remote scan silently if local fails
            }

            // Check for redirects BEFORE scanning (for warning display only, not skipping)
            let hasRedirect = false
            let redirectUrl: string | null = null
            try {
                const debugUrl = `${pluginBase}/debug/${pageId}${checkHttp ? '?check_http=1' : ''}`
                const debugRes = await fetch(debugUrl, {
                    headers: authHeaders
                })
                if (debugRes.ok) {
                    const debugData = await debugRes.json()
                    if (debugData.has_redirect) {
                        hasRedirect = true
                        redirectUrl = debugData.redirect_url || 'unknown'
                        console.log(`[Scan] Page ${pageId} has redirect to ${redirectUrl} (source: ${debugData.redirect_source}, method: ${redirectCheckMethod})`)
                    }
                }
            } catch (e) {
                console.log(`[Scan] Could not check redirect for page ${pageId}`)
            }

            // Prepare keywords for plugin
            const keywordData = keywords.map(kw => ({
                keyword: kw.keyword,
                id: kw.id
            }))

            // Fallback: If plugin didn't find redirect, try direct check from CRM server
            // This bypasses WP internal loopback issues or outdated plugin versions
            if (!hasRedirect && ['http', 'both'].includes(redirectCheckMethod)) {
                try {
                    const directCheck = await fetch(pageUrl, {
                        method: 'HEAD',
                        redirect: 'manual', // Don't follow automatically
                        headers: {
                            'User-Agent': 'Mozilla/5.0 (compatible; PatrickCRM/1.0; +https://mehrana.agency)'
                        }
                    })

                    if ([301, 302, 303, 307, 308].includes(directCheck.status)) {
                        const location = directCheck.headers.get('location')
                        if (location) {
                            hasRedirect = true
                            redirectUrl = location.startsWith('/')
                                ? new URL(location, pageUrl).toString()
                                : location
                            console.log(`[Scan] Direct server check detected redirect: ${pageUrl} -> ${location}`)
                        }
                    }
                } catch (e) {
                    console.error('[Scan] Direct redirect check failed:', e)
                }
            }

            // CRITICAL FIX: If redirect detected, force update ALL existing logs for this page/project immediately
            if (hasRedirect) {
                const existingLogs = await prisma.linkBuildingLog.findMany({
                    where: {
                        projectId: parseInt(projectId),
                        pageId: parseInt(pageId),
                        keywordId: { in: keywords.map(k => k.id) }
                    }
                })

                for (const log of existingLogs) {
                    const currentMessage = log.message || ''
                    // Update if redirectUrl is missing OR message tag is missing
                    const needsMessageUpdate = !currentMessage.includes('[REDIRECT:')
                    const needsUrlUpdate = !log.redirectUrl

                    if (needsMessageUpdate || needsUrlUpdate) {
                        const redirectWarning = needsMessageUpdate ? ` [REDIRECT: ${redirectUrl}]` : ''

                        try {
                            // Try updating both (requires DB migration)
                            await prisma.linkBuildingLog.update({
                                where: { id: log.id },
                                data: {
                                    message: needsMessageUpdate ? (currentMessage + redirectWarning) : undefined,
                                    redirectUrl: redirectUrl
                                }
                            })
                            console.log(`[Scan] Forced redirect info update for log ${log.id}`)
                        } catch (e) {
                            console.warn(`[Scan] Failed to update redirectUrl for log ${log.id} (likely missing DB column). Fallback to message update.`)
                            // Fallback: Update message ONLY (if needed)
                            if (needsMessageUpdate) {
                                await prisma.linkBuildingLog.update({
                                    where: { id: log.id },
                                    data: { message: currentMessage + redirectWarning }
                                })
                            }
                        }
                    }
                }
            }

            // Call Plugin Scan
            const scanRes = await fetch(`${pluginBase}/pages/${pageId}/scan`, {
                method: 'POST',
                headers: {
                    ...authHeaders,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ keywords: keywordData })
            })

            if (!scanRes.ok) {
                const errText = await scanRes.text()
                console.error(`[LinkBuilding:Scan] Failed to scan page ${pageId}:`, errText)
                return NextResponse.json({ error: `Plugin Scan Error: ${errText}` }, { status: 500 })
            }

            let scanResult;
            try {
                scanResult = await scanRes.json()
            } catch (jsonErr) {
                const text = await scanRes.text()
                console.error(`[Scan] Invalid JSON from plugin for page ${pageId}:`, text.substring(0, 500))
                return NextResponse.json({
                    error: `Plugin returned invalid JSON`,
                    details: text.substring(0, 200)
                }, { status: 500 })
            }
            const candidates = scanResult.candidates || []

            // Upsert Pending Logs
            let newCandidates = 0

            for (const cand of candidates) {
                const kw = keywords.find(k => k.keyword === cand.keyword)
                if (kw) {
                    // Check if already linked or skipped?
                    // We want to create a PENDING log only if no log exists?
                    // Or update existing?
                    // If log exists and is 'linked' or 'skipped', we ignore?
                    // Scan should find *potential* links. 
                    // If we already handled it, don't overwrite status.

                    const existingLog = await prisma.linkBuildingLog.findFirst({
                        where: {
                            projectId: parseInt(projectId),
                            keywordId: kw.id,
                            pageUrl: { contains: `p=${pageId}` } // Simple check, or assume pageUrl logic
                            // Wait, pageUrl in plugin response isn't guaranteed.
                            // But we are scanning a specific pageId.
                            // The Log stores `pageUrl`.
                            // I need to know the URL of the page I am scanning to check existing logs reliably.
                            // The `scanResult` might not return URL?
                            // `scan_page` in plugin returns `page_id`.
                            // I can ask `init` to return URLs and pass it here?
                            // Or fetch page details here? Excess overhead.
                            // I'll skip the URL check for finding duplicates via `pageTitle` or just assume distinct `pageId` if I stored it?
                            // `LinkBuildingLog` table has `pageId`?
                            // Step 415 schema: `pageUrl`, `pageTitle`. No `pageId`.
                            // I should add `pageId` to schema?
                            // "Migrate existing SEO data" (Task).
                            // Schema in Step 682: `pageUrl`, `pageTitle`. No `pageId`.
                            // This makes exact lookup hard if URL changes.
                            // But `pageUrl` is usually stable.
                            // The `init` action returns pages with URLs. I should pass URL to `scan_page` action.
                        }
                    })

                    // Actually, let's pass `pageUrl` and `pageTitle` from client (who got it from init).
                    // Update `action: scan_page` to accept `pageUrl` and `pageTitle`.
                }
            }

            // Re-fetch keywords to be safe or use map logic above
            // Using the map logic we built (pageUrl, pageTitle already extracted above):

            for (const cand of candidates) {
                const kw = keywords.find(k => k.keyword === cand.keyword)
                if (kw) {
                    const existingLog = await prisma.linkBuildingLog.findFirst({
                        where: {
                            projectId: parseInt(projectId),
                            keywordId: kw.id,
                            pageUrl: pageUrl
                        }
                    })

                    // Build message with redirect warning if applicable
                    const redirectWarning = hasRedirect ? ` [REDIRECT: ${redirectUrl}]` : ''
                    const messageBase = `Found ${cand.count} occurrence(s)${cand.linked_count > 0 ? ` (+${cand.linked_count} existing)` : ''}`

                    if (!existingLog) {
                        try {
                            await prisma.linkBuildingLog.create({
                                data: {
                                    projectId: parseInt(projectId),
                                    keywordId: kw.id,
                                    pageId: parseInt(pageId),
                                    pageUrl: pageUrl,
                                    pageTitle: pageTitle || `Page ${pageId}`,
                                    status: 'pending',
                                    message: messageBase + redirectWarning,
                                    redirectUrl: hasRedirect ? redirectUrl : null
                                }
                            })
                        } catch (e) {
                            console.warn('[Scan] Failed to create log with redirectUrl. Retrying without it.')
                            await prisma.linkBuildingLog.create({
                                data: {
                                    projectId: parseInt(projectId),
                                    keywordId: kw.id,
                                    pageId: parseInt(pageId),
                                    pageUrl: pageUrl,
                                    pageTitle: pageTitle || `Page ${pageId}`,
                                    status: 'pending',
                                    message: messageBase + redirectWarning
                                }
                            })
                        }
                        newCandidates++
                    } else {
                        // Always update message with redirect warning if applicable
                        const currentMessage = existingLog.message || ''
                        const needsRedirectUpdate = hasRedirect && !currentMessage.includes('[REDIRECT:')
                        const needsUrlUpdate = hasRedirect && !existingLog.redirectUrl

                        if (existingLog.status === 'pending' || needsRedirectUpdate || needsUrlUpdate) {
                            try {
                                await prisma.linkBuildingLog.update({
                                    where: { id: existingLog.id },
                                    data: {
                                        message: existingLog.status === 'pending'
                                            ? messageBase + redirectWarning
                                            : (needsRedirectUpdate ? currentMessage + redirectWarning : undefined),
                                        redirectUrl: hasRedirect ? redirectUrl : undefined
                                    }
                                })
                            } catch (e) {
                                console.warn('[Scan] Failed to update log with redirectUrl. Fallback to message update.')
                                if (existingLog.status === 'pending' || needsRedirectUpdate) {
                                    await prisma.linkBuildingLog.update({
                                        where: { id: existingLog.id },
                                        data: {
                                            message: existingLog.status === 'pending'
                                                ? messageBase + redirectWarning
                                                : (needsRedirectUpdate ? currentMessage + redirectWarning : undefined)
                                        }
                                    })
                                }
                            }
                        }
                    }
                }
            }

            return NextResponse.json({ success: true, processed: 1, candidates: newCandidates })
        }

        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })

    } catch (error: any) {
        console.error('[LinkBuilding:Scan] Error:', error)
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 })
    }
}
