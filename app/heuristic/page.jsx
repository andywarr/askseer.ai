import { auth } from "@/auth";
import { redirect } from 'next/navigation'
import { SignOut } from "../components/sign-out";

export default async function Heuristic() {
  const session = await auth();
  
  if (!session) {
    redirect("/");
  }

  return (
    <SignOut />
  );
}
  