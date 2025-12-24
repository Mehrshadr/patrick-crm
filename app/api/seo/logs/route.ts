import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

// GET /api/seo/logs - Get activity logs
export async function GET() {
    try {
        const session = await auth()
        const userEmail = session?.user?.email

        // Get user from database
        const user = userEmail ? await prisma.user.findUnique({
            where: { email: userEmail },
            include: { projectAccess: true }
        }) : null

        let logs

        // SUPER_ADMIN sees all logs
        if (user?.role === 'SUPER_ADMIN') {
            logs = await prisma.indexingLog.findMany({
                orderBy: { createdAt: 'desc' },
                take: 200,
                include: {
                    url: {
                        include: {
                            project: true
                        }
                    }
                }
            })
        } else if (user && user.projectAccess.length > 0) {
            // Regular users only see logs from their projects
            const projectIds = user.projectAccess.map(pa => pa.projectId)
            logs = await prisma.indexingLog.findMany({
                where: {
                    url: {
                        projectId: { in: projectIds }
                    }
                },
                orderBy: { createdAt: 'desc' },
                take: 200,
                include: {
                    url: {
                        include: {
                            project: true
                        }
                    }
                }
            })
        } else {
            return NextResponse.json([])
        }

        // Transform logs into simpler format
        const formattedLogs = logs.map(log => ({
            id: log.id,
            action: log.action,
            details: log.url.url,
            userId: null,
            userName: 'System',
            projectId: log.url.projectId,
            projectName: log.url.project.name,
            createdAt: log.createdAt.toISOString()
        }))

        return NextResponse.json(formattedLogs)
    } catch (error) {
        console.error('Failed to fetch logs:', error)
        return NextResponse.json({ error: 'Failed to fetch logs' }, { status: 500 })
    }
}
