import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// GET - List activity logs with optional filters
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const category = searchParams.get('category')
        const entityType = searchParams.get('entityType')
        const limit = parseInt(searchParams.get('limit') || '50')

        const where: any = {}
        if (category) where.category = category
        if (entityType) where.entityType = entityType

        const logs = await prisma.activityLog.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            take: Math.min(limit, 200)
        })

        return NextResponse.json({ success: true, logs })
    } catch (error) {
        console.error('Error fetching activity logs:', error)
        return NextResponse.json({ success: false, error: 'Failed to fetch logs' }, { status: 500 })
    }
}

// POST - Create a new activity log
export async function POST(request: NextRequest) {
    try {
        const data = await request.json()

        if (!data.category || !data.action || !data.description) {
            return NextResponse.json(
                { success: false, error: 'category, action, and description are required' },
                { status: 400 }
            )
        }

        const log = await prisma.activityLog.create({
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

        return NextResponse.json({ success: true, log })
    } catch (error) {
        console.error('Error creating activity log:', error)
        return NextResponse.json({ success: false, error: 'Failed to create log' }, { status: 500 })
    }
}

// Helper to log activity (exported for use in other routes)
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
        await prisma.activityLog.create({
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
