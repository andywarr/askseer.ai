// Next imports
import Link from "next/link";
import { redirect } from "next/navigation";

// NextAuth imports
import { auth } from "@/auth";

// Component imports
import { SignIn } from "@/app/components/sign-in";

export default async function Home() {
  const session = await auth();

  if (session) {
    redirect("/heuristic");
  }

  return (
    <div className="flex min-h-screen animate-gradient items-center bg-gradient-to-r from-red-400 via-pink-500 to-blue-500 bg-[length:400%_400%] p-8">
      <div className="w-full min-w-80 max-w-max p-2 text-white">
        <h1 className="mb-4 text-8xl drop-shadow-lg">Seer</h1>
        <h1 className="mb-1 text-2xl">AI-assisted research</h1>
        <p className="max-w-xs text-sm">
          Save hours on research with the click of a button.
        </p>
        <SignIn />
        <p className="mt-4 max-w-xs text-sm">
          By clicking signing in you agree to our{" "}
          <Link className="underline" href={"/privacy"}>
            Privacy Policy
          </Link>{" "}
          and{" "}
          <Link className="underline" href={"/terms"}>
            Terms of Service
          </Link>
        </p>
      </div>
    </div>
  );
}
