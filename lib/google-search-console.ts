import { prisma } from "@/lib/prisma"

const GOOGLE_CLIENT_ID = process.env.GOOGLE_SEARCH_CONSOLE_CLIENT_ID
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_SEARCH_CONSOLE_CLIENT_SECRET

/**
 * Get a valid Google OAuth access token.
 * Automatically refreshes if expired.
 */
export async function getGoogleAccessToken(): Promise<string | null> {
    const token = await prisma.googleOAuthToken.findFirst({
        orderBy: { createdAt: 'desc' }
    })

    if (!token) {
        console.log("No Google OAuth token found")
        return null
    }

    // Check if token is still valid (with 5 minute buffer)
    const isExpired = new Date() >= new Date(token.expiresAt.getTime() - 5 * 60 * 1000)

    if (!isExpired) {
        return token.accessToken
    }

    // Token is expired, try to refresh
    console.log("Access token expired, refreshing...")

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
        await prisma.googleOAuthToken.update({
            where: { id: token.id },
            data: {
                accessToken: newTokens.access_token,
                expiresAt: new Date(Date.now() + newTokens.expires_in * 1000)
            }
        })

        console.log("Access token refreshed successfully")
        return newTokens.access_token
    } catch (error) {
        console.error("Failed to refresh token:", error)
        return null
    }
}

/**
 * Status values returned by Google Search Console URL Inspection API
 * These are the actual coverageState values
 */
export const GOOGLE_COVERAGE_STATES = {
    // Indexed (success)
    SUBMITTED_AND_INDEXED: "Submitted and indexed",

    // Not indexed (various reasons)
    CRAWLED_NOT_INDEXED: "Crawled - currently not indexed",
    DISCOVERED_NOT_INDEXED: "Discovered - currently not indexed",
    PAGE_WITH_REDIRECT: "Page with redirect",
    EXCLUDED_NOINDEX: "Excluded by 'noindex' tag",
    NOT_FOUND_404: "Not found (404)",
    ALTERNATE_CANONICAL: "Alternate page with proper canonical tag",
    BLOCKED_ROBOTS: "Blocked by robots.txt",
    DUPLICATE_NO_CANONICAL: "Duplicate without user-selected canonical",
    REDIRECT_ERROR: "Redirect error",
    BLOCKED_4XX: "Blocked due to other 4xx issue",
    URL_UNKNOWN: "URL is unknown to Google",
} as const

export type GoogleCoverageState = typeof GOOGLE_COVERAGE_STATES[keyof typeof GOOGLE_COVERAGE_STATES]
