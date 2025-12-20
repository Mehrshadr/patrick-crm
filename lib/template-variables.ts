"use server"

// Template variable replacement utility
// Replaces {name}, {website}, {audit_link}, etc. with actual lead data

import { db } from '@/lib/db'

interface LeadData {
    name: string
    email?: string | null
    website?: string | null
    phone?: string
}

interface LinkData {
    type: string
    url: string
}

export async function replaceTemplateVariables(
    template: string,
    leadId: number,
    signature?: string
): Promise<string> {
    // Fetch lead data
    const lead = await db.lead.findUnique({
        where: { id: leadId },
        include: {
            links: true
        }
    })

    if (!lead) {
        console.warn(`Lead ${leadId} not found for template replacement`)
        return template
    }

    // Build replacement map
    const replacements: Record<string, string> = {
        '{name}': lead.name || 'there',
        '{email}': lead.email || '',
        '{website}': lead.website || '',
        '{phone}': lead.phone || '',
        '{signature}': signature || '',
    }

    // Add link variables
    const auditLink = lead.links.find((l: LinkData) => l.type === 'AUDIT')
    const proposalLink = lead.links.find((l: LinkData) => l.type === 'PROPOSAL')
    const recordingLink = lead.links.find((l: LinkData) => l.type === 'RECORDING')

    replacements['{audit_link}'] = auditLink?.url || '[Audit Link Not Set]'
    replacements['{proposal_link}'] = proposalLink?.url || '[Proposal Link Not Set]'
    replacements['{recording_link}'] = recordingLink?.url || '[Recording Link Not Set]'

    // Perform replacements
    let result = template
    for (const [variable, value] of Object.entries(replacements)) {
        result = result.replaceAll(variable, value)
    }

    return result
}

// Get available variables for autocomplete
export function getAvailableVariables(): { variable: string; description: string }[] {
    return [
        { variable: '{name}', description: 'Lead name' },
        { variable: '{email}', description: 'Lead email' },
        { variable: '{website}', description: 'Lead website' },
        { variable: '{phone}', description: 'Lead phone' },
        { variable: '{audit_link}', description: 'Audit document link' },
        { variable: '{proposal_link}', description: 'Proposal link' },
        { variable: '{recording_link}', description: 'Meeting recording link' },
        { variable: '{signature}', description: 'Email signature' },
    ]
}
