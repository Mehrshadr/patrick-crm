import twilio from 'twilio'
import { prisma } from '@/lib/prisma'
import { decrypt, isEncryptionConfigured } from '@/lib/encryption'

// Cache for credentials
let cachedCredentials: {
    accountSid: string | null
    authToken: string | null
    phoneNumber: string | null
    cacheTime: number
} | null = null

const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

/**
 * Get a credential value from database or env var
 */
async function getCredential(dbKey: string, envKey: string): Promise<string | null> {
    try {
        const setting = await prisma.appSettings.findUnique({
            where: { key: dbKey }
        })

        if (setting?.value) {
            // Decrypt if encrypted
            if ((setting as any).isEncrypted && isEncryptionConfigured()) {
                try {
                    return decrypt(setting.value)
                } catch (e) {
                    console.error(`Failed to decrypt ${dbKey}:`, e)
                }
            }
            return setting.value
        }
    } catch (e) {
        // Database error - fall back to env
    }

    // Fallback to environment variable
    return process.env[envKey] || null
}

/**
 * Get all Twilio credentials (with caching)
 */
async function getTwilioCredentials() {
    // Check cache
    if (cachedCredentials && Date.now() - cachedCredentials.cacheTime < CACHE_TTL) {
        return cachedCredentials
    }

    const [accountSid, authToken, phoneNumber] = await Promise.all([
        getCredential('twilio_account_sid', 'TWILIO_ACCOUNT_SID'),
        getCredential('twilio_auth_token', 'TWILIO_AUTH_TOKEN'),
        getCredential('twilio_phone_number', 'TWILIO_PHONE_NUMBER')
    ])

    cachedCredentials = {
        accountSid,
        authToken,
        phoneNumber,
        cacheTime: Date.now()
    }

    return cachedCredentials
}

/**
 * Clear credentials cache (call after updating settings)
 */
export function clearTwilioCache() {
    cachedCredentials = null
}

interface SendSmsResult {
    success: boolean
    messageId?: string
    error?: string
}

export async function sendSms(to: string, body: string): Promise<SendSmsResult> {
    const creds = await getTwilioCredentials()

    if (!creds.accountSid || !creds.authToken) {
        console.error('Twilio client not configured - check settings or TWILIO_* env vars')
        return { success: false, error: 'Twilio not configured' }
    }

    if (!creds.phoneNumber) {
        return { success: false, error: 'Twilio phone number not set' }
    }

    try {
        const client = twilio(creds.accountSid, creds.authToken)

        // Format phone number if needed
        let formattedTo = to.replace(/[^\d+]/g, '')
        if (!formattedTo.startsWith('+')) {
            formattedTo = '+1' + formattedTo // Default to US/Canada
        }

        const message = await client.messages.create({
            body,
            from: creds.phoneNumber,
            to: formattedTo
        })

        console.log(`SMS sent: ${message.sid} to ${formattedTo}`)
        return { success: true, messageId: message.sid }
    } catch (error: any) {
        console.error('Failed to send SMS:', error.message)
        return { success: false, error: error.message }
    }
}

// Test function
export async function testSmsConnection(): Promise<boolean> {
    const creds = await getTwilioCredentials()

    if (!creds.accountSid || !creds.authToken) return false

    try {
        const client = twilio(creds.accountSid, creds.authToken)
        await client.api.accounts(creds.accountSid).fetch()
        return true
    } catch {
        return false
    }
}

