import { NextRequest, NextResponse } from 'next/server'
import { prisma } from "@/lib/prisma"

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams
        const projectId = searchParams.get('projectId')
        const status = searchParams.get('status')
        const limit = parseInt(searchParams.get('limit') || '50')
        const source = searchParams.get('source') // 'wordpress' or 'local' (default)

        if (!projectId) {
            return NextResponse.json({ error: 'Project ID required' }, { status: 400 })
        }

        // If requesting WordPress logs
        if (source === 'wordpress') {
            return fetchWordPressLogs(parseInt(projectId))
        }

        // Default: fetch from local database
        const whereClause: any = {
            projectId: parseInt(projectId)
        }

        if (status) {
            whereClause.status = status
        }

        const logs = await prisma.linkBuildingLog.findMany({
            where: whereClause,
            orderBy: { createdAt: 'desc' },
            take: limit,
            include: {
                keyword: {
                    select: { keyword: true, targetUrl: true }
                }
            }
        })

        return NextResponse.json({ logs })
    } catch (e) {
        console.error('Error fetching logs:', e)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

// Helper function to fetch WordPress plugin logs
async function fetchWordPressLogs(projectId: number) {
    try {
        // Get project settings
        const settings = await prisma.projectSettings.findUnique({
            where: { projectId }
        })

        if (!settings?.cmsApiKey && (!settings?.cmsUsername || !settings?.cmsAppPassword)) {
            return NextResponse.json({ error: 'WordPress credentials not configured.' }, { status: 400 })
        }

        // Get project domain
        const project = await prisma.indexingProject.findUnique({
            where: { id: projectId }
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
        console.error('Error fetching WordPress logs:', e)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
