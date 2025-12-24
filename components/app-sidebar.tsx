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
    SidebarMenuSub,
    SidebarMenuSubItem,
    SidebarMenuSubButton,
    SidebarRail,
} from "@/components/ui/sidebar"
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
    LayoutDashboard,
    Bot,
    Calendar,
    Settings,
    ClipboardList,
    Link2,
    ChevronDown,
    Search,
    Brain,
    CheckSquare,
} from "lucide-react"

// PCRM Menu Items
const PCRM_ITEMS = [
    { id: 'leads', label: 'Lead Pipeline', icon: LayoutDashboard, href: '/leads' },
    { id: 'tasks', label: 'Tasks', icon: CheckSquare, href: '/tasks' },
    { id: 'automation', label: 'Automation', icon: Bot, href: '/automation' },
    { id: 'logs', label: 'Logs', icon: ClipboardList, href: '/logs' },
    { id: 'calendar', label: 'Calendar', icon: Calendar, href: '/calendar' },
]

// SEO Tools Menu Items
const SEO_ITEMS = [
    {
        id: 'link-indexing',
        label: 'Link Indexing',
        icon: Link2,
        href: '/seo/link-indexing',
        children: [
            { id: 'li-dashboard', label: 'Dashboard', href: '/seo/link-indexing' },
            { id: 'li-projects', label: 'Projects', href: '/seo/link-indexing/projects' },
            { id: 'li-logs', label: 'Logs', href: '/seo/link-indexing/logs' },
        ]
    },
    // Future: Link Building, Keyword Tracker, etc.
]

export function AppSidebar() {
    const pathname = usePathname()
    const [patrickEnlarged, setPatrickEnlarged] = useState(false)
    const isPcrm = !pathname.startsWith('/seo')
    const isSeoActive = pathname.startsWith('/seo')

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
                <SidebarGroup className="py-0">
                    <SidebarMenu>
                        {/* PCRM Section */}
                        <Collapsible defaultOpen={isPcrm} className="group/pcrm">
                            <SidebarMenuItem>
                                <CollapsibleTrigger asChild>
                                    <SidebarMenuButton className="font-medium">
                                        <Brain className="h-4 w-4" />
                                        <span>Patrick</span>
                                        <ChevronDown className="ml-auto h-4 w-4 transition-transform group-data-[state=open]/pcrm:rotate-180" />
                                    </SidebarMenuButton>
                                </CollapsibleTrigger>
                                <CollapsibleContent>
                                    <SidebarMenuSub>
                                        {PCRM_ITEMS.map((item) => (
                                            <SidebarMenuSubItem key={item.id}>
                                                <SidebarMenuSubButton
                                                    asChild
                                                    isActive={pathname === item.href || pathname.startsWith(item.href + '/')}
                                                >
                                                    <Link href={item.href}>
                                                        <item.icon className="h-4 w-4" />
                                                        <span>{item.label}</span>
                                                    </Link>
                                                </SidebarMenuSubButton>
                                            </SidebarMenuSubItem>
                                        ))}
                                    </SidebarMenuSub>
                                </CollapsibleContent>
                            </SidebarMenuItem>
                        </Collapsible>

                        {/* SEO Tools Section */}
                        <Collapsible defaultOpen={isSeoActive} className="group/seo">
                            <SidebarMenuItem>
                                <CollapsibleTrigger asChild>
                                    <SidebarMenuButton className="font-medium">
                                        <Search className="h-4 w-4" />
                                        <span>SEO Tools</span>
                                        <ChevronDown className="ml-auto h-4 w-4 transition-transform group-data-[state=open]/seo:rotate-180" />
                                    </SidebarMenuButton>
                                </CollapsibleTrigger>
                                <CollapsibleContent>
                                    <SidebarMenuSub>
                                        {SEO_ITEMS.map((item) => (
                                            <Collapsible key={item.id} defaultOpen={pathname.startsWith(item.href)} className="group/tool">
                                                <SidebarMenuSubItem>
                                                    <CollapsibleTrigger asChild>
                                                        <SidebarMenuSubButton
                                                            isActive={pathname.startsWith(item.href)}
                                                            className="justify-between pr-2"
                                                        >
                                                            <span className="flex items-center gap-2">
                                                                <item.icon className="h-4 w-4" />
                                                                <span>{item.label}</span>
                                                            </span>
                                                            {item.children && (
                                                                <ChevronDown className="h-3 w-3 transition-transform group-data-[state=open]/tool:rotate-180" />
                                                            )}
                                                        </SidebarMenuSubButton>
                                                    </CollapsibleTrigger>
                                                    {item.children && (
                                                        <CollapsibleContent>
                                                            <SidebarMenuSub className="ml-4 border-l border-border/50">
                                                                {item.children.map((child) => (
                                                                    <SidebarMenuSubItem key={child.id}>
                                                                        <SidebarMenuSubButton
                                                                            asChild
                                                                            isActive={pathname === child.href}
                                                                            size="sm"
                                                                        >
                                                                            <Link href={child.href}>
                                                                                <span>{child.label}</span>
                                                                            </Link>
                                                                        </SidebarMenuSubButton>
                                                                    </SidebarMenuSubItem>
                                                                ))}
                                                            </SidebarMenuSub>
                                                        </CollapsibleContent>
                                                    )}
                                                </SidebarMenuSubItem>
                                            </Collapsible>
                                        ))}
                                    </SidebarMenuSub>
                                </CollapsibleContent>
                            </SidebarMenuItem>
                        </Collapsible>
                    </SidebarMenu>
                </SidebarGroup>
            </SidebarContent>

            <SidebarFooter className="p-4">
                {/* Settings Link */}
                <Link
                    href="/settings"
                    className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium mb-3 transition-colors ${pathname === '/settings' ? 'bg-slate-100 text-slate-900' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}
                >
                    <Settings className="h-4 w-4" />
                    <span className="group-data-[collapsible=icon]:hidden">Settings</span>
                </Link>

                {/* Patrick Easter Egg */}
                <div className="flex justify-center mb-2">
                    <img
                        src="/patrick.png"
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
                    <div className="font-medium text-slate-600">Mehrana Platform</div>
                    <div>© {new Date().getFullYear()} All rights reserved</div>
                </div>
            </SidebarFooter>

            <SidebarRail />
        </Sidebar>
    )
}
