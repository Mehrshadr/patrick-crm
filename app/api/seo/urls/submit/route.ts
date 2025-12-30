import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getGoogleAccessToken } from "@/lib/google-search-console"
import { auth } from "@/lib/auth"
import { logActivity } from "@/lib/activity-logger"

// POST /api/seo/urls/submit - Submit URLs to Google Indexing API
export async function POST(request: NextRequest) {
    try {
        // Get current user for tracking
        const session = await auth()
        const userEmail = session?.user?.email
        let userId: number | undefined
        let userName: string | undefined

        if (userEmail) {
            const user = await prisma.user.findUnique({
                where: { email: userEmail },
                select: { id: true, name: true }
            })
            if (user) {
                userId = user.id
                userName = user.name || userEmail
            }
        }

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

                // Log the action with user tracking
                await prisma.indexingLog.create({
                    data: {
                        urlId: urlRecord.id,
                        action: 'SUBMIT',
                        status: 'SUCCESS',
                        response: JSON.stringify(responseData),
                        userId,
                        userName
                    }
                })

                results.push({ url: urlRecord.url, status: 'SUBMITTED' })
                submitted++

                // Log Activity (Centralized)
                await logActivity({
                    userId: userEmail,
                    userName: userName,
                    projectId: urlRecord.projectId, // Assuming relation exists, checking loop variable
                    category: 'LINK_INDEXING',
                    action: 'SUBMITTED',
                    description: `Submitted URL to Google: ${urlRecord.url}`,
                    entityType: 'IndexingUrl',
                    entityId: urlRecord.id,
                    entityName: urlRecord.url
                })

            } catch (apiError: any) {
                console.error(`Failed to submit ${urlRecord.url}:`, apiError)

                // Log the error with user tracking
                await prisma.indexingLog.create({
                    data: {
                        urlId: urlRecord.id,
                        action: 'SUBMIT',
                        status: 'FAILED',
                        response: JSON.stringify({ error: apiError.message }),
                        userId,
                        userName
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

