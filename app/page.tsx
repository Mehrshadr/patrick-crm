import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"

export default async function Home() {
  const session = await auth()

  if (!session?.user) {
    redirect("/login")
  }

  // Redirect to leads page by default
  redirect("/leads")
}
