import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'

/**
 * Check if the current user has access to a specific app in a project
 * Server-side version for use in Server Components
 */
export async function checkProjectAppAccess(
    projectId: number,
    appType: string
): Promise<{ hasAccess: boolean; accessLevel: string | null }> {
    try {
        const session = await auth()
        const userEmail = session?.user?.email

        if (!userEmail) {
            return { hasAccess: false, accessLevel: null }
        }

        // Get user from database
        const user = await prisma.user.findUnique({
            where: { email: userEmail.toLowerCase() },
            select: { id: true, role: true }
        })

        if (!user) {
            return { hasAccess: false, accessLevel: null }
        }

        // SUPER_ADMIN has access to everything
        if (user.role === 'SUPER_ADMIN') {
            return { hasAccess: true, accessLevel: 'SUPER_ADMIN' }
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
            return { hasAccess: false, accessLevel: null }
        }

        // Check if user has access to the specific app
        const hasAppAccess = projectAccess.appAccess.some(a => a.appType === appType)

        return {
            hasAccess: hasAppAccess,
            accessLevel: projectAccess.role
        }
    } catch (e) {
        console.error('[checkProjectAppAccess] Error:', e)
        return { hasAccess: false, accessLevel: null }
    }
}
