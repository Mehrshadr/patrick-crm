import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// PUT - Update keyword
export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params

    try {
        const data = await request.json()
        const { keyword, targetUrl, pageTypes, onlyFirst, onlyFirstP, isEnabled } = data

        const updated = await prisma.linkBuildingKeyword.update({
            where: { id: parseInt(id) },
            data: {
                ...(keyword && { keyword, priority: keyword.length }),
                ...(targetUrl && { targetUrl }),
                ...(pageTypes !== undefined && { pageTypes: JSON.stringify(pageTypes) }),
                ...(onlyFirst !== undefined && { onlyFirst }),
                ...(onlyFirstP !== undefined && { onlyFirstP }),
                ...(isEnabled !== undefined && { isEnabled })
            }
        })

        return NextResponse.json({ success: true, keyword: updated })
    } catch (error) {
        console.error('Error updating keyword:', error)
        return NextResponse.json({ error: 'Failed to update keyword' }, { status: 500 })
    }
}

// DELETE - Remove keyword
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params

    try {
        await prisma.linkBuildingKeyword.delete({
            where: { id: parseInt(id) }
        })

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Error deleting keyword:', error)
        return NextResponse.json({ error: 'Failed to delete keyword' }, { status: 500 })
    }
}
