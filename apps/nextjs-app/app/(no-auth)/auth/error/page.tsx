import Link from "next/link";
import { Button } from "@/apps/nextjs-app/components/ui/button";
import { GlobalHeader } from "@/apps/nextjs-app/components/layout/global-header";

const ERROR_MESSAGES: Record<
  string,
  { title: string; description: string; cta: string }
> = {
  Verification: {
    title: "Link expired",
    description:
      "This sign-in link has already been used or has expired. Links are single-use and valid for 24 hours. Request a new one to continue.",
    cta: "Request a new link",
  },
  AccessDenied: {
    title: "Access denied",
    description:
      "You don't have permission to access this resource. If you believe this is a mistake, please contact support.",
    cta: "Back to sign in",
  },
  OAuthAccountNotLinked: {
    title: "Account not linked",
    description:
      "This email is already associated with a different sign-in method. Please sign in using the method you originally used.",
    cta: "Back to sign in",
  },
  Configuration: {
    title: "Configuration error",
    description:
      "There is a problem with the server configuration. Please contact support if this issue persists.",
    cta: "Back to sign in",
  },
};

const DEFAULT_ERROR = {
  title: "Something went wrong",
  description:
    "We encountered an unexpected error during sign in. Please try again or contact support if the problem persists.",
  cta: "Back to sign in",
};

export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const { title, description, cta } =
    (error && ERROR_MESSAGES[error]) || DEFAULT_ERROR;

  return (
    <div className="animate-gradient min-h-screen w-full bg-linear-to-r from-red-400 via-pink-500 to-blue-500 bg-size-[400%_400%]">
      <div className="mx-auto flex min-h-screen max-w-5xl flex-col items-center p-8">
        <GlobalHeader theme="dark" />

        <div className="flex flex-1 flex-col items-center justify-center">
          <div className="w-full max-w-sm">
            <div className="rounded-xl border border-white/30 bg-white/20 p-6 text-center shadow-xl backdrop-blur-xl">
              <p className="mb-6 text-sm leading-relaxed text-white/80">
                {description}
              </p>
              <Button
                asChild
                className="w-full bg-white text-zinc-900 hover:bg-white/90"
              >
                <Link href="/signin">{cta}</Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
