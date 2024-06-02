import { auth } from "@/auth";
import { redirect } from 'next/navigation'
import { SignOut } from "../components/sign-out";
import { StartTrial } from "../lib/data";

export default async function Heuristic() {
  const session = await auth();
  
  if (!session) {
    redirect("/");
  }

  if (session.user?.id) {
    StartTrial(session.user?.id);
  }

  return (
    <SignOut />
  );
}
  