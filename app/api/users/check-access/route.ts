import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// GET - Check if current user has access to a specific project and optionally an app
// Query: projectId, appType (optional)
export async function GET(request: NextRequest) {
    try {
        const session = await auth()
        const userEmail = session?.user?.email

        if (!userEmail) {
            return NextResponse.json({
                hasProjectAccess: false,
                hasAppAccess: false,
                error: 'Not authenticated'
            }, { status: 401 })
        }

        const searchParams = request.nextUrl.searchParams
        const projectId = searchParams.get('projectId')
        const appType = searchParams.get('appType')

        if (!projectId) {
            return NextResponse.json({
                hasProjectAccess: false,
                hasAppAccess: false,
                error: 'projectId required'
            }, { status: 400 })
        }

        // Get user from database
        const user = await prisma.user.findUnique({
            where: { email: userEmail.toLowerCase() },
            select: { id: true, role: true }
        })

        if (!user) {
            return NextResponse.json({
                hasProjectAccess: false,
                hasAppAccess: false,
                error: 'User not found'
            }, { status: 404 })
        }

        // SUPER_ADMIN has access to everything
        if (user.role === 'SUPER_ADMIN') {
            return NextResponse.json({
                hasProjectAccess: true,
                hasAppAccess: true,
                hasAccess: true, // backward compatibility
                accessLevel: 'SUPER_ADMIN',
                apps: ['LINK_INDEXING', 'LINK_BUILDING', 'CONTENT_FACTORY', 'IMAGE_FACTORY', 'DASHBOARD']
            })
        }

        // Check project access for this user
        const projectAccess = await prisma.projectAccess.findUnique({
            where: {
                userId_projectId: {
                    userId: user.id,
                    projectId: parseInt(projectId)
                }
            },
            include: {
                appAccess: true
            }
        })

        if (!projectAccess) {
            return NextResponse.json({
                hasProjectAccess: false,
                hasAppAccess: false,
                hasAccess: false,
                error: 'No access to this project',
                apps: []
            })
        }

        // Get list of apps user has access to
        const apps = projectAccess.appAccess.map(a => a.appType)

        // If specific app requested, check if user has access
        if (appType) {
            const hasAppAccess = apps.includes(appType)
            return NextResponse.json({
                hasProjectAccess: true,
                hasAppAccess,
                hasAccess: hasAppAccess, // backward compatibility
                accessLevel: projectAccess.role,
                apps,
                requestedApp: appType
            })
        }

        // Return all app access
        return NextResponse.json({
            hasProjectAccess: true,
            hasAppAccess: true,
            hasAccess: true,
            accessLevel: projectAccess.role,
            apps
        })
    } catch (error: any) {
        console.error('[CheckAccess] Error:', error)
        return NextResponse.json({
            hasProjectAccess: false,
            hasAppAccess: false,
            error: error.message
        }, { status: 500 })
    }
}
