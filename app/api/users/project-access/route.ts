import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { auth } from '@/lib/auth'
import { requireAdmin } from '@/lib/permissions'

// POST - Update project access for a user
export async function POST(request: NextRequest) {
    try {
        const session = await auth()
        await requireAdmin(session)

        const { userId, projectIds } = await request.json()

        if (!userId || !Array.isArray(projectIds)) {
            return NextResponse.json(
                { success: false, error: 'userId and projectIds are required' },
                { status: 400 }
            )
        }

        // Delete all existing access for this user
        await db.projectAccess.deleteMany({
            where: { userId }
        })

        // Create new access entries
        if (projectIds.length > 0) {
            await db.projectAccess.createMany({
                data: projectIds.map((projectId: number) => ({
                    userId,
                    projectId,
                    role: 'MEMBER'
                }))
            })
        }

        return NextResponse.json({ success: true })
    } catch (error: any) {
        console.error('Failed to update project access:', error)
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        )
    }
}
