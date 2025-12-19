
import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: idStr } = await params
        const id = parseInt(idStr)
        if (isNaN(id)) {
            return NextResponse.json({ success: false, error: 'Invalid ID' }, { status: 400 })
        }

        const workflow = await prisma.workflow.findUnique({
            where: { id },
            include: {
                steps: {
                    orderBy: { order: 'asc' },
                    include: {
                        template: true
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
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: idStr } = await params
        const id = parseInt(idStr)
        const data = await request.json()

        if (isNaN(id)) {
            return NextResponse.json({ success: false, error: 'Invalid ID' }, { status: 400 })
        }

        const workflow = await prisma.$transaction(async (tx) => {
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

            if (data.steps) {
                await tx.workflowStep.deleteMany({
                    where: { workflowId: id }
                })

                if (data.steps.length > 0) {
                    for (let i = 0; i < data.steps.length; i++) {
                        const step = data.steps[i]
                        await tx.workflowStep.create({
                            data: {
                                workflowId: id,
                                name: step.name,
                                type: step.type,
                                order: i + 1,
                                config: typeof step.config === 'string' ? step.config : JSON.stringify(step.config || {}),
                                templateId: step.templateId || null
                            }
                        })
                    }
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
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: idStr } = await params
        const id = parseInt(idStr)
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

