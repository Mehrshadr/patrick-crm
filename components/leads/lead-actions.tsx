"use client"

import { Lead, deleteLead } from "@/app/actions"
import { Row } from "@tanstack/react-table"
import { MoreHorizontal, Pencil, Trash } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { LeadDialog } from "./lead-dialog"
import { toast } from "sonner"
import { useRouter } from "next/navigation"

interface LeadActionsProps {
    lead: Lead
}

export function LeadActions({ lead }: LeadActionsProps) {
    const [showEditDialog, setShowEditDialog] = useState(false)
    const router = useRouter()

    const handleDelete = async () => {
        // In a real app, confirmed with a dialog
        if (!confirm("Are you sure?")) return;

        await deleteLead(lead.id)
        toast.success("Lead deleted")
        router.refresh()
    }

    return (
        <>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="h-8 w-8 p-0">
                        <span className="sr-only">Open menu</span>
                        <MoreHorizontal className="h-4 w-4" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <DropdownMenuLabel>Actions</DropdownMenuLabel>
                    <DropdownMenuItem onClick={() => setShowEditDialog(true)}>
                        <Pencil className="mr-2 h-4 w-4" /> Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleDelete} className="text-destructive">
                        <Trash className="mr-2 h-4 w-4" /> Delete
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>

            <LeadDialog
                open={showEditDialog}
                onOpenChange={setShowEditDialog}
                lead={lead}
            />
        </>
    )
}
