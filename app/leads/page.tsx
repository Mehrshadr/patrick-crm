import { getLeads } from "@/app/actions"
import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { DashboardLayout } from "@/components/dashboard-layout"
import { KanbanBoard } from "@/components/leads/kanban-board"
import { AddLeadButton } from "@/components/leads/add-lead-button"

export default async function LeadsPage() {
    const session = await auth()

    if (!session?.user) {
        redirect("/login")
    }

    const leads = await getLeads()

    return (
        <DashboardLayout
            user={session.user}
            title="📋 Lead Pipeline"
            actions={<AddLeadButton />}
        >
            <KanbanBoard leads={leads} />
        </DashboardLayout>
    )
}
