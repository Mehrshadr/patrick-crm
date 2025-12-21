import NextAuth from "next-auth"
import Google from "next-auth/providers/google"
import { db } from "@/lib/db"
import { isAllowedDomain, getUserRole, ADMIN_EMAILS } from "@/lib/permissions"

export const { handlers, signIn, signOut, auth } = NextAuth({
    trustHost: true,
    providers: [
        Google({
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
            authorization: {
                params: {
                    scope: "openid email profile https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/gmail.send",
                    access_type: "offline",
                    prompt: "consent",
                },
            },
        }),
    ],
    pages: {
        signIn: "/login",
    },
    callbacks: {
        async signIn({ user }) {
            const email = user.email?.toLowerCase() || ''

            // Only allow @mehrana.agency emails
            if (!isAllowedDomain(email)) {
                console.log(`[Auth] Blocked login attempt from: ${email}`)
                return false
            }

            // Upsert user in database
            try {
                const role = getUserRole(email)
                await db.user.upsert({
                    where: { email },
                    update: {
                        name: user.name || undefined,
                        lastLogin: new Date()
                    },
                    create: {
                        email,
                        name: user.name || undefined,
                        role
                    }
                })
                console.log(`[Auth] User logged in: ${email} (${role})`)
            } catch (e) {
                console.error("[Auth] Failed to upsert user:", e)
            }

            return true
        },
        async jwt({ token, account, user }) {
            if (account) {
                token.accessToken = account.access_token
                token.refreshToken = account.refresh_token

                const email = (user?.email || token.email || '').toLowerCase()
                token.role = getUserRole(email)

                // Save system tokens for Hello@ email sending
                // Only save if the user is Hello@ or an admin
                if (account.access_token && account.refresh_token) {
                    const isHelloAccount = email === 'hello@mehrana.agency'
                    const isAdmin = ADMIN_EMAILS.includes(email)

                    if (isHelloAccount || isAdmin) {
                        try {
                            // Store which email these tokens belong to
                            await db.appSettings.upsert({
                                where: { key: 'SYSTEM_EMAIL_SENDER' },
                                update: { value: email },
                                create: { key: 'SYSTEM_EMAIL_SENDER', value: email }
                            })
                            await db.appSettings.upsert({
                                where: { key: 'SYSTEM_GOOGLE_ACCESS_TOKEN' },
                                update: { value: account.access_token },
                                create: { key: 'SYSTEM_GOOGLE_ACCESS_TOKEN', value: account.access_token }
                            })
                            await db.appSettings.upsert({
                                where: { key: 'SYSTEM_GOOGLE_REFRESH_TOKEN' },
                                update: { value: account.refresh_token },
                                create: { key: 'SYSTEM_GOOGLE_REFRESH_TOKEN', value: account.refresh_token }
                            })
                            console.log(`[Auth] System tokens updated from: ${email}`)
                        } catch (e) {
                            console.error("[Auth] Failed to save system tokens:", e)
                        }
                    }
                }
            }
            return token
        },
        async session({ session, token }: any) {
            session.accessToken = token.accessToken
            session.refreshToken = token.refreshToken
            session.user.role = token.role || 'VIEWER'
            return session
        },
    },
})

