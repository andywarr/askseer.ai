// Prisma imports
import { PrismaClient } from "@prisma/client";

const prismaClientSingleton = () => {
  return new PrismaClient();
};

declare const globalThis: {
  prismaGlobal: ReturnType<typeof prismaClientSingleton>;
} & typeof global;

// Always use the singleton pattern to prevent connection pool exhaustion.
// In development, Next.js hot-reloading can create multiple instances,
// so we store the client in globalThis to reuse it across reloads.
// In production, this ensures we don't create multiple clients.
const prisma = globalThis.prismaGlobal ?? prismaClientSingleton();

// Store the client in globalThis for ALL environments to prevent
// creating multiple PrismaClient instances which can exhaust the connection pool
globalThis.prismaGlobal = prisma;

export default prisma;
