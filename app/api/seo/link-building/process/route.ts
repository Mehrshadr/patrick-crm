import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// POST - Process pending link building logs
export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { logIds, projectId } = body

        if (!logIds || !Array.isArray(logIds) || logIds.length === 0) {
            return NextResponse.json({ error: 'logIds array required' }, { status: 400 })
        }

        // Fetch logs
        const logs = await prisma.linkBuildingLog.findMany({
            where: {
                id: { in: logIds },
                projectId: parseInt(projectId), // Security check
                status: 'pending'
            },
            include: {
                keyword: true
            }
        })

        if (logs.length === 0) {
            return NextResponse.json({ success: true, processed: 0, message: 'No pending logs found' })
        }

        // Group by Page ID to batch updates
        const logsByPage = new Map<number, typeof logs>()

        for (const log of logs) {
            if (!log.pageId) continue; // Skip legacy logs without pageId
            const pid = log.pageId
            if (!logsByPage.has(pid)) {
                logsByPage.set(pid, [])
            }
            logsByPage.get(pid)?.push(log)
        }

        // Get Project Settings for Auth
        const settings = await prisma.projectSettings.findUnique({
            where: { projectId: parseInt(projectId) }
        })

        // ... (Re-use auth logic from scan/run routes) ...
        // Note: Ideally extract this to a helper, but duplicating for speed now.
        if (!settings?.cmsApiKey && (!settings?.cmsUsername || !settings?.cmsAppPassword)) {
            return NextResponse.json({ error: 'Auth missing' }, { status: 400 })
        }

        const project = await prisma.indexingProject.findUnique({ where: { id: parseInt(projectId) } })
        if (!project?.domain) return NextResponse.json({ error: 'Domain missing' }, { status: 400 })

        const siteUrl = project.domain.startsWith('http') ? project.domain : `https://${project.domain}`
        const pluginBase = `${siteUrl}/wp-json/mehrana-app/v1`

        const authHeaders: Record<string, string> = {}
        if (settings.cmsApiKey) {
            authHeaders['X-MAP-API-Key'] = settings.cmsApiKey
        } else {
            const auth = Buffer.from(`${settings.cmsUsername}:${settings.cmsAppPassword}`).toString('base64')
            authHeaders['Authorization'] = `Basic ${auth}`
        }

        const results = {
            processed: 0,
            success: 0,
            skipped: 0,
            errors: 0
        }

        // Process each page batch
        for (const [pageId, pageLogs] of logsByPage) {
            // Prepare keyword data
            const keywordData = pageLogs.map(log => ({
                keyword: log.keyword.keyword,
                target_url: log.keyword.targetUrl,
                anchor_id: `lb-${log.keyword.id}-${Date.now()}`,
                only_first: log.keyword.onlyFirst
            }))

            // Call Plugin Apply Links
            try {
                const applyRes = await fetch(`${pluginBase}/pages/${pageId}/apply-links`, {
                    method: 'POST',
                    headers: {
                        ...authHeaders,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ keywords: keywordData })
                })

                if (applyRes.ok) {
                    const data = applyRes.json ? await applyRes.json() : {}

                    // Handle Results
                    // Update logs based on plugin response
                    // Plugin returns: { results: [{keyword, count}], skipped: [{keyword, reason}] }

                    // Note: Order/Matching logic:
                    // If multiple logs have same keyword (rare per page, but possible if multiple occurrences pending?),
                    // plugin returns aggregated count.
                    // We map back by keyword.

                    const processedKeywords = new Set<string>()

                    if (data.results) {
                        for (const res of data.results) {
                            if (res.count > 0) {
                                // Find logs for this keyword
                                const relatedLogs = pageLogs.filter(l => l.keyword.keyword === res.keyword)
                                for (const l of relatedLogs) {
                                    await prisma.linkBuildingLog.update({
                                        where: { id: l.id },
                                        data: {
                                            status: 'linked',
                                            message: `Linked ${res.count} time(s)`,
                                            anchorId: keywordData.find(k => k.keyword === res.keyword)?.anchor_id
                                        }
                                    })
                                    // Update stats
                                    await prisma.linkBuildingKeyword.update({
                                        where: { id: l.keywordId },
                                        data: { linksCreated: { increment: res.count }, lastRunAt: new Date() }
                                    })
                                    results.success++
                                }
                                processedKeywords.add(res.keyword)
                            }
                        }
                    }

                    if (data.skipped) {
                        for (const skip of data.skipped) {
                            const relatedLogs = pageLogs.filter(l => l.keyword.keyword === skip.keyword)
                            for (const l of relatedLogs) {
                                // Only update if not already marked success (unlikely)
                                if (!processedKeywords.has(skip.keyword)) {
                                    await prisma.linkBuildingLog.update({
                                        where: { id: l.id },
                                        data: {
                                            status: 'skipped',
                                            message: `Skipped: ${skip.reason}`
                                        }
                                    })
                                    results.skipped++
                                }
                            }
                        }
                    }

                } else {
                    console.error(`[Process] Failed page ${pageId}:`, await applyRes.text())
                    // Mark logs as error? Or keep pending?
                    // Keep pending for retry? Or mark error.
                    // Let's mark error to avoid infinite retry loops in UI for now.
                    for (const l of pageLogs) {
                        await prisma.linkBuildingLog.update({
                            where: { id: l.id },
                            data: { status: 'error', message: 'Plugin call failed' }
                        })
                        results.errors++
                    }
                }

            } catch (e) {
                console.error(`[Process] Error page ${pageId}:`, e)
                results.errors += pageLogs.length
            }

            results.processed += pageLogs.length
        }

        return NextResponse.json({ success: true, stats: results })

    } catch (error) {
        console.error('[LinkBuilding:Process] Error:', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
