import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// GET /api/jarvis/flows/[id] - Get a single flow
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const flow = await prisma.jarvisFlow.findUnique({
            where: { id: parseInt(id) },
            include: {
                project: {
                    select: { id: true, name: true, slug: true }
                },
                _count: {
                    select: { executions: true }
                }
            }
        })

        if (!flow) {
            return NextResponse.json({ error: "Flow not found" }, { status: 404 })
        }

        return NextResponse.json(flow)
    } catch (error) {
        console.error("Failed to fetch flow:", error)
        return NextResponse.json({ error: "Failed to fetch flow" }, { status: 500 })
    }
}

// PATCH /api/jarvis/flows/[id] - Update a flow
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const body = await request.json()
        const { name, description, nodes, edges, isActive } = body

        const updateData: any = {}
        if (name !== undefined) updateData.name = name
        if (description !== undefined) updateData.description = description
        if (nodes !== undefined) updateData.nodes = typeof nodes === 'string' ? nodes : JSON.stringify(nodes)
        if (edges !== undefined) updateData.edges = typeof edges === 'string' ? edges : JSON.stringify(edges)
        if (isActive !== undefined) updateData.isActive = isActive

        const flow = await prisma.jarvisFlow.update({
            where: { id: parseInt(id) },
            data: updateData
        })

        return NextResponse.json(flow)
    } catch (error) {
        console.error("Failed to update flow:", error)
        return NextResponse.json({ error: "Failed to update flow" }, { status: 500 })
    }
}

// DELETE /api/jarvis/flows/[id] - Delete a flow
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        await prisma.jarvisFlow.delete({
            where: { id: parseInt(id) }
        })

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error("Failed to delete flow:", error)
        return NextResponse.json({ error: "Failed to delete flow" }, { status: 500 })
    }
}
