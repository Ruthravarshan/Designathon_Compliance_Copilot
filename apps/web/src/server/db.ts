import "server-only";
import type { PrismaClient } from "@prisma/client";
import { env } from "@/lib/env";
import { createPrismaClient } from "@/server/prisma-client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db =
  globalForPrisma.prisma ??
  createPrismaClient({
    log: env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}
