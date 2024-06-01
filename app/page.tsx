import { auth } from "@/auth";
import { redirect } from 'next/navigation'
import { SignIn } from "./components/sign-in";

export default async function Home() {
  const session = await auth();
  
  if (session) {
    redirect("/heuristic");
  }
  
  return (
    <div className="flex">
      <SignIn />
    </div>
  );
}