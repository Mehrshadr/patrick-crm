"use client"

import { useState, useEffect } from "react"
import { Badge } from "@/components/ui/badge"
import { Zap } from "lucide-react"

const DAILY_QUOTA = 200

export function QuotaCounter() {
    const [remaining, setRemaining] = useState<number | null>(null)
    const [loading, setLoading] = useState(true)

    const fetchQuota = async () => {
        try {
            const res = await fetch('/api/seo/quota')
            const data = await res.json()
            setRemaining(data.remaining)
        } catch {
            setRemaining(null)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchQuota()

        // Poll every 5 seconds for live updates
        const interval = setInterval(fetchQuota, 5000)

        // Also listen for custom events when indexing happens
        const handleIndexing = () => fetchQuota()
        window.addEventListener('indexing-complete', handleIndexing)

        return () => {
            clearInterval(interval)
            window.removeEventListener('indexing-complete', handleIndexing)
        }
    }, [])

    if (loading) {
        return (
            <Badge variant="outline" className="gap-1.5 px-3 py-1.5 bg-slate-50 text-slate-600 border-slate-200">
                <Zap className="h-3.5 w-3.5 animate-pulse" />
                <span>Loading...</span>
            </Badge>
        )
    }

    if (remaining === null) {
        return null
    }

    const percentage = (remaining / DAILY_QUOTA) * 100

    // Color based on remaining quota
    let colorClass = "bg-emerald-50 text-emerald-700 border-emerald-200"
    if (percentage <= 25) {
        colorClass = "bg-red-50 text-red-700 border-red-200"
    } else if (percentage <= 50) {
        colorClass = "bg-amber-50 text-amber-700 border-amber-200"
    }

    return (
        <Badge
            variant="outline"
            className={`gap-1.5 px-3 py-1.5 font-medium ${colorClass}`}
        >
            <Zap className="h-3.5 w-3.5" />
            <span>{remaining} / {DAILY_QUOTA} remaining</span>
        </Badge>
    )
}
