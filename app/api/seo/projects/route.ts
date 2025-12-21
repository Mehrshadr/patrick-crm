import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// GET /api/seo/projects - List all projects
export async function GET() {
    try {
        const projects = await prisma.indexingProject.findMany({
            orderBy: { createdAt: 'desc' },
            include: {
                _count: {
                    select: { urls: true }
                }
            }
        })

        return NextResponse.json(projects)
    } catch (error) {
        console.error('Failed to fetch projects:', error)
        return NextResponse.json({ error: 'Failed to fetch projects' }, { status: 500 })
    }
}

// POST /api/seo/projects - Create a new project
export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { name, domain, description } = body

        if (!name?.trim()) {
            return NextResponse.json({ error: 'Project name is required' }, { status: 400 })
        }

        const project = await prisma.indexingProject.create({
            data: {
                name: name.trim(),
                domain: domain?.trim() || null,
                description: description?.trim() || null
            }
        })

        return NextResponse.json(project, { status: 201 })
    } catch (error) {
        console.error('Failed to create project:', error)
        return NextResponse.json({ error: 'Failed to create project' }, { status: 500 })
    }
}
