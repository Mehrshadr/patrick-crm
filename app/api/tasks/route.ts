
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

// GET /api/tasks - Get all tasks (filtered by user unless SUPER_ADMIN)
export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        const userEmail = session?.user?.email

        const { searchParams } = new URL(request.url)
        const leadId = searchParams.get('leadId')

        // Get current user and check role
        let currentUser = null
        let isSuperAdmin = false

        if (userEmail) {
            currentUser = await prisma.user.findUnique({
                where: { email: userEmail }
            })
            isSuperAdmin = currentUser?.role === 'SUPER_ADMIN'
        }

        const where: any = {}

        if (leadId) {
            where.leadId = parseInt(leadId)
        }

        // Filter by createdById unless SUPER_ADMIN
        if (currentUser && !isSuperAdmin) {
            where.createdById = currentUser.id
        }

        const tasks = await prisma.task.findMany({
            where,
            include: {
                lead: {
                    select: {
                        id: true,
                        name: true,
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
        const session = await getServerSession(authOptions)
        const userEmail = session?.user?.email

        // Get current user id
        let createdById = null
        if (userEmail) {
            const user = await prisma.user.findUnique({
                where: { email: userEmail }
            })
            createdById = user?.id
        }

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
                status: "PENDING",
                createdById: createdById
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
