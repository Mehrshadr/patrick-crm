
import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { DashboardLayout } from "@/components/dashboard-layout"
import { TasksTab } from "@/components/tasks/tasks-tab"

export default async function TasksPage() {
    const session = await auth()

    if (!session?.user) {
        redirect("/login")
    }

    return (
        <DashboardLayout
            user={session.user}
            title="✅ Tasks"
        >
            <TasksTab />
        </DashboardLayout>
    )
}
