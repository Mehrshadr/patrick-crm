import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { DashboardLayout } from "@/components/dashboard-layout"
import { SettingsTab } from "@/components/settings/settings-tab"

export default async function SettingsPage() {
    // DEV_BYPASS: Skip auth and use fake user
    let user = { email: 'dev@mehrana.agency', name: 'Dev User', role: 'SUPER_ADMIN' }

    if (process.env.DEV_BYPASS !== 'true') {
        const session = await auth()
        if (!session?.user) {
            redirect("/login")
        }
        user = session.user as any
    }

    return (
        <DashboardLayout user={user} title="⚙️ Settings">
            <SettingsTab />
        </DashboardLayout>
    )
}
