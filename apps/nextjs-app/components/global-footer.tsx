import Image from "next/image";
import Link from "next/link";

export function GlobalFooter() {
  return (
    <footer className="relative mt-auto w-full">
      {/* Gradient background with top fade */}
      <div className="absolute inset-0 bg-linear-to-r from-red-400/30 via-pink-500/30 to-blue-500/30" />
      <div className="absolute inset-0 bg-linear-to-b from-white via-transparent to-transparent" />

      <div className="relative mx-auto max-w-5xl px-8 pt-0 pb-16 md:pt-32">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 md:gap-12 lg:grid-cols-4">
          {/* Brand Column */}
          <div className="flex flex-col">
            <Image
              src="/logo-black.png"
              alt="Seer logo"
              width={32}
              height={30}
              className="mb-4"
            />
            <p className="text-sm text-zinc-600">
              AI-powered product insights for teams that ship fast.
            </p>
            <p className="mt-4 text-sm text-zinc-500">
              ©{new Date().getFullYear()} Seer. All rights reserved.
            </p>
          </div>

          {/* Product Column */}
          <div className="flex flex-col gap-2 pt-[46px]">
            <Link
              href="/home"
              className="block text-sm text-zinc-700 hover:text-zinc-900 hover:underline"
            >
              Home
            </Link>
            <Link
              href="/pricing"
              className="block text-sm text-zinc-700 hover:text-zinc-900 hover:underline"
            >
              Pricing
            </Link>
            <Link
              href="/updates"
              className="block text-sm text-zinc-700 hover:text-zinc-900 hover:underline"
            >
              Release notes
            </Link>
          </div>

          {/* Legal Column */}
          <div className="flex flex-col gap-2 pt-[46px]">
            <Link
              href="https://www.linkedin.com/company/askseer/about/"
              target="_blank"
              rel="noopener noreferrer"
              className="block text-sm text-zinc-700 hover:text-zinc-900 hover:underline"
            >
              LinkedIn
            </Link>
            <Link
              href="/privacy"
              className="block text-sm text-zinc-700 hover:text-zinc-900 hover:underline"
            >
              Privacy Policy
            </Link>
            <Link
              href="/terms"
              className="block text-sm text-zinc-700 hover:text-zinc-900 hover:underline"
            >
              Terms of Service
            </Link>
          </div>

          {/* Actions Column */}
          <div className="flex flex-col gap-2 pt-[46px]">
            <Link
              href="/signin"
              className="block text-sm text-zinc-700 hover:text-zinc-900 hover:underline"
            >
              Sign in
            </Link>
            <Link
              href="/demo"
              className="block text-sm text-zinc-700 hover:text-zinc-900 hover:underline"
            >
              Request a demo
            </Link>
            <Link
              href="/contact"
              className="block text-sm text-zinc-700 hover:text-zinc-900 hover:underline"
            >
              Contact us
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
