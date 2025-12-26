import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// POST - Track Patrick click (hidden analytics)
export async function POST(request: NextRequest) {
    try {
        // Upsert the click count
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

// GET - Get Patrick click count (for admin review)
export async function GET(request: NextRequest) {
    try {
        const counter = await prisma.analyticsCounter.findUnique({
            where: { key: 'patrick_clicks' }
        })

        return NextResponse.json({
            clicks: counter?.value || 0,
            updatedAt: counter?.updatedAt
        })
    } catch (error) {
        return NextResponse.json({ clicks: 0 })
    }
}
