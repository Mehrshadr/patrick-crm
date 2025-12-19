
import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function GET(
    request: Request,
    { params }: { params: { id: string } }
) {
    try {
        const id = parseInt(params.id)
        if (isNaN(id)) {
            return NextResponse.json({ success: false, error: 'Invalid ID' }, { status: 400 })
        }

        const workflow = await prisma.workflow.findUnique({
            where: { id },
            include: {
                steps: {
                    orderBy: { order: 'asc' },
                    include: {
                        template: true // Include template details if step uses one
                    }
                }
            }
        })

        if (!workflow) {
            return NextResponse.json({ success: false, error: 'Workflow not found' }, { status: 404 })
        }

        return NextResponse.json({ success: true, workflow })
    } catch (error) {
        console.error('Error fetching workflow:', error)
        return NextResponse.json({ success: false, error: 'Failed to fetch workflow' }, { status: 500 })
    }
}

export async function PUT(
    request: Request,
    { params }: { params: { id: string } }
) {
    try {
        const id = parseInt(params.id)
        const data = await request.json()

        if (isNaN(id)) {
            return NextResponse.json({ success: false, error: 'Invalid ID' }, { status: 400 })
        }

        // Use transaction to update workflow and optionally replace steps
        const workflow = await prisma.$transaction(async (tx) => {
            // 1. Update main workflow details
            const updated = await tx.workflow.update({
                where: { id },
                data: {
                    name: data.name,
                    description: data.description,
                    triggerType: data.triggerType,
                    triggerStatus: data.triggerStatus,
                    triggerSubStatus: data.triggerSubStatus,
                    isActive: data.isActive,
                    requireApproval: data.requireApproval,
                    cancelOnStatus: data.cancelOnStatus,
                    cancelOnSubStatus: data.cancelOnSubStatus
                }
            })

            // 2. If steps are provided, replace them
            // This is a simple "full sync" approach. 
            // In a more complex app, we might diff the steps.
            if (data.steps) {
                // Delete existing steps
                await tx.workflowStep.deleteMany({
                    where: { workflowId: id }
                })

                // Create new steps
                if (data.steps.length > 0) {
                    await tx.workflowStep.createMany({
                        data: data.steps.map((step: any, index: number) => ({
                            workflowId: id,
                            name: step.name,
                            type: step.type,
                            order: index + 1,
                            config: typeof step.config === 'string' ? step.config : JSON.stringify(step.config || {}),
                            templateId: step.templateId || null // Optional relation
                        }))
                    })
                }
            }

            return updated
        })

        return NextResponse.json({ success: true, workflow })
    } catch (error) {
        console.error('Error updating workflows:', error)
        return NextResponse.json({ success: false, error: 'Failed to update workflow' }, { status: 500 })
    }
}

export async function DELETE(
    request: Request,
    { params }: { params: { id: string } }
) {
    try {
        const id = parseInt(params.id)
        if (isNaN(id)) {
            return NextResponse.json({ success: false, error: 'Invalid ID' }, { status: 400 })
        }

        await prisma.workflow.delete({
            where: { id }
        })

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Error deleting workflow:', error)
        return NextResponse.json({ success: false, error: 'Failed to delete workflow' }, { status: 500 })
    }
}
