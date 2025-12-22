"use client"

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { STAGE_CONFIG, PipelineStage } from '@/lib/status-mapping'
import { ArrowLeft, Save, Trash2, Mail, MessageSquare, Clock, Zap, Eye, EyeOff, Layers, AlertCircle, ArrowRightLeft } from 'lucide-react'
import { toast } from 'sonner'

interface WorkflowBuilderProps {
    workflowId: number | null
    onClose: () => void
}

interface WorkflowStep {
    id?: number
    name: string
    type: 'EMAIL' | 'SMS' | 'DELAY' | 'CONDITION' | 'ACTION' | 'STATUS_CHANGE'
    config: any
}

const STEP_TYPES = [
    { type: 'EMAIL', label: 'Send Email', icon: Mail },
    { type: 'SMS', label: 'Send SMS', icon: MessageSquare },
    { type: 'DELAY', label: 'Delay', icon: Clock },
    { type: 'ACTION', label: 'External Action', icon: Zap },
    { type: 'STATUS_CHANGE', label: 'Change Status', icon: ArrowRightLeft },
]

export function WorkflowBuilder({ workflowId, onClose }: WorkflowBuilderProps) {
    const [loading, setLoading] = useState(false)
    const [name, setName] = useState('')
    const [description, setDescription] = useState('')
    const [triggerType, setTriggerType] = useState('ON_STATUS_CHANGE')
    const [triggerStatus, setTriggerStatus] = useState<string>('New')
    const [triggerSubStatus, setTriggerSubStatus] = useState<string>('__NONE__')
    const [executionMode, setExecutionMode] = useState('AUTO')
    const [pipelineStage, setPipelineStage] = useState<string>('__GENERAL__')
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
                setExecutionMode(w.executionMode || 'AUTO')
                setPipelineStage(w.pipelineStage || '__GENERAL__')
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
            executionMode,
            pipelineStage: pipelineStage === '__GENERAL__' ? null : pipelineStage,
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
            } : type === 'ACTION' ? {
                service: 'INSTANTLY',
                campaignId: '',
                fields: ['email', 'name', 'phone', 'website']
            } : type === 'STATUS_CHANGE' ? {
                status: '',
                subStatus: ''
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
                    <div className="flex-1">
                        <Input
                            value={name}
                            onChange={e => setName(e.target.value)}
                            placeholder="Workflow Name"
                            className="font-semibold text-lg border-none hover:bg-slate-50 focus:bg-white px-2 -ml-2 h-8 w-[400px]"
                        />
                        <Input
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                            placeholder="Add a description... (what does this workflow do?)"
                            className="text-sm text-slate-500 border-none hover:bg-slate-50 focus:bg-white px-2 -ml-2 h-6 w-[400px]"
                        />
                    </div>
                </div>
                <Button onClick={saveWorkflow} disabled={loading}>
                    <Save className="mr-2 h-4 w-4" />
                    {loading ? 'Saving...' : 'Save Workflow'}
                </Button>
            </div>

            {/* Main Builder Area - Now Full Width */}
            <div className="flex-1 overflow-y-auto p-12 bg-[#f8fafc]">
                {/* Trigger & Settings Card */}
                <div className="max-w-3xl mx-auto mb-10 relative">
                    {/* Visual Line Connector */}
                    <div className="absolute left-1/2 -bottom-10 w-0.5 h-10 bg-blue-200 -translate-x-1/2 z-0" />

                    <div className="relative z-10 bg-white border-2 border-blue-500 rounded-2xl shadow-lg shadow-blue-50 overflow-hidden">
                        <div className="bg-blue-500 px-6 py-3 flex items-center justify-between">
                            <div className="flex items-center gap-3 text-white">
                                < Zap className="h-5 w-5 fill-white" />
                                <span className="font-bold tracking-tight uppercase text-xs">Workflow Trigger</span>
                            </div>
                            <Badge className="bg-blue-400/30 text-white border-none text-[10px]">SYSTEM ENTRY</Badge>
                        </div>
                        <div className="p-8">
                            <div className="grid grid-cols-2 gap-8">
                                <div className="space-y-4">
                                    <div className="space-y-1.5">
                                        <Label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Execution Mode</Label>
                                        <Select value={executionMode} onValueChange={setExecutionMode}>
                                            <SelectTrigger className="h-10 font-medium border-slate-200">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="AUTO" className="py-3">
                                                    <div className="flex flex-col gap-0.5">
                                                        <span className="font-bold flex items-center gap-2">⚡ Automatic</span>
                                                        <span className="text-[10px] text-slate-500 uppercase tracking-tight">Runs instantly when triggered</span>
                                                    </div>
                                                </SelectItem>
                                                <SelectItem value="MANUAL" className="py-3">
                                                    <div className="flex flex-col gap-0.5">
                                                        <span className="font-bold flex items-center gap-2">👆 Manual</span>
                                                        <span className="text-[10px] text-slate-500 uppercase tracking-tight">Shows as suggestion on Lead Card</span>
                                                    </div>
                                                </SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Trigger Status</Label>
                                        <Select value={triggerStatus} onValueChange={setTriggerStatus}>
                                            <SelectTrigger className="h-10 font-medium border-slate-200"><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                {Object.entries(STAGE_CONFIG).map(([key, config]) => (
                                                    <SelectItem key={key} value={key}>{config.label}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                                <div className="space-y-4">
                                    <div className="space-y-1.5">
                                        <Label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Pipeline Filter</Label>
                                        <Select value={pipelineStage} onValueChange={setPipelineStage}>
                                            <SelectTrigger className="h-10 font-medium border-slate-200"><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="__GENERAL__">🌐 Apply to all stages</SelectItem>
                                                {Object.entries(STAGE_CONFIG).map(([key, config]) => (
                                                    <SelectItem key={key} value={key}>{config.label}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    {subStatuses.length > 0 && (
                                        <div className="space-y-1.5">
                                            <Label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Sub-status Filter</Label>
                                            <Select value={triggerSubStatus || '__NONE__'} onValueChange={setTriggerSubStatus}>
                                                <SelectTrigger className="h-10 font-medium border-slate-200"><SelectValue /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="__NONE__">Any sub-status</SelectItem>
                                                    {subStatuses.map(sub => (
                                                        <SelectItem key={sub} value={sub}>{sub}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Steps List */}
                <div className="max-w-2xl mx-auto space-y-0 flex flex-col items-center">
                    {steps.map((step, index) => {
                        const isEmailSms = step.type === 'EMAIL' && step.config?.sendSmsAlso
                        const isSms = step.type === 'SMS'
                        const isDelay = step.type === 'DELAY'
                        const Icon = isEmailSms ? Layers : (STEP_TYPES.find(t => t.type === step.type)?.icon || AlertCircle)
                        const typeLabel = isEmailSms ? 'EMAIL + SMS' : step.type
                        const themeColor = isSms ? 'green' : isEmailSms ? 'indigo' : isDelay ? 'amber' : 'blue'

                        return (
                            <div key={index} className="w-full relative flex flex-col items-center group">
                                {/* Visual Connector Line (Top) */}
                                {index >= 0 && <div className="w-0.5 h-10 bg-slate-200 group-hover:bg-blue-200 transition-colors" />}

                                <div
                                    className={`w-full bg-white border-2 rounded-2xl p-6 transition-all duration-200 cursor-pointer relative z-10 ${editingStepIndex === index
                                        ? `border-blue-500 shadow-xl shadow-blue-100 ring-4 ring-blue-50`
                                        : `border-slate-100 hover:border-blue-300 hover:shadow-lg`
                                        }`}
                                    onClick={() => setEditingStepIndex(index)}
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-5">
                                            <div className={`p-4 rounded-xl shadow-sm ${themeColor === 'green' ? 'bg-emerald-50 text-emerald-600' :
                                                themeColor === 'indigo' ? 'bg-indigo-50 text-indigo-600' :
                                                    themeColor === 'amber' ? 'bg-amber-50 text-amber-600' : 'bg-blue-50 text-blue-600'
                                                }`}>
                                                <Icon className="h-6 w-6" />
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2 mb-0.5">
                                                    <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Step {index + 1}</span>
                                                    <Separator orientation="vertical" className="h-2 bg-slate-200" />
                                                    <span className={`text-[10px] font-extrabold uppercase tracking-widest ${themeColor === 'green' ? 'text-emerald-500' :
                                                        themeColor === 'indigo' ? 'text-indigo-500' :
                                                            themeColor === 'amber' ? 'text-amber-500' : 'text-blue-500'
                                                        }`}>{typeLabel}</span>
                                                </div>
                                                <h4 className="text-lg font-bold text-slate-800">{step.name}</h4>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-10 w-10 text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                                                onClick={(e) => { e.stopPropagation(); removeStep(index); }}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>

                                    {/* Preview logic in card for context */}
                                    <div className="mt-4 pt-4 border-t border-slate-50">
                                        {isDelay ? (
                                            <div className="flex items-center gap-2 text-xs font-medium text-slate-500 bg-slate-50 rounded-lg py-2 px-3 border border-slate-100">
                                                <Clock className="h-3.5 w-3.5 text-amber-500" />
                                                <span>Wait for {step.config.fixedDuration} {step.config.fixedUnit}{step.config.fixedDuration !== 1 ? 's' : ''}</span>
                                            </div>
                                        ) : step.type === 'STATUS_CHANGE' ? (
                                            <div className="flex items-center gap-2 text-xs font-medium text-slate-500 bg-purple-50 rounded-lg py-2 px-3 border border-purple-100">
                                                <ArrowRightLeft className="h-3.5 w-3.5 text-purple-500" />
                                                <span>Change to: {step.config.status || 'Not set'}{step.config.subStatus ? ` - ${step.config.subStatus}` : ''}</span>
                                            </div>
                                        ) : (
                                            <div className="text-xs text-slate-400 line-clamp-1 italic">
                                                {step.config.subject || step.config.body || "No content configured yet"}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Visual Connector Line (Bottom) - Only if last */}
                                {index === steps.length - 1 && <div className="w-0.5 h-10 bg-slate-200 group-hover:bg-blue-200 transition-colors" />}
                            </div>
                        )
                    })}

                    {/* Add Step Experience */}
                    <div className="relative z-10 w-full flex flex-col items-center">
                        <div className="bg-white p-3 rounded-2xl border-2 border-dashed border-slate-200 shadow-sm flex items-center gap-3 hover:border-blue-400 transition-all duration-300">
                            {STEP_TYPES.map(t => (
                                <Button
                                    key={t.type}
                                    variant="ghost"
                                    size="sm"
                                    className={`h-11 px-4 gap-2 text-xs font-bold rounded-xl transition-all ${t.type === 'SMS' ? 'text-emerald-700 hover:bg-emerald-50' :
                                        t.type === 'DELAY' ? 'text-amber-700 hover:bg-amber-50' : 'text-slate-700 hover:bg-slate-50'
                                        }`}
                                    onClick={() => addStep(t.type)}
                                >
                                    <div className="p-1.5 rounded-lg bg-current/10">
                                        <t.icon className="h-3.5 w-3.5" />
                                    </div>
                                    {t.label}
                                </Button>
                            ))}
                            <Separator orientation="vertical" className="h-6 bg-slate-200" />
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-11 px-4 gap-2 text-xs font-bold text-blue-700 hover:bg-blue-50 rounded-xl"
                                onClick={() => addStep('EMAIL', true)}
                            >
                                <div className="p-1.5 rounded-lg bg-current/10">
                                    <Layers className="h-3.5 w-3.5" />
                                </div>
                                Send Email + SMS
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

                            {/* ACTION Step (Instantly.ai etc.) */}
                            {editingStep.type === 'ACTION' && (
                                <div className="space-y-4">
                                    <div>
                                        <Label>Integration Service</Label>
                                        <Select
                                            value={editingStep.config.service || 'INSTANTLY'}
                                            onValueChange={(val) => updateStep(editingStepIndex!, {
                                                config: { ...editingStep.config, service: val }
                                            })}
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select service" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="INSTANTLY">Instantly.ai</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    {editingStep.config.service === 'INSTANTLY' && (
                                        <>
                                            <div>
                                                <Label>Campaign ID</Label>
                                                <Input
                                                    value={editingStep.config.campaignId || ''}
                                                    onChange={(e) => updateStep(editingStepIndex!, {
                                                        config: { ...editingStep.config, campaignId: e.target.value }
                                                    })}
                                                    placeholder="e.g., 011cbf96-a9ec-4a09-b88d-991fd4a0cf08"
                                                />
                                                <p className="text-xs text-slate-500 mt-1">
                                                    Get this from your Instantly campaign settings
                                                </p>
                                            </div>

                                            <div>
                                                <Label>Fields to Send</Label>
                                                <div className="grid grid-cols-2 gap-2 mt-2">
                                                    {['email', 'name', 'phone', 'website'].map((field) => (
                                                        <label key={field} className="flex items-center gap-2 text-sm">
                                                            <Checkbox
                                                                checked={(editingStep.config.fields || []).includes(field)}
                                                                onCheckedChange={(checked) => {
                                                                    const current = editingStep.config.fields || []
                                                                    const updated = checked
                                                                        ? [...current, field]
                                                                        : current.filter((f: string) => f !== field)
                                                                    updateStep(editingStepIndex!, {
                                                                        config: { ...editingStep.config, fields: updated }
                                                                    })
                                                                }}
                                                                disabled={field === 'email'}
                                                            />
                                                            <span className="capitalize">{field}</span>
                                                            {field === 'email' && <span className="text-xs text-slate-400">(required)</span>}
                                                        </label>
                                                    ))}
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </div>
                            )}

                            {/* STATUS_CHANGE Step */}
                            {editingStep.type === 'STATUS_CHANGE' && (
                                <div className="space-y-4 p-4 bg-purple-50 border border-purple-200 rounded-lg">
                                    <div className="flex items-center gap-2 mb-2">
                                        <ArrowRightLeft className="h-5 w-5 text-purple-600" />
                                        <Label className="text-purple-800 font-medium">Change Lead Status</Label>
                                    </div>
                                    <p className="text-xs text-purple-700 mb-4">
                                        Update the lead's status when this step is reached in the workflow.
                                    </p>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <Label>New Status</Label>
                                            <Select
                                                value={editingStep.config.status || ''}
                                                onValueChange={(val) => updateStep(editingStepIndex!, {
                                                    config: { ...editingStep.config, status: val, subStatus: '' }
                                                })}
                                            >
                                                <SelectTrigger><SelectValue placeholder="Select status..." /></SelectTrigger>
                                                <SelectContent>
                                                    {Object.entries(STAGE_CONFIG).map(([key, config]) => (
                                                        <SelectItem key={key} value={key}>{config.label}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        {editingStep.config.status && STAGE_CONFIG[editingStep.config.status as PipelineStage]?.subStatuses?.length > 0 && (
                                            <div>
                                                <Label>Sub-Status (Optional)</Label>
                                                <Select
                                                    value={editingStep.config.subStatus || '__NONE__'}
                                                    onValueChange={(val) => updateStep(editingStepIndex!, {
                                                        config: { ...editingStep.config, subStatus: val === '__NONE__' ? '' : val }
                                                    })}
                                                >
                                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="__NONE__">None</SelectItem>
                                                        {STAGE_CONFIG[editingStep.config.status as PipelineStage]?.subStatuses?.map((sub: string) => (
                                                            <SelectItem key={sub} value={sub}>{sub}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        )}
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
