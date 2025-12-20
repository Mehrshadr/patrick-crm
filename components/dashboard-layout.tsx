"use client"

import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar'
import { AppSidebar } from '@/components/app-sidebar'
import { UserMenu } from '@/components/user-menu'
import { Separator } from '@/components/ui/separator'

interface DashboardLayoutProps {
    children: React.ReactNode
    user: {
        name?: string | null
        email?: string | null
        image?: string | null
    }
    title: string
    actions?: React.ReactNode
}

export function DashboardLayout({ children, user, title, actions }: DashboardLayoutProps) {
    return (
        <SidebarProvider>
            <AppSidebar />

            <SidebarInset className="overflow-hidden">
                {/* Header */}
                <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4 overflow-hidden">
                    <SidebarTrigger className="shrink-0" />
                    <Separator orientation="vertical" className="mr-2 h-4" />
                    <h1 className="text-lg font-semibold flex-1">{title}</h1>
                    <div className="flex gap-2 items-center">
                        {actions}
                        <UserMenu user={user} />
                    </div>
                </header>

                {/* Main Content */}
                <main className="flex-1 overflow-auto p-4 md:p-6">
                    {children}
                </main>
            </SidebarInset>
        </SidebarProvider>
    )
}
