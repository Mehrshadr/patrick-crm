import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { DashboardLayout } from "@/components/dashboard-layout"
import { WorkflowsTab } from "@/components/automation/workflows-tab"
import { checkPatrickAccess } from "@/lib/permissions"

export default async function AutomationPage() {
    const session = await auth()

    if (!session?.user) {
        redirect("/login")
    }

    // Check Patrick CRM access server-side
    const { hasAccess } = await checkPatrickAccess(session.user.email || '')
    if (!hasAccess) {
        redirect("/projects")
    }

    return (
        <DashboardLayout user={session.user} title="🤖 Automation Workflows">
            <WorkflowsTab />
        </DashboardLayout>
    )
}
