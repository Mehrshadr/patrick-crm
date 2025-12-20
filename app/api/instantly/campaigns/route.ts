import { NextResponse } from 'next/server'
import { listCampaigns } from '@/lib/instantly'

export async function GET() {
    try {
        const result = await listCampaigns()

        if (!result.success) {
            return NextResponse.json({
                success: false,
                error: result.error
            }, { status: 500 })
        }

        return NextResponse.json({
            success: true,
            campaigns: result.campaigns
        })

    } catch (error: any) {
        console.error('[API/Instantly/Campaigns] Error:', error)
        return NextResponse.json({
            success: false,
            error: error.message
        }, { status: 500 })
    }
}
