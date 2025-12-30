
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    console.log('Searching logs for anchorId like "%lb-27%"...')
    const logs = await prisma.linkBuildingLog.findMany({
        where: {
            anchorId: { contains: 'lb-27' }
        },
        include: {
            keyword: true
        }
    })

    if (logs.length > 0) {
        console.log('Found logs:', JSON.stringify(logs, null, 2))
    } else {
        console.log('No logs found with anchorId containing lb-27')

        // List all keywords to ensure we have data
        const keywords = await prisma.linkBuildingKeyword.findMany({
            take: 5,
            orderBy: { id: 'desc' }
        })
        console.log('Recent Keywords:', JSON.stringify(keywords, null, 2))
    }
}

main()
    .catch(e => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
