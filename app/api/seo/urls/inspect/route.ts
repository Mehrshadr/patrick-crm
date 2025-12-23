import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getGoogleAccessToken, GOOGLE_COVERAGE_STATES } from "@/lib/google-search-console"

// Try different siteUrl formats for the URL Inspection API
async function tryInspectUrl(
    accessToken: string,
    inspectionUrl: string,
    domain: string
): Promise<{ success: boolean; data?: any; error?: string; workingSiteUrl?: string }> {

    // Extract clean domain without protocol or trailing slash
    const cleanDomain = domain
        .replace(/^https?:\/\//, '')
        .replace(/\/$/, '')
        .replace(/^www\./, '')

    // Formats to try (in order of preference)
    const siteUrlFormats = [
        `sc-domain:${cleanDomain}`,                    // Domain property (preferred)
        `https://www.${cleanDomain}/`,                 // URL prefix with www
        `https://${cleanDomain}/`,                     // URL prefix without www
        `http://www.${cleanDomain}/`,                  // HTTP with www
        `http://${cleanDomain}/`,                      // HTTP without www
    ]

    for (const siteUrl of siteUrlFormats) {
        try {
            const response = await fetch(
                "https://searchconsole.googleapis.com/v1/urlInspection/index:inspect",
                {
                    method: "POST",
                    headers: {
                        "Authorization": `Bearer ${accessToken}`,
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        inspectionUrl,
                        siteUrl
                    })
                }
            )

            if (response.ok) {
                const data = await response.json()
                return { success: true, data, workingSiteUrl: siteUrl }
            }

            const errorData = await response.json()
            const errorMessage = errorData.error?.message || ''

            // If it's a "not owner" error, try the next format
            if (errorMessage.includes('not own') || errorMessage.includes('not part of')) {
                continue
            }

            // For other errors, return the error
            return { success: false, error: errorMessage }

        } catch (e: any) {
            continue // Try next format
        }
    }

    return {
        success: false,
        error: 'Could not find a valid Search Console property for this domain. Please verify the site in Search Console.'
    }
}

// POST /api/seo/urls/inspect - Check URL indexing status via Search Console API
export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { urlIds } = body

        if (!urlIds || !Array.isArray(urlIds) || urlIds.length === 0) {
            return NextResponse.json({ error: 'URL IDs are required' }, { status: 400 })
        }

        // Fetch URLs with their projects (for siteUrl)
        const urls = await prisma.indexingUrl.findMany({
            where: { id: { in: urlIds } },
            include: { project: true }
        })

        if (urls.length === 0) {
            return NextResponse.json({ error: 'No URLs found' }, { status: 404 })
        }

        // Get access token
        const accessToken = await getGoogleAccessToken()

        if (!accessToken) {
            return NextResponse.json({
                error: 'Google Search Console not connected. Please connect first.',
                needsAuth: true
            }, { status: 401 })
        }

        let checked = 0
        let failed = 0
        const results: {
            url: string
            status: string
            coverageState?: string
            lastCrawled?: string
            error?: string
        }[] = []

        // Process URLs in parallel batches of 5 for speed
        const batchSize = 5
        for (let i = 0; i < urls.length; i += batchSize) {
            const batch = urls.slice(i, i + batchSize)

            const batchPromises = batch.map(async (urlRecord) => {
                try {
                    const domain = urlRecord.project.domain || new URL(urlRecord.url).hostname

                    const inspectResult = await tryInspectUrl(
                        accessToken,
                        urlRecord.url,
                        domain
                    )

                    if (!inspectResult.success) {
                        throw new Error(inspectResult.error)
                    }

                    const inspectionResult = inspectResult.data.inspectionResult

                    // Extract coverage state (the actual status from Google)
                    const coverageState = inspectionResult?.indexStatusResult?.coverageState || 'URL is unknown to Google'

                    // Extract last crawl time
                    const lastCrawlTime = inspectionResult?.indexStatusResult?.lastCrawlTime
                    const lastCrawledAt = lastCrawlTime ? new Date(lastCrawlTime) : null

                    // Map Google's coverage state to our internal status for grouping
                    let internalStatus = 'PENDING'
                    if (coverageState === GOOGLE_COVERAGE_STATES.SUBMITTED_AND_INDEXED) {
                        internalStatus = 'INDEXED'
                    } else if (
                        coverageState === GOOGLE_COVERAGE_STATES.CRAWLED_NOT_INDEXED ||
                        coverageState === GOOGLE_COVERAGE_STATES.DISCOVERED_NOT_INDEXED
                    ) {
                        internalStatus = 'CRAWLED'
                    } else if (
                        coverageState === GOOGLE_COVERAGE_STATES.NOT_FOUND_404 ||
                        coverageState === GOOGLE_COVERAGE_STATES.REDIRECT_ERROR ||
                        coverageState === GOOGLE_COVERAGE_STATES.BLOCKED_4XX
                    ) {
                        internalStatus = 'ERROR'
                    } else {
                        internalStatus = 'EXCLUDED'
                    }

                    // Update URL record
                    await prisma.indexingUrl.update({
                        where: { id: urlRecord.id },
                        data: {
                            status: internalStatus,
                            lastInspectedAt: new Date(),
                            lastCrawledAt: lastCrawledAt,
                            lastInspectionResult: coverageState
                        }
                    })

                    // Log the action
                    await prisma.indexingLog.create({
                        data: {
                            urlId: urlRecord.id,
                            action: 'INSPECT',
                            status: 'SUCCESS',
                            response: JSON.stringify({
                                coverageState,
                                lastCrawlTime,
                                verdict: inspectionResult?.indexStatusResult?.verdict,
                                siteUrl: inspectResult.workingSiteUrl
                            })
                        }
                    })

                    return {
                        url: urlRecord.url,
                        status: internalStatus,
                        coverageState,
                        lastCrawled: lastCrawledAt?.toISOString(),
                        success: true
                    }

                } catch (apiError: any) {
                    console.error(`Failed to inspect ${urlRecord.url}:`, apiError)

                    // Log the error
                    await prisma.indexingLog.create({
                        data: {
                            urlId: urlRecord.id,
                            action: 'INSPECT',
                            status: 'FAILED',
                            response: JSON.stringify({ error: apiError.message })
                        }
                    })

                    return {
                        url: urlRecord.url,
                        status: 'ERROR',
                        error: apiError.message,
                        success: false
                    }
                }
            })

            const batchResults = await Promise.all(batchPromises)

            for (const result of batchResults) {
                if (result.success) {
                    checked++
                } else {
                    failed++
                }
                results.push(result)
            }
        }

        return NextResponse.json({ checked, failed, results })
    } catch (error) {
        console.error('Failed to inspect URLs:', error)
        return NextResponse.json({ error: 'Failed to inspect URLs' }, { status: 500 })
    }
}
