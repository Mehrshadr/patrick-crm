import { NextRequest, NextResponse } from "next/server"

const GOOGLE_CLIENT_ID = process.env.GOOGLE_SEARCH_CONSOLE_CLIENT_ID
const REDIRECT_URI = process.env.NEXTAUTH_URL + "/api/auth/google-docs/callback"

// Scopes needed for Google Docs API
const SCOPES = [
    "https://www.googleapis.com/auth/documents",      // Create/edit Google Docs
    "https://www.googleapis.com/auth/drive.file"      // Access files created by this app
].join(" ")

// GET /api/auth/google-docs - Redirect to Google OAuth for Docs access
export async function GET(request: NextRequest) {
    if (!GOOGLE_CLIENT_ID) {
        return NextResponse.json(
            { error: "Google credentials not configured" },
            { status: 500 }
        )
    }

    const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth")
    authUrl.searchParams.set("client_id", GOOGLE_CLIENT_ID)
    authUrl.searchParams.set("redirect_uri", REDIRECT_URI)
    authUrl.searchParams.set("response_type", "code")
    authUrl.searchParams.set("scope", SCOPES)
    authUrl.searchParams.set("access_type", "offline")
    authUrl.searchParams.set("prompt", "consent")

    return NextResponse.redirect(authUrl.toString())
}
