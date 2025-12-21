"use client"

import { useState } from "react"
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
    const [patrickEnlarged, setPatrickEnlarged] = useState(false)

    return (
        <Sidebar collapsible="icon">
            <SidebarHeader className="p-4">
                <Link href="/leads" className="flex items-center">
                    {/* Full logo - shown when sidebar is expanded */}
                    <img
                        src="https://mehrana.agency/wp-content/uploads/2023/06/Mehrana-Logo-Black.png"
                        alt="Mehrana Agency"
                        className="h-8 object-contain group-data-[collapsible=icon]:hidden"
                    />
                    {/* Icon only - shown when sidebar is collapsed */}
                    <img
                        src="/mehrana-icon.png"
                        alt="Mehrana"
                        className="h-8 w-8 object-contain hidden group-data-[collapsible=icon]:block"
                    />
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
                {/* Patrick Easter Egg */}
                <div className="flex justify-center mb-2">
                    <img
                        src="/patrick-mascot.png"
                        alt="Patrick"
                        onClick={() => {
                            setPatrickEnlarged(true)
                            setTimeout(() => setPatrickEnlarged(false), 1500)
                        }}
                        className={`cursor-pointer select-none transition-all duration-500 ease-out ${patrickEnlarged
                            ? 'h-20 w-20 opacity-100 rotate-12 scale-125'
                            : 'h-8 w-8 opacity-15 hover:opacity-40'
                            }`}
                        title="Hi, I'm Patrick! 🌟"
                    />
                </div>
                <div className="text-xs text-slate-500 group-data-[collapsible=icon]:hidden space-y-1 text-center">
                    <div className="font-medium text-slate-600">PCRM</div>
                    <div>A product by Mehrana Agency</div>
                    <div>© {new Date().getFullYear()} All rights reserved</div>
                </div>
            </SidebarFooter>

            <SidebarRail />
        </Sidebar>
    )
}
