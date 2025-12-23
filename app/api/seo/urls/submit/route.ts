import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getGoogleAccessToken } from "@/lib/google-search-console"

// POST /api/seo/urls/submit - Submit URLs to Google Indexing API
export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { urlIds } = body

        if (!urlIds || !Array.isArray(urlIds) || urlIds.length === 0) {
            return NextResponse.json({ error: 'URL IDs are required' }, { status: 400 })
        }

        // Fetch URLs from database
        const urls = await prisma.indexingUrl.findMany({
            where: { id: { in: urlIds } }
        })

        if (urls.length === 0) {
            return NextResponse.json({ error: 'No URLs found' }, { status: 404 })
        }

        // Get OAuth access token
        const accessToken = await getGoogleAccessToken()

        if (!accessToken) {
            return NextResponse.json({
                error: 'Google Search Console not connected. Please connect first.',
                needsAuth: true
            }, { status: 401 })
        }

        let submitted = 0
        let failed = 0
        const results: { url: string; status: string; error?: string }[] = []

        // Submit each URL to Google Indexing API
        for (const urlRecord of urls) {
            try {
                const response = await fetch(
                    "https://indexing.googleapis.com/v3/urlNotifications:publish",
                    {
                        method: "POST",
                        headers: {
                            "Authorization": `Bearer ${accessToken}`,
                            "Content-Type": "application/json"
                        },
                        body: JSON.stringify({
                            url: urlRecord.url,
                            type: "URL_UPDATED"
                        })
                    }
                )

                const responseData = await response.json()

                if (!response.ok) {
                    throw new Error(responseData.error?.message || `API error: ${response.status}`)
                }

                // Update URL status
                await prisma.indexingUrl.update({
                    where: { id: urlRecord.id },
                    data: {
                        status: 'SUBMITTED',
                        lastSubmittedAt: new Date()
                    }
                })

                // Log the action
                await prisma.indexingLog.create({
                    data: {
                        urlId: urlRecord.id,
                        action: 'SUBMIT',
                        status: 'SUCCESS',
                        response: JSON.stringify(responseData)
                    }
                })

                results.push({ url: urlRecord.url, status: 'SUBMITTED' })
                submitted++

            } catch (apiError: any) {
                console.error(`Failed to submit ${urlRecord.url}:`, apiError)

                // Log the error
                await prisma.indexingLog.create({
                    data: {
                        urlId: urlRecord.id,
                        action: 'SUBMIT',
                        status: 'FAILED',
                        response: JSON.stringify({ error: apiError.message })
                    }
                })

                results.push({ url: urlRecord.url, status: 'ERROR', error: apiError.message })
                failed++
            }
        }

        return NextResponse.json({ submitted, failed, results })
    } catch (error) {
        console.error('Failed to submit URLs:', error)
        return NextResponse.json({ error: 'Failed to submit URLs' }, { status: 500 })
    }
}
