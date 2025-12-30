import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { logActivity } from "@/lib/activity-logger"
import { auth } from "@/lib/auth"

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
                console.log(`[Process] Calling apply-links for page ${pageId} with keywords:`, keywordData.map(k => k.keyword))

                const applyRes = await fetch(`${pluginBase}/pages/${pageId}/apply-links`, {
                    method: 'POST',
                    headers: {
                        ...authHeaders,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ keywords: keywordData })
                })

                const responseText = await applyRes.text()
                console.log(`[Process] Response for page ${pageId}:`, responseText)

                if (applyRes.ok) {
                    let data: any = {}
                    try {
                        data = JSON.parse(responseText)
                    } catch (e) {
                        console.error(`[Process] Failed to parse JSON response for page ${pageId}`)
                    }

                    // Handle Results
                    // Plugin returns: { results: [{keyword, count}], skipped: [{keyword, reason}] }

                    const processedKeywords = new Set<string>()

                    if (data.results && Array.isArray(data.results)) {
                        for (const res of data.results) {
                            console.log(`[Process] Result for keyword "${res.keyword}": count=${res.count}`)

                            if (res.count > 0) {
                                // Find logs for this keyword
                                const relatedLogs = pageLogs.filter(l => l.keyword.keyword === res.keyword)
                                for (const l of relatedLogs) {
                                    console.log(`[Process] Updating log ${l.id} to 'linked'`)
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
                            } else {
                                // count is 0 - keyword not found or already linked
                                // Mark as skipped with appropriate message
                                const relatedLogs = pageLogs.filter(l => l.keyword.keyword === res.keyword)
                                for (const l of relatedLogs) {
                                    // Check if linked_count exists (existing links)
                                    const hasExisting = res.linked_count > 0
                                    console.log(`[Process] Keyword "${res.keyword}" count=0, linked_count=${res.linked_count || 0}`)

                                    await prisma.linkBuildingLog.update({
                                        where: { id: l.id },
                                        data: {
                                            status: hasExisting ? 'linked' : 'skipped',
                                            message: hasExisting
                                                ? `Already linked ${res.linked_count} time(s)`
                                                : 'Keyword not found in content',
                                            linkedCount: res.linked_count || 0
                                        }
                                    })
                                    results.skipped++
                                }
                                processedKeywords.add(res.keyword)
                            }
                        }
                    }

                    if (data.skipped && Array.isArray(data.skipped)) {
                        for (const skip of data.skipped) {
                            const relatedLogs = pageLogs.filter(l => l.keyword.keyword === skip.keyword)
                            for (const l of relatedLogs) {
                                // Only update if not already marked success
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
                    console.error(`[Process] Failed page ${pageId}:`, responseText)
                    // Mark logs as error
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

        // Log Activity
        const session = await auth()
        await logActivity({
            userId: session?.user?.email,
            userName: session?.user?.name,
            projectId: parseInt(projectId),
            category: 'LINK_BUILDING',
            action: 'EXECUTED',
            description: `Link building complete. Success: ${results.success}, Skipped: ${results.skipped}, Errors: ${results.errors}`,
            details: results
        })

        return NextResponse.json({ success: true, stats: results })

    } catch (error) {
        console.error('[LinkBuilding:Process] Error:', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
