"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { Clock, ChevronUp, ChevronDown } from "lucide-react"

interface TimePickerProps {
    value: string // HH:mm format
    onChange: (value: string) => void
    className?: string
}

// Get next rounded time (to nearest 15 min)
export function getDefaultTime(): string {
    const now = new Date()
    const minutes = now.getMinutes()
    const roundedMinutes = Math.ceil(minutes / 15) * 15
    now.setMinutes(roundedMinutes, 0, 0)
    if (roundedMinutes === 60) {
        now.setHours(now.getHours() + 1)
        now.setMinutes(0)
    }
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
}

export function TimePicker({ value, onChange, className }: TimePickerProps) {
    const [open, setOpen] = React.useState(false)

    // Parse current value
    const [hours, minutes] = value.split(':').map(Number)

    // Increment/decrement helpers
    const adjustHours = (delta: number) => {
        let newHours = hours + delta
        if (newHours < 0) newHours = 23
        if (newHours > 23) newHours = 0
        onChange(`${String(newHours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`)
    }

    const adjustMinutes = (delta: number) => {
        let newMinutes = minutes + delta
        let newHours = hours
        if (newMinutes < 0) {
            newMinutes = 45
            newHours = hours - 1
            if (newHours < 0) newHours = 23
        }
        if (newMinutes >= 60) {
            newMinutes = 0
            newHours = hours + 1
            if (newHours > 23) newHours = 0
        }
        onChange(`${String(newHours).padStart(2, '0')}:${String(newMinutes).padStart(2, '0')}`)
    }

    // Quick time presets
    const presets = [
        { label: 'Now', getValue: getDefaultTime },
        { label: '9:00', value: '09:00' },
        { label: '12:00', value: '12:00' },
        { label: '14:00', value: '14:00' },
        { label: '17:00', value: '17:00' },
        { label: '20:00', value: '20:00' },
    ]

    // Format for display (12h)
    const displayTime = React.useMemo(() => {
        const h = hours % 12 || 12
        const ampm = hours >= 12 ? 'PM' : 'AM'
        return `${h}:${String(minutes).padStart(2, '0')} ${ampm}`
    }, [hours, minutes])

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    className={cn(
                        "w-full justify-start text-left font-normal",
                        !value && "text-muted-foreground",
                        className
                    )}
                >
                    <Clock className="mr-2 h-4 w-4" />
                    {displayTime}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[220px] p-3" align="start">
                {/* Time Spinner */}
                <div className="flex items-center justify-center gap-2 mb-3">
                    {/* Hours */}
                    <div className="flex flex-col items-center">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-10"
                            onClick={() => adjustHours(1)}
                        >
                            <ChevronUp className="h-4 w-4" />
                        </Button>
                        <div className="text-2xl font-semibold tabular-nums py-1">
                            {String(hours).padStart(2, '0')}
                        </div>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-10"
                            onClick={() => adjustHours(-1)}
                        >
                            <ChevronDown className="h-4 w-4" />
                        </Button>
                    </div>

                    <div className="text-2xl font-semibold text-muted-foreground">:</div>

                    {/* Minutes */}
                    <div className="flex flex-col items-center">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-10"
                            onClick={() => adjustMinutes(15)}
                        >
                            <ChevronUp className="h-4 w-4" />
                        </Button>
                        <div className="text-2xl font-semibold tabular-nums py-1">
                            {String(minutes).padStart(2, '0')}
                        </div>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-10"
                            onClick={() => adjustMinutes(-15)}
                        >
                            <ChevronDown className="h-4 w-4" />
                        </Button>
                    </div>

                    {/* AM/PM indicator */}
                    <div className="flex flex-col items-center ml-2">
                        <Button
                            variant={hours >= 12 ? "ghost" : "secondary"}
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => {
                                if (hours >= 12) {
                                    onChange(`${String(hours - 12).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`)
                                }
                            }}
                        >
                            AM
                        </Button>
                        <Button
                            variant={hours < 12 ? "ghost" : "secondary"}
                            size="sm"
                            className="h-7 text-xs mt-1"
                            onClick={() => {
                                if (hours < 12) {
                                    onChange(`${String(hours + 12).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`)
                                }
                            }}
                        >
                            PM
                        </Button>
                    </div>
                </div>

                {/* Divider */}
                <div className="border-t my-2" />

                {/* Presets */}
                <div className="grid grid-cols-3 gap-1">
                    {presets.map((preset) => (
                        <Button
                            key={preset.label}
                            variant="ghost"
                            size="sm"
                            className={cn(
                                "h-7 text-xs",
                                value === (preset.value || preset.getValue?.()) && "bg-accent"
                            )}
                            onClick={() => {
                                const newValue = preset.value || preset.getValue?.() || value
                                onChange(newValue)
                                setOpen(false)
                            }}
                        >
                            {preset.label}
                        </Button>
                    ))}
                </div>
            </PopoverContent>
        </Popover>
    )
}
