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
                        },
                        appAccess: true
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

// POST - Create a new user
export async function POST(request: NextRequest) {
    try {
        const session = await auth()
        await requireAdmin(session)

        const { email, name, role, patrickAccess } = await request.json()

        if (!email) {
            return NextResponse.json(
                { success: false, error: 'Email is required' },
                { status: 400 }
            )
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!emailRegex.test(email)) {
            return NextResponse.json(
                { success: false, error: 'Invalid email format' },
                { status: 400 }
            )
        }

        // Check if user already exists
        const existingUser = await db.user.findUnique({ where: { email: email.toLowerCase() } })
        if (existingUser) {
            return NextResponse.json(
                { success: false, error: 'User with this email already exists' },
                { status: 400 }
            )
        }

        // Create user
        const newUser = await db.user.create({
            data: {
                email: email.toLowerCase(),
                name: name || null,
                role: role || 'USER',
                patrickAccess: patrickAccess || 'HIDDEN'
            }
        })

        return NextResponse.json({ success: true, user: newUser })
    } catch (error: any) {
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        )
    }
}

// PUT - Update user role or patrickAccess
export async function PUT(request: NextRequest) {
    try {
        const session = await auth()
        await requireAdmin(session)

        const { userId, role, patrickAccess } = await request.json()

        if (!userId) {
            return NextResponse.json(
                { success: false, error: 'userId is required' },
                { status: 400 }
            )
        }

        const updateData: { role?: string; patrickAccess?: string } = {}

        if (role) {
            if (!['SUPER_ADMIN', 'ADMIN', 'USER'].includes(role)) {
                return NextResponse.json(
                    { success: false, error: 'Role must be SUPER_ADMIN, ADMIN, or USER' },
                    { status: 400 }
                )
            }
            updateData.role = role
        }

        if (patrickAccess) {
            if (!['EDITOR', 'VIEWER', 'HIDDEN'].includes(patrickAccess)) {
                return NextResponse.json(
                    { success: false, error: 'patrickAccess must be EDITOR, VIEWER, or HIDDEN' },
                    { status: 400 }
                )
            }
            updateData.patrickAccess = patrickAccess
        }

        const updatedUser = await db.user.update({
            where: { id: userId },
            data: updateData
        })

        return NextResponse.json({ success: true, user: updatedUser })
    } catch (error: any) {
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        )
    }
}

// DELETE - Delete a user (soft delete: removes access but keeps logs)
export async function DELETE(request: NextRequest) {
    try {
        const session = await auth()
        await requireAdmin(session)

        const { searchParams } = new URL(request.url)
        const userId = searchParams.get('userId')

        if (!userId) {
            return NextResponse.json(
                { success: false, error: 'userId is required as query param' },
                { status: 400 }
            )
        }

        const userIdNum = parseInt(userId)

        // Check if user exists
        const user = await db.user.findUnique({ where: { id: userIdNum } })
        if (!user) {
            return NextResponse.json(
                { success: false, error: 'User not found' },
                { status: 404 }
            )
        }

        // Prevent deleting yourself
        if (user.email === session?.user?.email) {
            return NextResponse.json(
                { success: false, error: 'Cannot delete yourself' },
                { status: 400 }
            )
        }

        // Delete project access (this cascades to appAccess)
        await db.projectAccess.deleteMany({
            where: { userId: userIdNum }
        })

        // Delete login logs (not activity logs - those stay for audit)
        await db.loginLog.deleteMany({
            where: { userId: userIdNum }
        })

        // Actually delete the user (logs in ActivityLog remain with userId reference)
        await db.user.delete({
            where: { id: userIdNum }
        })

        return NextResponse.json({
            success: true,
            message: `User ${user.email} deleted. Activity logs preserved.`
        })
    } catch (error: any) {
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        )
    }
}
