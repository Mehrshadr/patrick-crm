import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

const GOOGLE_CLIENT_ID = process.env.GOOGLE_SEARCH_CONSOLE_CLIENT_ID
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_SEARCH_CONSOLE_CLIENT_SECRET
const REDIRECT_URI = process.env.NEXTAUTH_URL + "/api/auth/google-search-console/callback"

// GET /api/auth/google-search-console/callback - Handle OAuth callback
export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams
    const code = searchParams.get("code")
    const error = searchParams.get("error")

    if (error) {
        console.error("OAuth error:", error)
        return NextResponse.redirect(
            new URL("/seo/link-indexing?error=oauth_denied", request.nextUrl.origin)
        )
    }

    if (!code) {
        return NextResponse.redirect(
            new URL("/seo/link-indexing?error=no_code", request.nextUrl.origin)
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
            console.error("Token exchange error:", tokens)
            return NextResponse.redirect(
                new URL(`/seo/link-indexing?error=${tokens.error}`, request.nextUrl.origin)
            )
        }

        // Get user email
        let email: string | null = null
        try {
            const userInfoRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
                headers: { Authorization: `Bearer ${tokens.access_token}` }
            })
            const userInfo = await userInfoRes.json()
            email = userInfo.email || null
        } catch (e) {
            console.warn("Could not fetch user email:", e)
        }

        // Calculate expiration time
        const expiresAt = new Date(Date.now() + tokens.expires_in * 1000)

        // Delete any existing tokens and save new one
        await prisma.googleOAuthToken.deleteMany({})
        await prisma.googleOAuthToken.create({
            data: {
                accessToken: tokens.access_token,
                refreshToken: tokens.refresh_token,
                expiresAt,
                scope: tokens.scope || "",
                email
            }
        })

        console.log("Google Search Console connected successfully for:", email)

        return NextResponse.redirect(
            new URL("/seo/link-indexing?success=connected", request.nextUrl.origin)
        )
    } catch (error) {
        console.error("OAuth callback error:", error)
        return NextResponse.redirect(
            new URL("/seo/link-indexing?error=callback_failed", request.nextUrl.origin)
        )
    }
}
