import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var prismaGlobal: PrismaClient | undefined;
}

export const prisma =
  globalThis.prismaGlobal ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

// In serverless environments (e.g. Vercel Functions), cache the PrismaClient instance
// on globalThis across warm invocations to avoid exhausting database connection pools.
globalThis.prismaGlobal = prisma;


export type { PrismaClient } from "@prisma/client";
export * from "@prisma/client";
