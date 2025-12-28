import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// POST - Run link building using Patrick Link Builder plugin
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

        if (!settings?.cmsApiKey && (!settings?.cmsUsername || !settings?.cmsAppPassword)) {
            return NextResponse.json({ error: 'WordPress credentials not configured. Please set API Key or Username/App Password.' }, { status: 400 })
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

        // Build auth headers - prefer API Key over Application Password
        const authHeaders: Record<string, string> = {}
        if (settings.cmsApiKey) {
            authHeaders['X-MAP-API-Key'] = settings.cmsApiKey
        } else {
            const auth = Buffer.from(`${settings.cmsUsername}:${settings.cmsAppPassword}`).toString('base64')
            authHeaders['Authorization'] = `Basic ${auth}`
        }

        // Check plugin health
        const healthRes = await fetch(`${pluginBase}/health`, {
            headers: authHeaders
        })

        if (!healthRes.ok) {
            console.error('[LinkBuilding] Plugin not available:', await healthRes.text())
            return NextResponse.json({
                error: 'Mehrana App Plugin not installed or not accessible. Install the plugin first.',
                pluginRequired: true
            }, { status: 400 })
        }

        const health = await healthRes.json()
        console.log('[LinkBuilding] Plugin health:', health)

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

        // Fetch pages from plugin
        const pagesRes = await fetch(`${pluginBase}/pages`, {
            headers: authHeaders
        })

        if (!pagesRes.ok) {
            console.error('[LinkBuilding] Failed to fetch pages:', await pagesRes.text())
            return NextResponse.json({ error: 'Failed to fetch pages from WordPress' }, { status: 500 })
        }

        const pages = await pagesRes.json()
        console.log(`[LinkBuilding] Found ${pages.length} Elementor pages`)

        const results = {
            processed: 0,
            linked: 0,
            errors: 0,
            skipped: 0
        }

        // Process each page
        for (const page of pages) {
            // Use type from plugin response, fallback to URL detection
            const pageType = page.type || detectPageType(page.url)

            // Filter keywords by page type
            const applicableKeywords = keywords.filter(kw => {
                const pageTypes = kw.pageTypes ? JSON.parse(kw.pageTypes) : []
                return pageTypes.length === 0 || pageTypes.includes(pageType)
            })

            if (applicableKeywords.length === 0) {
                continue
            }

            // Prepare keywords for API
            const keywordData = applicableKeywords.map(kw => ({
                keyword: kw.keyword,
                target_url: kw.targetUrl,
                anchor_id: `lb-${kw.id}-${Date.now()}`,
                only_first: kw.onlyFirst ?? true
            }))

            // Apply links via plugin
            const applyRes = await fetch(`${pluginBase}/pages/${page.id}/apply-links`, {
                method: 'POST',
                headers: {
                    ...authHeaders,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ keywords: keywordData })
            })

            if (applyRes.ok) {
                const result = await applyRes.json()
                console.log(`[LinkBuilding] Applied links to ${page.url}:`, result.results)

                // Log each successful link
                for (const kwResult of result.results) {
                    if (kwResult.count > 0) {
                        const kw = applicableKeywords.find(k => k.keyword === kwResult.keyword)
                        if (kw) {
                            await prisma.linkBuildingLog.create({
                                data: {
                                    projectId: parseInt(projectId),
                                    keywordId: kw.id,
                                    pageUrl: page.url,
                                    pageTitle: page.title,
                                    anchorId: keywordData.find(k => k.keyword === kw.keyword)?.anchor_id || '',
                                    status: 'linked',
                                    message: `Linked "${kw.keyword}" ${kwResult.count} time(s)`
                                }
                            })

                            await prisma.linkBuildingKeyword.update({
                                where: { id: kw.id },
                                data: {
                                    linksCreated: { increment: kwResult.count },
                                    lastRunAt: new Date()
                                }
                            })

                            results.linked += kwResult.count
                        }
                    }
                }

                // Log skipped items
                if (result.skipped && result.skipped.length > 0) {
                    for (const skip of result.skipped) {
                        const kw = applicableKeywords.find(k => k.keyword === skip.keyword)
                        if (kw) {
                            await prisma.linkBuildingLog.create({
                                data: {
                                    projectId: parseInt(projectId),
                                    keywordId: kw.id,
                                    pageUrl: page.url,
                                    pageTitle: page.title,
                                    anchorId: '',
                                    status: 'skipped',
                                    message: `Skipped: ${skip.reason}${skip.sample ? ` - "${skip.sample}"` : ''}`
                                }
                            })
                            results.skipped++
                        }
                    }
                }
            } else {
                console.error(`[LinkBuilding] Failed to apply links to ${page.url}:`, await applyRes.text())
                results.errors++
            }

            results.processed++
        }

        return NextResponse.json({ success: true, results })
    } catch (error) {
        console.error('Run link building error:', error)
        return NextResponse.json({ error: 'Failed to run link building' }, { status: 500 })
    }
}

// Detect page type from URL
function detectPageType(url: string): string {
    try {
        const path = new URL(url).pathname.toLowerCase()
        if (path === '/' || path === '') return 'home'
        if (path.includes('/blog') || path.includes('/post')) return 'blog'
        if (path.includes('/service')) return 'service'
        if (path.includes('/product')) return 'product'
        if (path.includes('/category')) return 'category'
        if (path.includes('/landing')) return 'landing'
        return 'page'
    } catch {
        return 'page'
    }
}
