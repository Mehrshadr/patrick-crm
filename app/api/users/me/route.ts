import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'

// GET /api/users/me - Get current user info
export async function GET() {
    try {
        // DEV_BYPASS: Return fake SUPER_ADMIN user
        if (process.env.DEV_BYPASS === 'true') {
            return NextResponse.json({
                success: true,
                user: {
                    id: 0,
                    email: 'dev@mehrana.agency',
                    name: 'Dev User',
                    role: 'SUPER_ADMIN',
                    patrickAccess: 'EDITOR'
                }
            })
        }

        const session = await auth()
        const userEmail = session?.user?.email

        if (!userEmail) {
            return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 })
        }

        const user = await prisma.user.findUnique({
            where: { email: userEmail },
            select: {
                id: true,
                email: true,
                name: true,
                role: true,
                patrickAccess: true,
            }
        })

        if (!user) {
            return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 })
        }

        return NextResponse.json({ success: true, user })
    } catch (error: any) {
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        )
    }
}
