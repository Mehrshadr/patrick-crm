// Script to generate slugs for existing projects
// Run with: npx ts-node scripts/generate-slugs.ts

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

function slugify(text: string): string {
    return text
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, '') // Remove special chars
        .replace(/[\s_-]+/g, '-') // Replace spaces/underscores with hyphens
        .replace(/^-+|-+$/g, '') // Remove leading/trailing hyphens
}

async function main() {
    const projects = await prisma.indexingProject.findMany()

    console.log(`Found ${projects.length} projects to update...`)

    for (const project of projects) {
        let baseSlug = slugify(project.name)
        let slug = baseSlug
        let counter = 1

        // Handle duplicates by appending number
        while (true) {
            const existing = await prisma.indexingProject.findFirst({
                where: {
                    slug,
                    id: { not: project.id }
                }
            })
            if (!existing) break
            slug = `${baseSlug}-${counter}`
            counter++
        }

        await prisma.indexingProject.update({
            where: { id: project.id },
            data: { slug }
        })

        console.log(`  ${project.name} → ${slug}`)
    }

    console.log('Done!')
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect())
