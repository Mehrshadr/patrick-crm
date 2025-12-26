import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { getGoogleDocsAccessToken, createGoogleDoc } from "@/lib/google-docs"

// POST - Export content to Google Docs
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ projectId: string; contentId: string }> }
) {
    try {
        // Auth check
        if (process.env.DEV_BYPASS !== 'true') {
            const session = await auth()
            if (!session?.user) {
                return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
            }
        }

        const { projectId, contentId } = await params

        // Get the content
        const content = await prisma.generatedContent.findFirst({
            where: {
                id: parseInt(contentId),
                projectId: parseInt(projectId)
            },
            include: {
                project: true
            }
        })

        if (!content) {
            return NextResponse.json({ error: "Content not found" }, { status: 404 })
        }

        if (!content.content) {
            return NextResponse.json({ error: "No content to export" }, { status: 400 })
        }

        // Get Google Docs access token
        const accessToken = await getGoogleDocsAccessToken()
        if (!accessToken) {
            return NextResponse.json(
                { error: "Google Docs not connected. Please connect in Settings." },
                { status: 401 }
            )
        }

        // Create the Google Doc
        const docTitle = `${content.title || 'Untitled'} - ${content.project.name}`
        const docUrl = await createGoogleDoc(docTitle, content.content, accessToken)

        return NextResponse.json({
            success: true,
            url: docUrl,
            title: docTitle
        })
    } catch (error: any) {
        console.error("Failed to export to Google Docs:", error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
