"use client"

import { useState, useEffect, useRef } from 'react'
import { getCaretCoordinates } from '@/lib/textarea-utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription
} from '@/components/ui/dialog'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { STAGE_CONFIG, PipelineStage } from '@/lib/status-mapping'
import {
    Mail,
    MessageSquare,
    Clock,
    Play,
    Settings,
    Loader2,
    ChevronRight,
    Save,
    X,
    Plus,
    Info,
    Eye,
    Signature,
    Trash2
} from 'lucide-react'

interface AutomationRule {
    id: number
    name: string
    description: string | null
    triggerType: string
    triggerStatus: string | null
    triggerSubStatus: string | null
    delayMinutes: number
    scheduledHour: number | null
    requireApproval: boolean
    isActive: boolean
    sortOrder: number
    cancelOnStatus: string | null
    cancelOnSubStatus: string | null
    emailTemplate: { id: number; name: string; subject: string | null; body: string } | null
    smsTemplate: { id: number; name: string; body: string } | null
    _count: { queueItems: number }
}

const TRIGGER_TYPES = [
    { value: 'ON_LEAD_CREATE', label: 'When Lead Created' },
    { value: 'ON_STATUS_CHANGE', label: 'When Status Changes' },
    { value: 'ON_SCHEDULE', label: 'Scheduled (Time-based)' },
]

const TIMING_OPTIONS = [
    { value: 'immediate', label: 'Immediately' },
    { value: 'hours', label: 'Hours after trigger' },
    { value: 'next_day', label: 'Next day at specific time' },
    { value: 'days_later', label: 'X days later at specific time' },
]

// Sample lead for preview
const SAMPLE_LEAD = {
    name: 'John Smith',
    website: 'example.com',
    email: 'john@example.com',
    phone: '+1-555-0123',
    audit_link: 'https://mehrana.agency/audit/sample-123'
}

