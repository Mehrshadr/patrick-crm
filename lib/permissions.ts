// Permission utilities for Mehrana Agency

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
