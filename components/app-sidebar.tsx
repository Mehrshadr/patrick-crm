"use client"

import { useState, useEffect } from "react"
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
    FolderOpen,
    Brain,
    CheckSquare,
    Activity,
} from "lucide-react"

// PCRM Menu Items
const PCRM_ITEMS = [
    { id: 'leads', label: 'Lead Pipeline', icon: LayoutDashboard, href: '/leads' },
    { id: 'tasks', label: 'Tasks', icon: CheckSquare, href: '/tasks' },
    { id: 'automation', label: 'Automation', icon: Bot, href: '/automation' },
    { id: 'logs', label: 'Logs', icon: ClipboardList, href: '/logs' },
    { id: 'calendar', label: 'Calendar', icon: Calendar, href: '/calendar' },
]

interface Project {
    id: number
    name: string
    domain: string | null
}

export function AppSidebar() {
    const pathname = usePathname()
    const [patrickEnlarged, setPatrickEnlarged] = useState(false)
    const [projects, setProjects] = useState<Project[]>([])
    const isPcrm = !pathname.startsWith('/seo') && !pathname.startsWith('/projects')
    const isProjectsActive = pathname.startsWith('/projects')

    // Fetch projects for sidebar
    useEffect(() => {
        fetch('/api/seo/projects')
            .then(res => res.json())
            .then(data => setProjects(data))
            .catch(() => { })
    }, [])

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

                        {/* Projects Section */}
                        <Collapsible defaultOpen={isProjectsActive} className="group/projects">
                            <SidebarMenuItem>
                                <CollapsibleTrigger asChild>
                                    <SidebarMenuButton className="font-medium">
                                        <FolderOpen className="h-4 w-4" />
                                        <span>Projects</span>
                                        <ChevronDown className="ml-auto h-4 w-4 transition-transform group-data-[state=open]/projects:rotate-180" />
                                    </SidebarMenuButton>
                                </CollapsibleTrigger>
                                <CollapsibleContent>
                                    <SidebarMenuSub>
                                        {projects.map((project) => (
                                            <SidebarMenuSubItem key={project.id}>
                                                <SidebarMenuSubButton
                                                    asChild
                                                    isActive={pathname === `/projects/${project.id}` || pathname.startsWith(`/projects/${project.id}/`)}
                                                >
                                                    <Link href={`/projects/${project.id}`}>
                                                        <span>{project.name}</span>
                                                    </Link>
                                                </SidebarMenuSubButton>
                                            </SidebarMenuSubItem>
                                        ))}
                                        {projects.length === 0 && (
                                            <SidebarMenuSubItem>
                                                <span className="text-xs text-muted-foreground px-2">No projects yet</span>
                                            </SidebarMenuSubItem>
                                        )}
                                        {/* Divider */}
                                        <div className="my-2 border-t"></div>
                                        {/* Logs Link */}
                                        <SidebarMenuSubItem>
                                            <SidebarMenuSubButton
                                                asChild
                                                isActive={pathname === '/projects/logs'}
                                            >
                                                <Link href="/projects/logs">
                                                    <Activity className="h-4 w-4" />
                                                    <span>Activity Logs</span>
                                                </Link>
                                            </SidebarMenuSubButton>
                                        </SidebarMenuSubItem>
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
