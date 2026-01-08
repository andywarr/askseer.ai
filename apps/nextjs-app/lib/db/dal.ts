import "server-only";

import { auth } from "@/apps/nextjs-app/auth";
import { redirect } from "next/navigation";
import { cache } from "react";

export const isAuthenticated = cache(async () => {
  const session = await auth();

  if (!session?.user?.id) {
    // Middleware should have already redirected with callbackUrl preserved,
    // but as a fallback, redirect to signin
    redirect("/signin");
  }

  return { isAuth: true, userId: session.user.id };
});
