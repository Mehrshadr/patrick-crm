import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// GET /api/seo/projects/[id] - Get project details
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const projectId = parseInt(id)

        if (isNaN(projectId)) {
            return NextResponse.json({ error: 'Invalid project ID' }, { status: 400 })
        }

        const project = await prisma.indexingProject.findUnique({
            where: { id: projectId },
            include: {
                _count: {
                    select: { urls: true }
                }
            }
        })

        if (!project) {
            return NextResponse.json({ error: 'Project not found' }, { status: 404 })
        }

        return NextResponse.json(project)
    } catch (error) {
        console.error('Failed to fetch project:', error)
        return NextResponse.json({ error: 'Failed to fetch project' }, { status: 500 })
    }
}

// PUT /api/seo/projects/[id] - Update project
export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const projectId = parseInt(id)
        const body = await request.json()
        const { name, domain, description, platform } = body

        if (isNaN(projectId)) {
            return NextResponse.json({ error: 'Invalid project ID' }, { status: 400 })
        }

        if (!name?.trim()) {
            return NextResponse.json({ error: 'Project name is required' }, { status: 400 })
        }

        const project = await prisma.indexingProject.update({
            where: { id: projectId },
            data: {
                name: name.trim(),
                domain: domain?.trim() || null,
                description: description?.trim() || null,
                platform: platform || null
            }
        })

        return NextResponse.json(project)
    } catch (error) {
        console.error('Failed to update project:', error)
        return NextResponse.json({ error: 'Failed to update project' }, { status: 500 })
    }
}

// DELETE /api/seo/projects/[id] - Delete project
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const projectId = parseInt(id)

        if (isNaN(projectId)) {
            return NextResponse.json({ error: 'Invalid project ID' }, { status: 400 })
        }

        await prisma.indexingProject.delete({
            where: { id: projectId }
        })

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Failed to delete project:', error)
        return NextResponse.json({ error: 'Failed to delete project' }, { status: 500 })
    }
}
