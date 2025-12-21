import { PrismaClient } from "@prisma/client"

declare global {
    var prisma: PrismaClient | undefined
}

// Export as both 'db' (existing convention) and 'prisma' (for new SEO modules)
export const db = globalThis.prisma || new PrismaClient()
export const prisma = db

if (process.env.NODE_ENV !== "production") globalThis.prisma = db
