import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

const DAILY_QUOTA = 200

// GET /api/seo/quota - Get today's API usage stats
export async function GET() {
    try {
        const todayStart = new Date()
        todayStart.setHours(0, 0, 0, 0)

        // Count successful submissions today
        const todayUsed = await prisma.indexingLog.count({
            where: {
                action: 'SUBMIT',
                status: 'SUCCESS',
                createdAt: {
                    gte: todayStart
                }
            }
        })

        return NextResponse.json({
            dailyQuota: DAILY_QUOTA,
            used: todayUsed,
            remaining: Math.max(0, DAILY_QUOTA - todayUsed)
        })
    } catch (error) {
        console.error('Failed to get quota:', error)
        return NextResponse.json({ error: 'Failed to get quota' }, { status: 500 })
    }
}
