import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

// GET /api/seo/projects/all - List ALL projects (for admin panel)
export async function GET() {
    try {
        const session = await auth()
        const userEmail = session?.user?.email

        // Get user from database
        const user = userEmail ? await prisma.user.findUnique({
            where: { email: userEmail }
        }) : null

        // Only SUPER_ADMIN can see all projects list
        if (user?.role !== 'SUPER_ADMIN') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
        }

        const projects = await prisma.indexingProject.findMany({
            orderBy: { name: 'asc' },
            select: {
                id: true,
                name: true
            }
        })

        return NextResponse.json(projects)
    } catch (error) {
        console.error('Failed to fetch all projects:', error)
        return NextResponse.json({ error: 'Failed to fetch projects' }, { status: 500 })
    }
}
