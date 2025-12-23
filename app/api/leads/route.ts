import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { processWorkflow } from '@/lib/workflow-engine'
import { logActivity } from '@/lib/activity'

const API_KEY = process.env.EXTERNAL_API_KEY || 'patrick-api-secret-2024'

// Helper to validate API key
function validateApiKey(request: NextRequest): boolean {
    const headerKey = request.headers.get('x-api-key') || request.headers.get('authorization')?.replace('Bearer ', '')
    const queryKey = request.nextUrl.searchParams.get('api_key')
    return (headerKey === API_KEY) || (queryKey === API_KEY)
}

// POST - Create a new lead (for n8n, Facebook, Zapier, etc.)
export async function POST(request: NextRequest) {
    try {
        // Validate API Key
        if (!validateApiKey(request)) {
            console.log('[API/leads] Unauthorized request - invalid API key')
            return NextResponse.json(
                { success: false, error: 'Unauthorized: Invalid API key' },
                { status: 401 }
            )
        }

        const body = await request.json()

        const { name, email, phone, website, status, subStatus, source } = body

        // Validation
        if (!name && !email && !phone) {
            return NextResponse.json(
                { success: false, error: 'At least one of name, email, or phone is required' },
                { status: 400 }
            )
        }

        const cleanEmail = email?.toString()?.toLowerCase()?.trim() || null
        const cleanPhone = phone?.toString()?.replace(/\D/g, '') || null

        // Check for duplicates
        if (cleanEmail) {
            const existing = await db.lead.findFirst({ where: { email: cleanEmail } })
            if (existing) {
                return NextResponse.json(
                    { success: false, error: 'Lead with this email already exists', leadId: existing.id },
                    { status: 409 }
                )
            }
        }

        if (cleanPhone) {
            const existing = await db.lead.findFirst({ where: { phone: cleanPhone } })
            if (existing) {
                return NextResponse.json(
                    { success: false, error: 'Lead with this phone already exists', leadId: existing.id },
                    { status: 409 }
                )
            }
        }

        // Create lead
        const lead = await db.lead.create({
            data: {
                name: name?.toString()?.trim() || 'Unknown',
                email: cleanEmail,
                phone: cleanPhone || '',
                website: website?.toString()?.trim() || null,
                status: status || 'New',
                subStatus: subStatus || 'Welcome Sent',
                nurtureStage: 0,
                nextNurtureAt: null,
                automationStatus: null,
            }
        })

        // Log the creation
        await logActivity({
            category: 'LEAD',
            action: 'LEAD_CREATED',
            entityType: 'LEAD',
            entityId: lead.id,
            entityName: lead.name,
            description: `Lead created via API${source ? ` (${source})` : ''}`
        })

        // Auto-trigger workflow ONLY if executionMode is AUTO (not MANUAL)
        if (lead.status && lead.subStatus) {
            // Find matching AUTO workflows only
            const workflows = await db.workflow.findMany({
                where: {
                    isActive: true,
                    executionMode: 'AUTO', // Only trigger AUTO workflows!
                    triggerType: 'ON_STATUS_CHANGE',
                    triggerStatus: lead.status,
                    OR: [
                        { triggerSubStatus: null },
                        { triggerSubStatus: '' },
                        { triggerSubStatus: lead.subStatus }
                    ]
                }
            })

            console.log(`[API/leads] Found ${workflows.length} AUTO workflows to trigger for status ${lead.status}/${lead.subStatus}`)

            // Start workflows in background
            for (const wf of workflows) {
                processWorkflow({
                    workflowId: wf.id,
                    leadId: lead.id,
                    triggeredBy: `AUTO (API - ${source || 'External'})`
                }).catch(err => console.error('[API/leads] Workflow error:', err))
            }
        }

        return NextResponse.json({
            success: true,
            leadId: lead.id,
            message: 'Lead created successfully'
        })

    } catch (error: any) {
        console.error('[API/leads] Error:', error)
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        )
    }
}

// GET - List leads (basic)
export async function GET(request: NextRequest) {
    try {
        const email = request.nextUrl.searchParams.get('email')

        const leads = await db.lead.findMany({
            where: email ? { email: email.toLowerCase().trim() } : undefined,
            orderBy: { createdAt: 'desc' },
            take: 100
        })
        return NextResponse.json({ success: true, leads })
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }
}
