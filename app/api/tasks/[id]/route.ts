
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// PATCH /api/tasks/[id] - Update a task
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const body = await request.json()

        // Handle date conversion if present
        if (body.dueDate) {
            body.dueDate = new Date(body.dueDate)
        }

        // If marking as completed, set completedAt
        if (body.status === 'COMPLETED' && !body.completedAt) {
            body.completedAt = new Date()
        } else if (body.status === 'PENDING') {
            body.completedAt = null
        }

        const task = await prisma.task.update({
            where: { id: parseInt(id) },
            data: body,
            include: {
                lead: true
            }
        })

        return NextResponse.json(task)
    } catch (error) {
        console.error("Failed to update task:", error)
        return NextResponse.json({ error: "Failed to update task" }, { status: 500 })
    }
}

// DELETE /api/tasks/[id] - Delete a task
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        await prisma.task.delete({
            where: { id: parseInt(id) }
        })

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error("Failed to delete task:", error)
        return NextResponse.json({ error: "Failed to delete task" }, { status: 500 })
    }
}
