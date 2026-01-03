import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { encrypt, decrypt, maskValue, isEncryptionConfigured } from '@/lib/encryption'

// Integration settings keys
const INTEGRATION_KEYS = {
    TWILIO_ACCOUNT_SID: 'twilio_account_sid',
    TWILIO_AUTH_TOKEN: 'twilio_auth_token',
    TWILIO_PHONE_NUMBER: 'twilio_phone_number',
    INSTANTLY_API_KEY: 'instantly_api_key',
} as const

type IntegrationKey = typeof INTEGRATION_KEYS[keyof typeof INTEGRATION_KEYS]

// Keys that should be encrypted
const ENCRYPTED_KEYS: IntegrationKey[] = [
    INTEGRATION_KEYS.TWILIO_AUTH_TOKEN,
    INTEGRATION_KEYS.INSTANTLY_API_KEY,
]

/**
 * Check if user is admin
 */
async function isAdmin(session: any): Promise<boolean> {
    if (!session?.user?.email) return false

    const user = await prisma.user.findUnique({
        where: { email: session.user.email },
        select: { role: true }
    })

    return user?.role === 'ADMIN'
}

/**
 * GET /api/settings/integrations
 * Fetch all integration credentials (masked for security)
 */
export async function GET(request: NextRequest) {
    try {
        const session = await auth()

        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const admin = await isAdmin(session)

        if (!admin) {
            return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
        }

        // Get all integration settings
        const settings = await prisma.appSettings.findMany({
            where: {
                key: { in: Object.values(INTEGRATION_KEYS) }
            }
        })

        // Build response with masked values
        const result: Record<string, { value: string; masked: string; configured: boolean }> = {}

        for (const key of Object.values(INTEGRATION_KEYS)) {
            const setting = settings.find(s => s.key === key)

            if (setting) {
                // Decrypt if encrypted
                let plainValue = setting.value
                if (setting.isEncrypted && isEncryptionConfigured()) {
                    try {
                        plainValue = decrypt(setting.value)
                    } catch (e) {
                        console.error(`Failed to decrypt ${key}:`, e)
                        plainValue = ''
                    }
                }

                result[key] = {
                    value: '', // Never send actual value to client
                    masked: maskValue(plainValue),
                    configured: !!plainValue
                }
            } else {
                result[key] = {
                    value: '',
                    masked: '',
                    configured: false
                }
            }
        }

        return NextResponse.json({
            success: true,
            integrations: result,
            encryptionConfigured: isEncryptionConfigured()
        })

    } catch (error: any) {
        console.error('Error fetching integrations:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

/**
 * PUT /api/settings/integrations
 * Update integration credentials
 */
export async function PUT(request: NextRequest) {
    try {
        const session = await auth()

        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const admin = await isAdmin(session)

        if (!admin) {
            return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
        }

        const body = await request.json()

        // Validate keys
        const validKeys = Object.values(INTEGRATION_KEYS)
        const updates: { key: string; value: string }[] = []

        for (const [key, value] of Object.entries(body)) {
            if (validKeys.includes(key as IntegrationKey) && typeof value === 'string' && value) {
                updates.push({ key, value })
            }
        }

        if (updates.length === 0) {
            return NextResponse.json({ error: 'No valid settings to update' }, { status: 400 })
        }

        // Upsert each setting
        for (const { key, value } of updates) {
            const shouldEncrypt = ENCRYPTED_KEYS.includes(key as IntegrationKey)
            const finalValue = shouldEncrypt && isEncryptionConfigured()
                ? encrypt(value)
                : value

            await prisma.appSettings.upsert({
                where: { key },
                create: {
                    key,
                    value: finalValue,
                    isEncrypted: shouldEncrypt && isEncryptionConfigured()
                },
                update: {
                    value: finalValue,
                    isEncrypted: shouldEncrypt && isEncryptionConfigured()
                }
            })
        }

        return NextResponse.json({
            success: true,
            message: `Updated ${updates.length} integration(s)`,
            updated: updates.map(u => u.key)
        })

    } catch (error: any) {
        console.error('Error updating integrations:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

/**
 * Helper function to get a decrypted integration value
 * Used by other parts of the app (sms.ts, instantly.ts)
 */
export async function getIntegrationValue(key: IntegrationKey): Promise<string | null> {
    try {
        const setting = await prisma.appSettings.findUnique({
            where: { key }
        })

        if (!setting || !setting.value) {
            return null
        }

        // Decrypt if encrypted
        if (setting.isEncrypted && isEncryptionConfigured()) {
            try {
                return decrypt(setting.value)
            } catch (e) {
                console.error(`Failed to decrypt ${key}:`, e)
                return null
            }
        }

        return setting.value
    } catch (error) {
        console.error(`Error getting integration ${key}:`, error)
        return null
    }
}
