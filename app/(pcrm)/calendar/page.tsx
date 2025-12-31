import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { DashboardLayout } from "@/components/dashboard-layout"
import { CalendarTab } from "@/components/calendar/calendar-tab"
import { checkPatrickAccess } from "@/lib/permissions"

export default async function CalendarPage() {
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
        <DashboardLayout
            user={session.user}
            title="📅 Calendar"
        >
            <CalendarTab />
        </DashboardLayout>
    )
}
