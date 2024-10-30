import { PrismaClient as OldPrisma } from "@prisma/client";
import { PrismaClient as NewPrisma } from "@prisma/client";

async function migrateDatabases() {
  const oldPrisma = new OldPrisma();
  const newPrisma = new NewPrisma();
}
