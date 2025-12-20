"use client"

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'
import { Save, Mail, User, Reply, Eye, EyeOff } from 'lucide-react'

export function SettingsTab() {
    const [loading, setLoading] = useState(false)
    const [showPreview, setShowPreview] = useState(false)

    // Email settings
    const [signature, setSignature] = useState('')
    const [senderName, setSenderName] = useState('')
    const [replyTo, setReplyTo] = useState('')

    useEffect(() => {
        loadSettings()
    }, [])

    async function loadSettings() {
        try {
            const [sigRes, nameRes, replyRes] = await Promise.all([
                fetch('/api/settings?key=email_signature').then(r => r.json()),
                fetch('/api/settings?key=sender_name').then(r => r.json()),
                fetch('/api/settings?key=reply_to').then(r => r.json()),
            ])

            if (sigRes.success && sigRes.setting) setSignature(sigRes.setting.value)
            if (nameRes.success && nameRes.setting) setSenderName(nameRes.setting.value)
            if (replyRes.success && replyRes.setting) setReplyTo(replyRes.setting.value)
        } catch (e) {
            console.error('Failed to load settings:', e)
        }
    }

    async function saveSettings() {
        setLoading(true)
        try {
            await Promise.all([
                fetch('/api/settings', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ key: 'email_signature', value: signature })
                }),
                fetch('/api/settings', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ key: 'sender_name', value: senderName })
                }),
                fetch('/api/settings', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ key: 'reply_to', value: replyTo })
                }),
            ])
            toast.success('Settings saved!')
        } catch (e) {
            toast.error('Failed to save settings')
        }
        setLoading(false)
    }

    return (
        <div className="space-y-6 max-w-3xl">
            {/* Email Settings Card */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Mail className="h-5 w-5" />
                        Email Settings
                    </CardTitle>
                    <CardDescription>
                        Configure your email sender information and signature
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label className="flex items-center gap-2 mb-2">
                                <User className="h-4 w-4" />
                                Sender Name
                            </Label>
                            <Input
                                value={senderName}
                                onChange={(e) => setSenderName(e.target.value)}
                                placeholder="e.g., Mehrdad from Mehrana"
                            />
                            <p className="text-xs text-muted-foreground mt-1">
                                Name shown in recipient's inbox
                            </p>
                        </div>
                        <div>
                            <Label className="flex items-center gap-2 mb-2">
                                <Reply className="h-4 w-4" />
                                Reply-To Email
                            </Label>
                            <Input
                                type="email"
                                value={replyTo}
                                onChange={(e) => setReplyTo(e.target.value)}
                                placeholder="e.g., support@mehrana.agency"
                            />
                            <p className="text-xs text-muted-foreground mt-1">
                                Where replies will be sent
                            </p>
                        </div>
                    </div>

                    <Separator />

                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <Label>Email Signature</Label>
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
                        <p className="text-xs text-muted-foreground mb-2">
                            HTML signature added to all emails (use {'{signature}'} in templates)
                        </p>
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
                    </div>

                    <div className="flex justify-end">
                        <Button onClick={saveSettings} disabled={loading}>
                            <Save className="mr-2 h-4 w-4" />
                            {loading ? 'Saving...' : 'Save Settings'}
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* API Keys Card (placeholder) */}
            <Card className="opacity-60">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        🔑 API Keys
                        <span className="text-xs bg-slate-200 text-slate-600 px-2 py-0.5 rounded">Coming Soon</span>
                    </CardTitle>
                    <CardDescription>
                        Instantly.ai, Twilio SMS, and other integrations
                    </CardDescription>
                </CardHeader>
            </Card>
        </div>
    )
}