export function AutomationTab() {
    const [rules, setRules] = useState<AutomationRule[]>([])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [selectedRule, setSelectedRule] = useState<AutomationRule | null>(null)
    const [isCreating, setIsCreating] = useState(false)
    const [showSignatureSettings, setShowSignatureSettings] = useState(false)
    const [emailSignature, setEmailSignature] = useState('')
    const [editedSignature, setEditedSignature] = useState('')

    // Edit states
    const [editedName, setEditedName] = useState('')
    const [editedDescription, setEditedDescription] = useState('')
    const [editedEmailSubject, setEditedEmailSubject] = useState('')
    const [editedEmailBody, setEditedEmailBody] = useState('')
    const [editedSmsBody, setEditedSmsBody] = useState('')
    const [editedTriggerType, setEditedTriggerType] = useState('ON_LEAD_CREATE')
    const [editedTriggerStatus, setEditedTriggerStatus] = useState('')
    const [editedTriggerSubStatus, setEditedTriggerSubStatus] = useState('')
    const [editedTimingType, setEditedTimingType] = useState('immediate')
    const [editedDelayHours, setEditedDelayHours] = useState(0)
    const [editedScheduledHour, setEditedScheduledHour] = useState(14)
    const [editedDaysLater, setEditedDaysLater] = useState(1)
    const [editedRequireApproval, setEditedRequireApproval] = useState(false)
    const [editedCancelOnStatus, setEditedCancelOnStatus] = useState('')
    const [includeSignature, setIncludeSignature] = useState(true)

    // Suggestion state
    const [suggestionPos, setSuggestionPos] = useState({ top: 0, left: 0 })
    const [showSuggestions, setShowSuggestions] = useState(false)
    const [suggestionIndex, setSuggestionIndex] = useState(0)
    const [activeTextarea, setActiveTextarea] = useState<'email' | 'sms' | null>(null)

    const VARIABLES = [
        { label: 'Name', value: '{name}' },
        { label: 'Website', value: '{website}' },
        { label: 'Audit Link', value: '{audit_link}' },
        { label: 'Email', value: '{email}' },
        { label: 'Phone', value: '{phone}' },
    ]

    useEffect(() => {
        fetchData()
        fetchSignature()
    }, [])

    async function fetchData() {
        setLoading(true)
        try {
            const rulesRes = await fetch('/api/automation/rules').then(r => r.json())
            if (rulesRes.success) setRules(rulesRes.rules)
        } catch (e) {
            console.error('Error fetching automation data:', e)
        }
        setLoading(false)
    }

    async function fetchSignature() {
        try {
            const res = await fetch('/api/settings?key=email_signature').then(r => r.json())
            if (res.success && res.setting) {
                setEmailSignature(res.setting.value)
                setEditedSignature(res.setting.value)
            }
        } catch (e) {
            console.error('Error fetching signature:', e)
        }
    }

    async function saveSignature() {
        try {
            await fetch('/api/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ key: 'email_signature', value: editedSignature })
            })
            setEmailSignature(editedSignature)
            toast.success('Signature saved!')
            setShowSignatureSettings(false)
        } catch (e) {
            toast.error('Failed to save signature')
        }
    }

    async function toggleRule(id: number, isActive: boolean, e: React.MouseEvent) {
        e.stopPropagation()
        try {
            const res = await fetch('/api/automation/rules', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, isActive })
            }).then(r => r.json())

            if (res.success) {
                setRules(rules.map(r => r.id === id ? { ...r, isActive } : r))
                toast.success(`Rule ${isActive ? 'activated' : 'deactivated'}`)
            }
        } catch (e) {
            toast.error('Failed to update rule')
        }
    }

    function openRuleDetails(rule: AutomationRule) {
        setSelectedRule(rule)
        setIsCreating(false)

        setEditedName(rule.name)
        setEditedDescription(rule.description || '')
        setEditedEmailSubject(rule.emailTemplate?.subject || '')
        setEditedEmailBody(rule.emailTemplate?.body || '')
        setEditedSmsBody(rule.smsTemplate?.body || '')
        setEditedTriggerType(rule.triggerType)
        setEditedTriggerStatus(rule.triggerStatus || '')
        setEditedTriggerSubStatus(rule.triggerSubStatus || '')
        setEditedRequireApproval(rule.requireApproval)
        setEditedCancelOnStatus(rule.cancelOnStatus || '')
        setIncludeSignature(true)

        if (rule.delayMinutes === 0 && !rule.scheduledHour) {
            setEditedTimingType('immediate')
        } else if (rule.delayMinutes > 0) {
            setEditedTimingType('hours')
            setEditedDelayHours(Math.round(rule.delayMinutes / 60))
        } else if (rule.scheduledHour) {
            setEditedTimingType(rule.sortOrder > 2 ? 'days_later' : 'next_day')
            setEditedScheduledHour(rule.scheduledHour)
            setEditedDaysLater(rule.sortOrder > 1 ? rule.sortOrder - 1 : 1)
        }
    }

    function openNewRule() {
        setSelectedRule(null)
        setIsCreating(true)
        setEditedName('')
        setEditedDescription('')
        setEditedEmailSubject('')
        setEditedEmailBody('')
        setEditedSmsBody('')
        setEditedTriggerType('ON_LEAD_CREATE')
        setEditedTriggerStatus('')
        setEditedTriggerSubStatus('')
        setEditedTimingType('immediate')
        setEditedDelayHours(2)
        setEditedScheduledHour(14)
        setEditedDaysLater(1)
        setEditedRequireApproval(false)
        setEditedCancelOnStatus('')
        setIncludeSignature(true)
    }

    async function deleteRule(ruleId: number) {
        if (!confirm('Are you sure you want to delete this rule?')) return

        try {
            const res = await fetch(`/api/automation/rules?id=${ruleId}`, {
                method: 'DELETE'
            }).then(r => r.json())

            if (res.success) {
                toast.success('Rule deleted!')
                await fetchData()
            } else {
                toast.error('Failed to delete: ' + res.error)
            }
        } catch (e) {
            toast.error('Failed to delete rule')
        }
    }

    async function saveRule() {
        setSaving(true)

        try {
            let delayMinutes = 0
            let scheduledHour: number | null = null
            let sortOrder = 1

            if (editedTimingType === 'immediate') {
                delayMinutes = 0
            } else if (editedTimingType === 'hours') {
                delayMinutes = editedDelayHours * 60
            } else if (editedTimingType === 'next_day') {
                scheduledHour = editedScheduledHour
                sortOrder = 2
            } else if (editedTimingType === 'days_later') {
                scheduledHour = editedScheduledHour
                sortOrder = editedDaysLater + 1
            }

            const ruleData = {
                name: editedName,
                description: editedDescription || null,
                triggerType: editedTriggerType,
                triggerStatus: editedTriggerStatus === '__NONE__' ? null : (editedTriggerStatus || null),
                triggerSubStatus: editedTriggerSubStatus === '__NONE__' ? null : (editedTriggerSubStatus || null),
                delayMinutes,
                scheduledHour,
                sortOrder,
                requireApproval: editedRequireApproval,
                cancelOnStatus: editedCancelOnStatus === '__NONE__' ? null : (editedCancelOnStatus || null),
            }

            // Include signature in body if checked
            const finalEmailBody = includeSignature && emailSignature
                ? `${editedEmailBody}<br><br>${emailSignature}`
                : editedEmailBody

            if (isCreating) {
                const res = await fetch('/api/automation/rules', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(ruleData)
                }).then(r => r.json())

                if (res.success) {
                    toast.success('Rule created!')

                    if (editedEmailBody) {
                        await fetch('/api/templates', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                ruleId: res.rule.id,
                                type: 'EMAIL',
                                name: `${editedName} Email`,
                                subject: editedEmailSubject,
                                body: editedEmailBody
                            })
                        })
                    }
                    if (editedSmsBody) {
                        await fetch('/api/templates', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                ruleId: res.rule.id,
                                type: 'SMS',
                                name: `${editedName} SMS`,
                                body: editedSmsBody
                            })
                        })
                    }
                }
            } else if (selectedRule) {
                const res = await fetch('/api/automation/rules', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: selectedRule.id, ...ruleData })
                }).then(r => r.json())

                if (!res.success) {
                    throw new Error(res.error || 'Failed to save rule')
                }

                // Save email template - update if exists, create if not
                if (editedEmailBody || editedEmailSubject) {
                    if (selectedRule.emailTemplate) {
                        // Update existing template
                        await fetch('/api/templates', {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                id: selectedRule.emailTemplate.id,
                                name: `${editedName} Email`, // Sync name
                                subject: editedEmailSubject,
                                body: editedEmailBody
                            })
                        })
                    } else {
                        // Create new template for this rule
                        await fetch('/api/templates', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                ruleId: selectedRule.id,
                                type: 'EMAIL',
                                name: `${editedName} Email`,
                                subject: editedEmailSubject,
                                body: editedEmailBody
                            })
                        })
                    }
                }

                // Save SMS template - update if exists, create if not
                if (editedSmsBody) {
                    if (selectedRule.smsTemplate) {
                        // Update existing template
                        await fetch('/api/templates', {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                id: selectedRule.smsTemplate.id,
                                name: `${editedName} SMS`, // Sync name
                                body: editedSmsBody
                            })
                        })
                    } else {
                        // Create new template for this rule
                        await fetch('/api/templates', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                ruleId: selectedRule.id,
                                type: 'SMS',
                                name: `${editedName} SMS`,
                                body: editedSmsBody
                            })
                        })
                    }
                }

                toast.success('Saved!')
            }

            await fetchData()
            setSelectedRule(null)
            setIsCreating(false)
        } catch (e) {
            toast.error('Failed to save: ' + String(e))
        }

        setSaving(false)
    }

    function getTimingText(rule: AutomationRule): string {
        if (rule.triggerType === 'ON_LEAD_CREATE' && rule.delayMinutes === 0) {
            return 'Immediately'
        }
        if (rule.delayMinutes > 0) {
            const hours = Math.round(rule.delayMinutes / 60)
            return `${hours} hour${hours > 1 ? 's' : ''} after`
        }
        if (rule.scheduledHour !== null) {
            const hour = rule.scheduledHour
            const isPM = hour >= 12
            const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour
            const ampm = isPM ? 'PM' : 'AM'

            if (rule.sortOrder === 2) {
                return `${displayHour}:00 ${ampm} next day`
            } else if (rule.sortOrder >= 3) {
                return `${displayHour}:00 ${ampm} +${rule.sortOrder - 1} days`
            }
            return `At ${displayHour}:00 ${ampm}`
        }
        return 'Not scheduled'
    }

    function getSubStatuses(stage: string): string[] {
        if (stage && stage !== '__NONE__' && stage in STAGE_CONFIG) {
            return STAGE_CONFIG[stage as PipelineStage].subStatuses
        }
        return []
    }

    // Replace variables with sample data for preview
    function getPreviewContent(content: string): string {
        return content
            .replace(/\{name\}/g, SAMPLE_LEAD.name)
            .replace(/\{website\}/g, SAMPLE_LEAD.website)
            .replace(/\{email\}/g, SAMPLE_LEAD.email)
            .replace(/\{phone\}/g, SAMPLE_LEAD.phone)
            .replace(/\{audit_link\}/g, SAMPLE_LEAD.audit_link)
    }

    function handleInput(e: React.FormEvent<HTMLTextAreaElement>, type: 'email' | 'sms') {
        const target = e.target as HTMLTextAreaElement
        const value = target.value
        const selectionEnd = target.selectionEnd

        if (value[selectionEnd - 1] === '{') {
            const coords = getCaretCoordinates(target, selectionEnd)
            setSuggestionPos({ top: coords.top + 20, left: coords.left }) // Offset slightly
            setShowSuggestions(true)
            setActiveTextarea(type)
            setSuggestionIndex(0)
        } else {
            setShowSuggestions(false)
        }

        if (type === 'email') setEditedEmailBody(value)
        else setEditedSmsBody(value)
    }

    function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>, type: 'email' | 'sms') {
        if (!showSuggestions) return

        const activeVars = VARIABLES // Filter here if needed

        if (e.key === 'ArrowDown') {
            e.preventDefault()
            setSuggestionIndex(i => (i + 1) % activeVars.length)
        } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setSuggestionIndex(i => (i - 1 + activeVars.length) % activeVars.length)
        } else if (e.key === 'Enter' || e.key === 'Tab') {
            e.preventDefault()
            if (activeVars[suggestionIndex]) {
                insertVariable(activeVars[suggestionIndex].value, type)
            }
        } else if (e.key === 'Escape') {
            setShowSuggestions(false)
        }
    }

    function insertVariable(variable: string, type: 'email' | 'sms') {
        const isEmail = type === 'email'
        const value = isEmail ? editedEmailBody : editedSmsBody
        const textarea = document.getElementById(`${type}-textarea`) as HTMLTextAreaElement

        if (!textarea) return

        const selectionEnd = textarea.selectionEnd
        // Replace the last `{` with the variable
        // We assume the cursor is right after `{`
        const newValue = value.substring(0, selectionEnd - 1) + variable + value.substring(selectionEnd)

        if (isEmail) setEditedEmailBody(newValue)
        else setEditedSmsBody(newValue)

        setShowSuggestions(false)

        // Restore focus and move cursor
        setTimeout(() => {
            textarea.focus()
            const newPos = selectionEnd - 1 + variable.length
            textarea.setSelectionRange(newPos, newPos)
        }, 0)
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-semibold flex items-center gap-2">
                        <Settings className="h-5 w-5" />
                        Automation Rules
                    </h2>
                    <p className="text-sm text-slate-500 mt-1">
                        Click on a rule to view and edit its settings
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <Button size="sm" variant="outline" onClick={() => {
                        setEditedSignature(emailSignature)
                        setShowSignatureSettings(true)
                    }}>
                        <Signature className="h-4 w-4 mr-1" /> Email Signature
                    </Button>
                    <Badge variant="outline" className="text-slate-600">
                        {rules.filter(r => r.isActive).length} of {rules.length} active
                    </Badge>
                    <Button size="sm" onClick={openNewRule}>
                        <Plus className="h-4 w-4 mr-1" /> New Rule
                    </Button>
                </div>
            </div>

            {/* Rules List */}
            <div className="grid gap-3">
                {rules.map(rule => (
                    <Card
                        key={rule.id}
                        className={`cursor-pointer transition-all hover:shadow-md hover:border-indigo-200 ${!rule.isActive ? 'opacity-60' : ''}`}
                        onClick={() => openRuleDetails(rule)}
                    >
                        <CardContent className="py-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4 flex-1">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="font-semibold">{rule.name}</span>
                                            <Badge variant={rule.isActive ? 'default' : 'secondary'} className="text-xs">
                                                {rule.isActive ? 'Active' : 'Off'}
                                            </Badge>
                                            {rule.triggerStatus && STAGE_CONFIG[rule.triggerStatus as PipelineStage] && (
                                                <Badge className={`text-xs ${STAGE_CONFIG[rule.triggerStatus as PipelineStage].color}`}>
                                                    {STAGE_CONFIG[rule.triggerStatus as PipelineStage].label}
                                                </Badge>
                                            )}
                                            {rule.requireApproval && (
                                                <Badge variant="outline" className="text-xs text-orange-600 border-orange-300">
                                                    Ask First
                                                </Badge>
                                            )}
                                        </div>
                                        {rule.description && (
                                            <p className="text-xs text-slate-500 mt-0.5">{rule.description}</p>
                                        )}
                                    </div>

                                    <div className="flex items-center gap-2 text-sm text-slate-600 min-w-[160px]">
                                        <Clock className="h-4 w-4 text-slate-400" />
                                        <span>{getTimingText(rule)}</span>
                                    </div>

                                    <div className="flex items-center gap-3 min-w-[120px]">
                                        {rule.emailTemplate && (
                                            <div className="flex items-center gap-1 text-blue-600 text-sm">
                                                <Mail className="h-4 w-4" />
                                                <span>Email</span>
                                            </div>
                                        )}
                                        {rule.smsTemplate && (
                                            <div className="flex items-center gap-1 text-green-600 text-sm">
                                                <MessageSquare className="h-4 w-4" />
                                                <span>SMS</span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="flex items-center gap-3">
                                    <Switch
                                        checked={rule.isActive}
                                        onCheckedChange={(checked) => toggleRule(rule.id, checked, event as any)}
                                        onClick={(e) => e.stopPropagation()}
                                    />
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            deleteRule(rule.id)
                                        }}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                    <ChevronRight className="h-5 w-5 text-slate-300" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Signature Settings Dialog */}
            <Dialog open={showSignatureSettings} onOpenChange={setShowSignatureSettings}>
                <DialogContent className="max-w-4xl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Signature className="h-5 w-5" />
                            Email Signature
                        </DialogTitle>
                        <DialogDescription>
                            Paste your email signature HTML here. This will be appended to emails when "Include Signature" is checked.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid grid-cols-2 gap-4 mt-4">
                        <div>
                            <Label>Signature HTML</Label>
                            <Textarea
                                value={editedSignature}
                                onChange={(e) => setEditedSignature(e.target.value)}
                                placeholder="Paste your signature HTML here..."
                                className="mt-1 h-[300px] max-h-[300px] font-mono text-xs resize-none overflow-y-auto"
                            />
                        </div>
                        <div>
                            <Label>Preview</Label>
                            <div className="mt-1 border rounded-lg p-4 min-h-[300px] bg-white overflow-auto">
                                <div dangerouslySetInnerHTML={{ __html: editedSignature }} />
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end gap-2 mt-4">
                        <Button variant="ghost" onClick={() => setShowSignatureSettings(false)}>
                            Cancel
                        </Button>
                        <Button onClick={saveSignature}>
                            <Save className="h-4 w-4 mr-1" /> Save Signature
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Rule Editor Dialog */}
            <Dialog open={!!selectedRule || isCreating} onOpenChange={(open) => {
                if (!open) {
                    setSelectedRule(null)
                    setIsCreating(false)
                }
            }}>
                <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <div className="flex items-center justify-between">
                            <DialogTitle className="text-xl">
                                {isCreating ? 'Create New Rule' : 'Edit Rule'}
                            </DialogTitle>
                            <div className="flex gap-2">
                                <Button size="sm" variant="ghost" onClick={() => {
                                    setSelectedRule(null)
                                    setIsCreating(false)
                                }}>
                                    <X className="h-4 w-4 mr-1" /> Cancel
                                </Button>
                                <Button size="sm" onClick={saveRule} disabled={saving || !editedName}>
                                    {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
                                    Save All
                                </Button>
                            </div>
                        </div>
                        <DialogDescription>
                            Configure automation trigger, timing, and message templates
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-6 mt-4">
                        {/* Basic Info */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Rule Name *</Label>
                                <Input
                                    value={editedName}
                                    onChange={(e) => setEditedName(e.target.value)}
                                    placeholder="e.g. Stage 1 - Welcome 1"
                                    className="mt-1"
                                />
                            </div>
                            <div>
                                <Label>Description</Label>
                                <Input
                                    value={editedDescription}
                                    onChange={(e) => setEditedDescription(e.target.value)}
                                    placeholder="Brief description"
                                    className="mt-1"
                                />
                            </div>
                        </div>

                        {/* Trigger Settings */}
                        <div className="bg-slate-50 p-4 rounded-lg space-y-4">
                            <h3 className="font-semibold flex items-center gap-2">
                                <Play className="h-4 w-4 text-indigo-600" />
                                Trigger Conditions
                            </h3>

                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div>
                                    <Label className="text-xs">Trigger Type</Label>
                                    <Select value={editedTriggerType} onValueChange={setEditedTriggerType}>
                                        <SelectTrigger className="mt-1">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {TRIGGER_TYPES.map(t => (
                                                <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div>
                                    <Label className="text-xs">Pipeline Stage</Label>
                                    <Select value={editedTriggerStatus || '__NONE__'} onValueChange={(v) => {
                                        setEditedTriggerStatus(v === '__NONE__' ? '' : v)
                                        setEditedTriggerSubStatus('')
                                    }}>
                                        <SelectTrigger className="mt-1">
                                            <SelectValue placeholder="Select stage..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="__NONE__">Any Stage</SelectItem>
                                            {Object.keys(STAGE_CONFIG).map(stage => (
                                                <SelectItem key={stage} value={stage}>
                                                    {STAGE_CONFIG[stage as PipelineStage].label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                {editedTriggerStatus && editedTriggerStatus !== '__NONE__' && (
                                    <div>
                                        <Label className="text-xs">Sub-Status</Label>
                                        <Select value={editedTriggerSubStatus || '__NONE__'} onValueChange={(v) => setEditedTriggerSubStatus(v === '__NONE__' ? '' : v)}>
                                            <SelectTrigger className="mt-1">
                                                <SelectValue placeholder="Any" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="__NONE__">Any</SelectItem>
                                                {getSubStatuses(editedTriggerStatus).map(sub => (
                                                    <SelectItem key={sub} value={sub}>{sub}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                )}

                                <div>
                                    <Label className="text-xs">Timing</Label>
                                    <Select value={editedTimingType} onValueChange={setEditedTimingType}>
                                        <SelectTrigger className="mt-1">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {TIMING_OPTIONS.map(t => (
                                                <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                {editedTimingType === 'hours' && (
                                    <div>
                                        <Label className="text-xs">Hours After</Label>
                                        <Input type="number" min="1" value={editedDelayHours} onChange={(e) => setEditedDelayHours(Number(e.target.value))} className="mt-1" />
                                    </div>
                                )}

                                {editedTimingType === 'days_later' && (
                                    <div>
                                        <Label className="text-xs">Days Later</Label>
                                        <Input type="number" min="1" value={editedDaysLater} onChange={(e) => setEditedDaysLater(Number(e.target.value))} className="mt-1" />
                                    </div>
                                )}

                                {(editedTimingType === 'next_day' || editedTimingType === 'days_later') && (
                                    <div>
                                        <Label className="text-xs">At Hour (0-23)</Label>
                                        <Input type="number" min="0" max="23" value={editedScheduledHour} onChange={(e) => setEditedScheduledHour(Number(e.target.value))} className="mt-1" />
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Settings Row */}
                        <div className="flex items-center gap-6 p-4 bg-amber-50 rounded-lg">
                            <div className="flex items-center gap-3">
                                <Switch checked={editedRequireApproval} onCheckedChange={setEditedRequireApproval} />
                                <Label>Ask for approval</Label>
                            </div>

                            <div className="flex items-center gap-2 flex-1">
                                <Label className="text-xs whitespace-nowrap">Cancel if stage →</Label>
                                <Select value={editedCancelOnStatus || '__NONE__'} onValueChange={(v) => setEditedCancelOnStatus(v === '__NONE__' ? '' : v)}>
                                    <SelectTrigger className="w-[200px]">
                                        <SelectValue placeholder="Don't cancel" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="__NONE__">Don't cancel</SelectItem>
                                        {Object.keys(STAGE_CONFIG).map(stage => (
                                            <SelectItem key={stage} value={stage}>
                                                {STAGE_CONFIG[stage as PipelineStage].label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {/* Email Template with Preview */}
                        <div className="border rounded-lg overflow-hidden">
                            <div className="flex items-center justify-between bg-blue-50 px-4 py-2 border-b">
                                <div className="flex items-center gap-2 text-blue-600">
                                    <Mail className="h-5 w-5" />
                                    <span className="font-semibold">Email Template</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Checkbox
                                        id="includeSignature"
                                        checked={includeSignature}
                                        onCheckedChange={(c) => setIncludeSignature(c as boolean)}
                                    />
                                    <Label htmlFor="includeSignature" className="text-sm cursor-pointer">
                                        Include Signature
                                    </Label>
                                </div>
                            </div>

                            <Tabs defaultValue="edit" className="w-full">
                                <TabsList className="m-2">
                                    <TabsTrigger value="edit">Edit</TabsTrigger>
                                    <TabsTrigger value="preview" className="flex items-center gap-1">
                                        <Eye className="h-3 w-3" /> Preview
                                    </TabsTrigger>
                                </TabsList>

                                <TabsContent value="edit" className="p-4 pt-0">
                                    <div className="space-y-3">
                                        <div>
                                            <Label className="text-xs">Subject</Label>
                                            <Input value={editedEmailSubject} onChange={(e) => setEditedEmailSubject(e.target.value)} placeholder="Email subject" className="mt-1" />
                                        </div>
                                        <div>
                                            <Label className="text-xs">Body - Type {'{'} to insert variables</Label>
                                            <div className="relative">
                                                <Textarea
                                                    id="email-textarea"
                                                    value={editedEmailBody}
                                                    onChange={(e) => handleInput(e, 'email')}
                                                    onKeyDown={(e) => handleKeyDown(e, 'email')}
                                                    placeholder="Email body..."
                                                    className="mt-1 h-[200px] max-h-[200px] resize-none overflow-y-auto"
                                                />
                                                {showSuggestions && activeTextarea === 'email' && (
                                                    <div
                                                        className="absolute z-50 w-48 bg-white border rounded-md shadow-lg overflow-hidden"
                                                        style={{ top: suggestionPos.top, left: suggestionPos.left }}
                                                    >
                                                        {VARIABLES.map((v, i) => (
                                                            <div
                                                                key={v.value}
                                                                className={`px-3 py-2 text-sm cursor-pointer hover:bg-slate-100 ${i === suggestionIndex ? 'bg-indigo-50 text-indigo-700' : ''}`}
                                                                onClick={() => insertVariable(v.value, 'email')}
                                                            >
                                                                <span className="font-medium">{v.label}</span>
                                                                <span className="ml-2 text-xs text-slate-400">{v.value}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </TabsContent>

                                <TabsContent value="preview" className="p-4 pt-0">
                                    <div className="border rounded-lg bg-white">
                                        <div className="border-b px-4 py-2 bg-slate-50">
                                            <p className="text-sm text-slate-500">To: {SAMPLE_LEAD.email}</p>
                                            <p className="text-sm font-medium">Subject: {getPreviewContent(editedEmailSubject)}</p>
                                        </div>
                                        <div className="p-4">
                                            <div dangerouslySetInnerHTML={{
                                                __html: getPreviewContent(editedEmailBody) + (includeSignature && emailSignature ? `<br><br>${emailSignature}` : '')
                                            }} />
                                        </div>
                                    </div>
                                </TabsContent>
                            </Tabs>
                        </div>

                        {/* SMS Template */}
                        <div className="border rounded-lg p-4">
                            <div className="flex items-center gap-2 text-green-600 mb-3">
                                <MessageSquare className="h-5 w-5" />
                                <span className="font-semibold">SMS Template</span>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label className="text-xs">Message - Type {'{'} to insert variables</Label>
                                    <div className="relative">
                                        <Textarea
                                            id="sms-textarea"
                                            value={editedSmsBody}
                                            onChange={(e) => handleInput(e, 'sms')}
                                            onKeyDown={(e) => handleKeyDown(e, 'sms')}
                                            placeholder="SMS message..."
                                            className="mt-1 h-[150px] max-h-[150px] resize-none overflow-y-auto"
                                        />
                                        {showSuggestions && activeTextarea === 'sms' && (
                                            <div
                                                className="absolute z-50 w-48 bg-white border rounded-md shadow-lg overflow-hidden"
                                                style={{ top: suggestionPos.top, left: suggestionPos.left }}
                                            >
                                                {VARIABLES.map((v, i) => (
                                                    <div
                                                        key={v.value}
                                                        className={`px-3 py-2 text-sm cursor-pointer hover:bg-slate-100 ${i === suggestionIndex ? 'bg-indigo-50 text-indigo-700' : ''}`}
                                                        onClick={() => insertVariable(v.value, 'sms')}
                                                    >
                                                        <span className="font-medium">{v.label}</span>
                                                        <span className="ml-2 text-xs text-slate-400">{v.value}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div>
                                    <Label className="text-xs">Preview</Label>
                                    <div className="mt-1 bg-green-50 border border-green-200 rounded-lg p-3 min-h-[150px]">
                                        <p className="text-sm whitespace-pre-wrap">{getPreviewContent(editedSmsBody)}</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Variables Help */}
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                            <div className="flex items-start gap-2">
                                <Info className="h-4 w-4 text-blue-600 mt-0.5" />
                                <div>
                                    <p className="text-sm font-medium text-blue-800">Available Variables</p>
                                    <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mt-2">
                                        <code className="text-xs bg-white px-2 py-1 rounded">{'{name}'} = Lead name</code>
                                        <code className="text-xs bg-white px-2 py-1 rounded">{'{website}'} = Website</code>
                                        <code className="text-xs bg-white px-2 py-1 rounded">{'{email}'} = Email</code>
                                        <code className="text-xs bg-white px-2 py-1 rounded">{'{phone}'} = Phone</code>
                                        <code className="text-xs bg-white px-2 py-1 rounded">{'{audit_link}'} = Audit URL</code>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}
