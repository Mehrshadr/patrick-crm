import { db } from './db'

export async function logActivity(data: {
    category: string
    action: string
    entityType?: string
    entityId?: number
    entityName?: string
    description: string
    details?: any
    userId?: string
    userName?: string
}) {
    try {
        await db.activityLog.create({
            data: {
                category: data.category,
                action: data.action,
                entityType: data.entityType,
                entityId: data.entityId,
                entityName: data.entityName,
                description: data.description,
                details: data.details ? JSON.stringify(data.details) : null,
                userId: data.userId,
                userName: data.userName,
            }
        })
    } catch (e) {
        console.error('Failed to log activity:', e)
    }
}
