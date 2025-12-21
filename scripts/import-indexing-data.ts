// Import script for Excel data
// Run with: npx ts-node scripts/import-indexing-data.ts

import { PrismaClient } from '@prisma/client'
import * as XLSX from 'xlsx'

const prisma = new PrismaClient()

// Excel serial date to JS Date
function excelDateToJS(serial: number): Date | null {
    if (!serial || isNaN(serial)) return null
    // Excel dates start from 1900-01-01
    const utc_days = Math.floor(serial - 25569)
    const utc_value = utc_days * 86400
    return new Date(utc_value * 1000)
}

// Map Index Status to our status
function mapStatus(indexStatus: string): string {
    if (!indexStatus) return 'PENDING'
    const lower = indexStatus.toLowerCase()
    if (lower.includes('indexed')) return 'INDEXED'
    if (lower.includes('submitted')) return 'SUBMITTED'
    if (lower.includes('crawled')) return 'SUBMITTED'
    if (lower.includes('error') || lower.includes('redirect')) return 'ERROR'
    if (lower.includes('noindex')) return 'NOINDEX'
    if (lower.includes('blocked')) return 'BLOCKED'
    return 'PENDING'
}

interface SheetRow {
    URL?: string
    'Date Added'?: number
    Status?: boolean
    'Date Indexed'?: number
    'Error Log'?: string
    'Index Status'?: string
    'Last Checked'?: number
}

async function importSheet(sheetName: string, data: SheetRow[]) {
    console.log(`\nImporting ${sheetName}...`)

    // Extract domain from first URL
    const firstUrl = data.find(r => r.URL)?.URL
    const domain = firstUrl ? new URL(firstUrl).hostname : null

    // Create or find project
    let project = await prisma.indexingProject.findFirst({
        where: { name: sheetName }
    })

    if (!project) {
        project = await prisma.indexingProject.create({
            data: {
                name: sheetName,
                domain: domain,
                description: `Imported from Excel on ${new Date().toISOString()}`
            }
        })
        console.log(`  Created project: ${sheetName}`)
    } else {
        console.log(`  Found existing project: ${sheetName}`)
    }

    let imported = 0
    let skipped = 0

    for (const row of data) {
        if (!row.URL) continue

        try {
            const status = mapStatus(row['Index Status'] || '')
            const lastChecked = excelDateToJS(row['Last Checked'] as number)
            const dateIndexed = excelDateToJS(row['Date Indexed'] as number)

            await prisma.indexingUrl.upsert({
                where: {
                    projectId_url: {
                        projectId: project.id,
                        url: row.URL
                    }
                },
                update: {
                    status,
                    lastInspectedAt: lastChecked,
                    lastSubmittedAt: dateIndexed || lastChecked,
                    lastInspectionResult: row['Index Status'] || null
                },
                create: {
                    projectId: project.id,
                    url: row.URL,
                    status,
                    lastInspectedAt: lastChecked,
                    lastSubmittedAt: dateIndexed || lastChecked,
                    lastInspectionResult: row['Index Status'] || null
                }
            })
            imported++
        } catch (error) {
            console.log(`  Skipped: ${row.URL}`)
            skipped++
        }
    }

    console.log(`  Imported: ${imported}, Skipped: ${skipped}`)
}

async function main() {
    const workbook = XLSX.readFile('Mehrana - Link Indexing Workflow.xlsx')

    for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName]
        const data = XLSX.utils.sheet_to_json<SheetRow>(sheet)
        await importSheet(sheetName, data)
    }

    console.log('\n✅ Import complete!')
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect())
