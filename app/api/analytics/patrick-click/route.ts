import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// POST - Track Patrick click (hidden analytics with timestamp)
export async function POST(request: NextRequest) {
    try {
        const now = new Date()

        // Log individual click with timestamp details
        await prisma.patrickClick.create({
            data: {
                clickedAt: now,
                hour: now.getHours(),
                dayOfWeek: now.getDay(), // 0=Sunday, 6=Saturday
                date: now.toISOString().split('T')[0] // YYYY-MM-DD
            }
        })

        // Also update the counter for quick total
        await prisma.analyticsCounter.upsert({
            where: { key: 'patrick_clicks' },
            create: { key: 'patrick_clicks', value: 1 },
            update: { value: { increment: 1 } }
        })

        return NextResponse.json({ success: true })
    } catch (error) {
        // Silently fail - this is non-critical
        return NextResponse.json({ success: false })
    }
}

// GET - Get Patrick click analytics
export async function GET(request: NextRequest) {
    try {
        // Get total count
        const counter = await prisma.analyticsCounter.findUnique({
            where: { key: 'patrick_clicks' }
        })

        // Get clicks grouped by hour
        const clicksByHour = await prisma.patrickClick.groupBy({
            by: ['hour'],
            _count: { id: true },
            orderBy: { hour: 'asc' }
        })

        // Get clicks grouped by day of week
        const clicksByDay = await prisma.patrickClick.groupBy({
            by: ['dayOfWeek'],
            _count: { id: true },
            orderBy: { dayOfWeek: 'asc' }
        })

        // Get recent clicks (last 10)
        const recentClicks = await prisma.patrickClick.findMany({
            take: 10,
            orderBy: { clickedAt: 'desc' }
        })

        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

        return NextResponse.json({
            totalClicks: counter?.value || 0,
            byHour: clicksByHour.map(h => ({ hour: h.hour, clicks: h._count.id })),
            byDayOfWeek: clicksByDay.map(d => ({
                day: dayNames[d.dayOfWeek],
                dayNum: d.dayOfWeek,
                clicks: d._count.id
            })),
            recentClicks: recentClicks.map(c => ({
                clickedAt: c.clickedAt,
                hour: c.hour,
                day: dayNames[c.dayOfWeek]
            }))
        })
    } catch (error) {
        return NextResponse.json({ totalClicks: 0, byHour: [], byDayOfWeek: [], recentClicks: [] })
    }
}
