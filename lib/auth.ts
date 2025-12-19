import NextAuth from "next-auth"
import Google from "next-auth/providers/google"

export const { handlers, signIn, signOut, auth } = NextAuth({
    trustHost: true,
    providers: [
        Google({
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        }),
    ],
    pages: {
        signIn: "/login",
    },
    callbacks: {
        // For now: allow any Google account
        // Later: restrict to @mehrana.agency only by uncommenting below
        async signIn({ user }) {
            // Uncomment this to restrict to mehrana.agency emails:
            // if (!user.email?.endsWith("@mehrana.agency")) {
            //     return false
            // }
            return true
        },
        async session({ session, token }) {
            return session
        },
    },
})
