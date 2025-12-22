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
                const dbUser = await db.user.upsert({
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

                // Create login log for security auditing
                await db.loginLog.create({
                    data: {
                        userId: dbUser.id,
                        success: true
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
                    const isMehrdadAccount = email === 'mehrdad@mehrana.agency'

                    try {
                        // Hello@ is the designated EMAIL sender
                        if (isHelloAccount) {
                            await db.appSettings.upsert({
                                where: { key: 'SYSTEM_EMAIL_SENDER' },
                                update: { value: email },
                                create: { key: 'SYSTEM_EMAIL_SENDER', value: email }
                            })
                            await db.appSettings.upsert({
                                where: { key: 'SYSTEM_EMAIL_ACCESS_TOKEN' },
                                update: { value: account.access_token },
                                create: { key: 'SYSTEM_EMAIL_ACCESS_TOKEN', value: account.access_token }
                            })
                            await db.appSettings.upsert({
                                where: { key: 'SYSTEM_EMAIL_REFRESH_TOKEN' },
                                update: { value: account.refresh_token },
                                create: { key: 'SYSTEM_EMAIL_REFRESH_TOKEN', value: account.refresh_token }
                            })
                            console.log(`[Auth] EMAIL tokens updated from: ${email}`)
                        }

                        // Mehrdad@ is the designated CALENDAR user
                        if (isMehrdadAccount) {
                            await db.appSettings.upsert({
                                where: { key: 'SYSTEM_CALENDAR_USER' },
                                update: { value: email },
                                create: { key: 'SYSTEM_CALENDAR_USER', value: email }
                            })
                            await db.appSettings.upsert({
                                where: { key: 'SYSTEM_CALENDAR_ACCESS_TOKEN' },
                                update: { value: account.access_token },
                                create: { key: 'SYSTEM_CALENDAR_ACCESS_TOKEN', value: account.access_token }
                            })
                            await db.appSettings.upsert({
                                where: { key: 'SYSTEM_CALENDAR_REFRESH_TOKEN' },
                                update: { value: account.refresh_token },
                                create: { key: 'SYSTEM_CALENDAR_REFRESH_TOKEN', value: account.refresh_token }
                            })
                            console.log(`[Auth] CALENDAR tokens updated from: ${email}`)
                        }

                        // Legacy: Keep SYSTEM_GOOGLE_* for backward compatibility (use first admin login)
                        const existingToken = await db.appSettings.findUnique({ where: { key: 'SYSTEM_GOOGLE_ACCESS_TOKEN' } })
                        if (!existingToken && (isHelloAccount || isMehrdadAccount)) {
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
                        }
                    } catch (e) {
                        console.error("[Auth] Failed to save system tokens:", e)
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

