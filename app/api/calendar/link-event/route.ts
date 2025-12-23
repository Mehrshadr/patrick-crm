
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// POST /api/calendar/link-event - Link a Google Calendar event to a Lead
export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { eventId, eventTitle, leadId } = body

        if (!eventId || !leadId) {
            return NextResponse.json({ error: "Event ID and Lead ID are required" }, { status: 400 })
        }

        // Check if link already exists
        const existingLink = await prisma.link.findFirst({
            where: {
                leadId: parseInt(leadId),
                url: eventId, // Storing event ID in URL field for now, or we could add a specific field
                type: "RECORDING" // Using RECORDING as a proxy for "Meeting" or we can add "EVENT" type
            }
        })

        if (existingLink) {
            return NextResponse.json({ success: true, link: existingLink, message: "Already linked" })
        }

        // Create the link
        const link = await prisma.link.create({
            data: {
                leadId: parseInt(leadId),
                title: eventTitle || "Calendar Event",
                url: eventId, // Storing event ID mainly for reference
                type: "RECORDING" // Maps to "Meeting Recording" usually, but serving as Event link here
            }
        })

        return NextResponse.json({ success: true, link })
    } catch (error) {
        console.error("Failed to link event:", error)
        return NextResponse.json({ error: "Failed to link event" }, { status: 500 })
    }
}
