import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
    try {
        const body = await req.json()
        const { projectId, mode = 'full', logIds = [], concurrency = 5, delay = 500 } = body

        if (!projectId) {
            return NextResponse.json({ error: 'projectId required' }, { status: 400 })
        }

        let urlsToCheck: { id: number; url: string; type: 'page' | 'log' }[] = []

        if (mode === 'selected' && logIds.length > 0) {
            // Quick mode: Check only selected logs
            const logs = await prisma.linkBuildingLog.findMany({
                where: { id: { in: logIds } },
                select: { id: true, pageUrl: true }
            })
            urlsToCheck = logs.map(l => ({ id: l.id, url: l.pageUrl, type: 'log' as const }))
        } else {
            // Full mode: Check all cached pages for the project
            const pages = await prisma.projectPage.findMany({
                where: { projectId: parseInt(projectId) },
                select: { id: true, url: true }
            })
            urlsToCheck = pages.map(p => ({ id: p.id, url: p.url, type: 'page' as const }))
        }

        if (urlsToCheck.length === 0) {
            return NextResponse.json({ checked: 0, redirectsFound: 0, message: 'No URLs to check' })
        }

        // Check for redirects in batches
        const effectiveConcurrency = mode === 'selected' ? 25 : concurrency
        const effectiveDelay = mode === 'selected' ? 0 : delay
        let redirectsFound = 0

        const checkUrl = async (item: typeof urlsToCheck[0]) => {
            try {
                const controller = new AbortController()
                const timeoutId = setTimeout(() => controller.abort(), 10000) // 10s timeout

                const response = await fetch(item.url, {
                    method: 'HEAD',
                    redirect: 'manual', // Don't follow redirects
                    signal: controller.signal,
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                    }
                })

                clearTimeout(timeoutId)

                const isRedirect = response.status >= 300 && response.status < 400
                const redirectUrl = isRedirect ? response.headers.get('location') || null : null

                if (isRedirect) {
                    redirectsFound++
                }

                // Update database
                if (item.type === 'page') {
                    await prisma.projectPage.update({
                        where: { id: item.id },
                        data: {
                            hasRedirect: isRedirect,
                            redirectUrl: redirectUrl
                        }
                    })
                } else {
                    // For logs, just mark the redirectUrl but don't change status
                    // This allows the item to stay visible with a redirect badge
                    await prisma.linkBuildingLog.update({
                        where: { id: item.id },
                        data: {
                            redirectUrl: redirectUrl,
                            message: isRedirect ? `Redirects to: ${redirectUrl}` : undefined
                        }
                    })
                }

                return { id: item.id, redirect: isRedirect, redirectUrl }
            } catch (e: any) {
                console.error(`Error checking ${item.url}:`, e.message)
                return { id: item.id, redirect: false, error: e.message }
            }
        }

        // Process in batches
        for (let i = 0; i < urlsToCheck.length; i += effectiveConcurrency) {
            const batch = urlsToCheck.slice(i, i + effectiveConcurrency)
            await Promise.all(batch.map(checkUrl))

            // Add delay between batches (for gentle mode)
            if (effectiveDelay > 0 && i + effectiveConcurrency < urlsToCheck.length) {
                await new Promise(r => setTimeout(r, effectiveDelay))
            }
        }

        return NextResponse.json({
            checked: urlsToCheck.length,
            redirectsFound,
            mode
        })

    } catch (e: any) {
        console.error('Check redirects error:', e)
        return NextResponse.json({ error: e.message || 'Failed to check redirects' }, { status: 500 })
    }
}
