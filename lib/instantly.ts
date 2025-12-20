/**
 * Instantly.ai API Client
 * 
 * Used to add leads to Instantly campaigns via External Action workflow steps.
 */

const INSTANTLY_API_BASE = 'https://api.instantly.ai/api/v2'

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
 * Get API key from environment or AppSettings
 */
function getApiKey(): string | null {
    return process.env.INSTANTLY_API_KEY || null
}

/**
 * Add a lead to an Instantly campaign
 */
export async function addLeadToCampaign(
    campaignId: string,
    lead: InstantlyLead
): Promise<AddLeadResponse> {
    const apiKey = getApiKey()

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
    const apiKey = getApiKey()

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
