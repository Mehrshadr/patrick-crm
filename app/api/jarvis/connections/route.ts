import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// Available connector types
export const JARVIS_CONNECTORS = [
    {
        type: "webhook",
        name: "Webhook",
        category: "trigger",
        icon: "🔗",
        description: "Receive data via HTTP POST",
        configFields: [] // No config needed, just generates URL
    },
    {
        type: "facebook_leads",
        name: "Facebook Lead Ads",
        category: "trigger",
        icon: "📘",
        description: "Trigger when new lead from Facebook",
        configFields: [
            { name: "pageId", label: "Page ID", type: "text", required: true },
            { name: "accessToken", label: "Access Token", type: "password", required: true }
        ]
    },
    {
        type: "gravity_forms",
        name: "Gravity Forms",
        category: "trigger",
        icon: "📝",
        description: "Trigger on form submission",
        configFields: [
            { name: "webhookSecret", label: "Webhook Secret", type: "password", required: false }
        ]
    },
    {
        type: "monday",
        name: "Monday.com",
        category: "action",
        icon: "📊",
        description: "Create items in Monday boards",
        configFields: [
            { name: "apiKey", label: "API Key", type: "password", required: true },
            { name: "boardId", label: "Default Board ID", type: "text", required: false }
        ]
    },
    {
        type: "instantly",
        name: "Instantly",
        category: "action",
        icon: "⚡",
        description: "Add leads to Instantly campaigns",
        configFields: [
            { name: "apiKey", label: "API Key", type: "password", required: true },
            { name: "campaignId", label: "Default Campaign ID", type: "text", required: false }
        ]
    },
    {
        type: "mailchimp",
        name: "Mailchimp",
        category: "action",
        icon: "🐵",
        description: "Add subscribers to lists",
        configFields: [
            { name: "apiKey", label: "API Key", type: "password", required: true },
            { name: "listId", label: "Default List ID", type: "text", required: false },
            { name: "datacenter", label: "Datacenter (e.g. us20)", type: "text", required: true }
        ]
    },
    {
        type: "http",
        name: "HTTP Request",
        category: "action",
        icon: "🌐",
        description: "Make custom HTTP requests",
        configFields: [] // Config per-node
    },
    {
        type: "delay",
        name: "Delay",
        category: "utility",
        icon: "⏱️",
        description: "Wait before next step",
        configFields: [] // Config per-node
    },
    {
        type: "filter",
        name: "Filter",
        category: "utility",
        icon: "🔀",
        description: "Continue only if condition met",
        configFields: [] // Config per-node
    }
]

// GET /api/jarvis/connections - List connections for a project
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const projectId = searchParams.get("projectId")

        if (!projectId) {
            // Return available connector types
            return NextResponse.json({ connectors: JARVIS_CONNECTORS })
        }

        const connections = await prisma.jarvisConnection.findMany({
            where: { projectId: parseInt(projectId) },
            orderBy: { createdAt: "desc" }
        })

        // Mask credentials in response
        const maskedConnections = connections.map(conn => ({
            ...conn,
            credentials: "***" // Don't expose actual credentials
        }))

        return NextResponse.json({ connections: maskedConnections, connectors: JARVIS_CONNECTORS })
    } catch (error) {
        console.error("Failed to fetch connections:", error)
        return NextResponse.json({ error: "Failed to fetch connections" }, { status: 500 })
    }
}

// POST /api/jarvis/connections - Create a new connection
export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { projectId, connectorType, name, credentials, config } = body

        if (!projectId || !connectorType || !name) {
            return NextResponse.json({ error: "projectId, connectorType, and name required" }, { status: 400 })
        }

        // Validate connector type
        const connector = JARVIS_CONNECTORS.find(c => c.type === connectorType)
        if (!connector) {
            return NextResponse.json({ error: "Invalid connector type" }, { status: 400 })
        }

        const connection = await prisma.jarvisConnection.create({
            data: {
                projectId: parseInt(projectId),
                connectorType,
                name,
                icon: connector.icon,
                credentials: JSON.stringify(credentials || {}),
                config: config ? JSON.stringify(config) : null
            }
        })

        return NextResponse.json({ ...connection, credentials: "***" })
    } catch (error) {
        console.error("Failed to create connection:", error)
        return NextResponse.json({ error: "Failed to create connection" }, { status: 500 })
    }
}
