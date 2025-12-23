"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { CheckCircle2, AlertCircle, Loader2, ExternalLink, Unplug } from "lucide-react"
import { toast } from "sonner"

interface ConnectionStatus {
    connected: boolean
    email?: string
    expired?: boolean
    message?: string
}

export function GoogleConnectionCard() {
    const [status, setStatus] = useState<ConnectionStatus | null>(null)
    const [loading, setLoading] = useState(true)
    const [disconnecting, setDisconnecting] = useState(false)

    useEffect(() => {
        checkStatus()
    }, [])

    async function checkStatus() {
        try {
            const res = await fetch("/api/auth/google-search-console/status")
            const data = await res.json()
            setStatus(data)
        } catch (error) {
            setStatus({ connected: false, message: "Failed to check status" })
        } finally {
            setLoading(false)
        }
    }

    async function handleDisconnect() {
        if (!confirm("Disconnect from Google Search Console?")) return

        setDisconnecting(true)
        try {
            await fetch("/api/auth/google-search-console/status", { method: "DELETE" })
            toast.success("Disconnected from Google Search Console")
            setStatus({ connected: false })
        } catch (error) {
            toast.error("Failed to disconnect")
        } finally {
            setDisconnecting(false)
        }
    }

    if (loading) {
        return (
            <Card className="bg-slate-50 dark:bg-slate-900/50">
                <CardHeader className="pb-3">
                    <div className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <CardTitle className="text-sm">Checking connection...</CardTitle>
                    </div>
                </CardHeader>
            </Card>
        )
    }

    if (status?.connected) {
        return (
            <Card className="bg-green-50 dark:bg-green-950/20 border-green-200">
                <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <CheckCircle2 className="h-5 w-5 text-green-600" />
                            <CardTitle className="text-sm">Google Search Console</CardTitle>
                        </div>
                        <Badge variant="outline" className="text-green-600 border-green-300">
                            Connected
                        </Badge>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center justify-between">
                        <p className="text-sm text-muted-foreground">
                            {status.email || "Connected account"}
                        </p>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleDisconnect}
                            disabled={disconnecting}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                            <Unplug className="h-4 w-4 mr-1" />
                            Disconnect
                        </Button>
                    </div>
                </CardContent>
            </Card>
        )
    }

    return (
        <Card className="bg-amber-50 dark:bg-amber-950/20 border-amber-200">
            <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <AlertCircle className="h-5 w-5 text-amber-600" />
                        <CardTitle className="text-sm">Google Search Console</CardTitle>
                    </div>
                    <Badge variant="outline" className="text-amber-600 border-amber-300">
                        Not Connected
                    </Badge>
                </div>
            </CardHeader>
            <CardContent>
                <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">
                        Connect to check URL indexing status
                    </p>
                    <Button
                        size="sm"
                        asChild
                    >
                        <a href="/api/auth/google-search-console">
                            <ExternalLink className="h-4 w-4 mr-1" />
                            Connect
                        </a>
                    </Button>
                </div>
            </CardContent>
        </Card>
    )
}
