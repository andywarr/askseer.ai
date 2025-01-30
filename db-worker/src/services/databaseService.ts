import prisma from "./db.ts";

export async function dbGetStudies(userId: string) {
  // Get all studies for a user
  let studies = await prisma.study.findMany({
    where: { userId: userId },
    orderBy: [
      {
        createdAt: "desc",
      },
    ],
    include: {
      files: true,
    },
  });

  return studies;
}

export async function dbGetUser(userId: string) {
  // Get a user
  let user = await prisma.user.findUnique({
    where: {
      id: userId,
    },
  });

  return user;
}
