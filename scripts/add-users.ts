
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    const users = [
        { email: 'parastoo.p@mehrana.agency', name: 'Parasto Parandin' },
        { email: 'kosar@mehrana.agency', name: 'Kosar Koohi' }
    ]

    console.log('Adding users...')

    for (const u of users) {
        const user = await prisma.user.upsert({
            where: { email: u.email },
            update: { name: u.name },
            create: {
                email: u.email,
                name: u.name,
                role: 'USER',
                patrickAccess: 'VIEWER' // Default to viewer so they can at least login if needed, or HIDDEN? User said "add users", usually implies access. Let's trust 'USER' role defaults.
            }
        })
        console.log(`User upserted: ${user.email} (${user.name})`)
    }

    console.log('Done.')
}

main()
    .catch((e) => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
