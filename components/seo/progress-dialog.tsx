"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import { Loader2, CheckCircle2, XCircle, AlertCircle } from "lucide-react"

interface ProgressDialogProps {
    open: boolean
    title: string
    current: number
    total: number
    status: 'running' | 'completed' | 'error'
    successCount?: number
    failedCount?: number
    onClose?: () => void
}

export function ProgressDialog({
    open,
    title,
    current,
    total,
    status,
    successCount = 0,
    failedCount = 0,
    onClose
}: ProgressDialogProps) {
    const percentage = total > 0 ? Math.round((current / total) * 100) : 0

    return (
        <Dialog open={open} onOpenChange={(isOpen) => {
            if (!isOpen && status !== 'running' && onClose) {
                onClose()
            }
        }}>
            <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => {
                if (status === 'running') {
                    e.preventDefault()
                }
            }}>
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        {status === 'running' && (
                            <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
                        )}
                        {status === 'completed' && (
                            <CheckCircle2 className="h-5 w-5 text-green-500" />
                        )}
                        {status === 'error' && (
                            <AlertCircle className="h-5 w-5 text-red-500" />
                        )}
                        {title}
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <Progress value={percentage} className="h-3" />

                    <div className="flex justify-between text-sm text-muted-foreground">
                        <span>
                            {status === 'running' ? 'Processing' : 'Processed'}: {current} of {total}
                        </span>
                        <span>{percentage}%</span>
                    </div>

                    {status !== 'running' && (successCount > 0 || failedCount > 0) && (
                        <div className="flex gap-4 text-sm pt-2 border-t">
                            {successCount > 0 && (
                                <div className="flex items-center gap-1.5 text-green-600">
                                    <CheckCircle2 className="h-4 w-4" />
                                    <span>{successCount} successful</span>
                                </div>
                            )}
                            {failedCount > 0 && (
                                <div className="flex items-center gap-1.5 text-red-600">
                                    <XCircle className="h-4 w-4" />
                                    <span>{failedCount} failed</span>
                                </div>
                            )}
                        </div>
                    )}

                    {status === 'running' && (
                        <p className="text-xs text-center text-muted-foreground">
                            Please wait, do not close this window...
                        </p>
                    )}

                    {status !== 'running' && (
                        <Button
                            className="w-full mt-2"
                            onClick={onClose}
                        >
                            Done
                        </Button>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    )
}
