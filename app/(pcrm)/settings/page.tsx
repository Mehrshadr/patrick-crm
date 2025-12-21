import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { DashboardLayout } from "@/components/dashboard-layout"
import { SettingsTab } from "@/components/settings/settings-tab"

export default async function SettingsPage() {
    const session = await auth()

    if (!session?.user) {
        redirect("/login")
    }

    return (
        <DashboardLayout user={session.user} title="⚙️ Settings">
            <SettingsTab />
        </DashboardLayout>
    )
}
