"use client";

import { Spinner } from "@/MTailwind";

export function Loading() {
  return (
    <div className="fixed left-0 top-0 flex h-screen w-screen items-center justify-center bg-black/80">
      <Spinner color="blue-gray" className="h-16 w-16" />
    </div>
  );
}
