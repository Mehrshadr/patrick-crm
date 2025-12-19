import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"

// GET all logs (execution history)
export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url)
    const leadId = searchParams.get("leadId")
    const type = searchParams.get("type") // EMAIL, SMS, SYSTEM
    const status = searchParams.get("status") // SENT, PENDING, FAILED
    const limit = searchParams.get("limit") || "50"

    try {
        const where: any = {}

        if (leadId) where.leadId = Number(leadId)
        if (type) where.type = type
        if (status) where.status = status

        const logs = await db.log.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            take: Number(limit),
            include: {
                lead: {
                    select: { id: true, name: true, email: true, website: true }
                }
            }
        })

        return NextResponse.json({ logs })
    } catch (error) {
        console.error("API getLogs error:", error)
        return NextResponse.json({ logs: [], error: String(error) }, { status: 500 })
    }
}

// POST: Create a new execution log
export async function POST(request: NextRequest) {
    try {
        const { leadId, type, stage, status, title, content, meta } = await request.json()

        if (!leadId || !type || !status || !title) {
            return NextResponse.json({ success: false, error: "Missing required fields" }, { status: 400 })
        }

        const log = await db.log.create({
            data: {
                leadId: Number(leadId),
                type,
                stage: stage || null,
                status,
                title,
                content: content || '',
                meta: meta ? JSON.stringify(meta) : null
            }
        })

        return NextResponse.json({ success: true, log })
    } catch (error) {
        console.error("API createLog error:", error)
        return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
    }
}
