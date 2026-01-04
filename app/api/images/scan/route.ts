import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// Force dynamic because we fetch from external API
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
    try {
        const body = await req.json()
        const { projectId, page = 1, per_page = 50, search = '', sync = false, fromDb = false } = body

        if (!projectId) {
            return NextResponse.json({ error: "Project ID required" }, { status: 400 })
        }

        const project = await prisma.indexingProject.findUnique({
            where: { id: parseInt(projectId) },
            include: { settings: true }
        })

        if (!project) {
            return NextResponse.json({ error: "Project not found" }, { status: 404 })
        }

        // If loading from database (after sync)
        if (fromDb) {
            const { filterUrl, filterHeavy, filterFormat, filterType, filterMissingAlt } = body

            const skip = (page - 1) * per_page
            const where: any = { projectId: project.id }

            // Search filter
            if (search) {
                where.OR = [
                    { filename: { contains: search } },
                    { alt: { contains: search } }
                ]
            }

            // Filter by parent URL
            if (filterUrl) {
                where.parentPostUrl = { contains: filterUrl }
            }

            // Filter by heavy files (>150KB)
            if (filterHeavy) {
                where.filesize = { gt: 150 * 1024 }
            }

            // Filter by format (mime type)
            if (filterFormat) {
                where.mimeType = { contains: filterFormat }
            }

            // Filter by type (product, post, page)
            if (filterType) {
                where.parentPostType = filterType
            }

            // Filter by missing alt
            if (filterMissingAlt) {
                where.OR = [
                    { alt: null },
                    { alt: '' }
                ]
            }

            const [mediaItems, total] = await Promise.all([
                prisma.projectMedia.findMany({
                    where,
                    skip,
                    take: per_page,
                    orderBy: { lastSyncedAt: 'desc' }
                }),
                prisma.projectMedia.count({ where })
            ])

            // Transform to match frontend format
            const media = mediaItems.map(item => ({
                id: item.wpId,
                title: item.filename,
                filename: item.filename,
                alt: item.alt || '',
                url: item.url,
                width: item.width,
                height: item.height,
                filesize: item.filesize,
                mime_type: item.mimeType,
                date: item.lastSyncedAt.toISOString(),
                parent_id: item.parentPostId,
                parent_title: item.parentPostTitle,
                parent_type: item.parentPostType,
                parent_url: item.parentPostUrl
            }))

            return NextResponse.json({
                success: true,
                media,
                total,
                pages: Math.ceil(total / per_page),
                page,
                fromDb: true
            })
        }

        // For WordPress fetch, we need domain and credentials
        if (!project.domain) {
            return NextResponse.json({ error: "Project domain not configured" }, { status: 400 })
        }

        const settings = project.settings
        if (!settings?.cmsApiKey && (!settings?.cmsUsername || !settings?.cmsAppPassword)) {
            return NextResponse.json({ error: "WordPress credentials not configured" }, { status: 400 })
        }

        const siteUrl = project.domain.startsWith('http') ? project.domain : `https://${project.domain}`
        const pluginBase = `${siteUrl.replace(/\/$/, '')}/wp-json/mehrana/v1`

        // Build auth headers
        const headers: Record<string, string> = {
            'Content-Type': 'application/json'
        }

        if (settings.cmsApiKey) {
            headers['X-MAP-API-Key'] = settings.cmsApiKey
        } else {
            const auth = Buffer.from(`${settings.cmsUsername}:${settings.cmsAppPassword}`).toString('base64')
            headers['Authorization'] = `Basic ${auth}`
        }

        // Build query string
        const params = new URLSearchParams({
            page: page.toString(),
            per_page: per_page.toString()
        })
        if (search) params.append('search', search)

        const fetchUrl = `${pluginBase}/media?${params.toString()}`

        const res = await fetch(fetchUrl, { headers, next: { revalidate: 0 } })

        if (!res.ok) {
            const errorText = await res.text()
            console.error(`[ImageFactory] WP Error: ${res.status} - ${errorText}`)
            return NextResponse.json({
                error: `WordPress API Error: ${res.status}`,
                details: errorText
            }, { status: res.status })
        }

        const data = await res.json()
        const mediaItems = data.media || []

        if (sync) {
            console.log(`[ImageFactory] Syncing ${mediaItems.length} items for project ${projectId}`)
            let added = 0
            let updated = 0

            for (const item of mediaItems) {
                // Determine transaction type (Add vs Update) for logging
                const existing = await prisma.projectMedia.findUnique({
                    where: { projectId_wpId: { projectId: project.id, wpId: item.id } }
                })

                if (existing) {
                    updated++
                    // Check for changes to log history
                    const changes: any[] = []
                    if (existing.alt !== item.alt) changes.push({ field: 'alt', old: existing.alt, new: item.alt })
                    if (existing.filesize !== item.filesize) changes.push({ field: 'filesize', old: String(existing.filesize), new: String(item.filesize) })

                    if (changes.length > 0) {
                        if (changes.length > 0) {
                            await Promise.all(changes.map(c =>
                                prisma.mediaChangeLog.create({
                                    data: {
                                        mediaId: existing.id,
                                        fieldName: c.field,
                                        oldValue: c.old || '',
                                        newValue: c.new || ''
                                    }
                                })
                            ))
                        }
                    }
                } else {
                    added++
                }

                await prisma.projectMedia.upsert({
                    where: { projectId_wpId: { projectId: project.id, wpId: item.id } },
                    update: {
                        url: item.url,
                        filename: item.filename,
                        alt: item.alt,
                        width: item.width,
                        height: item.height,
                        filesize: item.filesize,
                        mimeType: item.mime_type,
                        parentPostId: item.parent_id,
                        parentPostTitle: item.parent_title,
                        parentPostUrl: item.parent_url,
                        parentPostType: item.parent_type,
                        lastSyncedAt: new Date()
                    },
                    create: {
                        projectId: project.id,
                        wpId: item.id,
                        url: item.url,
                        filename: item.filename,
                        alt: item.alt,
                        width: item.width,
                        height: item.height,
                        filesize: item.filesize,
                        mimeType: item.mime_type,
                        parentPostId: item.parent_id,
                        parentPostTitle: item.parent_title,
                        parentPostUrl: item.parent_url,
                        parentPostType: item.parent_type
                    }
                })
            }

            return NextResponse.json({
                success: true,
                synced: true,
                added,
                updated,
                totalScan: mediaItems.length,
                page: page,
                totalPages: data.pages
            })
        }

        // Return just the scan result if not strictly syncing (though we might want to default to sync)
        return NextResponse.json({
            success: true,
            media: mediaItems,
            total: data.total,
            pages: data.pages,
            page: page
        })

    } catch (error: any) {
        console.error("[ImageFactory] Scan error:", error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
