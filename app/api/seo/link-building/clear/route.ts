import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// DELETE - Clear all link building logs for a specific project
export async function DELETE(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url)
        const projectId = searchParams.get('projectId')

        if (!projectId) {
            return NextResponse.json({ error: 'projectId required' }, { status: 400 })
        }

        // Delete all logs for this project only
        const result = await prisma.linkBuildingLog.deleteMany({
            where: { projectId: parseInt(projectId) }
        })

        console.log(`[Clear Logs] Deleted ${result.count} logs for project ${projectId}`)

        return NextResponse.json({
            success: true,
            deleted: result.count,
            projectId: parseInt(projectId)
        })

    } catch (e: any) {
        console.error('Clear logs error:', e)
        return NextResponse.json({ error: e.message || 'Failed to clear logs' }, { status: 500 })
    }
}
