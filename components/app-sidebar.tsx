"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarRail,
} from "@/components/ui/sidebar"
import {
    LayoutDashboard,
    Bot,
    Calendar,
    Settings,
    Zap,
    ClipboardList
} from "lucide-react"

const MENU_ITEMS = [
    { id: 'leads', label: 'Lead Pipeline', icon: LayoutDashboard, href: '/leads' },
    { id: 'automation', label: 'Automation', icon: Bot, href: '/automation' },
    { id: 'logs', label: 'Logs', icon: ClipboardList, href: '/logs' },
    { id: 'calendar', label: 'Calendar', icon: Calendar, href: '/calendar' },
    { id: 'settings', label: 'Settings', icon: Settings, href: '/settings' },
]

export function AppSidebar() {
    const pathname = usePathname()

    return (
        <Sidebar collapsible="icon">
            <SidebarHeader className="p-4">
                <Link href="/leads" className="flex items-center gap-2">
                    <img
                        src="/mehrana-logo.png"
                        alt="Mehrana"
                        className="h-8 w-8 rounded-lg object-cover"
                    />
                    <span className="font-bold text-lg group-data-[collapsible=icon]:hidden">
                        PCRM
                    </span>
                </Link>
            </SidebarHeader>

            <SidebarContent>
                <SidebarGroup>
                    <SidebarGroupLabel>Main Menu</SidebarGroupLabel>
                    <SidebarGroupContent>
                        <SidebarMenu>
                            {MENU_ITEMS.map((item) => (
                                <SidebarMenuItem key={item.id}>
                                    <SidebarMenuButton
                                        asChild
                                        isActive={pathname === item.href || pathname.startsWith(item.href + '/')}
                                        tooltip={item.label}
                                    >
                                        <Link href={item.href}>
                                            <item.icon className="h-4 w-4" />
                                            <span>{item.label}</span>
                                        </Link>
                                    </SidebarMenuButton>
                                </SidebarMenuItem>
                            ))}
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>
            </SidebarContent>

            <SidebarFooter className="p-4">
                <div className="text-xs text-slate-500 group-data-[collapsible=icon]:hidden space-y-1">
                    <div className="font-medium text-slate-600">PCRM</div>
                    <div>A product by Mehrana Agency</div>
                    <div>© {new Date().getFullYear()} All rights reserved</div>
                </div>
            </SidebarFooter>

            <SidebarRail />
        </Sidebar>
    )
}
