import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { DashboardLayout } from "@/components/dashboard-layout"
import { CalendarTab } from "@/components/calendar/calendar-tab"

export default async function CalendarPage() {
    const session = await auth()

    if (!session?.user) {
        redirect("/login")
    }

    return (
        <DashboardLayout user={session.user} title="📅 Calendar">
            <CalendarTab />
        </DashboardLayout>
    )
}
