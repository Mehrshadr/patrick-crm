import { NextRequest, NextResponse } from "next/server"

const GOOGLE_CLIENT_ID = process.env.GOOGLE_SEARCH_CONSOLE_CLIENT_ID

// Scopes needed for Search Console API
const SCOPES = [
    "https://www.googleapis.com/auth/indexing",           // For submitting URLs
    "https://www.googleapis.com/auth/webmasters.readonly" // For reading URL inspection data
].join(" ")

// GET /api/auth/google-search-console - Redirect to Google OAuth
export async function GET(request: NextRequest) {
    if (!GOOGLE_CLIENT_ID) {
        return NextResponse.json(
            { error: "Google Search Console credentials not configured" },
            { status: 500 }
        )
    }

    // Build redirect URI dynamically from request origin
    const redirectUri = `${request.nextUrl.origin}/api/auth/google-search-console/callback`

    const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth")
    authUrl.searchParams.set("client_id", GOOGLE_CLIENT_ID)
    authUrl.searchParams.set("redirect_uri", redirectUri)
    authUrl.searchParams.set("response_type", "code")
    authUrl.searchParams.set("scope", SCOPES)
    authUrl.searchParams.set("access_type", "offline")  // Get refresh token
    authUrl.searchParams.set("prompt", "consent")        // Force consent to get refresh token

    return NextResponse.redirect(authUrl.toString())
}
