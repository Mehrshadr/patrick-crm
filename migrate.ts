import { db } from "./lib/db"
import { STAGE_CONFIG, getStageForStatus } from "./lib/status-mapping"
import dotenv from "dotenv"

dotenv.config({ path: ".env.local" })

const APPS_SCRIPT_URL = process.env.APPS_SCRIPT_URL

async function migrate() {
    if (!APPS_SCRIPT_URL) {
        console.error("No APPS_SCRIPT_URL found")
        return
    }

    console.log("Fetching from Sheets...")
    const res = await fetch(`${APPS_SCRIPT_URL}?action=getLeads`)
    const data = await res.json()
    const sheetLeads = data.leads
    console.log(`Found ${sheetLeads.length} leads. Migrating...`)

    for (const l of sheetLeads) {
        // Map Status to Stage
        const stage = getStageForStatus(l.status)

        try {
            await db.lead.create({
                data: {
                    name: l.name || "Unknown",
                    phone: l.phone || "",
                    email: l.email || null,
                    website: l.website || null,
                    status: l.status || "New",
                    stage: stage,
                    call1Outcome: l.call1Outcome || null,
                    meeting1Outcome: l.meeting1Outcome || null,
                    meeting2Outcome: l.meeting2Outcome || null,
                    meeting3Outcome: l.meeting3Outcome || null,
                    auditStatus: l.auditStatus || null,
                    notes: l.notes || "",
                    createdAt: l.dateAdded ? new Date(l.dateAdded) : new Date(),
                    updatedAt: l.lastUpdated ? new Date(l.lastUpdated) : new Date()
                }
            })
            console.log(`Migrated: ${l.name}`)
        } catch (e) {
            console.error(`Failed to migrate ${l.name}:`, e)
        }
    }
    console.log("Migration Complete.")
}

migrate()
