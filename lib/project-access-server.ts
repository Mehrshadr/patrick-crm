import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'

interface AccessCheckResult {
    hasProjectAccess: boolean  // Does user have ANY access to this project?
    hasAppAccess: boolean      // Does user have access to the specific app?
    accessLevel: string | null
    apps: string[]
}

/**
 * Check if the current user has access to a project and optionally a specific app
 * Server-side version for use in Server Components
 */
export async function checkProjectAppAccess(
    projectId: number,
    appType?: string
): Promise<AccessCheckResult> {
    try {
        const session = await auth()
        const userEmail = session?.user?.email

        if (!userEmail) {
            return { hasProjectAccess: false, hasAppAccess: false, accessLevel: null, apps: [] }
        }

        // Get user from database
        const user = await prisma.user.findUnique({
            where: { email: userEmail.toLowerCase() },
            select: { id: true, role: true }
        })

        if (!user) {
            return { hasProjectAccess: false, hasAppAccess: false, accessLevel: null, apps: [] }
        }

        // SUPER_ADMIN has access to everything
        if (user.role === 'SUPER_ADMIN') {
            return {
                hasProjectAccess: true,
                hasAppAccess: true,
                accessLevel: 'SUPER_ADMIN',
                apps: ['LINK_INDEXING', 'LINK_BUILDING', 'CONTENT_FACTORY', 'IMAGE_FACTORY', 'DASHBOARD']
            }
        }

        // Check project access for this user
        const projectAccess = await prisma.projectAccess.findUnique({
            where: {
                userId_projectId: {
                    userId: user.id,
                    projectId
                }
            },
            include: {
                appAccess: true
            }
        })

        if (!projectAccess) {
            return { hasProjectAccess: false, hasAppAccess: false, accessLevel: null, apps: [] }
        }

        // User has project access - now check app access
        const apps = projectAccess.appAccess.map(a => a.appType)

        // If specific app requested, check if user has access
        const hasAppAccess = appType ? apps.includes(appType) : true

        return {
            hasProjectAccess: true,
            hasAppAccess,
            accessLevel: projectAccess.role,
            apps
        }
    } catch (e) {
        console.error('[checkProjectAppAccess] Error:', e)
        return { hasProjectAccess: false, hasAppAccess: false, accessLevel: null, apps: [] }
    }
}

