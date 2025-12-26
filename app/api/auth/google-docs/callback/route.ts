import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

const GOOGLE_CLIENT_ID = process.env.GOOGLE_SEARCH_CONSOLE_CLIENT_ID
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_SEARCH_CONSOLE_CLIENT_SECRET
const REDIRECT_URI = process.env.NEXTAUTH_URL + "/api/auth/google-docs/callback"

// GET /api/auth/google-docs/callback - Handle OAuth callback
export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams
    const code = searchParams.get("code")
    const error = searchParams.get("error")

    if (error) {
        return NextResponse.redirect(
            `${process.env.NEXTAUTH_URL}/settings?error=google_docs_denied`
        )
    }

    if (!code) {
        return NextResponse.redirect(
            `${process.env.NEXTAUTH_URL}/settings?error=no_code`
        )
    }

    try {
        // Exchange code for tokens
        const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
                code,
                client_id: GOOGLE_CLIENT_ID!,
                client_secret: GOOGLE_CLIENT_SECRET!,
                redirect_uri: REDIRECT_URI,
                grant_type: "authorization_code"
            })
        })

        const tokens = await tokenResponse.json()

        if (tokens.error) {
            console.error("Token exchange failed:", tokens)
            return NextResponse.redirect(
                `${process.env.NEXTAUTH_URL}/settings?error=token_exchange_failed`
            )
        }

        // Store tokens in database (separate from Search Console tokens)
        await prisma.googleDocsToken.upsert({
            where: { id: 1 }, // Single row for now
            create: {
                id: 1,
                accessToken: tokens.access_token,
                refreshToken: tokens.refresh_token,
                expiresAt: new Date(Date.now() + tokens.expires_in * 1000)
            },
            update: {
                accessToken: tokens.access_token,
                refreshToken: tokens.refresh_token || undefined,
                expiresAt: new Date(Date.now() + tokens.expires_in * 1000)
            }
        })

        return NextResponse.redirect(
            `${process.env.NEXTAUTH_URL}/settings?google_docs=connected`
        )
    } catch (error) {
        console.error("OAuth callback error:", error)
        return NextResponse.redirect(
            `${process.env.NEXTAUTH_URL}/settings?error=callback_failed`
        )
    }
}
