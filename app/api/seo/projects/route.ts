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
            // Add all apps for dev bypass
            return NextResponse.json(projects.map(p => ({
                ...p,
                userApps: ['LINK_INDEXING', 'LINK_BUILDING', 'CONTENT_FACTORY', 'IMAGE_FACTORY', 'DASHBOARD']
            })))
        }

        const session = await auth()
        const userEmail = session?.user?.email

        // Get user from database with project access AND app access
        const user = userEmail ? await prisma.user.findUnique({
            where: { email: userEmail },
            include: {
                projectAccess: {
                    include: {
                        appAccess: true
                    }
                }
            }
        }) : null

        let projects: any[] = []

        // SUPER_ADMIN sees all projects with all apps
        if (user?.role === 'SUPER_ADMIN') {
            const allProjects = await prisma.indexingProject.findMany({
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
            // Add all apps for SUPER_ADMIN
            projects = allProjects.map(p => ({
                ...p,
                userApps: ['LINK_INDEXING', 'LINK_BUILDING', 'CONTENT_FACTORY', 'IMAGE_FACTORY', 'DASHBOARD']
            }))
        } else if (user && user.projectAccess.length > 0) {
            const projectIds = user.projectAccess.map(pa => pa.projectId)
            const fetchedProjects = await prisma.indexingProject.findMany({
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

            // Map projects with their user-specific app access
            projects = fetchedProjects.map(p => {
                const access = user.projectAccess.find(pa => pa.projectId === p.id)
                const userApps = access?.appAccess.map(a => a.appType) || []
                return {
                    ...p,
                    userApps
                }
            })
        }

        // Return empty if no access
        if (projects.length === 0) {
            return NextResponse.json([])
        }

        // Self-healing: Fix missing slugs for legacy projects
        for (const p of projects) {
            if (!p.slug) {
                let newSlug = p.name.trim().toLowerCase()
                    .replace(/[^a-z0-9]+/g, '-')
                    .replace(/^-+|-+$/g, '')

                if (!newSlug) newSlug = `project-${p.id}`

                try {
                    // Try to update with simple slug
                    await prisma.indexingProject.update({
                        where: { id: p.id },
                        data: { slug: newSlug }
                    })
                    p.slug = newSlug
                } catch {
                    // Collision? Append ID
                    newSlug = `${newSlug}-${p.id}`
                    await prisma.indexingProject.update({
                        where: { id: p.id },
                        data: { slug: newSlug }
                    })
                    p.slug = newSlug
                }
            }
        }

        return NextResponse.json(projects)
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

        // Simple slug generation
        let slug = name.trim().toLowerCase()
            .replace(/[^a-z0-9]+/g, '-') // Replace non-alphanumeric with dashes
            .replace(/^-+|-+$/g, '')     // Trim dashes from start/end

        if (!slug) {
            slug = `project-${Date.now()}`
        }

        // Check for duplicate slug and append timestamp if needed to avoid crash
        const existing = await prisma.indexingProject.findUnique({ where: { slug } })
        if (existing) {
            slug = `${slug}-${Math.floor(Math.random() * 1000)}`
        }

        const project = await prisma.indexingProject.create({
            data: {
                name: name.trim(),
                slug,
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
