import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// POST - Search for keyword in a specific page (for debugging)
export async function POST(request: NextRequest) {
    try {
        const { projectId, pageId, keyword } = await request.json()

        if (!projectId || !pageId || !keyword) {
            return NextResponse.json({ error: 'projectId, pageId, and keyword required' }, { status: 400 })
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
        const pluginBase = `${siteUrl}/wp-json/patrick-link-builder/v1`

        // Call search endpoint on plugin
        const searchRes = await fetch(`${pluginBase}/search/${pageId}`, {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${auth}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ keyword })
        })

        if (!searchRes.ok) {
            const errorText = await searchRes.text()
            return NextResponse.json({
                error: 'Search failed',
                status: searchRes.status,
                details: errorText
            }, { status: 500 })
        }

        const results = await searchRes.json()
        return NextResponse.json(results)

    } catch (error) {
        console.error('Search keyword error:', error)
        return NextResponse.json({ error: 'Failed to search' }, { status: 500 })
    }
}
