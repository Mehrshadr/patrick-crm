
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url)
    const pageUrl = searchParams.get('pageUrl')
    const projectId = searchParams.get('projectId')

    if (!pageUrl || !projectId) {
        return NextResponse.json({ error: 'Missing pageUrl or projectId' }, { status: 400 })
    }

    try {
        const logs = await prisma.linkBuildingLog.findMany({
            where: {
                projectId: parseInt(projectId),
                pageUrl: {
                    contains: pageUrl
                }
            }
        })

        return NextResponse.json({
            count: logs.length,
            logs: logs
        })
    } catch (error) {
        return NextResponse.json({ error: String(error) }, { status: 500 })
    }
}
