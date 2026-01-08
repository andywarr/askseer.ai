/**
 * Figma OAuth status endpoint
 *
 * Returns the current Figma connection status for the authenticated user.
 */

import { NextResponse } from "next/server";
import { auth } from "@/apps/nextjs-app/auth";
import { getFigmaConnection } from "@/apps/nextjs-app/lib/figma/oauth";
import prisma from "@/apps/nextjs-app/lib/db/db";

export async function GET() {
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

    const connection = await getFigmaConnection(user.id);

    return NextResponse.json(connection);
  } catch (error) {
    console.error("Error checking Figma status:", error);
    return NextResponse.json(
      { error: "Failed to check Figma status" },
      { status: 500 },
    );
  }
}
