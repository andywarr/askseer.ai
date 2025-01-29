import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";

export async function GET(request: NextRequest) {
  const users = await prisma.user.findMany();
  return NextResponse.json(users, { status: 200 });
}

export async function POST(request: NextRequest) {
  const { name, email, image } = await request.json();

  // Check if the user already exists
  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (existingUser) {
    return NextResponse.json({ user: existingUser }, { status: 200 });
  }

  const user = await prisma.user.create({
    data: {
      name,
      email,
      image,
    },
  });
  return NextResponse.json(user, { status: 201 });
}
