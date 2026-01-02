
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// Force dynamic because we fetch from external API
export const dynamic = 'force-dynamic'

// Helper function to extract text content from Elementor JSON data
function extractElementorText(elementorData: string): string {
    try {
        const data = JSON.parse(elementorData)
        const texts: string[] = []

        function traverse(obj: any) {
            if (!obj) return

            // If it's an array, traverse each item
            if (Array.isArray(obj)) {
                obj.forEach(traverse)
                return
            }

            // If it's an object, check for text content
            if (typeof obj === 'object') {
                // Common Elementor text fields
                if (obj.editor) texts.push(obj.editor)
                if (obj.title) texts.push(obj.title)
                if (obj.description) texts.push(obj.description)
                if (obj.text) texts.push(obj.text)
                if (obj.heading_title) texts.push(obj.heading_title)
                if (obj.tab_title) texts.push(obj.tab_title)
                if (obj.alert_title) texts.push(obj.alert_title)
                if (obj.alert_description) texts.push(obj.alert_description)
                if (obj.caption) texts.push(obj.caption)
                if (obj.testimonial_content) texts.push(obj.testimonial_content)
                if (obj.testimonial_name) texts.push(obj.testimonial_name)
                if (obj.html) texts.push(obj.html)

                // Traverse nested objects
                Object.values(obj).forEach(traverse)
            }
        }

        traverse(data)

        // Join all texts and strip HTML tags
        return texts
            .filter(t => typeof t === 'string' && t.trim())
            .map(t => t.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim())
            .join(' ')
    } catch (e) {
        return ''
    }
}

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

                // Get content - store original for future features (Image Factory, Heading Management)
                // Link building will filter at scan time
                let content = page.post_content || ''

                // If there's elementor_data, extract text from it and append
                if (page.elementor_data) {
                    try {
                        const elementorText = extractElementorText(page.elementor_data)
                        // Combine both sources
                        content = content + ' ' + elementorText
                    } catch (e) {
                        console.error(`[Sync] Failed to parse elementor data for page ${page.id}`)
                    }
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
