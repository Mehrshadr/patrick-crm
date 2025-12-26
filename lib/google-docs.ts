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

interface ContentBlock {
    type: 'heading1' | 'heading2' | 'heading3' | 'paragraph' | 'list-item' | 'image'
    text: string
    imageUrl?: string
}

/**
 * Parse HTML into structured content blocks for Google Docs formatting.
 */
function parseHtmlToBlocks(html: string): ContentBlock[] {
    const blocks: ContentBlock[] = []

    // Clean up HTML entities
    let content = html
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')

    // Extract elements with regex (order matters)
    const patterns = [
        { regex: /<h1[^>]*>([\s\S]*?)<\/h1>/gi, type: 'heading1' as const },
        { regex: /<h2[^>]*>([\s\S]*?)<\/h2>/gi, type: 'heading2' as const },
        { regex: /<h3[^>]*>([\s\S]*?)<\/h3>/gi, type: 'heading3' as const },
        { regex: /<li[^>]*>([\s\S]*?)<\/li>/gi, type: 'list-item' as const },
        { regex: /<p[^>]*>([\s\S]*?)<\/p>/gi, type: 'paragraph' as const },
        { regex: /<figure[^>]*class="content-image"[^>]*>[\s\S]*?<img[^>]*src="([^"]+)"[^>]*>[\s\S]*?<\/figure>/gi, type: 'image' as const },
    ]

    // Find all matches with their positions
    interface Match {
        type: ContentBlock['type']
        text: string
        imageUrl?: string
        index: number
    }

    const matches: Match[] = []

    for (const pattern of patterns) {
        let match
        const tempContent = content
        while ((match = pattern.regex.exec(tempContent)) !== null) {
            if (pattern.type === 'image') {
                matches.push({
                    type: 'image',
                    text: '',
                    imageUrl: match[1],
                    index: match.index
                })
            } else {
                // Strip inner HTML tags
                const text = match[1]
                    .replace(/<strong[^>]*>([\s\S]*?)<\/strong>/gi, '$1')
                    .replace(/<em[^>]*>([\s\S]*?)<\/em>/gi, '$1')
                    .replace(/<[^>]+>/g, '')
                    .trim()

                if (text) {
                    matches.push({
                        type: pattern.type,
                        text,
                        index: match.index
                    })
                }
            }
        }
    }

    // Sort by position in document
    matches.sort((a, b) => a.index - b.index)

    // Convert to blocks
    for (const match of matches) {
        blocks.push({
            type: match.type,
            text: match.text,
            imageUrl: match.imageUrl
        })
    }

    return blocks
}

/**
 * Create a new Google Doc with the given content, preserving formatting.
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

    // Step 2: Parse HTML into blocks
    const blocks = parseHtmlToBlocks(htmlContent)

    if (blocks.length === 0) {
        return `https://docs.google.com/document/d/${documentId}/edit`
    }

    // Step 3: Build requests for inserting text and applying styles
    // We insert in REVERSE order because each insert shifts existing content
    const requests: any[] = []
    const styleRequests: any[] = []

    // Build the full text and track positions for styling
    let fullText = ""
    const blockPositions: { start: number; end: number; type: ContentBlock['type']; imageUrl?: string }[] = []

    for (const block of blocks) {
        const start = fullText.length + 1 // +1 because Docs is 1-indexed

        if (block.type === 'image' && block.imageUrl) {
            // Add placeholder for image
            fullText += "[Image]\n\n"
        } else if (block.type === 'list-item') {
            fullText += `• ${block.text}\n`
        } else {
            fullText += block.text + "\n\n"
        }

        const end = fullText.length
        blockPositions.push({ start, end, type: block.type, imageUrl: block.imageUrl })
    }

    // Insert all text at once
    requests.push({
        insertText: {
            location: { index: 1 },
            text: fullText
        }
    })

    // Apply styles to each block
    for (const pos of blockPositions) {
        if (pos.type === 'heading1') {
            styleRequests.push({
                updateParagraphStyle: {
                    range: { startIndex: pos.start, endIndex: pos.end },
                    paragraphStyle: { namedStyleType: 'HEADING_1' },
                    fields: 'namedStyleType'
                }
            })
        } else if (pos.type === 'heading2') {
            styleRequests.push({
                updateParagraphStyle: {
                    range: { startIndex: pos.start, endIndex: pos.end },
                    paragraphStyle: { namedStyleType: 'HEADING_2' },
                    fields: 'namedStyleType'
                }
            })
        } else if (pos.type === 'heading3') {
            styleRequests.push({
                updateParagraphStyle: {
                    range: { startIndex: pos.start, endIndex: pos.end },
                    paragraphStyle: { namedStyleType: 'HEADING_3' },
                    fields: 'namedStyleType'
                }
            })
        }
    }

    // Step 4: Execute batch update - first insert text
    const insertResponse = await fetch(
        `https://docs.googleapis.com/v1/documents/${documentId}:batchUpdate`,
        {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${accessToken}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ requests })
        }
    )

    if (!insertResponse.ok) {
        console.error("Failed to insert content:", await insertResponse.text())
    }

    // Step 5: Apply styles in a second batch
    if (styleRequests.length > 0) {
        const styleResponse = await fetch(
            `https://docs.googleapis.com/v1/documents/${documentId}:batchUpdate`,
            {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${accessToken}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ requests: styleRequests })
            }
        )

        if (!styleResponse.ok) {
            console.error("Failed to apply styles:", await styleResponse.text())
        }
    }

    // Step 6: Insert images (requires absolute URLs)
    // Note: Images must be publicly accessible for Google Docs to fetch them
    // For local images, we'd need to upload them to Google Drive first
    // For now, we show [Image] placeholder

    return `https://docs.google.com/document/d/${documentId}/edit`
}
