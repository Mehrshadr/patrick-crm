// Permission utilities for Mehrana Agency
import { prisma } from '@/lib/prisma'

export const ALLOWED_DOMAIN = 'mehrana.agency'

export const ADMIN_EMAILS = [
    'mehrshad@mehrana.agency',
    'mehrdad@mehrana.agency'
]

export function isAllowedDomain(email: string): boolean {
    return email.toLowerCase().endsWith(`@${ALLOWED_DOMAIN}`)
}

export function isAdmin(email: string): boolean {
    return ADMIN_EMAILS.includes(email.toLowerCase())
}

export function getUserRole(email: string): 'ADMIN' | 'VIEWER' {
    return isAdmin(email) ? 'ADMIN' : 'VIEWER'
}

// For use in actions/API routes - checks session and throws if not admin
export async function requireAdmin(session: { user?: { email?: string | null, role?: string } } | null): Promise<void> {
    if (!session?.user?.email) {
        throw new Error('Unauthorized: Not logged in')
    }

    const role = session.user.role || getUserRole(session.user.email)
    if (role !== 'ADMIN') {
        throw new Error('Forbidden: Admin access required')
    }
}

/**
 * Check if user has access to Patrick CRM pages
 * Returns true if user can access, false if should be blocked
 */
export async function checkPatrickAccess(email: string): Promise<{ hasAccess: boolean; accessLevel: string }> {
    try {
        const user = await prisma.user.findUnique({
            where: { email: email.toLowerCase() },
            select: { role: true, patrickAccess: true }
        })

        if (!user) {
            return { hasAccess: false, accessLevel: 'HIDDEN' }
        }

        // SUPER_ADMIN always has access
        if (user.role === 'SUPER_ADMIN') {
            return { hasAccess: true, accessLevel: 'EDITOR' }
        }

        // Check patrickAccess field
        const accessLevel = user.patrickAccess || 'HIDDEN'
        const hasAccess = accessLevel !== 'HIDDEN'

        return { hasAccess, accessLevel }
    } catch (e) {
        console.error('[Permissions] Failed to check Patrick access:', e)
        return { hasAccess: false, accessLevel: 'HIDDEN' }
    }
}
