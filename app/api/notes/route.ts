import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { revalidatePath } from "next/cache"

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url)
    const leadId = searchParams.get("leadId")

    if (!leadId) {
        return NextResponse.json({ notes: [] })
    }

    try {
        const notes = await db.note.findMany({
            where: { leadId: Number(leadId) },
            orderBy: { createdAt: 'desc' }
        })
        return NextResponse.json({ notes })
    } catch (error) {
        return NextResponse.json({ notes: [], error: String(error) })
    }
}

export async function POST(request: NextRequest) {
    try {
        const { leadId, stage, content } = await request.json()

        if (!leadId || !content) {
            return NextResponse.json({ success: false, error: "Missing fields" }, { status: 400 })
        }

        const note = await db.note.create({
            data: {
                leadId: Number(leadId),
                stage: stage || null,
                content
            }
        })

        revalidatePath("/")
        return NextResponse.json({ success: true, note })
    } catch (error) {
        console.error("API addNote error:", error)
        return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const noteId = searchParams.get("id")

        if (!noteId) {
            return NextResponse.json({ success: false, error: "Missing note ID" }, { status: 400 })
        }

        await db.note.delete({
            where: { id: Number(noteId) }
        })

        revalidatePath("/")
        return NextResponse.json({ success: true })
    } catch (error) {
        console.error("API deleteNote error:", error)
        return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
    }
}
