
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    // 1. Create a Lead
    const lead = await prisma.lead.create({
        data: {
            name: 'Test Lead (Restored)',
            email: 'test@example.com',
            phone: '+1234567890',
            status: 'New',
            stage: 'New',
            notes: {
                create: {
                    content: 'This lead was automatically created to restore data context.'
                }
            }
        }
    })

    // 2. Create a Log (Execution History)
    await prisma.log.create({
        data: {
            leadId: lead.id,
            type: 'SYSTEM',
            status: 'SENT',
            title: 'System Restored',
            content: 'Database connection verified and sample data restored.',
            meta: JSON.stringify({ action: 'restore', timestamp: new Date() })
        }
    })

    // 3. Create a Sample Workflow
    await prisma.workflow.create({
        data: {
            name: 'Sample Workflow 1',
            description: 'Demo workflow for testing',
            triggerType: 'ON_STATUS_CHANGE',
            triggerStatus: 'Meeting1',
            steps: {
                create: [
                    { name: 'Welcome Email', type: 'EMAIL', order: 1, config: JSON.stringify({ subject: 'Hello', body: 'Welcome!' }) },
                    { name: 'Wait 2 Days', type: 'DELAY', order: 2, config: JSON.stringify({ duration: 2, unit: 'DAYS' }) }
                ]
            }
        }
    })

    console.log('Seed data created!')
}

main()
    .then(async () => {
        await prisma.$disconnect()
    })
    .catch(async (e) => {
        console.error(e)
        await prisma.$disconnect()
        process.exit(1)
    })
