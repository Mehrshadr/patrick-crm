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
        const exclude = searchParams.get('exclude') // Comma-separated categories to exclude
        const limit = parseInt(searchParams.get('limit') || '50')

        const where: any = {}

        if (projectId && projectId !== 'all') {
            where.projectId = parseInt(projectId)
        }

        if (category && category !== 'all') {
            where.category = category
        }

        // Exclude specified categories (for separating Patrick vs SEO logs)
        if (exclude) {
            const excludeList = exclude.split(',')
            where.category = { notIn: excludeList }
        }

        const logs = await prisma.activityLog.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            take: limit,
            include: {
                project: {
                    select: { name: true, domain: true }
                }
            }
        })

        return NextResponse.json({ success: true, logs })
    } catch (error) {
        console.error('Failed to fetch activity logs:', error)
        return NextResponse.json({ error: 'Failed to fetch logs' }, { status: 500 })
    }
}
