import NextAuth from "next-auth"
import Google from "next-auth/providers/google"
import { db } from "@/lib/db"

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
            return true
        },
        async jwt({ token, account }) {
            if (account) {
                token.accessToken = account.access_token
                token.refreshToken = account.refresh_token

                // Save system tokens for Cron jobs (Automation)
                if (account.access_token && account.refresh_token) {
                    try {
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
                        console.log("System tokens updated in AppSettings")
                    } catch (e) {
                        console.error("Failed to save system tokens:", e)
                    }
                }
            }
            return token
        },
        async session({ session, token }: any) {
            session.accessToken = token.accessToken
            session.refreshToken = token.refreshToken
            return session
        },
    },
})
