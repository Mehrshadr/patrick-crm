"use client"

import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar'
import { AppSidebar } from '@/components/app-sidebar'
import { Separator } from '@/components/ui/separator'
import { UserMenuWrapper } from '@/components/user-menu-wrapper'

export default function ProjectsLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <SidebarProvider>
            <AppSidebar />

            <SidebarInset className="overflow-hidden">
                {/* Header */}
                <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4 overflow-hidden">
                    <SidebarTrigger className="shrink-0" />
                    <Separator orientation="vertical" className="mr-2 h-4" />
                    <h1 className="text-lg font-semibold flex-1">📁 Projects</h1>
                    <UserMenuWrapper />
                </header>

                {/* Main Content */}
                <main className="flex-1 overflow-auto">
                    {children}
                </main>
            </SidebarInset>
        </SidebarProvider>
    )
}

