import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// POST - Scan content for link building candidates
export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { action, projectId, pageId, keywordIds } = body

        if (!projectId) {
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
        const pluginBase = `${siteUrl}/wp-json/mehrana-app/v1`

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
            const scanUrl = `${pluginBase}/pages`
            console.log('[Scan] Fetching pages from:', scanUrl)

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

            const pages = await pagesRes.json()
            return NextResponse.json({ success: true, pages })
        }

        // === ACTION: SCAN PAGE ===
        if (action === 'scan_page') {
            if (!pageId) {
                return NextResponse.json({ error: 'pageId required for scan_page' }, { status: 400 })
            }

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
                return NextResponse.json({ success: true, processed: 0, candidates: 0 })
            }

            // Prepare keywords for plugin
            const keywordData = keywords.map(kw => ({
                keyword: kw.keyword,
                id: kw.id
            }))

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

            const scanResult = await scanRes.json()
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

            // Re-evaluating: I need `pageUrl` and `pageTitle` in body.
            // I'll assume client sends them.

            const { pageUrl, pageTitle } = body

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

                    if (!existingLog) {
                        await prisma.linkBuildingLog.create({
                            data: {
                                projectId: parseInt(projectId),
                                keywordId: kw.id,
                                pageId: parseInt(pageId), // Store for reliable access
                                pageUrl: pageUrl,
                                pageTitle: pageTitle || `Page ${pageId}`,
                                status: 'pending',
                                message: `Found ${cand.count} occurrence(s)`
                            }
                        })
                        newCandidates++
                    } else if (existingLog.status === 'pending') {
                        // Update message if needed
                        await prisma.linkBuildingLog.update({
                            where: { id: existingLog.id },
                            data: { message: `Found ${cand.count} occurrence(s)` }
                        })
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
