/**
 * Instantly.ai API Client
 * 
 * Used to add leads to Instantly campaigns via External Action workflow steps.
 */

import { prisma } from '@/lib/prisma'
import { decrypt, isEncryptionConfigured } from '@/lib/encryption'

const INSTANTLY_API_BASE = 'https://api.instantly.ai/api/v2'

// Cache for API key
let cachedApiKey: { value: string | null; cacheTime: number } | null = null
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

interface InstantlyLead {
    email: string
    first_name?: string
    phone?: string
    website?: string
}

interface InstantlyCampaign {
    id: string
    name: string
    status?: string
}

interface AddLeadResponse {
    success: boolean
    error?: string
}

interface ListCampaignsResponse {
    success: boolean
    campaigns?: InstantlyCampaign[]
    error?: string
}

/**
 * Get API key from database or environment variable
 */
async function getApiKey(): Promise<string | null> {
    // Check cache
    if (cachedApiKey && Date.now() - cachedApiKey.cacheTime < CACHE_TTL) {
        return cachedApiKey.value
    }

    try {
        const setting = await prisma.appSettings.findUnique({
            where: { key: 'instantly_api_key' }
        })

        if (setting?.value) {
            let value = setting.value
            // Decrypt if encrypted
            if ((setting as any).isEncrypted && isEncryptionConfigured()) {
                try {
                    value = decrypt(setting.value)
                } catch (e) {
                    console.error('Failed to decrypt Instantly API key:', e)
                }
            }
            cachedApiKey = { value, cacheTime: Date.now() }
            return value
        }
    } catch (e) {
        // Database error - fall back to env
    }

    // Fallback to environment variable
    const envKey = process.env.INSTANTLY_API_KEY || null
    cachedApiKey = { value: envKey, cacheTime: Date.now() }
    return envKey
}

/**
 * Clear API key cache (call after updating settings)
 */
export function clearInstantlyCache() {
    cachedApiKey = null
}

/**
 * Add a lead to an Instantly campaign
 */
export async function addLeadToCampaign(
    campaignId: string,
    lead: InstantlyLead
): Promise<AddLeadResponse> {
    const apiKey = await getApiKey()

    if (!apiKey) {
        return { success: false, error: 'Instantly API key not configured' }
    }

    try {
        const response = await fetch(`${INSTANTLY_API_BASE}/leads`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                campaign: campaignId,
                email: lead.email,
                skip_if_in_campaign: false,
                skip_if_in_workspace: false,
                first_name: lead.first_name || undefined,
                phone: lead.phone || undefined,
                website: lead.website || undefined
            })
        })

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}))
            console.error('[Instantly] API Error:', response.status, errorData)
            return {
                success: false,
                error: `Instantly API error: ${response.status} - ${errorData.message || 'Unknown error'}`
            }
        }

        const data = await response.json()
        console.log('[Instantly] Lead added successfully:', data)
        return { success: true }

    } catch (error: any) {
        console.error('[Instantly] Request failed:', error)
        return { success: false, error: error.message }
    }
}

/**
 * List all campaigns from Instantly
 */
export async function listCampaigns(): Promise<ListCampaignsResponse> {
    const apiKey = await getApiKey()

    if (!apiKey) {
        return { success: false, error: 'Instantly API key not configured' }
    }

    try {
        const response = await fetch(`${INSTANTLY_API_BASE}/campaigns?limit=100`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${apiKey}`
            }
        })

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}))
            console.error('[Instantly] API Error:', response.status, errorData)
            return {
                success: false,
                error: `Instantly API error: ${response.status}`
            }
        }

        const data = await response.json()

        // Instantly v2 API returns { items: [...] }
        const campaigns: InstantlyCampaign[] = (data.items || data || []).map((c: any) => ({
            id: c.id,
            name: c.name,
            status: c.status
        }))

        return { success: true, campaigns }

    } catch (error: any) {
        console.error('[Instantly] Request failed:', error)
        return { success: false, error: error.message }
    }
}
