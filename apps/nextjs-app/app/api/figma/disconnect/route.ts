/**
 * Figma disconnect endpoint
 *
 * Removes the Figma connection for the authenticated user.
 */

import { NextResponse } from "next/server";
import { auth } from "@/apps/nextjs-app/auth";
import { disconnectFigma } from "@/apps/nextjs-app/lib/figma/oauth";
import prisma from "@/apps/nextjs-app/lib/db/db";

export async function POST() {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user ID from email
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const success = await disconnectFigma(user.id);

    if (!success) {
      return NextResponse.json(
        { error: "Failed to disconnect Figma" },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error disconnecting Figma:", error);
    return NextResponse.json(
      { error: "Failed to disconnect Figma" },
      { status: 500 },
    );
  }
}
