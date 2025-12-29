import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// POST - Crawl site via plugin and discover page types
export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { projectId } = body

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

        // Fetch pages from plugin
        const pagesRes = await fetch(`${pluginBase}/pages`, {
            headers: authHeaders
        })

        if (!pagesRes.ok) {
            const errText = await pagesRes.text()
            return NextResponse.json({
                error: `WP Error (${pagesRes.status}): ${errText.substring(0, 200)}`
            }, { status: 500 })
        }

        const pagesData = await pagesRes.json()
        const pages = pagesData.pages || pagesData // Handle both formats

        // Count page types
        const typeCounts: Record<string, number> = {}
        for (const page of pages) {
            const type = page.type || 'page'
            typeCounts[type] = (typeCounts[type] || 0) + 1
        }

        // Upsert discovered page types
        const upsertPromises = Object.entries(typeCounts).map(([typeName, count]) =>
            prisma.discoveredPageType.upsert({
                where: {
                    projectId_typeName: {
                        projectId: parseInt(projectId),
                        typeName
                    }
                },
                create: {
                    projectId: parseInt(projectId),
                    typeName,
                    count
                },
                update: {
                    count
                }
            })
        )

        await Promise.all(upsertPromises)

        // Fetch updated list
        const discoveredTypes = await prisma.discoveredPageType.findMany({
            where: { projectId: parseInt(projectId) },
            orderBy: { count: 'desc' }
        })

        return NextResponse.json({
            success: true,
            pageTypes: discoveredTypes,
            totalPages: pages.length
        })

    } catch (error: any) {
        console.error('[LinkBuilding:Crawl] Error:', error)
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 })
    }
}

// GET - Fetch existing discovered page types
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const projectId = searchParams.get('projectId')

        if (!projectId) {
            return NextResponse.json({ error: 'projectId required' }, { status: 400 })
        }

        const pageTypes = await prisma.discoveredPageType.findMany({
            where: { projectId: parseInt(projectId) },
            orderBy: { count: 'desc' }
        })

        return NextResponse.json({ success: true, pageTypes })

    } catch (error: any) {
        console.error('[LinkBuilding:Crawl] GET Error:', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
