"use client"

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { toast } from 'sonner'
import { Save, Mail, Eye, EyeOff, Users, Search, Brain, FileText, Sparkles, ChevronDown, Settings, Plug } from 'lucide-react'
import { UsersTab } from './users-tab'
import { GoogleConnectionCard } from '@/components/seo/google-connection-card'
import { IntegrationsSettings } from './integrations-settings'

export function SettingsTab() {
    const [loading, setLoading] = useState(false)
    const [showPreview, setShowPreview] = useState(false)

    // Email settings - only signature
    const [signature, setSignature] = useState('')

    // Content Generator settings
    const [guidelines, setGuidelines] = useState('')
    const [aiRules, setAiRules] = useState('')
    const [contentGenLoading, setContentGenLoading] = useState(false)
    const [contentGenOpen, setContentGenOpen] = useState(true)
    const [isAdmin, setIsAdmin] = useState(false)

    useEffect(() => {
        loadSettings()
        loadContentGenSettings()
        checkAdminStatus()
    }, [])

    async function checkAdminStatus() {
        try {
            const res = await fetch('/api/users/me').then(r => r.json())
            setIsAdmin(res.user?.role === 'SUPER_ADMIN')
        } catch (e) {
            setIsAdmin(false)
        }
    }

    async function loadSettings() {
        try {
            const sigRes = await fetch('/api/settings?key=email_signature').then(r => r.json())
            if (sigRes.success && sigRes.setting) setSignature(sigRes.setting.value)
        } catch (e) {
            console.error('Failed to load settings:', e)
        }
    }

    async function loadContentGenSettings() {
        try {
            const res = await fetch('/api/settings/content-generator').then(r => r.json())
            if (res.success && res.config) {
                setGuidelines(res.config.guidelines || '')
                setAiRules(res.config.aiRules || '')
            }
        } catch (e) {
            console.error('Failed to load content generator settings:', e)
        }
    }

    async function saveSettings() {
        setLoading(true)
        try {
            await fetch('/api/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ key: 'email_signature', value: signature })
            })
            toast.success('Signature saved!')
        } catch (e) {
            toast.error('Failed to save settings')
        }
        setLoading(false)
    }

    async function saveContentGenSettings() {
        setContentGenLoading(true)
        try {
            const res = await fetch('/api/settings/content-generator', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ guidelines, aiRules })
            }).then(r => r.json())

            if (res.success) {
                toast.success('Content Generator settings saved!')
            } else {
                toast.error(res.error || 'Failed to save')
            }
        } catch (e) {
            toast.error('Failed to save settings')
        }
        setContentGenLoading(false)
    }

    return (
        <div className="h-full flex flex-col overflow-hidden">
            {/* Consistent Header */}
            <div className="shrink-0 p-4 border-b">
                <div className="flex items-center gap-2">
                    <Settings className="h-5 w-5 text-muted-foreground" />
                    <div>
                        <h1 className="text-lg font-semibold">Settings</h1>
                        <p className="text-xs text-muted-foreground">
                            Configure your CRM and SEO tools
                        </p>
                    </div>
                </div>
            </div>

            {/* Content Area - Scrollable */}
            <div className="flex-1 overflow-auto p-4 md:p-6">
                <Tabs defaultValue="patrick" className="space-y-6">
                    {/* Responsive Tabs */}
                    <TabsList className="flex flex-wrap h-auto gap-1 p-1">
                        <TabsTrigger value="patrick" className="flex items-center gap-1.5 text-sm px-3 py-2">
                            <Brain className="h-4 w-4" />
                            <span className="hidden sm:inline">Patrick</span> CRM
                        </TabsTrigger>
                        <TabsTrigger value="seo" className="flex items-center gap-1.5 text-sm px-3 py-2">
                            <Search className="h-4 w-4" />
                            SEO <span className="hidden sm:inline">Tools</span>
                        </TabsTrigger>
                        <TabsTrigger value="users" className="flex items-center gap-1.5 text-sm px-3 py-2">
                            <Users className="h-4 w-4" />
                            Users
                        </TabsTrigger>
                        {isAdmin && (
                            <TabsTrigger value="integrations" className="flex items-center gap-1.5 text-sm px-3 py-2">
                                <Plug className="h-4 w-4" />
                                Integrations
                            </TabsTrigger>
                        )}
                    </TabsList>

                    {/* Patrick CRM Settings */}
                    <TabsContent value="patrick" className="space-y-4 mt-4">
                        <div className="max-w-2xl space-y-4">
                            {/* Email Signature Card */}
                            <Card>
                                <CardHeader className="pb-3">
                                    <CardTitle className="flex items-center gap-2 text-base">
                                        <Mail className="h-4 w-4" />
                                        Email Signature
                                    </CardTitle>
                                    <CardDescription className="text-xs">
                                        Global signature added to all emails (use {'{signature}'} in templates)
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <Label className="text-sm">HTML Signature</Label>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => setShowPreview(!showPreview)}
                                            className="h-7 text-xs gap-1"
                                        >
                                            {showPreview ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                                            {showPreview ? 'Edit' : 'Preview'}
                                        </Button>
                                    </div>
                                    {showPreview ? (
                                        <div
                                            className="border rounded-lg p-4 min-h-[150px] bg-white prose prose-sm max-w-none"
                                            dangerouslySetInnerHTML={{ __html: signature || '<em class="text-gray-400">No signature set</em>' }}
                                        />
                                    ) : (
                                        <Textarea
                                            value={signature}
                                            onChange={(e) => setSignature(e.target.value)}
                                            className="h-[150px] font-mono text-xs"
                                            placeholder={`<p>Kind Regards,</p>
<p><strong>Your Name</strong><br/>
Your Title | <a href="https://mehrana.agency">Mehrana Agency</a></p>`}
                                        />
                                    )}

                                    <div className="flex justify-end">
                                        <Button size="sm" onClick={saveSettings} disabled={loading}>
                                            <Save className="mr-1.5 h-3.5 w-3.5" />
                                            {loading ? 'Saving...' : 'Save'}
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Info Card */}
                            <Card className="bg-blue-50 border-blue-200">
                                <CardContent className="p-3">
                                    <p className="text-xs text-blue-700">
                                        <strong>💡 Tip:</strong> Sender Name and Reply-To are now configured per-email in each automation step.
                                    </p>
                                </CardContent>
                            </Card>
                        </div>
                    </TabsContent>

                    {/* SEO Tools Settings */}
                    <TabsContent value="seo" className="space-y-4 mt-4">
                        <div className="max-w-2xl space-y-4">
                            {/* Google Search Console */}
                            <Card>
                                <CardHeader className="pb-3">
                                    <CardTitle className="flex items-center gap-2 text-base">
                                        <Search className="h-4 w-4" />
                                        Google Search Console
                                    </CardTitle>
                                    <CardDescription className="text-xs">
                                        Connect for URL indexing and status checks
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <GoogleConnectionCard />
                                </CardContent>
                            </Card>

                            {/* Content Generator Settings */}
                            <Card>
                                <Collapsible open={contentGenOpen} onOpenChange={setContentGenOpen}>
                                    <CardHeader className="pb-3 cursor-pointer" onClick={() => setContentGenOpen(!contentGenOpen)}>
                                        <CollapsibleTrigger asChild>
                                            <div className="flex items-center justify-between w-full">
                                                <div>
                                                    <CardTitle className="flex items-center gap-2 text-base">
                                                        <Sparkles className="h-4 w-4" />
                                                        Content Factory
                                                    </CardTitle>
                                                    <CardDescription className="text-xs">
                                                        Global guidelines and AI rules
                                                    </CardDescription>
                                                </div>
                                                <ChevronDown className={`h-4 w-4 transition-transform ${contentGenOpen ? 'rotate-180' : ''}`} />
                                            </div>
                                        </CollapsibleTrigger>
                                    </CardHeader>
                                    <CollapsibleContent>
                                        <CardContent className="space-y-4 pt-0">
                                            {/* Content Guidelines */}
                                            <div className="space-y-2">
                                                <Label className="flex items-center gap-1.5 text-sm">
                                                    <FileText className="h-3.5 w-3.5" />
                                                    Content Guidelines
                                                </Label>
                                                <p className="text-xs text-muted-foreground">
                                                    Tone, style, formatting rules, etc.
                                                </p>
                                                <Textarea
                                                    value={guidelines}
                                                    onChange={(e) => setGuidelines(e.target.value)}
                                                    className="h-[120px] font-mono text-xs"
                                                    placeholder={`- Write in professional but friendly tone
- Use short paragraphs (2-3 sentences)
- Include relevant keywords naturally`}
                                                />
                                            </div>

                                            {/* AI Rules */}
                                            <div className="space-y-2">
                                                <Label className="flex items-center gap-1.5 text-sm">
                                                    <Sparkles className="h-3.5 w-3.5" />
                                                    AI Rules
                                                </Label>
                                                <p className="text-xs text-muted-foreground">
                                                    Specific instructions for AI
                                                </p>
                                                <Textarea
                                                    value={aiRules}
                                                    onChange={(e) => setAiRules(e.target.value)}
                                                    className="h-[120px] font-mono text-xs"
                                                    placeholder={`- Never use "In today's world"
- Avoid starting with "However"
- Output content in HTML format`}
                                                />
                                            </div>

                                            <div className="flex justify-end">
                                                <Button size="sm" onClick={saveContentGenSettings} disabled={contentGenLoading}>
                                                    <Save className="mr-1.5 h-3.5 w-3.5" />
                                                    {contentGenLoading ? 'Saving...' : 'Save'}
                                                </Button>
                                            </div>
                                        </CardContent>
                                    </CollapsibleContent>
                                </Collapsible>
                            </Card>
                        </div>
                    </TabsContent>

                    {/* Users Tab */}
                    <TabsContent value="users" className="mt-4">
                        <div className="max-w-4xl">
                            <UsersTab />
                        </div>
                    </TabsContent>

                    {/* Integrations Tab - Admin Only */}
                    {isAdmin && (
                        <TabsContent value="integrations" className="mt-4">
                            <div className="max-w-2xl">
                                <IntegrationsSettings />
                            </div>
                        </TabsContent>
                    )}
                </Tabs>
            </div>
        </div>
    )
}
