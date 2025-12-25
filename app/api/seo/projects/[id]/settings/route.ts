import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

// GET - Get project settings (brand statement, etc.)
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        // DEV_BYPASS: Skip auth check
        if (process.env.DEV_BYPASS !== 'true') {
            const session = await auth()
            if (!session?.user) {
                return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
            }
        }

        const { id } = await params
        const projectId = parseInt(id)

        // Get or create settings
        let settings = await prisma.projectSettings.findUnique({
            where: { projectId }
        })

        if (!settings) {
            settings = await prisma.projectSettings.create({
                data: {
                    projectId,
                    brandStatement: null
                }
            })
        }

        return NextResponse.json(settings)
    } catch (error: any) {
        console.error("Failed to get project settings:", error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

// PUT - Update project settings
export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        // DEV_BYPASS: Skip auth check
        if (process.env.DEV_BYPASS !== 'true') {
            const session = await auth()
            if (!session?.user) {
                return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
            }
        }

        const { id } = await params
        const projectId = parseInt(id)
        const body = await request.json()
        const { brandStatement } = body

        // Upsert settings
        const settings = await prisma.projectSettings.upsert({
            where: { projectId },
            update: { brandStatement },
            create: {
                projectId,
                brandStatement
            }
        })

        return NextResponse.json({ success: true, settings })
    } catch (error: any) {
        console.error("Failed to update project settings:", error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
