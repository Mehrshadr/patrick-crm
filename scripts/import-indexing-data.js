// Import script for Excel data - saves Google's exact status values
// Run with: node scripts/import-indexing-data.js

const { PrismaClient } = require('@prisma/client')
const XLSX = require('xlsx')

const prisma = new PrismaClient()

// Excel serial date to JS Date
function excelDateToJS(serial) {
    if (!serial || isNaN(serial)) return null
    const utc_days = Math.floor(serial - 25569)
    const utc_value = utc_days * 86400
    return new Date(utc_value * 1000)
}

// Map Google's Index Status to our internal status for filtering
function mapToInternalStatus(indexStatus) {
    if (!indexStatus) return 'PENDING'
    const lower = indexStatus.toLowerCase()
    if (lower.includes('indexed') && lower.includes('submitted')) return 'INDEXED'
    if (lower.includes('indexed')) return 'INDEXED'
    if (lower.includes('crawled')) return 'SUBMITTED'
    if (lower.includes('error') || lower.includes('redirect')) return 'ERROR'
    return 'PENDING'
}

async function importSheet(sheetName, data) {
    console.log(`\nImporting ${sheetName}...`)

    // Extract domain from first URL
    const firstUrl = data.find(r => r.URL)?.URL
    let domain = null
    try {
        domain = firstUrl ? new URL(firstUrl).hostname : null
    } catch (e) { }

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
            const googleStatus = row['Index Status'] || null  // Keep Google's exact status
            const internalStatus = mapToInternalStatus(googleStatus)
            const lastChecked = excelDateToJS(row['Last Checked'])
            const dateIndexed = excelDateToJS(row['Date Indexed'])

            await prisma.indexingUrl.upsert({
                where: {
                    projectId_url: {
                        projectId: project.id,
                        url: row.URL
                    }
                },
                update: {
                    status: internalStatus,
                    lastInspectedAt: lastChecked,
                    lastSubmittedAt: dateIndexed || lastChecked,
                    lastInspectionResult: googleStatus  // Store Google's exact response
                },
                create: {
                    projectId: project.id,
                    url: row.URL,
                    status: internalStatus,
                    lastInspectedAt: lastChecked,
                    lastSubmittedAt: dateIndexed || lastChecked,
                    lastInspectionResult: googleStatus  // Store Google's exact response
                }
            })
            imported++
        } catch (error) {
            console.log(`  Skipped: ${row.URL} - ${error.message}`)
            skipped++
        }
    }

    console.log(`  Imported: ${imported}, Skipped: ${skipped}`)
}

async function main() {
    const workbook = XLSX.readFile('Mehrana - Link Indexing Workflow.xlsx')

    for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName]
        const data = XLSX.utils.sheet_to_json(sheet)
        await importSheet(sheetName, data)
    }

    console.log('\n✅ Import complete!')
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect())
