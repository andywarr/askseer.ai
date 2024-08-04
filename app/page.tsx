import { auth } from "@/auth";
import Link from "next/link";
import { redirect } from 'next/navigation'
import { SignIn } from "./components/sign-in";

export default async function Home() {
  const session = await auth();

  if (session) {
    redirect("/heuristic");
  }

  return (
    <div className="flex items-center min-h-screen p-8 bg-gradient-to-r from-red-400 via-pink-500 to-blue-500 bg-[length:400%_400%] animate-gradient">
      <div className="max-w-max min-w-80 p-2 text-white w-full">
        <h1 className="drop-shadow-lg mb-4 text-8xl">Seer</h1>
        <h1 className="mb-1 text-2xl">AI-assisted research</h1>
        <p className="max-w-xs text-sm">Save hours on research with the click of a button.</p>
        <SignIn />
        <p className="max-w-xs mt-4 text-sm">By clicking &apos;signin&apos; you agree to our <Link className="underline" href={'/privacy'}>Privacy Policy</Link> and <Link className="underline" href={'/terms'}>Terms of Service</Link></p>
      </div>
    </div>
  );
}