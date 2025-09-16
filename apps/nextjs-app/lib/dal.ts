import "server-only";

import { auth } from "@/apps/nextjs-app/auth";
import { redirect } from "next/navigation";
import { cache } from "react";

export const isAuthenticated = cache(async () => {
  const session = await auth();

  const userId =
    (typeof (session as { userId?: unknown } | null | undefined)?.userId ===
    "string"
      ? (session as { userId?: string }).userId
      : undefined) ?? session?.user?.id;

  if (!session || !userId) {
    redirect("/");
  }

  return { isAuth: true, userId };
});
