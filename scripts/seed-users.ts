import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Users to create
const users = [
    { email: 'mehrdad@mehrana.agency', name: 'Mehrdad Salehi', role: 'SUPER_ADMIN' },
    { email: 'mehrshad@mehrana.agency', name: 'Mehrshad Rostami', role: 'SUPER_ADMIN' },
    { email: 'alireza@mehrana.agency', name: 'Alireza Saberi', role: 'USER' },
    { email: 'amirhossein@mehrana.agency', name: 'Amirhossein Sheydaei', role: 'USER' },
    { email: 'anahita@mehrana.agency', name: 'Anahita Yaghoubi', role: 'USER' },
    { email: 'fatemeh@mehrana.agency', name: 'Fatemeh Malmir', role: 'USER' },
    { email: 'fereshteh@mehrana.agency', name: 'Fereshteh', role: 'USER' },
    { email: 'info@mehrana.agency', name: 'Mehrana Marketing', role: 'USER' },
    { email: 'parastoo@mehrana.agency', name: 'Parastoo Rabiei', role: 'USER' },
    { email: 'sajedeh@mehrana.agency', name: 'Sajedeh Moghimbeyk', role: 'USER' },
    { email: 'shahab@mehrana.agency', name: 'Shahab Mohammad Hosseini', role: 'USER' },
    { email: 'shima@mehrana.agency', name: 'Shima Zahabi', role: 'USER' },
    { email: 'siavash@mehrana.agency', name: 'Siavash Malek Hosseini', role: 'USER' },
]

// Missing projects to create
const newProjects = [
    { name: 'Smart View Homes', domain: null, description: 'Placeholder - domain TBD' },
    { name: 'Auxwood', domain: null, description: 'Placeholder - domain TBD' },
    { name: 'GTA SEO', domain: null, description: 'Placeholder - domain TBD' },
    { name: 'Chinese ET', domain: null, description: 'Chinese Epoch Times - domain TBD' },
    { name: 'NTD Chinese', domain: null, description: 'NTD Chinese - domain TBD' },
    { name: 'Quick Fit Parts', domain: null, description: 'Placeholder - domain TBD' },
]

// Project assignments (email -> project names)
const projectAssignments: Record<string, string[]> = {
    'parastoo@mehrana.agency': [
        'GroveTreeDecor',
        'MorsunKitchen',
        'Smart View Homes',
        'Mehrana Agency',
        'Today Decision',
    ],
    'fatemeh@mehrana.agency': [
        'Pretty Fluffy',
        'SEP Immigration',
        'Trigger Electric',
        'Auxwood',
    ],
    'fereshteh@mehrana.agency': [
        'GTA SEO',
        'NTD',
        'Chinese ET',
        'NTD Chinese',
        'Charlie Kirk Documentary',
        'Quick Fit Parts',
    ],
    'shima@mehrana.agency': [
        'Line In Connect',
    ],
}

async function main() {
    console.log('🌱 Seeding users and project access...\n')

    // 1. Create users
    console.log('Creating users...')
    for (const userData of users) {
        const user = await prisma.user.upsert({
            where: { email: userData.email },
            update: { name: userData.name, role: userData.role },
            create: userData,
        })
        console.log(`  ✓ ${user.name} (${user.email}) - ${user.role}`)
    }

    // 2. Create missing projects
    console.log('\nCreating missing projects...')
    for (const projectData of newProjects) {
        const existing = await prisma.indexingProject.findFirst({
            where: { name: projectData.name }
        })
        if (!existing) {
            const project = await prisma.indexingProject.create({
                data: projectData,
            })
            console.log(`  ✓ Created: ${project.name}`)
        } else {
            console.log(`  - Already exists: ${projectData.name}`)
        }
    }

    // 3. Assign projects to users
    console.log('\nAssigning projects to users...')
    for (const [email, projectNames] of Object.entries(projectAssignments)) {
        const user = await prisma.user.findUnique({ where: { email } })
        if (!user) {
            console.log(`  ✗ User not found: ${email}`)
            continue
        }

        for (const projectName of projectNames) {
            const project = await prisma.indexingProject.findFirst({
                where: { name: projectName }
            })
            if (!project) {
                console.log(`  ✗ Project not found: ${projectName}`)
                continue
            }

            await prisma.projectAccess.upsert({
                where: {
                    userId_projectId: {
                        userId: user.id,
                        projectId: project.id,
                    }
                },
                update: {},
                create: {
                    userId: user.id,
                    projectId: project.id,
                    role: 'MEMBER',
                },
            })
            console.log(`  ✓ ${user.name} -> ${project.name}`)
        }
    }

    console.log('\n✅ Seeding complete!')
}

main()
    .catch((e) => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
