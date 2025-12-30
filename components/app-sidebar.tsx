"use client"

import { useState, useEffect, useRef } from "react"
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
    Sparkles,
    Anchor,
    ImageIcon,
} from "lucide-react"
import { useUserAccess } from "@/lib/user-access"

// PCRM Menu Items - viewerVisible: true means VIEWER can see this item
const PCRM_ITEMS = [
    { id: 'leads', label: 'Lead Pipeline', icon: LayoutDashboard, href: '/leads', viewerVisible: true },
    { id: 'tasks', label: 'Tasks', icon: CheckSquare, href: '/tasks', viewerVisible: false },
    { id: 'automation', label: 'Automation', icon: Bot, href: '/automation', viewerVisible: false },
    { id: 'logs', label: 'Logs', icon: ClipboardList, href: '/logs', viewerVisible: false },
    { id: 'calendar', label: 'Calendar', icon: Calendar, href: '/calendar', viewerVisible: false },
]

interface Project {
    id: number
    name: string
    slug: string
    domain: string | null
}

// Extract active project slug from pathname
function getActiveProjectSlug(pathname: string): string | null {
    const match = pathname.match(/\/projects\/([^/]+)/)
    return match ? match[1] : null
}

export function AppSidebar() {
    const pathname = usePathname()
    const [patrickEnlarged, setPatrickEnlarged] = useState(false)
    const [projects, setProjects] = useState<Project[]>([])
    const userAccess = useUserAccess()
    const isPcrm = !pathname.startsWith('/seo') && !pathname.startsWith('/projects')
    const isProjectsActive = pathname.startsWith('/projects')

    // Refs for project items to enable scrolling
    const projectRefs = useRef<Map<string, HTMLDivElement>>(new Map())
    const activeProjectSlug = getActiveProjectSlug(pathname)

    // Controlled state for open projects
    const [openProjects, setOpenProjects] = useState<Record<number, boolean>>({})

    // Filter menu items based on user access
    const visibleMenuItems = PCRM_ITEMS.filter(item =>
        userAccess.isEditor || item.viewerVisible
    )

    // Fetch projects for sidebar
    const fetchProjects = async () => {
        try {
            const res = await fetch('/api/seo/projects')
            if (res.ok) {
                const data = await res.json()
                setProjects(data)
            }
        } catch (e) {
            console.error('Failed to fetch projects', e)
        }
    }

    useEffect(() => {
        fetchProjects()

        // Listen for updates (from drag-drop reorder)
        const handleUpdate = () => fetchProjects()
        window.addEventListener('project-update', handleUpdate)

        return () => window.removeEventListener('project-update', handleUpdate)
    }, [])

    // Scroll to active project and ensure it is OPEN
    // Scroll to active project and ensure it is OPEN
    useEffect(() => {
        // If projects aren't loaded yet, do nothing (wait for them)
        if (projects.length === 0) return

        if (activeProjectSlug) {
            const activeProject = projects.find(p => p.slug === activeProjectSlug)
            if (activeProject) {
                // Ensure it's open
                setOpenProjects(prev => ({ ...prev, [activeProject.id]: true }))

                // Scroll into view
                setTimeout(() => {
                    const ref = projectRefs.current.get(activeProjectSlug)
                    if (ref) {
                        ref.scrollIntoView({ behavior: 'smooth', block: 'center' })
                    }
                }, 100)
            } else {
                // Active slug exists but no matching project (e.g. /projects/logs)
                // We might want to collapse others or leave as is. User asked for "back to projects" (root) behavior.
                // For now, let's play safe and check if it's strictly root.
            }
        } else {
            // Path is exactly /projects (or doesn't match /projects/[slug])
            // Collapse all projects
            setOpenProjects({})
        }
    }, [activeProjectSlug, projects])


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
                        {/* PCRM Section - Only show if user has access */}
                        {!userAccess.isHidden && (
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
                                            {visibleMenuItems.map((item) => (
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
                        )}

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
                                        {projects.map((project) => {
                                            // Check if any of this project's tool pages is active
                                            const isProjectActive =
                                                pathname.includes(`/projects/${project.slug}`)

                                            return (
                                                <Collapsible
                                                    key={project.id}
                                                    open={!!openProjects[project.id]}
                                                    onOpenChange={(isOpen) => setOpenProjects(prev => ({ ...prev, [project.id]: isOpen }))}
                                                    className="group/project"
                                                >
                                                    <SidebarMenuSubItem>
                                                        <div
                                                            ref={(el) => {
                                                                if (el) projectRefs.current.set(project.slug, el)
                                                                else projectRefs.current.delete(project.slug)
                                                            }}
                                                            className="flex items-center w-full"
                                                        >
                                                            <Link
                                                                href={`/projects/${project.slug}`}
                                                                className="flex-1 flex items-center gap-2 px-2 py-1.5 text-sm hover:bg-slate-50 rounded-l min-w-0"
                                                                title={project.name}
                                                            >
                                                                <FolderOpen className="h-3 w-3 shrink-0" />
                                                                <span
                                                                    className="flex-1 min-w-0 whitespace-nowrap overflow-hidden text-left"
                                                                    style={{
                                                                        maskImage: 'linear-gradient(to right, black calc(100% - 24px), transparent 100%)',
                                                                        WebkitMaskImage: 'linear-gradient(to right, black calc(100% - 24px), transparent 100%)'
                                                                    }}
                                                                >
                                                                    {project.name}
                                                                </span>
                                                            </Link>
                                                            <CollapsibleTrigger asChild>
                                                                <button className="p-1.5 hover:bg-slate-100 rounded-r shrink-0">
                                                                    <ChevronDown className="h-3 w-3 shrink-0 transition-transform group-data-[state=open]/project:rotate-180" />
                                                                </button>
                                                            </CollapsibleTrigger>
                                                        </div>
                                                        <CollapsibleContent>
                                                            <div className="pl-4 space-y-1 py-1">
                                                                <Link
                                                                    href={`/projects/${project.slug}/link-indexing`}
                                                                    className={`flex items-center gap-2 px-2 py-1.5 rounded text-xs transition-colors ${pathname === `/projects/${project.slug}/link-indexing`
                                                                        ? 'bg-slate-100 text-slate-900 font-medium'
                                                                        : 'text-slate-600 hover:bg-slate-50'
                                                                        }`}
                                                                >
                                                                    <Link2 className="h-3 w-3" />
                                                                    Link Indexing
                                                                </Link>
                                                                <Link
                                                                    href={`/projects/${project.slug}/link-building`}
                                                                    className={`flex items-center gap-2 px-2 py-1.5 rounded text-xs transition-colors ${pathname === `/projects/${project.slug}/link-building`
                                                                        ? 'bg-slate-100 text-slate-900 font-medium'
                                                                        : 'text-slate-600 hover:bg-slate-50'
                                                                        }`}
                                                                >
                                                                    <Anchor className="h-3 w-3" />
                                                                    Link Building
                                                                </Link>
                                                                <Link
                                                                    href={`/projects/${project.slug}/content-factory`}
                                                                    className={`flex items-center gap-2 px-2 py-1.5 rounded text-xs transition-colors ${pathname === `/projects/${project.slug}/content-factory`
                                                                        ? 'bg-slate-100 text-slate-900 font-medium'
                                                                        : 'text-slate-600 hover:bg-slate-50'
                                                                        }`}
                                                                >
                                                                    <Sparkles className="h-3 w-3" />
                                                                    Content Factory
                                                                </Link>
                                                                <Link
                                                                    href={`/projects/${project.slug}/image-factory`}
                                                                    className={`flex items-center gap-2 px-2 py-1.5 rounded text-xs transition-colors ${pathname === `/projects/${project.slug}/image-factory`
                                                                        ? 'bg-slate-100 text-slate-900 font-medium'
                                                                        : 'text-slate-600 hover:bg-slate-50'
                                                                        }`}
                                                                >
                                                                    <ImageIcon className="h-3 w-3" />
                                                                    Image Factory
                                                                </Link>
                                                            </div>
                                                        </CollapsibleContent>
                                                    </SidebarMenuSubItem>
                                                </Collapsible>
                                            )
                                        })}
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

                {/* Patrick Easter Egg */}
                <div className="flex justify-center mb-2">
                    <img
                        src="/patrick.png"
                        alt="Patrick"
                        onClick={() => {
                            setPatrickEnlarged(true)
                            setTimeout(() => setPatrickEnlarged(false), 1500)
                            // Hidden counter - track Patrick clicks
                            fetch('/api/analytics/patrick-click', { method: 'POST' }).catch(() => { })
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
