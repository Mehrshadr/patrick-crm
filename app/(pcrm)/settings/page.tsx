import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { DashboardLayout } from "@/components/dashboard-layout"
import { SettingsTab } from "@/components/settings/settings-tab"
import { checkPatrickAccess } from "@/lib/permissions"

export default async function SettingsPage() {
    const session = await auth()

    if (!session?.user) {
        redirect("/login")
    }

    // Check Patrick CRM access server-side (Settings requires at least VIEWER access)
    const { hasAccess } = await checkPatrickAccess(session.user.email || '')
    if (!hasAccess) {
        redirect("/projects")
    }

    return (
        <DashboardLayout user={session.user} title="⚙️ Settings">
            <SettingsTab />
        </DashboardLayout>
    )
}
