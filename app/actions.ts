"use server"

import { revalidatePath } from "next/cache"
import { db } from "@/lib/db"
import { Lead } from "@prisma/client"
import { processWorkflow } from "@/lib/workflow-engine"
import { auth } from "@/lib/auth"

// We re-export Lead so components can use it
export type { Lead } from "@prisma/client"

// For backward compatibility with some components that expect 'SheetLead', 
// we can alias it or just update components to use 'Lead'
// But 'Lead' has 'id' as Int, formerly 'id' was String.
// We should update components to expect Lead from prisma.

// Helper mapping for status logic (same as Apps Script)
const STATUS_MAP: Record<string, string> = {
    'Meeting Booked': 'M1 - Scheduled',
    'No Answer': 'Call 1 - SMS & Email Sent',
    'Wrong Number': 'Call 1 - Email Sent (Wrong Num)',
    'Not Interested': 'Lost - Not Interested',
    'Callback Requested': 'Call 1 - Callback Req',
    'Completed - Data Received': 'Audit In Progress',
    'Reschedule Requested': 'M1 - Reschedule Needed',
    'No Show': 'M1 - Recovery Email Sent',
    'Not Qualified': 'Lost - Not Qualified',
    'Audit Presented': 'M2 - Audit Presented',
    'Audit Presented - Not Interested': 'Lost - Not Interested',
    'Proposal Requested': 'Deal - Proposal Sent',
    'Proposal Accepted': 'Deal - Won',
    'Proposal Rejected': 'Deal - Lost',
    'Thinking / Reviewing': 'Deal - Proposal Sent',
    'Won': 'Deal - Won',
    'Lost': 'Deal - Lost'
}

export type LeadUpdateValues = Partial<Omit<Lead, 'id' | 'createdAt' | 'updatedAt'>>

export async function getLeads() {
    try {
        const leads = await db.lead.findMany({
            orderBy: { createdAt: 'desc' },
            include: { links: true }
        })
        return leads
    } catch (e) {
        console.error("DB Fetch failed", e)
        return []
    }
}

import { triggerStage1 } from "@/lib/automation"

export async function createLead(data: any) {
    try {
        const lead = await db.lead.create({
            data: {
                name: data.name || "",
                phone: data.phone || "",
                email: data.email || "",
                website: data.website || "",
                quality: data.quality || null,
                businessType: data.businessType || null,
                status: "New",
                stage: "New"
            }
        })

        // Trigger Automation
        // We don't await this to keep UI fast? Or we do to ensure it happens? 
        // Let's await for now to be safe.
        await triggerStage1(lead)

        revalidatePath("/")
        return { success: true, lead }
    } catch (e) {
        return { success: false, error: String(e) }
    }
}

export async function updateLead(id: number, data: LeadUpdateValues, user?: { email?: string | null, name?: string | null }) {
    try {
        const currentLead = await db.lead.findUnique({ where: { id } });

        const updated = await db.lead.update({
            where: { id },
            data: {
                ...data,
            }
        });

        // Logging Logic with user tracking
        if (currentLead) {
            // Check status change
            if ((data.status && data.status !== currentLead.status) || (data.subStatus && data.subStatus !== currentLead.subStatus)) {
                await db.log.create({
                    data: {
                        leadId: id,
                        type: 'STATUS_CHANGE',
                        title: `Status Updated`,
                        content: `Changed to **${data.status || currentLead.status}** (${data.subStatus || currentLead.subStatus || 'No Attribute'})`,
                        status: 'COMPLETED',
                        stage: data.status || currentLead.status,
                        userEmail: user?.email || null,
                        userName: user?.name || null,
                    }
                })

                // AUTO-TRIGGER LOGIC
                const newStatus = data.status || currentLead.status
                const newSubStatus = data.subStatus || currentLead.subStatus

                const session = await auth()
                const accessToken = (session as any)?.accessToken
                const refreshToken = (session as any)?.refreshToken

                // Find active workflows with trigger ON_STATUS_CHANGE that match
                const matchingWorkflows = await db.workflow.findMany({
                    where: {
                        isActive: true,
                        triggerType: 'ON_STATUS_CHANGE',
                        triggerStatus: newStatus,
                        OR: [
                            { triggerSubStatus: null },
                            { triggerSubStatus: newSubStatus || undefined }
                        ]
                    }
                })

                for (const workflow of matchingWorkflows) {
                    // Start execution
                    await processWorkflow({
                        workflowId: workflow.id,
                        leadId: id,
                        accessToken,
                        refreshToken,
                        triggeredBy: 'AUTO (Status Change)'
                    })
                }
            }
        }

        revalidatePath("/")
        return { success: true, lead: updated }
    } catch (e) {
        console.error("Update Error", e)
        return { success: false, error: String(e) }
    }
}

export async function deleteLead(id: number) {
    try {
        await db.lead.delete({ where: { id } })
        revalidatePath("/")
        return { success: true }
    } catch (e) {
        return { success: false, error: String(e) }
    }
}

export async function cleanupLeads() {
    // Implement cleanup logic later if needed
    return { success: true }
}

export async function getLeadLogs(leadId: number) {
    try {
        return await db.log.findMany({
            where: { leadId },
            orderBy: { createdAt: 'desc' }
        })
    } catch (e) {
        return []
    }
}

export async function addLink(leadId: number, type: string, title: string, url: string) {
    try {
        const link = await db.link.create({
            data: { leadId, type, title, url }
        })
        revalidatePath("/")
        return { success: true, link }
    } catch (e) {
        return { success: false, error: String(e) }
    }
}

export async function getLinks(leadId: number) {
    try {
        return await db.link.findMany({
            where: { leadId },
            orderBy: { createdAt: 'desc' }
        })
    } catch (e) {
        return []
    }
}
