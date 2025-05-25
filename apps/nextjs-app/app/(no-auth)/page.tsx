// Next imports
import Link from "next/link";
import { redirect } from "next/navigation";

// NextAuth imports
import { auth } from "@/apps/nextjs-app/auth";

// Component imports
import { GoogleSignIn } from "@/apps/nextjs-app/components/google-sign-in";
import { ResendSignIn } from "@/apps/nextjs-app/components/resend-sign-in";
// UI component imports
import { Separator } from "@/apps/nextjs-app/components/ui/separator";

export default async function Home() {
  const session = await auth();

  if (session) {
    redirect("/studies");
  }

  return (
    <div className="flex min-h-screen animate-gradient items-center bg-gradient-to-r from-red-400 via-pink-500 to-blue-500 bg-[length:400%_400%] p-8">
      <div className="w-full min-w-80 max-w-max p-2 text-white">
        <h1 className="mb-4 text-8xl drop-shadow-lg">Seer</h1>
        <h2 className="mb-1 text-2xl">AI-assisted research</h2>
        <p className="max-w-xs text-sm">
          Save hours on research with the click of a button.
        </p>
        <ResendSignIn />
        <Separator className="mt-4" />
        <GoogleSignIn />
        <p className="mt-4 max-w-xs text-sm">
          By clicking the sign in button you agree to our{" "}
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
