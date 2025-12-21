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
