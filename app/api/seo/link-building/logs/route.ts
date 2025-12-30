import { NextRequest, NextResponse } from 'next/server'
import { prisma } from "@/lib/prisma"

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams
        const projectId = searchParams.get('projectId')

        if (!projectId) {
            return NextResponse.json({ error: 'Project ID required' }, { status: 400 })
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

        // Build auth headers
        const authHeaders: Record<string, string> = {}
        if (settings.cmsApiKey) {
            authHeaders['X-MAP-API-Key'] = settings.cmsApiKey
        } else {
            const auth = Buffer.from(`${settings.cmsUsername}:${settings.cmsAppPassword}`).toString('base64')
            authHeaders['Authorization'] = `Basic ${auth}`
        }

        const res = await fetch(`${siteUrl}/wp-json/mehrana-app/v1/logs`, {
            headers: authHeaders,
            cache: 'no-store'
        })

        if (!res.ok) {
            const error = await res.text()
            console.error('Failed to fetch logs:', res.status, error)
            return NextResponse.json({ error: 'Failed to fetch logs from WordPress' }, { status: res.status })
        }

        const data = await res.json()
        return NextResponse.json(data)
    } catch (e) {
        console.error('Error fetching logs:', e)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
