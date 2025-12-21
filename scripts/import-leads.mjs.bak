// scripts/import-leads.ts
// Run with: npx ts-node scripts/import-leads.ts

const XLSX = require('xlsx');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Status mapping from old Excel statuses to new Pipeline stages
function mapStatus(excelStatus: string | null | undefined): { status: string; subStatus: string } {
    if (!excelStatus) return { status: 'New', subStatus: '' };

    const s = excelStatus.toLowerCase();

    // Call 1 statuses
    if (s.includes('call 1')) return { status: 'New', subStatus: 'Welcome Sent' };

    // Meeting 1 statuses
    if (s.includes('m1 - scheduled') || s.includes('meeting 1 - scheduled'))
        return { status: 'Meeting1', subStatus: 'Scheduled' };
    if (s.includes('m1 - done') || s.includes('meeting 1 - done'))
        return { status: 'Meeting1', subStatus: 'Done & Data Received' };
    if (s.includes('m1 - ghosted'))
        return { status: 'Meeting1', subStatus: 'Ghosted' };

    // Audit statuses
    if (s.includes('audit in progress'))
        return { status: 'Audit', subStatus: 'Analyzing' };
    if (s.includes('audit ready'))
        return { status: 'Audit', subStatus: 'Ready' };

    // Meeting 2 statuses
    if (s.includes('m2 - scheduled') || s.includes('meeting 2 - scheduled'))
        return { status: 'Meeting2', subStatus: 'Scheduled' };
    if (s.includes('m2 - email sent') || s.includes('m2 - reschedule'))
        return { status: 'Meeting2', subStatus: 'Rescheduled' };
    if (s.includes('m2 - done'))
        return { status: 'Meeting2', subStatus: 'Done' };
    if (s.includes('m2 - ghosted'))
        return { status: 'Meeting2', subStatus: 'Ghosted' };

    // Meeting 3 statuses
    if (s.includes('m3') || s.includes('meeting 3'))
        return { status: 'Meeting3', subStatus: 'Scheduled' };

    // Won/Lost
    if (s.includes('won') || s.includes('deal'))
        return { status: 'Won', subStatus: 'Deal Won' };
    if (s.includes('lost') || s.includes('not interested'))
        return { status: 'Lost', subStatus: 'Not Interested' };

    // Ghosted/Fox
    if (s.includes('ghost') || s.includes('fox'))
        return { status: 'Ghosted', subStatus: 'Long Term Ghosted' };

    // Default
    return { status: 'New', subStatus: '' };
}

// Parse Excel date (could be number or string)
function parseExcelDate(value: any): Date | null {
    if (!value) return null;

    // If it's a number (Excel serial date)
    if (typeof value === 'number') {
        // Excel dates are days since 1900-01-01 (but actually 1899-12-30 due to bug)
        const date = new Date((value - 25569) * 86400 * 1000);
        return date;
    }

    // If it's a string, try to parse it
    if (typeof value === 'string') {
        const d = new Date(value);
        return isNaN(d.getTime()) ? null : d;
    }

    return null;
}

// Clean phone number
function cleanPhone(phone: any): string {
    if (!phone) return '';
    return String(phone).replace(/\D/g, '');
}

async function importLeads() {
    console.log('Reading Excel file...');
    const wb = XLSX.readFile('./Mehrana Lead Sheet .xlsx');
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(sheet);

    console.log(`Found ${data.length} leads to import`);

    let imported = 0;
    let skipped = 0;
    let errors = 0;

    for (const row of data) {
        try {
            const email = row['Email']?.toString()?.toLowerCase()?.trim() || null;
            const phone = cleanPhone(row['Phone']);
            const name = row['Name']?.toString()?.trim() || 'Unknown';

            // Skip if no email and no phone
            if (!email && !phone) {
                console.log(`Skipping row without email/phone: ${name}`);
                skipped++;
                continue;
            }

            // Check if lead already exists
            let existingLead = null;
            if (email) {
                existingLead = await prisma.lead.findFirst({ where: { email } });
            }
            if (!existingLead && phone) {
                existingLead = await prisma.lead.findFirst({ where: { phone } });
            }

            if (existingLead) {
                console.log(`Lead already exists: ${email || phone}`);
                skipped++;
                continue;
            }

            // Map status
            const { status, subStatus } = mapStatus(row['Status']);

            // Create lead
            const lead = await prisma.lead.create({
                data: {
                    name,
                    phone,
                    email,
                    website: row['Website']?.toString()?.trim() || null,
                    status,
                    subStatus,
                    quality: row['Lead Quality']?.toString()?.trim() || null,
                    businessType: row['Business Type']?.toString()?.trim() || null,
                    call1Outcome: row['Call 1 Outcome']?.toString()?.trim() || null,
                    meeting1Outcome: row['Meeting 1 Outcome']?.toString()?.trim() || null,
                    meeting2Outcome: row['Meeting 2 Outcome']?.toString()?.trim() || null,
                    meeting3Outcome: row['Meeting 3 Outcome']?.toString()?.trim() || null,
                    createdAt: parseExcelDate(row['Date Added']) || new Date(),
                    updatedAt: new Date(),
                    nurtureStage: 0,
                    nextNurtureAt: null, // No automation for imported leads
                    automationStatus: null,
                }
            });

            // Add notes if available
            const notes = row['Notes from Setter (Free text)']?.toString()?.trim();
            const screenRecord = row['Screen record link + Note']?.toString()?.trim();
            const combinedNotes = [notes, screenRecord].filter(Boolean).join('\n\n---\n\n');

            if (combinedNotes) {
                await prisma.note.create({
                    data: {
                        leadId: lead.id,
                        content: combinedNotes,
                        stage: 'Imported', // Use stage instead of type
                        createdAt: new Date()
                    }
                });
            }

            // Add audit link if available
            const auditLink = row['Audit Link']?.toString()?.trim();
            if (auditLink) {
                await prisma.link.create({
                    data: {
                        leadId: lead.id,
                        url: auditLink,
                        type: 'Audit Link',
                        title: 'Audit Presentation'
                    }
                });
            }

            console.log(`✓ Imported: ${name} (${email || phone}) -> ${status}/${subStatus}`);
            imported++;

        } catch (err: any) {
            console.error(`✗ Error importing row:`, err.message);
            errors++;
        }
    }

    console.log('\n--- Import Summary ---');
    console.log(`Imported: ${imported}`);
    console.log(`Skipped: ${skipped}`);
    console.log(`Errors: ${errors}`);

    await prisma.$disconnect();
}

importLeads().catch(console.error);
