import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// PUT /api/seo/urls/[id] - Update a URL
export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const urlId = parseInt(id)
        const body = await request.json()
        const { interval, status } = body

        if (isNaN(urlId)) {
            return NextResponse.json({ error: 'Invalid URL ID' }, { status: 400 })
        }

        const url = await prisma.indexingUrl.update({
            where: { id: urlId },
            data: {
                ...(interval !== undefined && { interval }),
                ...(status !== undefined && { status })
            }
        })

        return NextResponse.json(url)
    } catch (error) {
        console.error('Failed to update URL:', error)
        return NextResponse.json({ error: 'Failed to update URL' }, { status: 500 })
    }
}

// DELETE /api/seo/urls/[id] - Delete a URL
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const urlId = parseInt(id)

        if (isNaN(urlId)) {
            return NextResponse.json({ error: 'Invalid URL ID' }, { status: 400 })
        }

        await prisma.indexingUrl.delete({
            where: { id: urlId }
        })

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Failed to delete URL:', error)
        return NextResponse.json({ error: 'Failed to delete URL' }, { status: 500 })
    }
}
