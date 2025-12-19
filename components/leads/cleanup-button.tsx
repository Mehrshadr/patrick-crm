"use client"

import { Button } from "@/components/ui/button"
import { Archive } from "lucide-react"
import { useState } from "react"
import { cleanupLeads } from "@/app/actions"
import { toast } from "sonner"
import { useRouter } from "next/navigation"

export function CleanupButton() {
    const [loading, setLoading] = useState(false)
    const router = useRouter()

    const handleCleanup = async () => {
        setLoading(true)
        try {
            const res = await cleanupLeads()
            if (res.success) {
                toast.success("Cleanup ran successfully.")
                router.refresh()
            } else {
                toast.error("Cleanup failed")
            }
        } catch (e) {
            toast.error("Cleanup failed")
        } finally {
            setLoading(false)
        }
    }

    return (
        <Button variant="ghost" onClick={handleCleanup} disabled={loading} size="sm">
            <Archive className="mr-2 h-4 w-4" />
            {loading ? "Cleaning..." : "Cleanup Old Ghosts"}
        </Button>
    )
}
