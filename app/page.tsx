import { auth } from "@/auth";
import { redirect } from 'next/navigation'
import { SignIn } from "./components/sign-in";

export default async function Home() {
  const session = await auth();
  
  if (session) {
    redirect("/heuristic");
  }
  
  return (
    <div className="flex items-center min-h-screen p-8 bg-gradient-to-r from-red-400 via-pink-500 to-blue-500 bg-[length:400%_400%] animate-gradient">
      <div className="max-w-max min-w-80 w-full">
        <h1 className="drop-shadow-lg mb-4 p-2 text-8xl text-white">Seer</h1>
        <h1 className="mb-1 p-2 text-2xl text-white">AI-assisted research</h1>
        <p className="max-w-xs p-2 text-sm text-white">Save hours on research with the click of a button.</p>
        <SignIn />
      </div>
    </div>
  );
}