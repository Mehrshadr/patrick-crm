import { db } from "./db"
import { calculateNextNurture } from "./nurture-logic"
import { Lead } from "@prisma/client"

// Mock Templates
const TEMPLATES = {
    email1: (name: string, website: string) => `Hello ${name},<br><br>Thank you for requesting website audit for ${website || 'your website'}. To prepare the audit, we need to better understand your goals...<br><br>👉 <a href="https://calendly.com/mehrdad-mehrana/15-minute-strategy-session">Book Chat</a>`,
    sms1: (name: string, website: string) => `Hi ${name}! Thanks for requesting an audit for ${website || 'your site'}. Please book a quick 15-min chat: https://calendly.com/mehrdad-mehrana/15-minute-strategy-session -Mehrdad`
}

export async function triggerStage1(lead: Lead) {
    console.log(`[Automation] Triggering Stage 1 for ${lead.name}`)

    // 1. Mock Send Email
    await db.log.create({
        data: {
            leadId: lead.id,
            type: "EMAIL",
            stage: "Stage 1",
            status: "SENT",
            title: "Welcome Email Sent",
            content: TEMPLATES.email1(lead.name, lead.website || "")
        }
    })

    // 2. Mock Send SMS
    await db.log.create({
        data: {
            leadId: lead.id,
            type: "SMS",
            stage: "Stage 1",
            status: "SENT",
            title: "Welcome SMS Sent",
            content: TEMPLATES.sms1(lead.name, lead.website || "")
        }
    })

    // 3. Schedule Stage 2
    const next = calculateNextNurture(lead.createdAt, 1)

    if (next) {
        await db.lead.update({
            where: { id: lead.id },
            data: {
                nurtureStage: 1, // Current stage done
                nextNurtureAt: next.scheduleAt
            }
        })
        console.log(`[Automation] Scheduled Stage 2 for ${next.scheduleAt.toLocaleString()}`)
    }
}
