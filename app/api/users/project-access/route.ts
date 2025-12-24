import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
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
        await prisma.projectAccess.deleteMany({
            where: { userId }
        })

        // Create new access entries (SQLite doesn't support createMany, use loop)
        for (const projectId of projectIds) {
            await prisma.projectAccess.create({
                data: {
                    userId,
                    projectId,
                    role: 'MEMBER'
                }
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
