
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// GET /api/tasks - Get all tasks
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const leadId = searchParams.get('leadId')

        const where: any = {}
        if (leadId) {
            where.leadId = parseInt(leadId)
        }

        const tasks = await prisma.task.findMany({
            where,
            include: {
                lead: {
                    select: {
                        id: true,
                        name: true,
                        // Add other fields if needed for display
                    }
                }
            },
            orderBy: [
                { status: 'asc' }, // PENDING first
                { dueDate: 'asc' } // Earliest due first
            ]
        })

        return NextResponse.json(tasks)
    } catch (error) {
        console.error("Failed to fetch tasks:", error)
        return NextResponse.json({ error: "Failed to fetch tasks" }, { status: 500 })
    }
}

// POST /api/tasks - Create a new task
export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { title, description, dueDate, leadId, priority } = body

        if (!title || !dueDate) {
            return NextResponse.json({ error: "Title and Due Date are required" }, { status: 400 })
        }

        const task = await prisma.task.create({
            data: {
                title,
                description,
                dueDate: new Date(dueDate),
                leadId: leadId ? parseInt(leadId) : null,
                priority: priority || "NORMAL",
                status: "PENDING"
            },
            include: {
                lead: true
            }
        })

        return NextResponse.json(task)
    } catch (error) {
        console.error("Failed to create task:", error)
        return NextResponse.json({ error: "Failed to create task" }, { status: 500 })
    }
}
