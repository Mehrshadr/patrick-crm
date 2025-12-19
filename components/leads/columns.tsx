"use client"

import { ColumnDef } from "@tanstack/react-table"
import { Lead } from "@/app/actions"
import { Badge } from "@/components/ui/badge"
import { format } from "date-fns"
import { LeadActions } from "./lead-actions"
import { getFriendlyStatusLabel, getStageForStatus, STAGE_CONFIG } from "@/lib/status-mapping"

export const columns: ColumnDef<Lead>[] = [
    {
        accessorKey: "name",
        header: "Name",
    },
    {
        accessorKey: "phone",
        header: "Phone",
    },
    {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => {
            const status = row.getValue("status") as string
            const stage = getStageForStatus(status)
            const config = STAGE_CONFIG[stage]
            const label = getFriendlyStatusLabel(status)

            return (
                <Badge variant="outline" className={`${config.color} border`}>
                    {label}
                </Badge>
            )
        },
        filterFn: (row, id, value) => {
            return value.includes(row.getValue(id))
        },
    },
    {
        accessorKey: "call1Outcome",
        header: "Call 1",
    },
    /*
    {
      accessorKey: "meeting1Outcome",
      header: "Meeting 1",
    },
    {
      accessorKey: "meeting2Outcome",
      header: "Meeting 2",
    },
    {
      accessorKey: "meeting3Outcome",
      header: "Closing",
    },
    */
    {
        accessorKey: "updatedAt",
        header: "Last Update",
        cell: ({ row }) => {
            const val = row.getValue("updatedAt") as Date
            if (!val) return "-"
            try {
                return format(new Date(val), "PP p")
            } catch {
                return val
            }
        },
    },
    {
        id: "actions",
        cell: ({ row }) => <LeadActions lead={row.original} />
    },
]
