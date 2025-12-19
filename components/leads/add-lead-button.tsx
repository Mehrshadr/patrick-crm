"use client"

import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import { useState } from "react"
import { LeadDialog } from "./lead-dialog"

export function AddLeadButton() {
    const [open, setOpen] = useState(false)

    return (
        <>
            <Button onClick={() => setOpen(true)}>
                <Plus className="mr-2 h-4 w-4" /> Add Lead
            </Button>
            <LeadDialog open={open} onOpenChange={setOpen} />
        </>
    )
}
