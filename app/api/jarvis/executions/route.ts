import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// GET /api/jarvis/executions - List executions for a flow
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const flowId = searchParams.get("flowId")
        const limit = parseInt(searchParams.get("limit") || "50")

        if (!flowId) {
            return NextResponse.json({ error: "flowId required" }, { status: 400 })
        }

        const executions = await prisma.jarvisExecution.findMany({
            where: { flowId: parseInt(flowId) },
            include: {
                logs: {
                    orderBy: { timestamp: "asc" }
                }
            },
            orderBy: { startedAt: "desc" },
            take: limit
        })

        return NextResponse.json({ executions })
    } catch (error) {
        console.error("Failed to fetch executions:", error)
        return NextResponse.json({ error: "Failed to fetch executions" }, { status: 500 })
    }
}

// POST /api/jarvis/executions - Manually trigger a flow
export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { flowId, testData } = body

        if (!flowId) {
            return NextResponse.json({ error: "flowId required" }, { status: 400 })
        }

        const flow = await prisma.jarvisFlow.findUnique({
            where: { id: parseInt(flowId) }
        })

        if (!flow) {
            return NextResponse.json({ error: "Flow not found" }, { status: 404 })
        }

        // Import and execute
        const { executeFlow } = await import("@/lib/jarvis/engine")

        const execution = await prisma.jarvisExecution.create({
            data: {
                flowId: flow.id,
                status: "running",
                triggerType: "manual",
                triggerData: JSON.stringify(testData || {})
            }
        })

        // Execute asynchronously
        executeFlow(flow, execution.id, testData || {}).catch(err => {
            console.error(`[Jarvis] Manual execution error:`, err)
        })

        return NextResponse.json({
            success: true,
            executionId: execution.id
        })
    } catch (error) {
        console.error("Failed to trigger execution:", error)
        return NextResponse.json({ error: "Failed to trigger" }, { status: 500 })
    }
}
