// Next imports
import { redirect } from "next/navigation";

// NextAuth imports
import { auth } from "@/apps/nextjs-app/auth";

export default async function Page() {
  const session = await auth();

  if (session) {
    redirect("/studies");
  }

  redirect("/home");
}
