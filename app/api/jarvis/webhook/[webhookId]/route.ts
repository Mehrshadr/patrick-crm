import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { executeFlow } from "@/lib/jarvis/engine"

// POST /api/jarvis/webhook/[webhookId] - Receive webhook and trigger flow
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ webhookId: string }> }
) {
    const { webhookId } = await params

    try {
        // Find flow by webhookId
        const flow = await prisma.jarvisFlow.findUnique({
            where: { webhookId },
            include: {
                project: {
                    select: { id: true, name: true }
                }
            }
        })

        if (!flow) {
            return NextResponse.json({ error: "Flow not found" }, { status: 404 })
        }

        if (!flow.isActive) {
            return NextResponse.json({ error: "Flow is paused" }, { status: 400 })
        }

        // Get request body
        let triggerData: any = {}
        try {
            triggerData = await request.json()
        } catch {
            // Empty body is ok for some webhooks
        }

        // Create execution record
        const execution = await prisma.jarvisExecution.create({
            data: {
                flowId: flow.id,
                status: "running",
                triggerType: "webhook",
                triggerData: JSON.stringify(triggerData)
            }
        })

        // Execute flow asynchronously (don't wait)
        executeFlow(flow, execution.id, triggerData).catch(err => {
            console.error(`[Jarvis] Flow execution error for ${flow.id}:`, err)
        })

        return NextResponse.json({
            success: true,
            executionId: execution.id,
            message: "Flow triggered"
        })
    } catch (error: any) {
        console.error("[Jarvis Webhook] Error:", error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

// GET - Return info about the webhook
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ webhookId: string }> }
) {
    const { webhookId } = await params

    const flow = await prisma.jarvisFlow.findUnique({
        where: { webhookId },
        select: { id: true, name: true, isActive: true }
    })

    if (!flow) {
        return NextResponse.json({ error: "Flow not found" }, { status: 404 })
    }

    return NextResponse.json({
        flowId: flow.id,
        flowName: flow.name,
        isActive: flow.isActive,
        message: "Send POST request with JSON body to trigger this flow"
    })
}
