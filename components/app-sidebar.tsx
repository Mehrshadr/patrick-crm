"use client"

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

interface AppSidebarProps {
    activeTab: string
    onTabChange: (tab: string) => void
}

const MENU_ITEMS = [
    { id: 'board', label: 'Lead Pipeline', icon: LayoutDashboard },
    { id: 'automation', label: 'Automation', icon: Bot },
    { id: 'logs', label: 'Logs', icon: ClipboardList },
    { id: 'calendar', label: 'Calendar', icon: Calendar },
    { id: 'settings', label: 'Settings', icon: Settings },
]

export function AppSidebar({ activeTab, onTabChange }: AppSidebarProps) {
    return (
        <Sidebar collapsible="icon">
            <SidebarHeader className="p-4">
                <div className="flex items-center gap-2">
                    <div className="bg-indigo-600 text-white rounded-lg p-1.5">
                        <Zap className="h-5 w-5" />
                    </div>
                    <span className="font-bold text-lg group-data-[collapsible=icon]:hidden">
                        Patrick CRM
                    </span>
                </div>
            </SidebarHeader>

            <SidebarContent>
                <SidebarGroup>
                    <SidebarGroupLabel>Main Menu</SidebarGroupLabel>
                    <SidebarGroupContent>
                        <SidebarMenu>
                            {MENU_ITEMS.map((item) => (
                                <SidebarMenuItem key={item.id}>
                                    <SidebarMenuButton
                                        isActive={activeTab === item.id}
                                        onClick={() => onTabChange(item.id)}
                                        tooltip={item.label}
                                    >
                                        <item.icon className="h-4 w-4" />
                                        <span>{item.label}</span>
                                    </SidebarMenuButton>
                                </SidebarMenuItem>
                            ))}
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>
            </SidebarContent>

            <SidebarFooter className="p-4">
                <div className="text-xs text-slate-500 group-data-[collapsible=icon]:hidden">
                    © 2025 Mehrana Agency
                </div>
            </SidebarFooter>

            <SidebarRail />
        </Sidebar>
    )
}
