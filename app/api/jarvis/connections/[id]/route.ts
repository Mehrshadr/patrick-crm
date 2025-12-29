import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// GET /api/jarvis/connections/[id] - Get a connection (with credentials for execution)
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const { searchParams } = new URL(request.url)
        const includeCredentials = searchParams.get("includeCredentials") === "true"

        const connection = await prisma.jarvisConnection.findUnique({
            where: { id: parseInt(id) }
        })

        if (!connection) {
            return NextResponse.json({ error: "Connection not found" }, { status: 404 })
        }

        // Only include credentials if specifically requested (for execution engine)
        if (!includeCredentials) {
            return NextResponse.json({ ...connection, credentials: "***" })
        }

        return NextResponse.json(connection)
    } catch (error) {
        console.error("Failed to fetch connection:", error)
        return NextResponse.json({ error: "Failed to fetch" }, { status: 500 })
    }
}

// PATCH /api/jarvis/connections/[id] - Update a connection
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const body = await request.json()
        const { name, credentials, config, isActive } = body

        const updateData: any = {}
        if (name !== undefined) updateData.name = name
        if (credentials !== undefined) updateData.credentials = JSON.stringify(credentials)
        if (config !== undefined) updateData.config = JSON.stringify(config)
        if (isActive !== undefined) updateData.isActive = isActive

        const connection = await prisma.jarvisConnection.update({
            where: { id: parseInt(id) },
            data: updateData
        })

        return NextResponse.json({ ...connection, credentials: "***" })
    } catch (error) {
        console.error("Failed to update connection:", error)
        return NextResponse.json({ error: "Failed to update" }, { status: 500 })
    }
}

// DELETE /api/jarvis/connections/[id] - Delete a connection
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        await prisma.jarvisConnection.delete({
            where: { id: parseInt(id) }
        })

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error("Failed to delete connection:", error)
        return NextResponse.json({ error: "Failed to delete" }, { status: 500 })
    }
}
