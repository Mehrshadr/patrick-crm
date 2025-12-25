"use client"

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'

interface UserAccess {
    role: string
    patrickAccess: 'EDITOR' | 'VIEWER' | 'HIDDEN'
    isEditor: boolean
    isViewer: boolean
    isHidden: boolean
    loading: boolean
}

const defaultAccess: UserAccess = {
    role: 'USER',
    patrickAccess: 'HIDDEN',
    isEditor: false,
    isViewer: false,
    isHidden: true,
    loading: true
}

const UserAccessContext = createContext<UserAccess>(defaultAccess)

export function UserAccessProvider({ children }: { children: ReactNode }) {
    const [access, setAccess] = useState<UserAccess>(defaultAccess)

    useEffect(() => {
        fetch('/api/users/me')
            .then(res => res.json())
            .then(data => {
                if (data.success && data.user) {
                    const patrickAccess = data.user.patrickAccess || 'HIDDEN'
                    const isSuperAdmin = data.user.role === 'SUPER_ADMIN'

                    setAccess({
                        role: data.user.role,
                        patrickAccess,
                        isEditor: isSuperAdmin || patrickAccess === 'EDITOR',
                        isViewer: patrickAccess === 'VIEWER',
                        isHidden: !isSuperAdmin && patrickAccess === 'HIDDEN',
                        loading: false
                    })
                } else {
                    setAccess({ ...defaultAccess, loading: false })
                }
            })
            .catch(() => {
                setAccess({ ...defaultAccess, loading: false })
            })
    }, [])

    return (
        <UserAccessContext.Provider value={access}>
            {children}
        </UserAccessContext.Provider>
    )
}

export function useUserAccess() {
    return useContext(UserAccessContext)
}
