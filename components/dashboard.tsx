"use client"

import { useState } from 'react'
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar'
import { AppSidebar } from '@/components/app-sidebar'
import { KanbanBoard } from '@/components/leads/kanban-board'
import { DataTable } from '@/components/leads/data-table'
import { WorkflowsTab } from '@/components/automation/workflows-tab'
import { ExecutionsTab } from '@/components/executions/executions-tab'
import { AddLeadButton } from '@/components/leads/add-lead-button'
import { CleanupButton } from '@/components/leads/cleanup-button'
import { UserMenu } from '@/components/user-menu'
import { columns } from '@/components/leads/columns'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import { Lead } from '@/app/actions'

interface DashboardProps {
    leads: Lead[]
    user: {
        name?: string | null
        email?: string | null
        image?: string | null
    }
}

export function Dashboard({ leads, user }: DashboardProps) {
    const [activeTab, setActiveTab] = useState('board')

    return (
        <SidebarProvider>
            <AppSidebar activeTab={activeTab} onTabChange={setActiveTab} />

            <SidebarInset>
                {/* Header */}
                <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
                    <SidebarTrigger className="-ml-1" />
                    <Separator orientation="vertical" className="mr-2 h-4" />
                    <h1 className="text-lg font-semibold flex-1">
                        {activeTab === 'board' && '📋 Lead Pipeline'}
                        {activeTab === 'automation' && '🤖 Automation Workflows'}
                        {activeTab === 'executions' && '⚡ Execution History'}
                        {activeTab === 'calendar' && '📅 Calendar'}
                        {activeTab === 'settings' && '⚙️ Settings'}
                    </h1>
                    <div className="flex gap-2 items-center">
                        {activeTab === 'board' && (
                            <>
                                <CleanupButton />
                                <AddLeadButton />
                            </>
                        )}
                        <UserMenu user={user} />
                    </div>
                </header>

                {/* Content */}
                <main className="flex-1 overflow-auto p-6">
                    {activeTab === 'board' && (
                        <div className="space-y-4">
                            <Tabs defaultValue="kanban" className="w-full">
                                <TabsList className="mb-4">
                                    <TabsTrigger value="kanban">Kanban</TabsTrigger>
                                    <TabsTrigger value="list">List</TabsTrigger>
                                </TabsList>
                                <TabsContent value="kanban">
                                    <KanbanBoard leads={leads} />
                                </TabsContent>
                                <TabsContent value="list" className="bg-white p-6 rounded-lg shadow-sm border">
                                    <DataTable columns={columns} data={leads} />
                                </TabsContent>
                            </Tabs>
                        </div>
                    )}

                    {activeTab === 'automation' && (
                        <div className="max-w-6xl">
                            <WorkflowsTab />
                        </div>
                    )}

                    {activeTab === 'executions' && (
                        <div className="max-w-6xl">
                            <ExecutionsTab />
                        </div>
                    )}

                    {activeTab === 'calendar' && (
                        <div className="flex items-center justify-center h-64 text-slate-500">
                            <div className="text-center">
                                <p className="text-4xl mb-4">📅</p>
                                <p className="font-medium">Calendar Sync Coming Soon</p>
                                <p className="text-sm">Connect your Calendly to see scheduled meetings</p>
                            </div>
                        </div>
                    )}

                    {activeTab === 'settings' && (
                        <div className="flex items-center justify-center h-64 text-slate-500">
                            <div className="text-center">
                                <p className="text-4xl mb-4">⚙️</p>
                                <p className="font-medium">Settings</p>
                                <p className="text-sm">API keys, integrations, and preferences</p>
                            </div>
                        </div>
                    )}
                </main>

                {/* Footer */}
                <footer className="border-t py-3 px-6 text-center">
                    <p className="text-xs text-slate-500">
                        ⚡ Powered by <span className="font-semibold text-slate-700">Patrick</span> from{' '}
                        <a href="https://mehrana.agency" target="_blank" className="text-blue-600 hover:underline">
                            Mehrana Agency
                        </a>
                    </p>
                </footer>
            </SidebarInset>
        </SidebarProvider>
    )
}
