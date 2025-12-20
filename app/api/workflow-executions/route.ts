import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { auth } from '@/lib/auth'
import { processWorkflow } from '@/lib/workflow-engine'

// POST - Start a workflow execution for a lead
export async function POST(request: NextRequest) {
    try {
        const { workflowId, leadId } = await request.json()
        const session = await auth()
        const accessToken = (session as any)?.accessToken
        const refreshToken = (session as any)?.refreshToken

        if (!workflowId || !leadId) {
            return NextResponse.json({ success: false, error: 'workflowId and leadId required' }, { status: 400 })
        }

        const res = await processWorkflow({
            workflowId,
            leadId,
            accessToken,
            refreshToken,
            triggeredBy: 'MANUAL'
        })

        if (res.success) {
            return NextResponse.json({ success: true, executionId: res.executionId })
        } else {
            return NextResponse.json({ success: false, error: res.error }, { status: 500 })
        }
    } catch (error) {
        console.error('Error starting workflow execution:', error)
        return NextResponse.json({ success: false, error: 'Failed to start execution' }, { status: 500 })
    }
}


// GET - List executions (optionally by leadId)
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const leadId = searchParams.get('leadId')

        const where = leadId ? { leadId: parseInt(leadId) } : {}

        const executions = await db.workflowExecution.findMany({
            where,
            include: {
                workflow: { select: { id: true, name: true } },
                lead: { select: { id: true, name: true } },
                _count: { select: { logs: true } }
            },
            orderBy: { id: 'desc' },
            take: 50
        })

        return NextResponse.json({ success: true, executions })
    } catch (error) {
        console.error('Error fetching executions:', error)
        return NextResponse.json({ success: false, error: 'Failed to fetch executions' }, { status: 500 })
    }
}
