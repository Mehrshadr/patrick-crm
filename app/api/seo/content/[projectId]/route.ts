import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { logActivity } from "@/lib/activity-logger"

// GET - List all content for a project
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ projectId: string }> }
) {
    try {
        // DEV_BYPASS: Skip auth
        if (process.env.DEV_BYPASS !== 'true') {
            const session = await auth()
            if (!session?.user) {
                return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
            }
        }

        const { projectId } = await params

        const contents = await prisma.generatedContent.findMany({
            where: { projectId: parseInt(projectId) },
            orderBy: { createdAt: 'desc' }
        })

        return NextResponse.json(contents)
    } catch (error: any) {
        console.error("Failed to get contents:", error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

// POST - Create new content
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ projectId: string }> }
) {
    try {
        // DEV_BYPASS: Skip auth
        if (process.env.DEV_BYPASS !== 'true') {
            const session = await auth()
            if (!session?.user) {
                return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
            }
        }

        const { projectId } = await params
        const body = await request.json()
        const { title, contentType, brief, useGuidelines, useAiRules } = body

        if (!brief?.trim()) {
            return NextResponse.json({ error: "Brief is required" }, { status: 400 })
        }

        // Get user ID (use dev email if in bypass mode)
        const userEmail = process.env.DEV_BYPASS === 'true' ? 'dev@mehrana.agency' : (await auth())?.user?.email
        const user = userEmail ? await prisma.user.findUnique({
            where: { email: userEmail }
        }) : null

        const content = await prisma.generatedContent.create({
            data: {
                projectId: parseInt(projectId),
                title: title?.trim() || null,
                contentType: contentType || 'BLOG_POST',
                brief: brief.trim(),
                useGuidelines: useGuidelines ?? true,
                useAiRules: useAiRules ?? true,
                status: 'DRAFT',
                createdById: user?.id
            }
        })

        // Log Activity
        await logActivity({
            userId: user?.email,
            userName: user?.name,
            projectId: parseInt(projectId),
            category: 'CONTENT_FACTORY',
            action: 'GENERATED',
            description: `Generated ${contentType} content: "${title || brief.substring(0, 30)}..."`,
            details: { contentId: content.id, brief },
            entityType: 'GeneratedContent',
            entityId: content.id,
            entityName: title || 'Untitled Content'
        })

        return NextResponse.json(content, { status: 201 })
    } catch (error: any) {
        console.error("Failed to create content:", error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
