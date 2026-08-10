import { PrismaClient } from "@prisma/client";
import { databaseConfigured } from "@/lib/config";

/**
 * Prisma singleton. The database is *optional*: the live map, classification
 * and search-based ownership lookups all work without it, they just lose
 * persistence (history, ownership cache across restarts). Every call site goes
 * through `withDb`, which returns the fallback value when the database is not
 * configured or is unreachable.
 */

const globalForPrisma = globalThis as unknown as { __patPrisma?: PrismaClient };

export const prisma: PrismaClient | null = databaseConfigured()
  ? (globalForPrisma.__patPrisma ??= new PrismaClient({
      log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
    }))
  : null;

let dbHealthy = databaseConfigured();
let lastFailureAt = 0;
const RETRY_AFTER_MS = 30_000;

export function databaseEnabled(): boolean {
  if (!prisma) return false;
  if (dbHealthy) return true;
  if (Date.now() - lastFailureAt > RETRY_AFTER_MS) {
    dbHealthy = true; // allow a probe through
    return true;
  }
  return false;
}

/**
 * Run a database operation, returning `fallback` if the database is missing or
 * errors. Failures are logged once and then rate-limited.
 */
export async function withDb<T>(
  fn: (db: PrismaClient) => Promise<T>,
  fallback: T,
  label = "db",
): Promise<T> {
  if (!prisma || !databaseEnabled()) return fallback;
  try {
    const result = await fn(prisma);
    dbHealthy = true;
    return result;
  } catch (error) {
    if (dbHealthy) {
      console.warn(`[${label}] database unavailable:`, (error as Error).message);
    }
    dbHealthy = false;
    lastFailureAt = Date.now();
    return fallback;
  }
}

export async function pingDatabase(): Promise<boolean> {
  return withDb(
    async (db) => {
      await db.$queryRaw`SELECT 1`;
      return true;
    },
    false,
    "db:ping",
  );
}
