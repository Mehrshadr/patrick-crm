import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// PUT - Reorder projects
export async function PUT(request: NextRequest) {
    try {
        const body = await request.json()
        const { orderedIds } = body

        if (!Array.isArray(orderedIds)) {
            return NextResponse.json({ error: 'orderedIds must be an array' }, { status: 400 })
        }

        // Transaction to update all
        await prisma.$transaction(
            orderedIds.map((id: number, index: number) =>
                prisma.indexingProject.update({
                    where: { id },
                    data: { sortOrder: index }
                })
            )
        )

        return NextResponse.json({ success: true })

    } catch (error: any) {
        console.error('[Projects:Reorder] Error:', error)
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 })
    }
}
