import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { revalidatePath } from "next/cache"

export async function POST(request: NextRequest) {
    try {
        const { leadId, type, title, url } = await request.json()

        if (!leadId || !url) {
            return NextResponse.json({ success: false, error: "Missing fields" }, { status: 400 })
        }

        const link = await db.link.create({
            data: {
                leadId: Number(leadId),
                type: type || "Link",
                title: title || "Link",
                url
            }
        })

        revalidatePath("/")
        return NextResponse.json({ success: true, link })
    } catch (error) {
        console.error("API addLink error:", error)
        return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const linkId = searchParams.get("id")

        if (!linkId) {
            return NextResponse.json({ success: false, error: "Missing link ID" }, { status: 400 })
        }

        await db.link.delete({
            where: { id: Number(linkId) }
        })

        revalidatePath("/")
        return NextResponse.json({ success: true })
    } catch (error) {
        console.error("API deleteLink error:", error)
        return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
    }
}
