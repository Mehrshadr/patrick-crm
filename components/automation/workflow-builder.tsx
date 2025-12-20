
"use client"

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import { STAGE_CONFIG, PipelineStage } from '@/lib/status-mapping'
import { ArrowLeft, Save, Plus, Trash2, Mail, MessageSquare, Clock, AlertCircle, Zap, Eye, EyeOff } from 'lucide-react'
import { toast } from 'sonner'
import { getCaretCoordinates } from '@/lib/textarea-utils'

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

// Icon for combined Email+SMS step
import { Layers } from 'lucide-react'

export function WorkflowBuilder({ workflowId, onClose }: WorkflowBuilderProps) {
    const [loading, setLoading] = useState(false)
    const [name, setName] = useState('')
    const [description, setDescription] = useState('')
    const [triggerType, setTriggerType] = useState('ON_STATUS_CHANGE')
    const [triggerStatus, setTriggerStatus] = useState<string>('New')
    const [triggerSubStatus, setTriggerSubStatus] = useState<string>('__NONE__')
    const [steps, setSteps] = useState<WorkflowStep[]>([])

    // For step editing
    const [editingStepIndex, setEditingStepIndex] = useState<number | null>(null)
    const [showPreview, setShowPreview] = useState(false)
    const [signature, setSignature] = useState('')

    useEffect(() => {
        if (workflowId) {
            fetchWorkflow(workflowId)
        } else {
            // Default template
            setSteps([
                { name: 'Initial Email', type: 'EMAIL', config: { subject: '', body: '' } }
            ])
        }
        // Fetch signature
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

                // Parse step configs
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

    function addStep(type: string) {
        const newStep: WorkflowStep = {
            name: `New ${type} Step`,
            type: type as any,
            config: {}
        }
        setSteps([...steps, newStep])
        setEditingStepIndex(steps.length) // Open editor for new step
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

    // Helper to get sub-statuses
    const subStatuses = (triggerStatus && STAGE_CONFIG[triggerStatus as PipelineStage]?.subStatuses) || []

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

            <div className="flex flex-1 overflow-hidden">
                {/* Visual Builder (Left/Main) */}
                <div className="flex-1 overflow-y-auto p-8 bg-slate-50/50">

                    {/* Trigger Card */}
                    <div className="max-w-2xl mx-auto mb-8">
                        <Card className="border-l-4 border-l-blue-500 shadow-sm">
                            <CardContent className="p-4 flex items-center gap-4">
                                <div className="bg-blue-100 p-2 rounded-full">
                                    <Zap className="h-5 w-5 text-blue-600" />
                                </div>
                                <div className="flex-1 grid grid-cols-2 gap-4">
                                    <div>
                                        <Label className="text-xs">Trigger</Label>
                                        <Select value={triggerType} onValueChange={setTriggerType} disabled>
                                            <SelectTrigger className="h-8">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="ON_STATUS_CHANGE">Status Change</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="flex gap-2">
                                        <div className="flex-1">
                                            <Label className="text-xs">Stage</Label>
                                            <Select value={triggerStatus} onValueChange={setTriggerStatus}>
                                                <SelectTrigger className="h-8">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {Object.entries(STAGE_CONFIG).map(([key, config]) => (
                                                        <SelectItem key={key} value={key}>{config.label}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        {subStatuses.length > 0 && (
                                            <div className="flex-1">
                                                <Label className="text-xs">Sub-status</Label>
                                                <Select value={triggerSubStatus || '__NONE__'} onValueChange={setTriggerSubStatus}>
                                                    <SelectTrigger className="h-8">
                                                        <SelectValue />
                                                    </SelectTrigger>
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
                            const Icon = STEP_TYPES.find(t => t.type === step.type)?.icon || AlertCircle
                            return (
                                <div key={index}>
                                    <Card
                                        className={`cursor-pointer transition-all ${editingStepIndex === index ? 'ring-2 ring-indigo-500 shadow-md' : 'hover:border-indigo-300'}`}
                                        onClick={() => setEditingStepIndex(index)}
                                    >
                                        <CardContent className="p-4 flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="bg-slate-100 p-2 rounded-md">
                                                    <Icon className="h-5 w-5 text-slate-600" />
                                                </div>
                                                <div>
                                                    <div className="font-medium text-sm">{step.name}</div>
                                                    <div className="text-xs text-slate-500">{step.type}</div>
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

                                    {/* Connector Line */}
                                    {index < steps.length && (
                                        <div className="flex justify-center my-2">
                                            <div className="w-0.5 h-6 bg-slate-300"></div>
                                        </div>
                                    )}
                                </div>
                            )
                        })}

                        {/* Add Function Button */}
                        <div className="flex justify-center pt-2 pb-12">
                            <div className="bg-white p-1 rounded-full border shadow-sm flex gap-1 flex-wrap justify-center">
                                {STEP_TYPES.map(t => (
                                    <Button
                                        key={t.type}
                                        variant="ghost"
                                        size="sm"
                                        className="gap-2 text-xs"
                                        onClick={() => addStep(t.type)}
                                    >
                                        <t.icon className="h-3 w-3" /> {t.label}
                                    </Button>
                                ))}
                                <Separator orientation="vertical" className="h-6" />
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="gap-2 text-xs text-indigo-600"
                                    onClick={() => {
                                        // Add Email+SMS as a special combined step
                                        const newStep: WorkflowStep = {
                                            name: 'Email + SMS',
                                            type: 'EMAIL',
                                            config: {
                                                subject: '',
                                                body: '',
                                                sendSmsAlso: true,
                                                smsBody: ''
                                            }
                                        }
                                        setSteps([...steps, newStep])
                                        setEditingStepIndex(steps.length)
                                    }}
                                >
                                    <Layers className="h-3 w-3" /> Email + SMS
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Settings Panel (Editor) */}
                {editingStepIndex !== null && steps[editingStepIndex] && (
                    <div className="w-[600px] border-l bg-white p-6 overflow-y-auto">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="font-semibold">Edit Step</h3>
                            <Button variant="ghost" size="sm" onClick={() => setEditingStepIndex(null)}>Close</Button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <Label>Step Name</Label>
                                <Input
                                    value={steps[editingStepIndex].name}
                                    onChange={(e) => updateStep(editingStepIndex, { name: e.target.value })}
                                />
                            </div>

                            <Separator />

                            {/* Conditional Rendering based on Type */}
                            {steps[editingStepIndex].type === 'DELAY' && (
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <Label>Duration</Label>
                                        <Input
                                            type="number"
                                            value={steps[editingStepIndex].config.duration || 1}
                                            onChange={(e) => updateStep(editingStepIndex, {
                                                config: { ...steps[editingStepIndex].config, duration: parseInt(e.target.value) }
                                            })}
                                        />
                                    </div>
                                    <div>
                                        <Label>Unit</Label>
                                        <Select
                                            value={steps[editingStepIndex].config.unit || 'DAYS'}
                                            onValueChange={(val) => updateStep(editingStepIndex, {
                                                config: { ...steps[editingStepIndex].config, unit: val }
                                            })}
                                        >
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="HOURS">Hours</SelectItem>
                                                <SelectItem value="DAYS">Days</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="col-span-2 mt-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                                        <Label className="text-xs text-amber-800 font-medium">Cancel Condition (Optional)</Label>
                                        <p className="text-xs text-amber-700 mb-2">If lead status changes to this, cancel remaining steps:</p>
                                        <Select
                                            value={steps[editingStepIndex].config.cancelOnStatus || '__NONE__'}
                                            onValueChange={(val) => updateStep(editingStepIndex, {
                                                config: { ...steps[editingStepIndex].config, cancelOnStatus: val === '__NONE__' ? null : val }
                                            })}
                                        >
                                            <SelectTrigger><SelectValue placeholder="Don't cancel" /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="__NONE__">Don't cancel</SelectItem>
                                                {Object.entries(STAGE_CONFIG).map(([key, config]) => (
                                                    <SelectItem key={key} value={key}>{config.label}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            )}

                            {(steps[editingStepIndex].type === 'EMAIL' || steps[editingStepIndex].type === 'SMS') && (
                                <>
                                    {steps[editingStepIndex].type === 'EMAIL' && (
                                        <div>
                                            <Label>Subject</Label>
                                            <Input
                                                value={steps[editingStepIndex].config.subject || ''}
                                                onChange={(e) => updateStep(editingStepIndex, {
                                                    config: { ...steps[editingStepIndex].config, subject: e.target.value }
                                                })}
                                                placeholder="Email Subject"
                                            />
                                        </div>
                                    )}
                                    <div>
                                        <div className="flex items-center justify-between mb-1">
                                            <Label>
                                                {steps[editingStepIndex].type === 'EMAIL' ? 'Body' : 'Message'}
                                            </Label>
                                            {steps[editingStepIndex].type === 'EMAIL' && (
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => setShowPreview(!showPreview)}
                                                    className="h-6 text-xs gap-1"
                                                >
                                                    {showPreview ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                                                    {showPreview ? 'Edit' : 'Preview'}
                                                </Button>
                                            )}
                                        </div>
                                        <p className="text-xs text-muted-foreground mb-2">
                                            Variables: {'{name}'}, {'{website}'}, {'{audit_link}'}, {'{proposal_link}'}, {'{signature}'}
                                        </p>
                                        {showPreview && steps[editingStepIndex].type === 'EMAIL' ? (
                                            <div
                                                className="border rounded-lg p-4 h-[400px] overflow-auto bg-white prose prose-sm max-w-none"
                                                dangerouslySetInnerHTML={{
                                                    __html: (steps[editingStepIndex].config.body || '')
                                                        .replace(/\n/g, '<br/>')
                                                        .replace(/{name}/g, '<span class="bg-blue-100 px-1 rounded">John Doe</span>')
                                                        .replace(/{website}/g, '<span class="bg-blue-100 px-1 rounded">example.com</span>')
                                                        .replace(/{audit_link}/g, '<a href="#" class="text-blue-600 underline">Audit Link</a>')
                                                        .replace(/{proposal_link}/g, '<a href="#" class="text-blue-600 underline">Proposal Link</a>')
                                                        .replace(/{signature}/g, signature || '<em class="text-gray-400">[Signature]</em>')
                                                }}
                                            />
                                        ) : (
                                            <Textarea
                                                value={steps[editingStepIndex].config.body || ''}
                                                onChange={(e) => updateStep(editingStepIndex, {
                                                    config: { ...steps[editingStepIndex].config, body: e.target.value }
                                                })}
                                                className="h-[400px] font-mono text-sm"
                                                placeholder="Write your message here..."
                                            />
                                        )}
                                    </div>

                                    {/* SMS Field for combined Email+SMS steps */}
                                    {steps[editingStepIndex].type === 'EMAIL' && steps[editingStepIndex].config.sendSmsAlso && (
                                        <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                                            <div className="flex items-center gap-2 mb-2">
                                                <MessageSquare className="h-4 w-4 text-green-600" />
                                                <Label className="text-green-800 font-medium">SMS Message (Sent Simultaneously)</Label>
                                            </div>
                                            <p className="text-xs text-green-700 mb-2">
                                                Variables: {'{name}'}, {'{website}'}
                                            </p>
                                            <Textarea
                                                value={steps[editingStepIndex].config.smsBody || ''}
                                                onChange={(e) => updateStep(editingStepIndex, {
                                                    config: { ...steps[editingStepIndex].config, smsBody: e.target.value }
                                                })}
                                                className="h-[120px] bg-white"
                                                placeholder="Write SMS message here (keeps it short!)"
                                            />
                                        </div>
                                    )}
                                </>
                            )}

                            {steps[editingStepIndex].type === 'ACTION' && (
                                <div>
                                    <Label>Action Type</Label>
                                    <Select
                                        value={steps[editingStepIndex].config.actionType || 'INSTANTLY_ADD_LEAD'}
                                        onValueChange={(val) => updateStep(editingStepIndex, {
                                            config: { ...steps[editingStepIndex].config, actionType: val }
                                        })}
                                    >
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="INSTANTLY_ADD_LEAD">Add to Instantly Campaign</SelectItem>
                                            <SelectItem value="WEBHOOK">Call Webhook</SelectItem>
                                        </SelectContent>
                                    </Select>

                                    {steps[editingStepIndex].config.actionType === 'INSTANTLY_ADD_LEAD' && (
                                        <div className="mt-4">
                                            <Label>Campaign ID</Label>
                                            <Input
                                                value={steps[editingStepIndex].config.campaignId || ''}
                                                onChange={(e) => updateStep(editingStepIndex, {
                                                    config: { ...steps[editingStepIndex].config, campaignId: e.target.value }
                                                })}
                                                placeholder="Instantly Campaign ID"
                                            />
                                            <p className="text-xs text-muted-foreground mt-1">
                                                You can find this in your Instantly campaign URL.
                                            </p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
