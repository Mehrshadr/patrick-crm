"use client"

import { useState, useMemo } from "react"
import { Lead } from "@/app/actions"
import { KanbanBoard } from "./kanban-board"
import { AddLeadButton } from "./add-lead-button"
import { Input } from "@/components/ui/input"
import { Search, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useUserAccess } from "@/lib/user-access"

interface LeadsClientWrapperProps {
    leads: Lead[]
}

export function LeadsClientWrapper({ leads }: LeadsClientWrapperProps) {
    const [searchQuery, setSearchQuery] = useState("")
    const userAccess = useUserAccess()

    const filteredLeads = useMemo(() => {
        if (!searchQuery.trim()) return leads

        const query = searchQuery.toLowerCase()
        return leads.filter(lead =>
            lead.name?.toLowerCase().includes(query) ||
            lead.email?.toLowerCase().includes(query) ||
            lead.phone?.toLowerCase().includes(query) ||
            lead.website?.toLowerCase().includes(query) ||
            lead.status?.toLowerCase().includes(query) ||
            lead.subStatus?.toLowerCase().includes(query)
        )
    }, [leads, searchQuery])

    return (
        <div className="flex flex-col h-full">
            {/* Header with Search and Add Button */}
            <div className="flex items-center gap-3 mb-4">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search leads..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9 pr-9"
                    />
                    {searchQuery && (
                        <Button
                            variant="ghost"
                            size="icon"
                            className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6"
                            onClick={() => setSearchQuery("")}
                        >
                            <X className="h-3 w-3" />
                        </Button>
                    )}
                </div>
                {searchQuery && (
                    <span className="text-sm text-muted-foreground">
                        {filteredLeads.length} of {leads.length} leads
                    </span>
                )}
                {/* Only show Add Lead button for EDITOR */}
                {userAccess.isEditor && (
                    <div className="ml-auto">
                        <AddLeadButton />
                    </div>
                )}
            </div>

            {/* Kanban Board */}
            <KanbanBoard leads={filteredLeads} />
        </div>
    )
}

