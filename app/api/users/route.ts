import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { auth } from '@/lib/auth'
import { requireAdmin } from '@/lib/permissions'

// GET - List all users with project access
export async function GET() {
    try {
        const session = await auth()
        await requireAdmin(session)

        const users = await db.user.findMany({
            orderBy: { lastLogin: 'desc' },
            include: {
                loginLogs: {
                    orderBy: { createdAt: 'desc' },
                    take: 5
                },
                projectAccess: {
                    include: {
                        project: {
                            select: { id: true, name: true }
                        }
                    }
                }
            }
        })

        return NextResponse.json({ success: true, users })
    } catch (error: any) {
        return NextResponse.json(
            { success: false, error: error.message },
            { status: error.message.includes('Unauthorized') ? 401 : 500 }
        )
    }
}

// PUT - Update user role
export async function PUT(request: NextRequest) {
    try {
        const session = await auth()
        await requireAdmin(session)

        const { userId, role } = await request.json()

        if (!userId || !role) {
            return NextResponse.json(
                { success: false, error: 'userId and role are required' },
                { status: 400 }
            )
        }

        if (!['SUPER_ADMIN', 'ADMIN', 'USER'].includes(role)) {
            return NextResponse.json(
                { success: false, error: 'Role must be SUPER_ADMIN, ADMIN, or USER' },
                { status: 400 }
            )
        }

        const updatedUser = await db.user.update({
            where: { id: userId },
            data: { role }
        })

        return NextResponse.json({ success: true, user: updatedUser })
    } catch (error: any) {
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        )
    }
}
