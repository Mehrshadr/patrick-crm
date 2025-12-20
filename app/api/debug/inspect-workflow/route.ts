
import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
    try {
        const url = new URL(req.url)
        const idStr = url.searchParams.get('id')
        if (!idStr) return NextResponse.json({ error: 'id required' }, { status: 400 })

        const id = parseInt(idStr)
        const workflow = await db.workflow.findUnique({
            where: { id },
            include: {
                steps: {
                    orderBy: { order: 'asc' },
                    include: { template: true }
                }
            }
        })

        if (!workflow) return NextResponse.json({ error: 'Workflow not found' }, { status: 404 })

        return NextResponse.json(workflow, { status: 200 })
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 })
    }
}
