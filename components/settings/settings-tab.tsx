"use client"

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'
import { Save, Mail, Eye, EyeOff, Users, Shield } from 'lucide-react'
import { UsersTab } from './users-tab'

export function SettingsTab() {
    const [loading, setLoading] = useState(false)
    const [showPreview, setShowPreview] = useState(false)

    // Email settings - only signature (sender name/reply-to moved to per-email step)
    const [signature, setSignature] = useState('')

    useEffect(() => {
        loadSettings()
    }, [])

    async function loadSettings() {
        try {
            const sigRes = await fetch('/api/settings?key=email_signature').then(r => r.json())
            if (sigRes.success && sigRes.setting) setSignature(sigRes.setting.value)
        } catch (e) {
            console.error('Failed to load settings:', e)
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

    return (
        <Tabs defaultValue="users" className="space-y-6">
            <TabsList className="grid w-full max-w-md grid-cols-2">
                <TabsTrigger value="users" className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Users & Access
                </TabsTrigger>
                <TabsTrigger value="email" className="flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    Email Settings
                </TabsTrigger>
            </TabsList>

            <TabsContent value="users">
                <UsersTab />
            </TabsContent>

            <TabsContent value="email" className="space-y-6 max-w-3xl">
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
        </Tabs>
    )
}
