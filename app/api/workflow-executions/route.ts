import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// POST - Start a workflow execution for a lead
export async function POST(request: NextRequest) {
    try {
        const { workflowId, leadId } = await request.json()

        if (!workflowId || !leadId) {
            return NextResponse.json({ success: false, error: 'workflowId and leadId required' }, { status: 400 })
        }

        // Create workflow execution
        const execution = await prisma.workflowExecution.create({
            data: {
                workflowId,
                leadId,
                status: 'ACTIVE',
                startDate: new Date(),
            },
            include: {
                workflow: {
                    include: { steps: { orderBy: { order: 'asc' } } }
                }
            }
        })

        // Log the start
        await prisma.workflowLog.create({
            data: {
                executionId: execution.id,
                stepId: null,
                logType: 'INFO',
                message: `Workflow "${execution.workflow.name}" started manually`,
            }
        })

        return NextResponse.json({ success: true, execution })
    } catch (error) {
        console.error('Error creating workflow execution:', error)
        return NextResponse.json({ success: false, error: 'Failed to create execution' }, { status: 500 })
    }
}

// GET - List executions (optionally by leadId)
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const leadId = searchParams.get('leadId')

        const where = leadId ? { leadId: parseInt(leadId) } : {}

        const executions = await prisma.workflowExecution.findMany({
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
