import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

// GET /api/seo/projects - List projects (filtered by user access)
export async function GET() {
    try {
        // DEV_BYPASS: Return all projects for testing
        if (process.env.DEV_BYPASS === 'true') {
            const projects = await prisma.indexingProject.findMany({
                orderBy: { name: 'asc' },
                include: {
                    _count: {
                        select: { urls: true }
                    }
                }
            })
            return NextResponse.json(projects)
        }

        const session = await auth()
        const userEmail = session?.user?.email

        // Get user from database
        const user = userEmail ? await prisma.user.findUnique({
            where: { email: userEmail },
            include: { projectAccess: true }
        }) : null

        // SUPER_ADMIN sees all projects
        if (user?.role === 'SUPER_ADMIN') {
            const projects = await prisma.indexingProject.findMany({
                orderBy: [
                    { sortOrder: 'asc' },
                    { name: 'asc' }
                ],
                include: {
                    _count: {
                        select: { urls: true }
                    }
                }
            })
            return NextResponse.json(projects)
        }

        // Regular users only see assigned projects
        if (user && user.projectAccess.length > 0) {
            const projectIds = user.projectAccess.map(pa => pa.projectId)
            const projects = await prisma.indexingProject.findMany({
                where: { id: { in: projectIds } },
                orderBy: [
                    { sortOrder: 'asc' },
                    { name: 'asc' }
                ],
                include: {
                    _count: {
                        select: { urls: true }
                    }
                }
            })
            return NextResponse.json(projects)
        }

        // No access - return empty array
        return NextResponse.json([])
    } catch (error) {
        console.error('Failed to fetch projects:', error)
        return NextResponse.json({ error: 'Failed to fetch projects' }, { status: 500 })
    }
}

// POST /api/seo/projects - Create a new project (SUPER_ADMIN only)
export async function POST(request: NextRequest) {
    try {
        const session = await auth()
        const userEmail = session?.user?.email

        // Check if user is SUPER_ADMIN
        const user = userEmail ? await prisma.user.findUnique({
            where: { email: userEmail }
        }) : null

        if (user?.role !== 'SUPER_ADMIN') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
        }

        const body = await request.json()
        const { name, domain, description, platform } = body

        if (!name?.trim()) {
            return NextResponse.json({ error: 'Project name is required' }, { status: 400 })
        }

        const project = await prisma.indexingProject.create({
            data: {
                name: name.trim(),
                domain: domain?.trim() || null,
                description: description?.trim() || null,
                platform: platform || null
            }
        })

        return NextResponse.json(project, { status: 201 })
    } catch (error) {
        console.error('Failed to create project:', error)
        return NextResponse.json({ error: 'Failed to create project' }, { status: 500 })
    }
}
