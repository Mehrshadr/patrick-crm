import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// Deepcrawl API base URL
const DEEPCRAWL_API = "https://api.deepcrawl.dev"

// Check if user is SUPER_ADMIN
async function isSuperAdmin() {
    const session = await auth()
    if (!session?.user?.email) return false

    const user = await prisma.user.findUnique({
        where: { email: session.user.email }
    })
    return user?.role === 'SUPER_ADMIN'
}

// POST /api/deepcrawl - Proxy requests to Deepcrawl API
export async function POST(request: Request) {
    try {
        // SUPER_ADMIN check
        if (!await isSuperAdmin()) {
            return NextResponse.json(
                { success: false, error: "Access denied. SUPER_ADMIN only." },
                { status: 403 }
            )
        }

        const body = await request.json()
        const { action, url, options = {} } = body

        const apiKey = process.env.DEEPCRAWL_API_KEY
        if (!apiKey) {
            return NextResponse.json(
                { success: false, error: "DEEPCRAWL_API_KEY not configured" },
                { status: 500 }
            )
        }

        let endpoint = ""
        let payload = {}

        switch (action) {
            case "read":
                // Read single URL - get markdown, metadata
                endpoint = "/read"
                payload = {
                    url,
                    markdown: true,
                    metadata: true,
                    cleanedHtml: false,
                    robots: true,
                    ...options
                }
                break

            case "links":
                // Extract links tree
                endpoint = "/links"
                payload = {
                    url,
                    tree: true,
                    metadata: true,
                    extractedLinks: true,
                    ...options
                }
                break

            default:
                return NextResponse.json(
                    { success: false, error: "Invalid action. Use 'read' or 'links'." },
                    { status: 400 }
                )
        }

        const response = await fetch(`${DEEPCRAWL_API}${endpoint}`, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        })

        const data = await response.json()

        if (!response.ok) {
            return NextResponse.json(
                { success: false, error: data.error || "Deepcrawl API error", details: data },
                { status: response.status }
            )
        }

        return NextResponse.json({
            success: true,
            data
        })

    } catch (error) {
        console.error("Deepcrawl API error:", error)
        return NextResponse.json(
            { success: false, error: "Failed to call Deepcrawl API" },
            { status: 500 }
        )
    }
}
