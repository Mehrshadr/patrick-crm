import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { DashboardLayout } from "@/components/dashboard-layout"
import { WorkflowsTab } from "@/components/automation/workflows-tab"

export default async function AutomationPage() {
    const session = await auth()

    if (!session?.user) {
        redirect("/login")
    }

    return (
        <DashboardLayout user={session.user} title="🤖 Automation Workflows">
            <WorkflowsTab />
        </DashboardLayout>
    )
}
