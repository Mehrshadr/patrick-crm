import { getLeads } from "@/app/actions"
import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { DashboardLayout } from "@/components/dashboard-layout"
import { LeadsClientWrapper } from "@/components/leads/leads-client-wrapper"
import { checkPatrickAccess } from "@/lib/permissions"

export default async function LeadsPage() {
    const session = await auth()

    if (!session?.user) {
        redirect("/login")
    }

    // Check Patrick CRM access server-side
    const { hasAccess } = await checkPatrickAccess(session.user.email || '')
    if (!hasAccess) {
        redirect("/projects") // Redirect HIDDEN users to projects
    }

    const leads = await getLeads()

    return (
        <DashboardLayout
            user={session.user}
            title="📋 Lead Pipeline"
        >
            <LeadsClientWrapper leads={leads} />
        </DashboardLayout>
    )
}
