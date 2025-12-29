import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET project by slug
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ slug: string }> }
) {
    const { slug } = await params

    const project = await prisma.indexingProject.findUnique({
        where: { slug }
    })

    if (!project) {
        return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    return NextResponse.json(project)
}
