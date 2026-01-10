import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { UserMenuWrapper } from "@/components/user-menu-wrapper"
import { SessionProvider } from "next-auth/react"

export default function CrawlLabLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <SessionProvider>
            <SidebarProvider>
                <AppSidebar />
                <SidebarInset>
                    <header className="flex h-16 items-center gap-4 border-b bg-background px-6">
                        <SidebarTrigger className="-ml-2" />
                        <div className="flex-1" />
                        <UserMenuWrapper />
                    </header>
                    <main className="flex-1 overflow-hidden flex flex-col bg-slate-50">
                        {children}
                    </main>
                </SidebarInset>
            </SidebarProvider>
        </SessionProvider>
    )
}
