import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { nanoid } from "nanoid"

// GET /api/jarvis/flows - Get flows for a project
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const projectId = searchParams.get("projectId")

        if (!projectId) {
            return NextResponse.json({ error: "projectId required" }, { status: 400 })
        }

        const flows = await prisma.jarvisFlow.findMany({
            where: { projectId: parseInt(projectId) },
            include: {
                _count: {
                    select: { executions: true }
                }
            },
            orderBy: { createdAt: "desc" }
        })

        return NextResponse.json({ flows })
    } catch (error) {
        console.error("Failed to fetch flows:", error)
        return NextResponse.json({ error: "Failed to fetch flows" }, { status: 500 })
    }
}

// POST /api/jarvis/flows - Create a new flow
export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { projectId, name, description } = body

        if (!projectId || !name) {
            return NextResponse.json({ error: "projectId and name required" }, { status: 400 })
        }

        // Create with default trigger node
        const defaultNodes = JSON.stringify([
            {
                id: "trigger-1",
                type: "trigger",
                position: { x: 250, y: 100 },
                data: { label: "Webhook Trigger", type: "webhook" }
            }
        ])
        const defaultEdges = JSON.stringify([])

        const flow = await prisma.jarvisFlow.create({
            data: {
                projectId: parseInt(projectId),
                name,
                description,
                nodes: defaultNodes,
                edges: defaultEdges,
                webhookId: nanoid(12) // Generate unique webhook ID
            }
        })

        return NextResponse.json(flow)
    } catch (error) {
        console.error("Failed to create flow:", error)
        return NextResponse.json({ error: "Failed to create flow" }, { status: 500 })
    }
}
