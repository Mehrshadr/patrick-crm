import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function cleanupDuplicateLogs() {
    console.log('🧹 Cleaning up duplicate calendar sync logs...\n')

    // Yesterday 6 PM (December 24, 2024)
    const cutoffDate = new Date('2024-12-24T18:00:00')

    // Pattern to match: "60min meeting detected → subStatus: Rescheduled (pipeline unchanged)"
    const duplicatePattern = 'min meeting detected → subStatus:'

    // 1. Find and delete from Log table (lead timeline)
    const logsToDelete = await prisma.log.findMany({
        where: {
            createdAt: { gte: cutoffDate },
            content: { contains: 'pipeline unchanged' },
            type: 'MEETING',
            status: 'BOOKED'
        }
    })

    console.log(`Found ${logsToDelete.length} duplicate logs in Lead Timeline`)

    if (logsToDelete.length > 0) {
        const result = await prisma.log.deleteMany({
            where: {
                id: { in: logsToDelete.map(l => l.id) }
            }
        })
        console.log(`  ✓ Deleted ${result.count} timeline logs`)
    }

    // 2. Find and delete from ActivityLog table
    const activityLogs = await prisma.activityLog.findMany({
        where: {
            createdAt: { gte: cutoffDate },
            description: { contains: duplicatePattern },
            action: 'MEETING_BOOKED'
        }
    })

    console.log(`Found ${activityLogs.length} duplicate activity logs`)

    if (activityLogs.length > 0) {
        const result = await prisma.activityLog.deleteMany({
            where: {
                id: { in: activityLogs.map(l => l.id) }
            }
        })
        console.log(`  ✓ Deleted ${result.count} activity logs`)
    }

    console.log('\n✅ Cleanup complete!')
}

cleanupDuplicateLogs()
    .catch((e) => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
