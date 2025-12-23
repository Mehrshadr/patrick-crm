import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

const GOOGLE_CLIENT_ID = process.env.GOOGLE_SEARCH_CONSOLE_CLIENT_ID
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_SEARCH_CONSOLE_CLIENT_SECRET

// GET /api/auth/google-search-console/status - Check connection status
export async function GET() {
    try {
        const token = await prisma.googleOAuthToken.findFirst({
            orderBy: { createdAt: 'desc' }
        })

        if (!token) {
            return NextResponse.json({
                connected: false,
                message: "Not connected to Google Search Console"
            })
        }

        // Check if token is expired
        const isExpired = new Date() >= token.expiresAt

        // If expired, try to refresh
        if (isExpired) {
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
                    // Refresh failed, need to re-authorize
                    return NextResponse.json({
                        connected: false,
                        expired: true,
                        message: "Token expired, please reconnect"
                    })
                }

                // Update token in database
                await prisma.googleOAuthToken.update({
                    where: { id: token.id },
                    data: {
                        accessToken: newTokens.access_token,
                        expiresAt: new Date(Date.now() + newTokens.expires_in * 1000)
                    }
                })

                return NextResponse.json({
                    connected: true,
                    email: token.email,
                    message: "Connected (token refreshed)"
                })
            } catch (refreshError) {
                console.error("Token refresh error:", refreshError)
                return NextResponse.json({
                    connected: false,
                    expired: true,
                    message: "Failed to refresh token"
                })
            }
        }

        return NextResponse.json({
            connected: true,
            email: token.email,
            expiresAt: token.expiresAt,
            message: "Connected to Google Search Console"
        })
    } catch (error) {
        console.error("Status check error:", error)
        return NextResponse.json({
            connected: false,
            error: "Failed to check connection status"
        })
    }
}

// DELETE /api/auth/google-search-console/status - Disconnect
export async function DELETE() {
    try {
        await prisma.googleOAuthToken.deleteMany({})
        return NextResponse.json({ success: true })
    } catch (error) {
        return NextResponse.json(
            { error: "Failed to disconnect" },
            { status: 500 }
        )
    }
}
