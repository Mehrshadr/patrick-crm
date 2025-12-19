import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET - Get all settings or a specific setting
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url)
        const key = searchParams.get('key')

        if (key) {
            const setting = await db.appSettings.findUnique({
                where: { key }
            })
            return NextResponse.json({ success: true, setting })
        }

        const settings = await db.appSettings.findMany()
        return NextResponse.json({ success: true, settings })
    } catch (error) {
        console.error('Error fetching settings:', error)
        return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
    }
}

// POST - Create or update a setting
export async function POST(req: NextRequest) {
    try {
        const data = await req.json()
        const { key, value } = data

        if (!key) {
            return NextResponse.json({ success: false, error: 'Key is required' }, { status: 400 })
        }

        const setting = await db.appSettings.upsert({
            where: { key },
            update: { value: value || '' },
            create: { key, value: value || '' }
        })

        return NextResponse.json({ success: true, setting })
    } catch (error) {
        console.error('Error saving setting:', error)
        return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
    }
}
