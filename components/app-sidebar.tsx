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
    Zap
} from "lucide-react"

interface AppSidebarProps {
    activeTab: string
    onTabChange: (tab: string) => void
}

const MENU_ITEMS = [
    { id: 'board', label: 'Lead Pipeline', icon: LayoutDashboard },
    { id: 'automation', label: 'Automation', icon: Bot },
    { id: 'calendar', label: 'Calendar', icon: Calendar, disabled: true, badge: 'Soon' },
    { id: 'settings', label: 'Settings', icon: Settings, disabled: true },
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
                                        onClick={() => !item.disabled && onTabChange(item.id)}
                                        disabled={item.disabled}
                                        tooltip={item.label}
                                    >
                                        <item.icon className="h-4 w-4" />
                                        <span>{item.label}</span>
                                        {item.badge && (
                                            <span className="ml-auto text-[10px] bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded">
                                                {item.badge}
                                            </span>
                                        )}
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
