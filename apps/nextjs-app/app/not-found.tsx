import Link from "next/link";
import { Button } from "@/apps/nextjs-app/components/ui/button";

export default function NotFound() {
  return (
    <html lang="en">
      <body>
        <div className="mx-auto flex min-h-screen max-w-5xl flex-col items-center p-8">
          <div className="flex flex-1 flex-col items-center justify-center text-center">
            <h1 className="mb-8 scroll-m-20 text-balance text-center text-7xl tracking-tight">
              404
            </h1>
            <h2 className="mb-4 scroll-m-20 text-3xl font-semibold tracking-tight">
              Page Not Found
            </h2>
            <p className="mb-8 max-w-md leading-7 text-gray-600">
              The page you're looking for doesn't exist or has been moved.
            </p>
            <div className="flex gap-4">
              <Button asChild>
                <Link href="/">Go Home</Link>
              </Button>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
