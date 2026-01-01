
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// Force dynamic because we fetch from external API
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
    try {
        const body = await req.json()
        const { projectId, mode = 'full' } = body

        if (!projectId) {
            return NextResponse.json({ error: 'Project ID required' }, { status: 400 })
        }

        const project = await prisma.indexingProject.findUnique({
            where: { id: parseInt(projectId) },
            include: { settings: true }
        })

        if (!project || !project.domain) {
            return NextResponse.json({ error: 'Project not found' }, { status: 404 })
        }

        const settings = project.settings
        if (!settings?.cmsApiKey && (!settings?.cmsUsername || !settings?.cmsAppPassword)) {
            return NextResponse.json({ error: 'WordPress credentials not configured.' }, { status: 400 })
        }

        const siteUrl = project.domain.startsWith('http') ? project.domain : `https://${project.domain}`
        const pluginBase = `${siteUrl.replace(/\/$/, '')}/wp-json/mehrana-app/v1`

        // Build auth headers
        const authHeaders: Record<string, string> = {}
        if (settings.cmsApiKey) {
            authHeaders['X-MAP-API-Key'] = settings.cmsApiKey
        } else {
            const auth = Buffer.from(`${settings.cmsUsername}:${settings.cmsAppPassword}`).toString('base64')
            authHeaders['Authorization'] = `Basic ${auth}`
        }

        // 1. Fetch pages from WP Plugin
        const fetchUrl = `${pluginBase}/pages`

        console.log(`[Sync] Fetching pages from ${fetchUrl}`)
        const res = await fetch(fetchUrl, {
            headers: authHeaders,
            next: { revalidate: 0 }
        })

        if (!res.ok) {
            const err = await res.text()
            console.error('[Sync] Plugin error:', err)
            // Handle 429 specifically
            if (res.status === 429) {
                return NextResponse.json({ error: 'WordPress Server Rate Limited (429). Please try again later.' }, { status: 429 })
            }
            return NextResponse.json({ error: `Plugin error: ${res.status}` }, { status: res.status })
        }

        const data = await res.json()
        const pages = data.pages || []

        console.log(`[Sync] Found ${pages.length} pages. Starting database sync...`)

        // 2. Upsert into ProjectPage
        let successCount = 0
        let redirectCount = 0

        const upsertPage = async (page: any) => {
            try {
                const hasRedirect = page.has_redirect || false
                const redirectUrl = page.redirect_url || null

                // Get content - preference: post_content or elementor_data (stringified)
                let content = page.post_content || ''
                if (!content && page.elementor_data) {
                    content = '[Elementor Content]'
                }

                await prisma.projectPage.upsert({
                    where: {
                        projectId_cmsId: {
                            projectId: parseInt(projectId),
                            cmsId: String(page.id)
                        }
                    },
                    update: {
                        url: page.url,
                        title: page.title,
                        content: content, // Store content for local keyword scan
                        pageType: page.type,
                        hasRedirect: hasRedirect,
                        redirectUrl: redirectUrl,
                        lastSyncedAt: new Date(),
                    },
                    create: {
                        projectId: parseInt(projectId),
                        cmsId: String(page.id),
                        url: page.url,
                        title: page.title,
                        content: content,
                        pageType: page.type,
                        hasRedirect: hasRedirect,
                        redirectUrl: redirectUrl,
                    }
                })

                if (hasRedirect) redirectCount++
                successCount++
            } catch (e) {
                console.error(`[Sync] Failed to save page ${page.id}:`, e)
            }
        }

        // Execute in batches of 20
        const chunkSize = 20
        for (let i = 0; i < pages.length; i += chunkSize) {
            const chunk = pages.slice(i, i + chunkSize)
            await Promise.all(chunk.map(upsertPage))
        }

        console.log(`[Sync] Completed. ${successCount} synced, ${redirectCount} specific redirects stored.`)

        return NextResponse.json({
            success: true,
            synced: successCount,
            totalRemote: pages.length,
            redirectsFound: redirectCount
        })

    } catch (error: any) {
        console.error('[Sync] Fatal error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
