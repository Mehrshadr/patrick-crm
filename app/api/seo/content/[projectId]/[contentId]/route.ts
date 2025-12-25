import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

// GET - Get single content
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ projectId: string; contentId: string }> }
) {
    try {
        const session = await auth()
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const { projectId, contentId } = await params

        const content = await prisma.generatedContent.findFirst({
            where: {
                id: parseInt(contentId),
                projectId: parseInt(projectId)
            }
        })

        if (!content) {
            return NextResponse.json({ error: "Content not found" }, { status: 404 })
        }

        return NextResponse.json(content)
    } catch (error: any) {
        console.error("Failed to get content:", error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

// DELETE - Delete content
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ projectId: string; contentId: string }> }
) {
    try {
        const session = await auth()
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const { projectId, contentId } = await params

        await prisma.generatedContent.delete({
            where: {
                id: parseInt(contentId),
                projectId: parseInt(projectId)
            }
        })

        return NextResponse.json({ success: true })
    } catch (error: any) {
        console.error("Failed to delete content:", error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

// PUT - Update content (e.g., mark as done)
export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ projectId: string; contentId: string }> }
) {
    try {
        const session = await auth()
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const { projectId, contentId } = await params
        const body = await request.json()
        const { status, content, title } = body

        const updated = await prisma.generatedContent.update({
            where: {
                id: parseInt(contentId),
                projectId: parseInt(projectId)
            },
            data: {
                ...(status && { status }),
                ...(content !== undefined && { content }),
                ...(title !== undefined && { title })
            }
        })

        return NextResponse.json(updated)
    } catch (error: any) {
        console.error("Failed to update content:", error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
