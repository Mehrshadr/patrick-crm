"use client"

import { useState, useEffect } from 'react'

interface AccessCheckResult {
    hasAccess: boolean
    accessLevel: string | null
    apps: string[]
    loading: boolean
    error: string | null
}

/**
 * Hook to check user's access to a specific app in a project
 * @param projectId - The project ID
 * @param appType - The app type to check (LINK_INDEXING, LINK_BUILDING, CONTENT_FACTORY, IMAGE_FACTORY)
 */
export function useProjectAccess(projectId: string | number | null, appType?: string): AccessCheckResult {
    const [result, setResult] = useState<AccessCheckResult>({
        hasAccess: false,
        accessLevel: null,
        apps: [],
        loading: true,
        error: null
    })

    useEffect(() => {
        if (!projectId) {
            setResult(prev => ({ ...prev, loading: false }))
            return
        }

        async function checkAccess() {
            try {
                const url = appType
                    ? `/api/users/check-access?projectId=${projectId}&appType=${appType}`
                    : `/api/users/check-access?projectId=${projectId}`

                const res = await fetch(url)
                const data = await res.json()

                setResult({
                    hasAccess: data.hasAccess,
                    accessLevel: data.accessLevel || null,
                    apps: data.apps || [],
                    loading: false,
                    error: data.error || null
                })
            } catch (e: any) {
                setResult({
                    hasAccess: false,
                    accessLevel: null,
                    apps: [],
                    loading: false,
                    error: e.message
                })
            }
        }

        checkAccess()
    }, [projectId, appType])

    return result
}

/**
 * Component to wrap content that requires specific app access
 */
export function RequireAppAccess({
    projectId,
    appType,
    children,
    fallback = null,
    loadingFallback = null
}: {
    projectId: string | number | null
    appType: string
    children: React.ReactNode
    fallback?: React.ReactNode
    loadingFallback?: React.ReactNode
}) {
    const { hasAccess, loading, error } = useProjectAccess(projectId, appType)

    if (loading) {
        return loadingFallback || <div className="flex items-center justify-center py-12 text-muted-foreground">Checking access...</div>
    }

    if (!hasAccess) {
        return fallback || (
            <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="text-4xl mb-4">🔒</div>
                <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
                <p className="text-muted-foreground max-w-md">
                    You don't have access to this tool. Please contact an administrator to request access.
                </p>
                {error && <p className="text-sm text-red-500 mt-2">{error}</p>}
            </div>
        )
    }

    return <>{children}</>
}
