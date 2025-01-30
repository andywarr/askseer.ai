import prisma from "./db.ts";

export const fetchAllData = async () => {
  return await prisma.yourTable.findMany();
};
