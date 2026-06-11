import Link from "next/link";
import { Button } from "@/apps/nextjs-app/components/ui/button";
import { GlobalHeader } from "@/apps/nextjs-app/components/layout/global-header";

export default function VerifyRequestPage() {
  return (
    <div className="animate-gradient min-h-screen w-full bg-linear-to-r from-red-400 via-pink-500 to-blue-500 bg-size-[400%_400%]">
      <div className="mx-auto flex min-h-screen max-w-5xl flex-col items-center p-8">
        <GlobalHeader theme="dark" />

        <div className="flex flex-1 flex-col items-center justify-center">
          <div className="w-full max-w-sm">
            <div className="rounded-xl border border-white/30 bg-white/20 p-6 text-center shadow-xl backdrop-blur-xl">
              <p className="mb-6 text-sm leading-relaxed text-white/80">
                A sign-in link has been sent to your email address. The link
                expires in 24 hours and can only be used once.
              </p>
              <Button
                asChild
                variant="outline"
                className="w-full border-white/30 bg-transparent text-white hover:bg-white/10 hover:text-white"
              >
                <Link href="/signin">Back to sign in</Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
