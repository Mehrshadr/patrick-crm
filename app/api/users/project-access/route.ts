import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { requireAdmin } from '@/lib/permissions'

// Available app types
export const APP_TYPES = ['LINK_INDEXING', 'CONTENT_FACTORY', 'IMAGE_FACTORY', 'DASHBOARD'] as const

interface ProjectWithApps {
    projectId: number
    apps: string[]  // e.g., ["LINK_INDEXING", "CONTENT_FACTORY"]
}

// POST - Update project access for a user (with per-app access)
export async function POST(request: NextRequest) {
    try {
        const session = await auth()
        await requireAdmin(session)

        const body = await request.json()

        // Support both old format (projectIds) and new format (projectsWithApps)
        const { userId, projectIds, projectsWithApps } = body

        if (!userId) {
            return NextResponse.json(
                { success: false, error: 'userId is required' },
                { status: 400 }
            )
        }

        // Delete all existing access for this user (including app access)
        await prisma.projectAccess.deleteMany({
            where: { userId }
        })

        // If using new format with app access
        if (projectsWithApps && Array.isArray(projectsWithApps)) {
            for (const item of projectsWithApps as ProjectWithApps[]) {
                // Create project access
                const access = await prisma.projectAccess.create({
                    data: {
                        userId,
                        projectId: item.projectId,
                        role: 'MEMBER'
                    }
                })

                // Create app access entries
                for (const appType of item.apps) {
                    if (APP_TYPES.includes(appType as typeof APP_TYPES[number])) {
                        await prisma.projectAppAccess.create({
                            data: {
                                accessId: access.id,
                                appType
                            }
                        })
                    }
                }
            }
        }
        // Legacy format - just project IDs (give all apps by default)
        else if (projectIds && Array.isArray(projectIds)) {
            for (const projectId of projectIds) {
                const access = await prisma.projectAccess.create({
                    data: {
                        userId,
                        projectId,
                        role: 'MEMBER'
                    }
                })

                // Give access to LINK_INDEXING by default for legacy
                await prisma.projectAppAccess.create({
                    data: {
                        accessId: access.id,
                        appType: 'LINK_INDEXING'
                    }
                })
            }
        }

        return NextResponse.json({ success: true })
    } catch (error: any) {
        console.error('Failed to update project access:', error)
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        )
    }
}
