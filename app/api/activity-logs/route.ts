import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

export async function GET(request: NextRequest) {
    try {
        const session = await auth()
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        // Access Control: Strict SUPER_ADMIN only
        const user = await prisma.user.findUnique({
            where: { email: session.user.email! },
            select: { role: true }
        })

        if (user?.role !== 'SUPER_ADMIN') {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 })
        }

        const { searchParams } = new URL(request.url)
        const projectId = searchParams.get('projectId')
        const category = searchParams.get('category')
        const userName = searchParams.get('userName')
        const date = searchParams.get('date') // YYYY-MM-DD format
        const exclude = searchParams.get('exclude') // Comma-separated categories to exclude
        const page = parseInt(searchParams.get('page') || '1')
        const limit = parseInt(searchParams.get('limit') || '100')
        const skip = (page - 1) * limit

        const where: any = {}

        if (projectId && projectId !== 'all') {
            where.projectId = parseInt(projectId)
        }

        // Handle category filter - must work WITH exclude, not be overwritten
        const categoryConditions: any[] = []

        if (category && category !== 'all') {
            categoryConditions.push({ category: category })
        }

        // Exclude specified categories (for separating Patrick vs SEO logs)
        if (exclude) {
            const excludeList = exclude.split(',')
            categoryConditions.push({ category: { notIn: excludeList } })
        }

        // Combine category conditions with AND
        if (categoryConditions.length > 0) {
            where.AND = categoryConditions
        }

        // User filter
        if (userName && userName !== 'all') {
            where.userName = userName
        }

        // Date filter
        if (date) {
            const startOfDay = new Date(date + 'T00:00:00')
            const endOfDay = new Date(date + 'T23:59:59')
            where.createdAt = {
                gte: startOfDay,
                lte: endOfDay
            }
        }

        // Get total count for pagination
        const total = await prisma.activityLog.count({ where })

        const logs = await prisma.activityLog.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            skip,
            take: limit,
            include: {
                project: {
                    select: { name: true, domain: true }
                }
            }
        })

        // Get unique user names for filter dropdown
        const users = await prisma.activityLog.findMany({
            where: exclude ? { category: { notIn: exclude.split(',') } } : {},
            select: { userName: true },
            distinct: ['userName']
        })
        const uniqueUsers = users
            .map(u => u.userName)
            .filter((name): name is string => !!name)

        return NextResponse.json({
            success: true,
            logs,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
            users: uniqueUsers
        })
    } catch (error) {
        console.error('Failed to fetch activity logs:', error)
        return NextResponse.json({ error: 'Failed to fetch logs' }, { status: 500 })
    }
}

