"use client"

import { SessionProvider } from "next-auth/react"
import { UserAccessProvider } from "@/lib/user-access"

export function Providers({ children }: { children: React.ReactNode }) {
    return (
        <SessionProvider>
            <UserAccessProvider>
                {children}
            </UserAccessProvider>
        </SessionProvider>
    )
}
