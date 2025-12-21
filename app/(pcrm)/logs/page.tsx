import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { DashboardLayout } from "@/components/dashboard-layout"
import { LogsTab } from "@/components/logs/logs-tab"

export default async function LogsPage() {
    const session = await auth()

    if (!session?.user) {
        redirect("/login")
    }

    return (
        <DashboardLayout user={session.user} title="📋 Activity Logs">
            <LogsTab />
        </DashboardLayout>
    )
}
