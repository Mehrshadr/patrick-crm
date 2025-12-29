/**
 * Jarvis Flow Execution Engine
 * 
 * Executes automation flows by processing nodes in order,
 * logging each step, and handling errors gracefully.
 */

import { prisma } from "@/lib/prisma"

interface FlowNode {
    id: string
    type: string
    data: {
        label: string
        type: string
        config?: Record<string, any>
        connectionId?: number
    }
    position: { x: number; y: number }
}

interface FlowEdge {
    id: string
    source: string
    target: string
}

interface Flow {
    id: number
    projectId: number
    nodes: string
    edges: string
}

interface ExecutionContext {
    executionId: number
    projectId: number
    data: Record<string, any>
    connections: Map<number, any>
}

// Node executor functions
const nodeExecutors: Record<string, (node: FlowNode, ctx: ExecutionContext) => Promise<any>> = {

    // === TRIGGERS ===
    webhook: async (node, ctx) => {
        // Webhook trigger just passes through the trigger data
        return ctx.data
    },

    facebook_leads: async (node, ctx) => {
        // Facebook lead trigger - data comes from webhook
        return ctx.data
    },

    gravity_forms: async (node, ctx) => {
        // Gravity Forms trigger - data comes from webhook
        return ctx.data
    },

    // === ACTIONS ===
    monday: async (node, ctx) => {
        const config = node.data.config || {}
        const connectionId = node.data.connectionId

        if (!connectionId) throw new Error("No Monday.com connection configured")

        const connection = await getConnection(connectionId)
        const creds = JSON.parse(connection.credentials)

        const boardId = config.boardId || JSON.parse(connection.config || "{}").boardId
        if (!boardId) throw new Error("No board ID configured")

        // Create item in Monday
        const query = `
            mutation ($boardId: ID!, $itemName: String!, $columnValues: JSON) {
                create_item(board_id: $boardId, item_name: $itemName, column_values: $columnValues) {
                    id
                }
            }
        `

        const itemName = interpolate(config.itemName || ctx.data.name || "New Item", ctx.data)
        const columnValues = config.columnValues ? interpolateObject(config.columnValues, ctx.data) : {}

        const response = await fetch("https://api.monday.com/v2", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": creds.apiKey
            },
            body: JSON.stringify({
                query,
                variables: {
                    boardId: parseInt(boardId),
                    itemName,
                    columnValues: JSON.stringify(columnValues)
                }
            })
        })

        const result = await response.json()
        if (result.errors) throw new Error(result.errors[0].message)

        return { itemId: result.data.create_item.id }
    },

    instantly: async (node, ctx) => {
        const config = node.data.config || {}
        const connectionId = node.data.connectionId

        if (!connectionId) throw new Error("No Instantly connection configured")

        const connection = await getConnection(connectionId)
        const creds = JSON.parse(connection.credentials)
        const connConfig = JSON.parse(connection.config || "{}")

        const campaignId = config.campaignId || connConfig.campaignId
        if (!campaignId) throw new Error("No campaign ID configured")

        const email = interpolate(config.email || ctx.data.email, ctx.data)
        if (!email) throw new Error("No email provided")

        const response = await fetch("https://api.instantly.ai/api/v2/leads", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${creds.apiKey}`
            },
            body: JSON.stringify({
                campaign: campaignId,
                email,
                first_name: interpolate(config.firstName || ctx.data.first_name || ctx.data.name, ctx.data),
                phone: interpolate(config.phone || ctx.data.phone, ctx.data),
                skip_if_in_campaign: false
            })
        })

        if (!response.ok) {
            const err = await response.json().catch(() => ({}))
            throw new Error(`Instantly API error: ${err.message || response.status}`)
        }

        return { success: true }
    },

    mailchimp: async (node, ctx) => {
        const config = node.data.config || {}
        const connectionId = node.data.connectionId

        if (!connectionId) throw new Error("No Mailchimp connection configured")

        const connection = await getConnection(connectionId)
        const creds = JSON.parse(connection.credentials)
        const connConfig = JSON.parse(connection.config || "{}")

        const listId = config.listId || connConfig.listId
        const datacenter = connConfig.datacenter
        if (!listId || !datacenter) throw new Error("List ID or datacenter not configured")

        const email = interpolate(config.email || ctx.data.email, ctx.data)
        if (!email) throw new Error("No email provided")

        const response = await fetch(
            `https://${datacenter}.api.mailchimp.com/3.0/lists/${listId}/members`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Basic ${Buffer.from(`anystring:${creds.apiKey}`).toString("base64")}`
                },
                body: JSON.stringify({
                    email_address: email,
                    status: "subscribed",
                    merge_fields: {
                        FNAME: interpolate(config.firstName || ctx.data.first_name || ctx.data.name, ctx.data),
                        PHONE: interpolate(config.phone || ctx.data.phone, ctx.data)
                    }
                })
            }
        )

        if (!response.ok && response.status !== 400) {
            const err = await response.json().catch(() => ({}))
            throw new Error(`Mailchimp API error: ${err.detail || response.status}`)
        }

        return { success: true }
    },

    http: async (node, ctx) => {
        const config = node.data.config || {}
        const url = interpolate(config.url, ctx.data)
        const method = config.method || "POST"
        const headers = config.headers || {}
        const body = config.body ? interpolateObject(config.body, ctx.data) : ctx.data

        const response = await fetch(url, {
            method,
            headers: { "Content-Type": "application/json", ...headers },
            body: method !== "GET" ? JSON.stringify(body) : undefined
        })

        const result = await response.json().catch(() => ({}))
        return result
    },

    // === UTILITIES ===
    delay: async (node, ctx) => {
        const config = node.data.config || {}
        const seconds = config.seconds || 5
        await new Promise(resolve => setTimeout(resolve, seconds * 1000))
        return ctx.data
    },

    filter: async (node, ctx) => {
        const config = node.data.config || {}
        const field = config.field
        const operator = config.operator || "equals"
        const value = config.value

        const actualValue = ctx.data[field]
        let pass = false

        switch (operator) {
            case "equals":
                pass = actualValue === value
                break
            case "not_equals":
                pass = actualValue !== value
                break
            case "contains":
                pass = String(actualValue).includes(value)
                break
            case "exists":
                pass = actualValue !== undefined && actualValue !== null
                break
        }

        if (!pass) {
            throw new Error("FILTER_STOP") // Special error to stop execution
        }

        return ctx.data
    }
}

