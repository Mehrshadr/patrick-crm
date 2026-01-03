"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Loader2, Save, Eye, EyeOff, CheckCircle2, XCircle, Shield } from "lucide-react"
import { toast } from "sonner"

interface IntegrationStatus {
    value: string
    masked: string
    configured: boolean
}

interface IntegrationsData {
    integrations: Record<string, IntegrationStatus>
    encryptionConfigured: boolean
}

const INTEGRATION_LABELS: Record<string, { label: string; description: string; placeholder: string }> = {
    twilio_account_sid: {
        label: "Account SID",
        description: "Twilio Account SID (starts with AC)",
        placeholder: "ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
    },
    twilio_auth_token: {
        label: "Auth Token",
        description: "Twilio Auth Token (encrypted)",
        placeholder: "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
    },
    twilio_phone_number: {
        label: "Phone Number",
        description: "Twilio Phone Number (e.g., +14379926614)",
        placeholder: "+1xxxxxxxxxx"
    },
    instantly_api_key: {
        label: "API Key",
        description: "Instantly.ai API Key (encrypted)",
        placeholder: "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
    }
}

export function IntegrationsSettings() {
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [data, setData] = useState<IntegrationsData | null>(null)
    const [showValues, setShowValues] = useState<Record<string, boolean>>({})
    const [formValues, setFormValues] = useState<Record<string, string>>({})
    const [hasChanges, setHasChanges] = useState(false)

    useEffect(() => {
        fetchIntegrations()
    }, [])

    async function fetchIntegrations() {
        try {
            const res = await fetch("/api/settings/integrations")
            if (!res.ok) {
                if (res.status === 403) {
                    toast.error("Admin access required")
                    return
                }
                throw new Error("Failed to fetch")
            }
            const json = await res.json()
            setData(json)
        } catch (error) {
            toast.error("Failed to load integration settings")
        } finally {
            setLoading(false)
        }
    }

    function handleInputChange(key: string, value: string) {
        setFormValues(prev => ({ ...prev, [key]: value }))
        setHasChanges(true)
    }

    async function handleSave() {
        if (!hasChanges || Object.keys(formValues).length === 0) {
            toast.info("No changes to save")
            return
        }

        setSaving(true)
        try {
            const res = await fetch("/api/settings/integrations", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(formValues)
            })

            const json = await res.json()

            if (!res.ok) {
                throw new Error(json.error || "Failed to save")
            }

            toast.success(`Saved ${json.updated?.length || 0} integration(s)`)
            setFormValues({})
            setHasChanges(false)
            fetchIntegrations() // Refresh to show updated masked values
        } catch (error: any) {
            toast.error(error.message || "Failed to save settings")
        } finally {
            setSaving(false)
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
        )
    }

    if (!data) {
        return (
            <div className="text-center py-12 text-muted-foreground">
                Failed to load settings or access denied
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Encryption Status */}
            <Card className={data.encryptionConfigured ? "border-green-200 bg-green-50/50" : "border-amber-200 bg-amber-50/50"}>
                <CardContent className="pt-4">
                    <div className="flex items-center gap-2">
                        <Shield className={`h-5 w-5 ${data.encryptionConfigured ? "text-green-600" : "text-amber-600"}`} />
                        <span className="font-medium">
                            {data.encryptionConfigured
                                ? "Encryption is enabled - sensitive values are encrypted at rest"
                                : "Encryption not configured - set ENCRYPTION_KEY for secure storage"}
                        </span>
                    </div>
                </CardContent>
            </Card>

            {/* Twilio Settings */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="text-lg">Twilio (SMS)</CardTitle>
                            <CardDescription>Configure Twilio for sending SMS messages</CardDescription>
                        </div>
                        <StatusBadge
                            configured={
                                data.integrations.twilio_account_sid?.configured &&
                                data.integrations.twilio_auth_token?.configured &&
                                data.integrations.twilio_phone_number?.configured
                            }
                        />
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    {["twilio_account_sid", "twilio_auth_token", "twilio_phone_number"].map(key => (
                        <IntegrationInput
                            key={key}
                            settingKey={key}
                            config={INTEGRATION_LABELS[key]}
                            status={data.integrations[key]}
                            value={formValues[key] || ""}
                            showValue={showValues[key] || false}
                            onToggleShow={() => setShowValues(prev => ({ ...prev, [key]: !prev[key] }))}
                            onChange={(val) => handleInputChange(key, val)}
                        />
                    ))}
                </CardContent>
            </Card>

            {/* Instantly Settings */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="text-lg">Instantly.ai</CardTitle>
                            <CardDescription>Configure Instantly for email campaigns</CardDescription>
                        </div>
                        <StatusBadge configured={data.integrations.instantly_api_key?.configured} />
                    </div>
                </CardHeader>
                <CardContent>
                    <IntegrationInput
                        settingKey="instantly_api_key"
                        config={INTEGRATION_LABELS.instantly_api_key}
                        status={data.integrations.instantly_api_key}
                        value={formValues.instantly_api_key || ""}
                        showValue={showValues.instantly_api_key || false}
                        onToggleShow={() => setShowValues(prev => ({ ...prev, instantly_api_key: !prev.instantly_api_key }))}
                        onChange={(val) => handleInputChange("instantly_api_key", val)}
                    />
                </CardContent>
            </Card>

            {/* Save Button */}
            {hasChanges && (
                <div className="flex justify-end">
                    <Button onClick={handleSave} disabled={saving}>
                        {saving ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Saving...
                            </>
                        ) : (
                            <>
                                <Save className="mr-2 h-4 w-4" />
                                Save Changes
                            </>
                        )}
                    </Button>
                </div>
            )}
        </div>
    )
}

function StatusBadge({ configured }: { configured: boolean }) {
    return (
        <Badge variant="outline" className={configured
            ? "text-green-600 border-green-300"
            : "text-amber-600 border-amber-300"
        }>
            {configured ? (
                <>
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Configured
                </>
            ) : (
                <>
                    <XCircle className="h-3 w-3 mr-1" />
                    Not Configured
                </>
            )}
        </Badge>
    )
}

interface IntegrationInputProps {
    settingKey: string
    config: { label: string; description: string; placeholder: string }
    status: IntegrationStatus | undefined
    value: string
    showValue: boolean
    onToggleShow: () => void
    onChange: (value: string) => void
}

function IntegrationInput({
    settingKey,
    config,
    status,
    value,
    showValue,
    onToggleShow,
    onChange
}: IntegrationInputProps) {
    const hasValue = status?.configured || !!value
    const displayPlaceholder = status?.configured
        ? status.masked
        : config.placeholder

    return (
        <div className="space-y-2">
            <Label htmlFor={settingKey} className="flex items-center gap-2">
                {config.label}
                {status?.configured && !value && (
                    <Badge variant="secondary" className="text-xs">
                        Currently set
                    </Badge>
                )}
            </Label>
            <div className="flex gap-2">
                <div className="relative flex-1">
                    <Input
                        id={settingKey}
                        type={showValue ? "text" : "password"}
                        placeholder={displayPlaceholder}
                        value={value}
                        onChange={(e) => onChange(e.target.value)}
                        className="pr-10"
                    />
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                        onClick={onToggleShow}
                    >
                        {showValue ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                </div>
            </div>
            <p className="text-xs text-muted-foreground">{config.description}</p>
        </div>
    )
}
