"use client"

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { toast } from 'sonner'
import { Save, Mail, Eye, EyeOff, Users, Search, Brain, FileText, Sparkles, ChevronDown } from 'lucide-react'
import { UsersTab } from './users-tab'
import { GoogleConnectionCard } from '@/components/seo/google-connection-card'

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

    useEffect(() => {
        loadSettings()
        loadContentGenSettings()
    }, [])

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
        <Tabs defaultValue="patrick" className="space-y-6">
            <TabsList className="grid w-full max-w-lg grid-cols-3">
                <TabsTrigger value="patrick" className="flex items-center gap-2">
                    <Brain className="h-4 w-4" />
                    Patrick CRM
                </TabsTrigger>
                <TabsTrigger value="seo" className="flex items-center gap-2">
                    <Search className="h-4 w-4" />
                    SEO Tools
                </TabsTrigger>
                <TabsTrigger value="users" className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Users
                </TabsTrigger>
            </TabsList>

            {/* Patrick CRM Settings */}
            <TabsContent value="patrick" className="space-y-6 max-w-3xl">
                {/* Email Signature Card */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Mail className="h-5 w-5" />
                            Email Signature
                        </CardTitle>
                        <CardDescription>
                            Global signature added to all emails (use {'{signature}'} in templates)
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center justify-between">
                            <Label>HTML Signature</Label>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setShowPreview(!showPreview)}
                                className="h-6 text-xs gap-1"
                            >
                                {showPreview ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                                {showPreview ? 'Edit' : 'Preview'}
                            </Button>
                        </div>
                        {showPreview ? (
                            <div
                                className="border rounded-lg p-4 min-h-[200px] bg-white prose prose-sm max-w-none"
                                dangerouslySetInnerHTML={{ __html: signature || '<em class="text-gray-400">No signature set</em>' }}
                            />
                        ) : (
                            <Textarea
                                value={signature}
                                onChange={(e) => setSignature(e.target.value)}
                                className="h-[200px] font-mono text-sm"
                                placeholder={`<p>Kind Regards,</p>
<p><strong>Your Name</strong><br/>
Your Title | <a href="https://mehrana.agency">Mehrana Agency</a></p>`}
                            />
                        )}

                        <div className="flex justify-end">
                            <Button onClick={saveSettings} disabled={loading}>
                                <Save className="mr-2 h-4 w-4" />
                                {loading ? 'Saving...' : 'Save Signature'}
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {/* Info Card */}
                <Card className="bg-blue-50 border-blue-200">
                    <CardContent className="p-4">
                        <p className="text-sm text-blue-700">
                            <strong>💡 Tip:</strong> Sender Name and Reply-To are now configured per-email in each automation step.
                            This allows different automations to send from different names/addresses.
                        </p>
                    </CardContent>
                </Card>
            </TabsContent>

            {/* SEO Tools Settings */}
            <TabsContent value="seo" className="space-y-6 max-w-3xl">
                {/* Google Search Console */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Search className="h-5 w-5" />
                            Google Search Console
                        </CardTitle>
                        <CardDescription>
                            Connect your Google Search Console for URL indexing and status checks
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <GoogleConnectionCard />
                    </CardContent>
                </Card>

                {/* Content Generator Settings */}
                <Card>
                    <Collapsible open={contentGenOpen} onOpenChange={setContentGenOpen}>
                        <CardHeader className="cursor-pointer" onClick={() => setContentGenOpen(!contentGenOpen)}>
                            <CollapsibleTrigger asChild>
                                <div className="flex items-center justify-between w-full">
                                    <div>
                                        <CardTitle className="flex items-center gap-2">
                                            <Sparkles className="h-5 w-5" />
                                            Content Factory Settings
                                        </CardTitle>
                                        <CardDescription>
                                            Global guidelines and AI rules for content generation
                                        </CardDescription>
                                    </div>
                                    <ChevronDown className={`h-5 w-5 transition-transform ${contentGenOpen ? 'rotate-180' : ''}`} />
                                </div>
                            </CollapsibleTrigger>
                        </CardHeader>
                        <CollapsibleContent>
                            <CardContent className="space-y-6">
                                {/* Content Guidelines */}
                                <div className="space-y-2">
                                    <Label className="flex items-center gap-2">
                                        <FileText className="h-4 w-4" />
                                        Content Guidelines
                                    </Label>
                                    <p className="text-sm text-muted-foreground">
                                        General guidelines for content creation (tone, style, formatting rules, etc.)
                                    </p>
                                    <Textarea
                                        value={guidelines}
                                        onChange={(e) => setGuidelines(e.target.value)}
                                        className="h-[200px] font-mono text-sm"
                                        placeholder={`Example:
- Write in a professional but friendly tone
- Use short paragraphs (2-3 sentences max)
- Include relevant keywords naturally
- Add internal links where appropriate
- Use H2 and H3 headings to structure content`}
                                    />
                                </div>

                                {/* AI Rules */}
                                <div className="space-y-2">
                                    <Label className="flex items-center gap-2">
                                        <Sparkles className="h-4 w-4" />
                                        AI Rules
                                    </Label>
                                    <p className="text-sm text-muted-foreground">
                                        Specific instructions for the AI during content generation
                                    </p>
                                    <Textarea
                                        value={aiRules}
                                        onChange={(e) => setAiRules(e.target.value)}
                                        className="h-[200px] font-mono text-sm"
                                        placeholder={`Example:
- Never use generic phrases like "In today's world"
- Avoid starting paragraphs with "However" or "Additionally"
- Don't use more than one exclamation mark per article
- Always include a clear call-to-action at the end
- Output content in HTML format with proper tags`}
                                    />
                                </div>

                                <div className="flex justify-end">
                                    <Button onClick={saveContentGenSettings} disabled={contentGenLoading}>
                                        <Save className="mr-2 h-4 w-4" />
                                        {contentGenLoading ? 'Saving...' : 'Save Settings'}
                                    </Button>
                                </div>
                            </CardContent>
                        </CollapsibleContent>
                    </Collapsible>
                </Card>
            </TabsContent>

            {/* Users Tab */}
            <TabsContent value="users">
                <UsersTab />
            </TabsContent>
        </Tabs>
    )
}