// Helper: Get connection by ID
async function getConnection(id: number) {
    const connection = await prisma.jarvisConnection.findUnique({ where: { id } })
    if (!connection) throw new Error(`Connection ${id} not found`)
    return connection
}

// Helper: Interpolate string with data
function interpolate(template: string | undefined, data: Record<string, any>): string {
    if (!template) return ""
    return template.replace(/\{\{(\w+)\}\}/g, (_, key) => data[key] || "")
}

// Helper: Interpolate object values
function interpolateObject(obj: Record<string, any>, data: Record<string, any>): Record<string, any> {
    const result: Record<string, any> = {}
    for (const [key, value] of Object.entries(obj)) {
        if (typeof value === "string") {
            result[key] = interpolate(value, data)
        } else if (typeof value === "object" && value !== null) {
            result[key] = interpolateObject(value, data)
        } else {
            result[key] = value
        }
    }
    return result
}

// Main execution function
export async function executeFlow(
    flow: Flow,
    executionId: number,
    triggerData: Record<string, any>
) {
    const startTime = Date.now()

    try {
        const nodes: FlowNode[] = JSON.parse(flow.nodes || "[]")
        const edges: FlowEdge[] = JSON.parse(flow.edges || "[]")

        // Build execution order (topological sort from trigger)
        const executionOrder = buildExecutionOrder(nodes, edges)

        const ctx: ExecutionContext = {
            executionId,
            projectId: flow.projectId,
            data: triggerData,
            connections: new Map()
        }

        // Execute each node in order
        for (const node of executionOrder) {
            const nodeStart = Date.now()
            const executor = nodeExecutors[node.data.type]

            if (!executor) {
                await logNodeExecution(executionId, node, "error", ctx.data, null, `Unknown node type: ${node.data.type}`, Date.now() - nodeStart)
                throw new Error(`Unknown node type: ${node.data.type}`)
            }

            try {
                const result = await executor(node, ctx)
                await logNodeExecution(executionId, node, "success", ctx.data, result, null, Date.now() - nodeStart)

                // Pass output to context for next node
                if (result && typeof result === "object") {
                    ctx.data = { ...ctx.data, ...result }
                }
            } catch (error: any) {
                if (error.message === "FILTER_STOP") {
                    await logNodeExecution(executionId, node, "skipped", ctx.data, null, "Filter condition not met", Date.now() - nodeStart)
                    break
                }
                await logNodeExecution(executionId, node, "error", ctx.data, null, error.message, Date.now() - nodeStart)
                throw error
            }
        }

        // Mark execution as success
        await prisma.jarvisExecution.update({
            where: { id: executionId },
            data: { status: "success", finishedAt: new Date() }
        })
    } catch (error: any) {
        // Mark execution as failed
        await prisma.jarvisExecution.update({
            where: { id: executionId },
            data: { status: "failed", finishedAt: new Date() }
        })
        console.error(`[Jarvis] Execution ${executionId} failed:`, error.message)
    }
}

// Build execution order from nodes and edges
function buildExecutionOrder(nodes: FlowNode[], edges: FlowEdge[]): FlowNode[] {
    const nodeMap = new Map(nodes.map(n => [n.id, n]))
    const order: FlowNode[] = []
    const visited = new Set<string>()

    // Find trigger node (start)
    const triggerNode = nodes.find(n => n.type === "trigger")
    if (!triggerNode) return []

    // BFS from trigger
    const queue = [triggerNode.id]
    while (queue.length > 0) {
        const nodeId = queue.shift()!
        if (visited.has(nodeId)) continue
        visited.add(nodeId)

        const node = nodeMap.get(nodeId)
        if (node) order.push(node)

        // Find connected nodes
        for (const edge of edges) {
            if (edge.source === nodeId && !visited.has(edge.target)) {
                queue.push(edge.target)
            }
        }
    }

    return order
}

// Log node execution
async function logNodeExecution(
    executionId: number,
    node: FlowNode,
    status: string,
    input: any,
    output: any,
    error: string | null,
    duration: number
) {
    await prisma.jarvisLog.create({
        data: {
            executionId,
            nodeId: node.id,
            nodeName: node.data.label,
            nodeType: node.data.type,
            status,
            input: JSON.stringify(input),
            output: output ? JSON.stringify(output) : null,
            error,
            duration
        }
    })
}
