import Link from "next/link";
import Image from "next/image";
import { Button } from "@/apps/nextjs-app/components/ui/button";

export default function SharedStudyNotFound() {
  return (
    <div className="flex min-h-screen flex-col bg-white dark:bg-zinc-950">
      {/* Header */}
      <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-2">
            <Image
              alt="logo"
              className="h-8 w-8"
              src="/logo.svg"
              width={32}
              height={32}
            />
            <h1 className="scroll-m-20 text-4xl font-extrabold tracking-tight text-black md:text-5xl dark:text-white">
              Seer
            </h1>
          </Link>
          <Button asChild variant="default" size="sm">
            <Link href="/signin">Sign in</Link>
          </Button>
        </div>
      </header>

      {/* Content */}
      <main className="flex flex-1 flex-col items-center justify-center px-4 py-16 text-center">
        <div className="mx-auto max-w-md">
          <h2 className="text-6xl font-bold text-zinc-900 dark:text-zinc-100">
            404
          </h2>
          <h3 className="mt-4 text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
            Study not found
          </h3>
          <p className="mt-4 text-zinc-600 dark:text-zinc-400">
            This shared study doesn&apos;t exist or is no longer publicly
            available. The owner may have changed the sharing settings or
            deleted the study.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Button asChild>
              <Link href="/signin">Sign in</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/">Go home</Link>
            </Button>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-200 bg-white py-8 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto max-w-7xl px-4 text-center sm:px-6 lg:px-8">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            AI-powered product insights for teams that ship fast.
          </p>
        </div>
      </footer>
    </div>
  );
}
