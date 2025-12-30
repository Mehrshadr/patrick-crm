import { prisma } from "@/lib/prisma"

export type ActivityCategory =
    | 'CONTENT_FACTORY'
    | 'LINK_INDEXING'
    | 'LINK_BUILDING'
    | 'IMAGE_FACTORY'
    | 'SYSTEM'
    | 'AUTOMATION'
    | 'LEAD'
    | 'EMAIL'
    | 'SMS'

export type ActivityAction =
    | 'CREATED'
    | 'UPDATED'
    | 'DELETED'
    | 'GENERATED'
    | 'SUBMITTED'
    | 'CHECKED'
    | 'COMPRESSED'
    | 'EXECUTED'
    | 'FAILED'
    | 'SENT'

interface LogActivityParams {
    userId?: string | null
    userName?: string | null
    projectId?: number | null
    category: ActivityCategory | string
    action: ActivityAction | string
    description: string
    details?: any
    entityType?: string
    entityId?: number
    entityName?: string
}

/**
 * Centralized logger for user activities
 */
export async function logActivity({
    userId,
    userName,
    projectId,
    category,
    action,
    description,
    details,
    entityType,
    entityId,
    entityName
}: LogActivityParams) {
    try {
        // Retrieve user name if only userId is provided
        if (userId && !userName) {
            const user = await prisma.user.findUnique({
                where: { email: userId }, // Assuming userId passed is email, or handle ID
                select: { name: true }
            })
            if (user) userName = user.name
        }

        await prisma.activityLog.create({
            data: {
                category,
                action,
                description,
                details: details ? JSON.stringify(details) : null,
                userId: userId || null,
                userName: userName || 'System',
                projectId: projectId || null,
                entityType,
                entityId,
                entityName
            }
        })
    } catch (error) {
        console.error('Failed to log activity:', error)
        // Fail silently to not block the main action
    }
}
