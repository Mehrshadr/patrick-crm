
import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function GET() {
    try {
        const workflows = await prisma.workflow.findMany({
            include: {
                steps: {
                    orderBy: { order: 'asc' }
                },
                _count: {
                    select: { executions: true }
                }
            },
            orderBy: {
                createdAt: 'desc'
            }
        })

        return NextResponse.json({ success: true, workflows })
    } catch (error) {
        console.error('Error fetching workflows:', error)
        return NextResponse.json(
            { success: false, error: 'Failed to fetch workflows' },
            { status: 500 }
        )
    }
}

export async function POST(request: Request) {
    try {
        const data = await request.json()

        // Basic validation
        if (!data.name) {
            return NextResponse.json(
                { success: false, error: 'Name is required' },
                { status: 400 }
            )
        }

        const workflow = await prisma.workflow.create({
            data: {
                name: data.name,
                description: data.description || '',
                triggerType: data.triggerType || 'ON_STATUS_CHANGE',
                triggerStatus: data.triggerStatus,
                triggerSubStatus: data.triggerSubStatus,
                executionMode: data.executionMode || 'AUTO',
                pipelineStage: data.pipelineStage || null,
                isActive: data.isActive ?? true,
                requireApproval: data.requireApproval ?? true,
                // If creating with initial steps (optional)
                steps: data.steps ? {
                    create: data.steps.map((step: any, index: number) => ({
                        name: step.name,
                        type: step.type,
                        order: index + 1,
                        config: step.config ? JSON.stringify(step.config) : '{}'
                    }))
                } : undefined
            },
            include: {
                steps: true
            }
        })

        return NextResponse.json({ success: true, workflow })
    } catch (error) {
        console.error('Error creating workflow:', error)
        return NextResponse.json(
            { success: false, error: 'Failed to create workflow' },
            { status: 500 }
        )
    }
}
