import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { requireAdmin } from "@/lib/permissions"

// GET - Get content generator settings
export async function GET() {
    try {
        // DEV_BYPASS: Skip auth check
        if (process.env.DEV_BYPASS !== 'true') {
            const session = await auth()
            if (!session?.user) {
                return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
            }
        }

        // Get or create default config
        let config = await prisma.contentGeneratorConfig.findFirst()
        if (!config) {
            config = await prisma.contentGeneratorConfig.create({
                data: {
                    guidelines: "",
                    aiRules: "",
                    llmProvider: "openai",
                    llmModel: "gpt-4"
                }
            })
        }

        return NextResponse.json({ success: true, config })
    } catch (error: any) {
        console.error("Failed to get content generator config:", error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

// PUT - Update content generator settings
export async function PUT(request: NextRequest) {
    try {
        // DEV_BYPASS: Skip admin check
        if (process.env.DEV_BYPASS !== 'true') {
            const session = await auth()
            await requireAdmin(session)
        }

        const body = await request.json()
        const { guidelines, aiRules, llmProvider, llmModel } = body

        // Get existing config or create new
        let config = await prisma.contentGeneratorConfig.findFirst()

        if (config) {
            config = await prisma.contentGeneratorConfig.update({
                where: { id: config.id },
                data: {
                    guidelines: guidelines ?? config.guidelines,
                    aiRules: aiRules ?? config.aiRules,
                    llmProvider: llmProvider ?? config.llmProvider,
                    llmModel: llmModel ?? config.llmModel
                }
            })
        } else {
            config = await prisma.contentGeneratorConfig.create({
                data: {
                    guidelines: guidelines || "",
                    aiRules: aiRules || "",
                    llmProvider: llmProvider || "openai",
                    llmModel: llmModel || "gpt-4"
                }
            })
        }

        return NextResponse.json({ success: true, config })
    } catch (error: any) {
        console.error("Failed to update content generator config:", error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
