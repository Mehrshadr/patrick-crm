import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const dynamic = 'force-dynamic'

// GET: Fetch logs with filters
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url)
        const projectId = searchParams.get('projectId')
        const action = searchParams.get('action') // DATABASE_CREATE, DATABASE_UPDATE, COMPRESS, ALT_EDIT
        const userId = searchParams.get('userId')
        const from = searchParams.get('from') // ISO date string
        const to = searchParams.get('to') // ISO date string
        const page = parseInt(searchParams.get('page') || '1')
        const perPage = parseInt(searchParams.get('perPage') || '50')

        if (!projectId) {
            return NextResponse.json({ error: "Project ID required" }, { status: 400 })
        }

        const where: any = { projectId: parseInt(projectId) }

        // Filter by action type
        if (action && action !== 'ALL') {
            where.action = action
        }

        // Filter by user
        if (userId) {
            where.userId = userId
        }

        // Filter by date range
        if (from || to) {
            where.createdAt = {}
            if (from) where.createdAt.gte = new Date(from)
            if (to) where.createdAt.lte = new Date(to)
        }

        const skip = (page - 1) * perPage

        const [logs, total] = await Promise.all([
            prisma.imageFactoryLog.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip,
                take: perPage
            }),
            prisma.imageFactoryLog.count({ where })
        ])

        // Get distinct users for filter dropdown
        const users = await prisma.imageFactoryLog.findMany({
            where: { projectId: parseInt(projectId) },
            distinct: ['userId'],
            select: { userId: true, userName: true }
        })

        // Get first log (database creation date)
        const firstLog = await prisma.imageFactoryLog.findFirst({
            where: {
                projectId: parseInt(projectId),
                action: 'DATABASE_CREATE'
            },
            orderBy: { createdAt: 'asc' }
        })

        return NextResponse.json({
            success: true,
            logs,
            total,
            pages: Math.ceil(total / perPage),
            page,
            users,
            databaseCreatedAt: firstLog?.createdAt || null
        })

    } catch (error: any) {
        console.error("[ImageFactory Logs] Error:", error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
