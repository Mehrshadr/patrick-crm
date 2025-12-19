import { getLeads } from "./actions"
import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { Dashboard } from "@/components/dashboard"

export default async function Home() {
  const session = await auth()

  if (!session?.user) {
    redirect("/login")
  }

  const leads = await getLeads()

  return <Dashboard leads={leads} user={session.user} />
}
