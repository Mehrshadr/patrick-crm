import { prisma } from "@/lib/prisma"

const GOOGLE_CLIENT_ID = process.env.GOOGLE_SEARCH_CONSOLE_CLIENT_ID
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_SEARCH_CONSOLE_CLIENT_SECRET

/**
 * Get a valid Google Docs OAuth access token.
 * Automatically refreshes if expired.
 */
export async function getGoogleDocsAccessToken(): Promise<string | null> {
    const token = await prisma.googleDocsToken.findFirst({
        orderBy: { createdAt: 'desc' }
    })

    if (!token) {
        console.log("No Google Docs OAuth token found")
        return null
    }

    // Check if token is still valid (with 5 minute buffer)
    const isExpired = new Date() >= new Date(token.expiresAt.getTime() - 5 * 60 * 1000)

    if (!isExpired) {
        return token.accessToken
    }

    // Token is expired, try to refresh
    console.log("Google Docs access token expired, refreshing...")

    try {
        const refreshResponse = await fetch("https://oauth2.googleapis.com/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
                client_id: GOOGLE_CLIENT_ID!,
                client_secret: GOOGLE_CLIENT_SECRET!,
                refresh_token: token.refreshToken,
                grant_type: "refresh_token"
            })
        })

        const newTokens = await refreshResponse.json()

        if (newTokens.error) {
            console.error("Token refresh failed:", newTokens)
            return null
        }

        // Update token in database
        await prisma.googleDocsToken.update({
            where: { id: token.id },
            data: {
                accessToken: newTokens.access_token,
                expiresAt: new Date(Date.now() + newTokens.expires_in * 1000)
            }
        })

        console.log("Google Docs access token refreshed successfully")
        return newTokens.access_token
    } catch (error) {
        console.error("Failed to refresh Google Docs token:", error)
        return null
    }
}

/**
 * Convert HTML content to Google Docs format requests.
 * Returns an array of insertText and updateParagraphStyle requests.
 */
export function htmlToGoogleDocsRequests(html: string): any[] {
    const requests: any[] = []
    let currentIndex = 1 // Docs index starts at 1

    // Parse HTML and convert to docs format
    // Simple parser - handles common tags
    const parser = new DOMParser()

    // For server-side, we'll use regex-based parsing
    const lines = html
        .replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n\n')
        .replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n\n')
        .replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n\n')
        .replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n\n')
        .replace(/<li[^>]*>(.*?)<\/li>/gi, '• $1\n')
        .replace(/<ul[^>]*>|<\/ul>/gi, '\n')
        .replace(/<ol[^>]*>|<\/ol>/gi, '\n')
        .replace(/<strong[^>]*>(.*?)<\/strong>/gi, '$1')
        .replace(/<em[^>]*>(.*?)<\/em>/gi, '$1')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<[^>]+>/g, '') // Remove remaining tags
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/\n{3,}/g, '\n\n') // Max 2 newlines
        .trim()

    // Insert all text at once
    requests.push({
        insertText: {
            location: { index: currentIndex },
            text: lines
        }
    })

    return requests
}

/**
 * Create a new Google Doc with the given content.
 * Returns the document URL.
 */
export async function createGoogleDoc(
    title: string,
    htmlContent: string,
    accessToken: string
): Promise<string> {
    // Step 1: Create empty document
    const createResponse = await fetch("https://docs.googleapis.com/v1/documents", {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${accessToken}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ title })
    })

    if (!createResponse.ok) {
        const error = await createResponse.json()
        throw new Error(`Failed to create document: ${JSON.stringify(error)}`)
    }

    const doc = await createResponse.json()
    const documentId = doc.documentId

    // Step 2: Convert HTML to plain text for insertion
    const plainText = htmlContent
        .replace(/<h1[^>]*>(.*?)<\/h1>/gi, '$1\n\n')
        .replace(/<h2[^>]*>(.*?)<\/h2>/gi, '$1\n\n')
        .replace(/<h3[^>]*>(.*?)<\/h3>/gi, '$1\n\n')
        .replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n\n')
        .replace(/<li[^>]*>(.*?)<\/li>/gi, '• $1\n')
        .replace(/<ul[^>]*>|<\/ul>/gi, '\n')
        .replace(/<ol[^>]*>|<\/ol>/gi, '\n')
        .replace(/<strong[^>]*>(.*?)<\/strong>/gi, '$1')
        .replace(/<em[^>]*>(.*?)<\/em>/gi, '$1')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<figure[^>]*>[\s\S]*?<\/figure>/gi, '[IMAGE]\n\n') // Show image placeholder
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/\n{3,}/g, '\n\n')
        .trim()

    // Step 3: Insert content
    const batchUpdateResponse = await fetch(
        `https://docs.googleapis.com/v1/documents/${documentId}:batchUpdate`,
        {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${accessToken}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                requests: [{
                    insertText: {
                        location: { index: 1 },
                        text: plainText
                    }
                }]
            })
        }
    )

    if (!batchUpdateResponse.ok) {
        console.error("Failed to insert content:", await batchUpdateResponse.text())
        // Continue anyway, doc is created
    }

    return `https://docs.google.com/document/d/${documentId}/edit`
}
