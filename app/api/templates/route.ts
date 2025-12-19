import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET - List all templates
export async function GET() {
    try {
        const templates = await db.messageTemplate.findMany({
            orderBy: { scenario: 'asc' }
        })

        return NextResponse.json({ success: true, templates })
    } catch (error) {
        console.error('Error fetching templates:', error)
        return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
    }
}

// POST - Create a new template
export async function POST(req: NextRequest) {
    try {
        const data = await req.json()
        const { ruleId, type, name, subject, body } = data

        const template = await db.messageTemplate.create({
            data: {
                name: name || 'New Template',
                type: type || 'EMAIL',
                scenario: `rule_${ruleId}_${type?.toLowerCase() || 'email'}`,
                subject: subject || null,
                body: body || '',
                ...(type === 'EMAIL'
                    ? { emailRules: { connect: { id: ruleId } } }
                    : { smsRules: { connect: { id: ruleId } } }
                )
            }
        })

        return NextResponse.json({ success: true, template })
    } catch (error) {
        console.error('Error creating template:', error)
        return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
    }
}

// PUT - Update a template
export async function PUT(req: NextRequest) {
    try {
        const data = await req.json()
        const { id, subject, body, name } = data

        if (!id) {
            return NextResponse.json({ success: false, error: 'Template ID required' }, { status: 400 })
        }

        const updateData: any = {}
        if (subject !== undefined) updateData.subject = subject
        if (body !== undefined) updateData.body = body
        if (name !== undefined) updateData.name = name

        const template = await db.messageTemplate.update({
            where: { id: Number(id) },
            data: updateData
        })

        return NextResponse.json({ success: true, template })
    } catch (error) {
        console.error('Error updating template:', error)
        return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
    }
}

