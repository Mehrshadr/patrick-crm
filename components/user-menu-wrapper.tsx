"use client"

import { useSession } from "next-auth/react"
import { UserMenu } from "@/components/user-menu"
import { Skeleton } from "@/components/ui/skeleton"

export function UserMenuWrapper() {
    const { data: session, status } = useSession()

    if (status === "loading") {
        return <Skeleton className="h-10 w-10 rounded-full" />
    }

    if (!session?.user) {
        return null
    }

    return <UserMenu user={session.user} />
}
