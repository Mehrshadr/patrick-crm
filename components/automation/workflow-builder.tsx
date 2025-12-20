"use client"

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { STAGE_CONFIG, PipelineStage } from '@/lib/status-mapping'
import { ArrowLeft, Save, Trash2, Mail, MessageSquare, Clock, Zap, Eye, EyeOff, Layers, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'

interface WorkflowBuilderProps {
    workflowId: number | null
    onClose: () => void
}

interface WorkflowStep {
    id?: number
    name: string
    type: 'EMAIL' | 'SMS' | 'DELAY' | 'CONDITION' | 'ACTION'
    config: any
}

const STEP_TYPES = [
    { type: 'EMAIL', label: 'Send Email', icon: Mail },
    { type: 'SMS', label: 'Send SMS', icon: MessageSquare },
    { type: 'DELAY', label: 'Delay', icon: Clock },
    { type: 'ACTION', label: 'External Action', icon: Zap },
]

export function WorkflowBuilder({ workflowId, onClose }: WorkflowBuilderProps) {
    const [loading, setLoading] = useState(false)
    const [name, setName] = useState('')
    const [description, setDescription] = useState('')
    const [triggerType, setTriggerType] = useState('ON_STATUS_CHANGE')
    const [triggerStatus, setTriggerStatus] = useState<string>('New')
    const [triggerSubStatus, setTriggerSubStatus] = useState<string>('__NONE__')
    const [steps, setSteps] = useState<WorkflowStep[]>([])

    // For step editing - now using dialog
    const [editingStepIndex, setEditingStepIndex] = useState<number | null>(null)
    const [showEmailPreview, setShowEmailPreview] = useState(false)
    const [showSmsPreview, setShowSmsPreview] = useState(false)
    const [signature, setSignature] = useState('')

    useEffect(() => {
        if (workflowId) {
            fetchWorkflow(workflowId)
        } else {
            setSteps([
                { name: 'Initial Email', type: 'EMAIL', config: { subject: '', body: '', includeSignature: true } }
            ])
        }
        fetchSignature()
    }, [workflowId])

    async function fetchSignature() {
        try {
            const res = await fetch('/api/settings?key=email_signature').then(r => r.json())
            if (res.success && res.setting) {
                setSignature(res.setting.value)
            }
        } catch (e) {
            console.warn('Failed to load signature')
        }
    }

    async function fetchWorkflow(id: number) {
        setLoading(true)
        try {
            const res = await fetch(`/api/workflows/${id}`).then(r => r.json())
            if (res.success) {
                const w = res.workflow
                setName(w.name)
                setDescription(w.description || '')
                setTriggerType(w.triggerType)
                setTriggerStatus(w.triggerStatus || '')
                setTriggerSubStatus(w.triggerSubStatus || '__NONE__')
                setSteps(w.steps.map((s: any) => ({
                    ...s,
                    config: typeof s.config === 'string' ? JSON.parse(s.config) : s.config
                })))
            }
        } catch (e) {
            toast.error('Failed to load workflow')
        }
        setLoading(false)
    }

    async function saveWorkflow() {
        if (!name) return toast.error('Name is required')

        setLoading(true)
        const payload = {
            name,
            description,
            triggerType,
            triggerStatus,
            triggerSubStatus: triggerSubStatus === '__NONE__' ? null : triggerSubStatus,
            steps: steps.map(s => ({
                name: s.name,
                type: s.type,
                config: s.config
            }))
        }

        try {
            const url = workflowId ? `/api/workflows/${workflowId}` : '/api/workflows'
            const method = workflowId ? 'PUT' : 'POST'
            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            }).then(r => r.json())

            if (res.success) {
                toast.success('Workflow saved!')
                onClose()
            } else {
                throw new Error(res.error)
            }
        } catch (e) {
            toast.error('Failed to save: ' + String(e))
        }
        setLoading(false)
    }

    function addStep(type: string, sendSmsAlso = false) {
        const newStep: WorkflowStep = {
            name: sendSmsAlso ? 'Email + SMS' : `New ${type} Step`,
            type: type as any,
            config: type === 'EMAIL' ? {
                subject: '',
                body: '',
                includeSignature: true,
                sendSmsAlso,
                smsBody: ''
            } : type === 'SMS' ? {
                body: ''
            } : type === 'DELAY' ? {
                delayType: 'FIXED',
                fixedDuration: 1,
                fixedUnit: 'DAYS',
                cancelOnStatuses: []
            } : {}
        }
        setSteps([...steps, newStep])
        setEditingStepIndex(steps.length)
    }

    function removeStep(index: number) {
        setSteps(steps.filter((_, i) => i !== index))
        if (editingStepIndex === index) setEditingStepIndex(null)
    }

    function updateStep(index: number, updates: Partial<WorkflowStep>) {
        const newSteps = [...steps]
        newSteps[index] = { ...newSteps[index], ...updates }
        setSteps(newSteps)
    }

    function toggleCancelStatus(status: string) {
        if (editingStepIndex === null) return
        const current = steps[editingStepIndex].config.cancelOnStatuses || []
        const updated = current.includes(status)
            ? current.filter((s: string) => s !== status)
            : [...current, status]
        updateStep(editingStepIndex, {
            config: { ...steps[editingStepIndex].config, cancelOnStatuses: updated }
        })
    }

    const subStatuses = (triggerStatus && STAGE_CONFIG[triggerStatus as PipelineStage]?.subStatuses) || []
    const editingStep = editingStepIndex !== null ? steps[editingStepIndex] : null

    // Preview helper
    function renderPreview(text: string) {
        return (text || '')
            .replace(/\n/g, '<br/>')
            .replace(/{name}/g, '<span class="bg-blue-100 px-1 rounded">John Doe</span>')
            .replace(/{website}/g, '<span class="bg-blue-100 px-1 rounded">example.com</span>')
            .replace(/{audit_link}/g, '<a href="#" class="text-blue-600 underline">Audit Link</a>')
            .replace(/{proposal_link}/g, '<a href="#" class="text-blue-600 underline">Proposal Link</a>')
            .replace(/{signature}/g, signature || '<em class="text-gray-400">[Signature]</em>')
    }

    return (
        <div className="flex flex-col h-full bg-white rounded-lg shadow-sm">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={onClose}>
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <div>
                        <Input
                            value={name}
                            onChange={e => setName(e.target.value)}
                            placeholder="Workflow Name"
                            className="font-semibold text-lg border-none hover:bg-slate-50 focus:bg-white px-2 -ml-2 h-8 w-[300px]"
                        />
                        <p className="text-xs text-slate-500 px-2">
                            {triggerType === 'ON_STATUS_CHANGE'
                                ? `Triggers when status is ${triggerStatus} ${triggerSubStatus !== '__NONE__' ? `(${triggerSubStatus})` : ''}`
                                : 'Manual/Scheduled Trigger'}
                        </p>
                    </div>
                </div>
                <Button onClick={saveWorkflow} disabled={loading}>
                    <Save className="mr-2 h-4 w-4" />
                    {loading ? 'Saving...' : 'Save Workflow'}
                </Button>
            </div>

            {/* Main Builder Area - Now Full Width */}
            <div className="flex-1 overflow-y-auto p-8 bg-slate-50/50">
                {/* Trigger Card */}
                <div className="max-w-2xl mx-auto mb-8">
                    <Card className="border-l-4 border-l-blue-500 shadow-sm">
                        <CardContent className="p-4 flex items-center gap-4">
                            <div className="bg-blue-100 p-2 rounded-full">
                                <Zap className="h-5 w-5 text-blue-600" />
                            </div>
                            <div className="flex-1 grid grid-cols-3 gap-4">
                                <div>
                                    <Label className="text-xs">Trigger</Label>
                                    <Select value={triggerType} onValueChange={setTriggerType} disabled>
                                        <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="ON_STATUS_CHANGE">Status Change</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    <Label className="text-xs">Stage</Label>
                                    <Select value={triggerStatus} onValueChange={setTriggerStatus}>
                                        <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            {Object.entries(STAGE_CONFIG).map(([key, config]) => (
                                                <SelectItem key={key} value={key}>{config.label}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                {subStatuses.length > 0 && (
                                    <div>
                                        <Label className="text-xs">Sub-status</Label>
                                        <Select value={triggerSubStatus || '__NONE__'} onValueChange={setTriggerSubStatus}>
                                            <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="__NONE__">Any</SelectItem>
                                                {subStatuses.map(sub => (
                                                    <SelectItem key={sub} value={sub}>{sub}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                    <div className="flex justify-center my-2">
                        <div className="w-0.5 h-8 bg-slate-300"></div>
                    </div>
                </div>

                {/* Steps List */}
                <div className="max-w-2xl mx-auto space-y-4">
                    {steps.map((step, index) => {
                        const isEmailSms = step.type === 'EMAIL' && step.config?.sendSmsAlso
                        const isSms = step.type === 'SMS'
                        const Icon = isEmailSms ? Layers : (STEP_TYPES.find(t => t.type === step.type)?.icon || AlertCircle)
                        const typeLabel = isEmailSms ? 'EMAIL + SMS' : step.type
                        const borderColor = isSms ? 'border-l-green-500' : isEmailSms ? 'border-l-indigo-500' : 'border-l-slate-300'
                        const iconBg = isSms ? 'bg-green-100' : isEmailSms ? 'bg-indigo-100' : 'bg-slate-100'
                        const iconColor = isSms ? 'text-green-600' : isEmailSms ? 'text-indigo-600' : 'text-slate-600'

                        return (
                            <div key={index}>
                                <Card
                                    className={`cursor-pointer transition-all border-l-4 ${borderColor} ${editingStepIndex === index ? 'ring-2 ring-indigo-500 shadow-md' : 'hover:border-l-indigo-400'}`}
                                    onClick={() => setEditingStepIndex(index)}
                                >
                                    <CardContent className="p-4 flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className={`p-2 rounded-md ${iconBg}`}>
                                                <Icon className={`h-5 w-5 ${iconColor}`} />
                                            </div>
                                            <div>
                                                <div className="font-medium text-sm">{step.name}</div>
                                                <div className="text-xs text-slate-500">{typeLabel}</div>
                                            </div>
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                            onClick={(e) => { e.stopPropagation(); removeStep(index); }}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </CardContent>
                                </Card>
                                {index < steps.length && (
                                    <div className="flex justify-center my-2">
                                        <div className="w-0.5 h-6 bg-slate-300"></div>
                                    </div>
                                )}
                            </div>
                        )
                    })}

                    {/* Add Step Buttons */}
                    <div className="flex justify-center pt-2 pb-12">
                        <div className="bg-white p-2 rounded-lg border shadow-sm flex gap-2 flex-wrap justify-center">
                            {STEP_TYPES.map(t => (
                                <Button
                                    key={t.type}
                                    variant="ghost"
                                    size="sm"
                                    className={`gap-2 text-xs ${t.type === 'SMS' ? 'text-green-600 hover:bg-green-50' : ''}`}
                                    onClick={() => addStep(t.type)}
                                >
                                    <t.icon className="h-3 w-3" /> {t.label}
                                </Button>
                            ))}
                            <Separator orientation="vertical" className="h-6" />
                            <Button
                                variant="ghost"
                                size="sm"
                                className="gap-2 text-xs text-indigo-600 hover:bg-indigo-50"
                                onClick={() => addStep('EMAIL', true)}
                            >
                                <Layers className="h-3 w-3" /> Email + SMS
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Step Editor Dialog */}
            <Dialog open={editingStepIndex !== null} onOpenChange={(open) => !open && setEditingStepIndex(null)}>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            {editingStep?.type === 'SMS' ? (
                                <MessageSquare className="h-5 w-5 text-green-600" />
                            ) : editingStep?.config?.sendSmsAlso ? (
                                <Layers className="h-5 w-5 text-indigo-600" />
                            ) : (
                                <Mail className="h-5 w-5" />
                            )}
                            Edit Step
                        </DialogTitle>
                    </DialogHeader>

                    {editingStep && (
                        <div className="space-y-6 pt-4">
                            {/* Step Name */}
                            <div>
                                <Label>Step Name</Label>
                                <Input
                                    value={editingStep.name}
                                    onChange={(e) => updateStep(editingStepIndex!, { name: e.target.value })}
                                />
                            </div>

                            <Separator />

                            {/* DELAY Step */}
                            {editingStep.type === 'DELAY' && (
                                <div className="space-y-4">
                                    <div>
                                        <Label>Delay Type</Label>
                                        <Select
                                            value={editingStep.config.delayType || 'FIXED'}
                                            onValueChange={(val) => updateStep(editingStepIndex!, {
                                                config: { ...editingStep.config, delayType: val }
                                            })}
                                        >
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="FIXED">Fixed Duration</SelectItem>
                                                <SelectItem value="SMART_STAGE_2">Smart: Stage 2 Nurture</SelectItem>
                                                <SelectItem value="SMART_STAGE_3">Smart: Stage 3 Nurture</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        {editingStep.config.delayType?.startsWith('SMART') && (
                                            <p className="text-xs text-blue-600 mt-1">
                                                ⚡ Uses lead creation time to calculate optimal send time
                                            </p>
                                        )}
                                    </div>

                                    {editingStep.config.delayType === 'FIXED' && (
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <Label>Duration</Label>
                                                <Input
                                                    type="number"
                                                    value={editingStep.config.fixedDuration || 1}
                                                    onChange={(e) => updateStep(editingStepIndex!, {
                                                        config: { ...editingStep.config, fixedDuration: parseInt(e.target.value) }
                                                    })}
                                                />
                                            </div>
                                            <div>
                                                <Label>Unit</Label>
                                                <Select
                                                    value={editingStep.config.fixedUnit || 'DAYS'}
                                                    onValueChange={(val) => updateStep(editingStepIndex!, {
                                                        config: { ...editingStep.config, fixedUnit: val }
                                                    })}
                                                >
                                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="HOURS">Hours</SelectItem>
                                                        <SelectItem value="DAYS">Days</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>
                                    )}

                                    {/* Multi-Select Cancel Conditions */}
                                    <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                                        <Label className="text-amber-800 font-medium">Cancel if status changes to:</Label>
                                        <p className="text-xs text-amber-700 mb-3">Select any statuses that should cancel remaining steps</p>
                                        <div className="grid grid-cols-3 gap-2">
                                            {Object.entries(STAGE_CONFIG).map(([key, config]) => (
                                                <label key={key} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-amber-100 p-1 rounded">
                                                    <Checkbox
                                                        checked={(editingStep.config.cancelOnStatuses || []).includes(key)}
                                                        onCheckedChange={() => toggleCancelStatus(key)}
                                                    />
                                                    {config.label}
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* EMAIL Step */}
                            {editingStep.type === 'EMAIL' && (
                                <div className="space-y-4">
                                    <div>
                                        <Label>Subject</Label>
                                        <Input
                                            value={editingStep.config.subject || ''}
                                            onChange={(e) => updateStep(editingStepIndex!, {
                                                config: { ...editingStep.config, subject: e.target.value }
                                            })}
                                            placeholder="Email Subject"
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <Label className="text-xs">Sender Name</Label>
                                            <Input
                                                value={editingStep.config.senderName || ''}
                                                onChange={(e) => updateStep(editingStepIndex!, {
                                                    config: { ...editingStep.config, senderName: e.target.value }
                                                })}
                                                placeholder="e.g., Mehrdad from Mehrana"
                                            />
                                        </div>
                                        <div>
                                            <Label className="text-xs">Reply-To</Label>
                                            <Input
                                                value={editingStep.config.replyTo || ''}
                                                onChange={(e) => updateStep(editingStepIndex!, {
                                                    config: { ...editingStep.config, replyTo: e.target.value }
                                                })}
                                                placeholder="e.g., support@mehrana.agency"
                                            />
                                        </div>
                                    </div>

                                    {/* Email Body */}
                                    <div>
                                        <div className="flex items-center justify-between mb-2">
                                            <Label>Email Body</Label>
                                            <div className="flex items-center gap-3">
                                                <label className="flex items-center gap-2 text-xs cursor-pointer">
                                                    <Checkbox
                                                        checked={editingStep.config.includeSignature !== false}
                                                        onCheckedChange={(checked) => updateStep(editingStepIndex!, {
                                                            config: { ...editingStep.config, includeSignature: checked }
                                                        })}
                                                    />
                                                    Include Signature
                                                </label>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => setShowEmailPreview(!showEmailPreview)}
                                                    className="h-6 text-xs gap-1"
                                                >
                                                    {showEmailPreview ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                                                    {showEmailPreview ? 'Edit' : 'Preview'}
                                                </Button>
                                            </div>
                                        </div>
                                        <p className="text-xs text-muted-foreground mb-2">
                                            Variables: {'{name}'}, {'{website}'}, {'{audit_link}'}, {'{proposal_link}'}, {'{signature}'}
                                        </p>
                                        {showEmailPreview ? (
                                            <div
                                                className="border rounded-lg p-4 min-h-[300px] max-h-[400px] overflow-auto bg-white prose prose-sm max-w-none"
                                                dangerouslySetInnerHTML={{
                                                    __html: renderPreview(editingStep.config.body) +
                                                        (editingStep.config.includeSignature !== false ? '<br/><br/>' + (signature || '') : '')
                                                }}
                                            />
                                        ) : (
                                            <Textarea
                                                value={editingStep.config.body || ''}
                                                onChange={(e) => updateStep(editingStepIndex!, {
                                                    config: { ...editingStep.config, body: e.target.value }
                                                })}
                                                className="h-[300px] font-mono text-sm"
                                                placeholder="Write your email here..."
                                            />
                                        )}
                                    </div>

                                    {/* SMS Section for Email+SMS */}
                                    {editingStep.config.sendSmsAlso && (
                                        <div className="p-4 bg-green-50 border border-green-200 rounded-lg space-y-3">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <MessageSquare className="h-4 w-4 text-green-600" />
                                                    <Label className="text-green-800 font-medium">SMS Message (Sent Simultaneously)</Label>
                                                </div>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => setShowSmsPreview(!showSmsPreview)}
                                                    className="h-6 text-xs gap-1 text-green-700 hover:bg-green-100"
                                                >
                                                    {showSmsPreview ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                                                    {showSmsPreview ? 'Edit' : 'Preview'}
                                                </Button>
                                            </div>
                                            <p className="text-xs text-green-700">
                                                Variables: {'{name}'}, {'{website}'}
                                            </p>
                                            {showSmsPreview ? (
                                                <div
                                                    className="border border-green-300 rounded-lg p-4 min-h-[100px] bg-white"
                                                    dangerouslySetInnerHTML={{ __html: renderPreview(editingStep.config.smsBody) }}
                                                />
                                            ) : (
                                                <Textarea
                                                    value={editingStep.config.smsBody || ''}
                                                    onChange={(e) => updateStep(editingStepIndex!, {
                                                        config: { ...editingStep.config, smsBody: e.target.value }
                                                    })}
                                                    className="h-[120px] bg-white"
                                                    placeholder="Write SMS message here (keep it short!)"
                                                />
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* SMS Step (standalone) */}
                            {editingStep.type === 'SMS' && (
                                <div className="p-4 bg-green-50 border border-green-200 rounded-lg space-y-3">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <MessageSquare className="h-4 w-4 text-green-600" />
                                            <Label className="text-green-800 font-medium">SMS Message</Label>
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => setShowSmsPreview(!showSmsPreview)}
                                            className="h-6 text-xs gap-1 text-green-700 hover:bg-green-100"
                                        >
                                            {showSmsPreview ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                                            {showSmsPreview ? 'Edit' : 'Preview'}
                                        </Button>
                                    </div>
                                    <p className="text-xs text-green-700">
                                        Variables: {'{name}'}, {'{website}'}
                                    </p>
                                    {showSmsPreview ? (
                                        <div
                                            className="border border-green-300 rounded-lg p-4 min-h-[100px] bg-white"
                                            dangerouslySetInnerHTML={{ __html: renderPreview(editingStep.config.body) }}
                                        />
                                    ) : (
                                        <Textarea
                                            value={editingStep.config.body || ''}
                                            onChange={(e) => updateStep(editingStepIndex!, {
                                                config: { ...editingStep.config, body: e.target.value }
                                            })}
                                            className="h-[150px] bg-white"
                                            placeholder="Write SMS message here (keep it short!)"
                                        />
                                    )}
                                </div>
                            )}

                            {/* ACTION Step */}
                            {editingStep.type === 'ACTION' && (
                                <div>
                                    <Label>Action Type</Label>
                                    <Select
                                        value={editingStep.config.actionType || 'INSTANTLY_ADD_LEAD'}
                                        onValueChange={(val) => updateStep(editingStepIndex!, {
                                            config: { ...editingStep.config, actionType: val }
                                        })}
                                    >
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="INSTANTLY_ADD_LEAD">Add to Instantly Campaign</SelectItem>
                                            <SelectItem value="WEBHOOK">Call Webhook</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    {editingStep.config.actionType === 'INSTANTLY_ADD_LEAD' && (
                                        <div className="mt-4">
                                            <Label>Campaign ID</Label>
                                            <Input
                                                value={editingStep.config.campaignId || ''}
                                                onChange={(e) => updateStep(editingStepIndex!, {
                                                    config: { ...editingStep.config, campaignId: e.target.value }
                                                })}
                                                placeholder="Instantly Campaign ID"
                                            />
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    )
}
