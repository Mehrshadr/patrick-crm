import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// POST - Get existing backlinks from a page or remove a backlink
export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { action, projectId, pageId, linkId } = body

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
        const pluginBase = `${siteUrl}/wp-json/mehrana/v1`

        // Build auth headers
        const authHeaders: Record<string, string> = {}
        if (settings.cmsApiKey) {
            authHeaders['X-MAP-API-Key'] = settings.cmsApiKey
        } else {
            const auth = Buffer.from(`${settings.cmsUsername}:${settings.cmsAppPassword}`).toString('base64')
            authHeaders['Authorization'] = `Basic ${auth}`
        }

        // === ACTION: GET BACKLINKS ===
        if (action === 'get_backlinks') {
            if (!pageId) {
                return NextResponse.json({ error: 'pageId required' }, { status: 400 })
            }

            // Fetch page content and extract internal links
            const res = await fetch(`${pluginBase}/pages/${pageId}/links`, {
                headers: authHeaders
            })

            if (!res.ok) {
                const errText = await res.text()
                console.error('[LinkBuilding:Backlinks] Failed:', errText)
                return NextResponse.json({ error: 'Failed to fetch backlinks' }, { status: 500 })
            }

            const data = await res.json()
            return NextResponse.json({
                success: true,
                links: data.links || [],
                pageUrl: data.page_url
            })
        }

        // === ACTION: REMOVE BACKLINK ===
        if (action === 'remove_link') {
            if (!pageId || !linkId) {
                return NextResponse.json({ error: 'pageId and linkId required' }, { status: 400 })
            }

            // Call WordPress plugin to remove the link
            const res = await fetch(`${pluginBase}/pages/${pageId}/links/${linkId}`, {
                method: 'DELETE',
                headers: authHeaders
            })

            if (!res.ok) {
                const errText = await res.text()
                console.error('[LinkBuilding:RemoveLink] Failed:', errText)
                return NextResponse.json({ error: 'Failed to remove link' }, { status: 500 })
            }

            const data = await res.json()

            // Update log status if exists
            await prisma.linkBuildingLog.updateMany({
                where: {
                    projectId: parseInt(projectId),
                    pageId: parseInt(pageId),
                    status: 'linked'
                },
                data: {
                    status: 'pending',
                    message: 'Link removed, ready to re-link'
                }
            })

            return NextResponse.json({ success: true, message: data.message || 'Link removed' })
        }

        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })

    } catch (error: any) {
        console.error('[LinkBuilding:Backlinks] Error:', error)
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 })
    }
}
