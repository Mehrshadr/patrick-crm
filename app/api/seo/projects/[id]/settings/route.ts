import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// GET - Fetch project settings
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params

    try {
        const settings = await prisma.projectSettings.findUnique({
            where: { projectId: parseInt(id) }
        })

        return NextResponse.json({ settings })
    } catch (error) {
        console.error('Error fetching settings:', error)
        return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 })
    }
}

// PUT - Update project settings
export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params
    const data = await request.json()

    try {
        const settings = await prisma.projectSettings.upsert({
            where: { projectId: parseInt(id) },
            update: {
                cmsType: data.cmsType,
                cmsUrl: data.cmsUrl,
                cmsUsername: data.cmsUsername,
                cmsAppPassword: data.cmsAppPassword,
                cmsApiKey: data.cmsApiKey,
                shopifyToken: data.shopifyToken,
                shopifyStore: data.shopifyStore,
                brandStatement: data.brandStatement,
                cloudflareApiToken: data.cloudflareApiToken,
                cloudflareZoneId: data.cloudflareZoneId
            },
            create: {
                projectId: parseInt(id),
                cmsType: data.cmsType,
                cmsUrl: data.cmsUrl,
                cmsUsername: data.cmsUsername,
                cmsAppPassword: data.cmsAppPassword,
                cmsApiKey: data.cmsApiKey,
                shopifyToken: data.shopifyToken,
                shopifyStore: data.shopifyStore,
                brandStatement: data.brandStatement,
                cloudflareApiToken: data.cloudflareApiToken,
                cloudflareZoneId: data.cloudflareZoneId
            }
        })

        return NextResponse.json({ success: true, settings })
    } catch (error) {
        console.error('Error updating settings:', error)
        return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 })
    }
}
