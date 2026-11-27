import { Prisma, PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

export function createPrismaClient(options?: { log?: Prisma.LogLevel[] }) {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required to create the Prisma client.");
  }

  const configuredMax = Number(process.env.DATABASE_POOL_MAX ?? "10");
  const max = Number.isInteger(configuredMax) && configuredMax > 0 ? configuredMax : 10;
  const adapter = new PrismaPg({ connectionString, max });

  return new PrismaClient({
    adapter,
    log: options?.log ?? ["error"],
  });
}
