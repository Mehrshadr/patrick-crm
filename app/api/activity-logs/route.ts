import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { logActivity } from '@/lib/activity'

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

        const logs = await db.activityLog.findMany({
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

        await logActivity(data)

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Error creating activity log:', error)
        return NextResponse.json({ success: false, error: 'Failed to create log' }, { status: 500 })
    }
}
