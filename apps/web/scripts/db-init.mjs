// Applies prisma/sql/init.sql. Used where Prisma's migration engine cannot
// download (blocked network); on open networks `prisma db push` also works.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Client } from "pg";

const sqlPath = fileURLToPath(new URL("../prisma/sql/init.sql", import.meta.url));
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error("DATABASE_URL is required. Run with: node --env-file=.env scripts/db-init.mjs");
  process.exit(1);
}

const client = new Client({ connectionString });

try {
  await client.connect();
  await client.query(readFileSync(sqlPath, "utf8"));
  const { rows } = await client.query(
    "select count(*)::int as n from pg_tables where schemaname = 'public'",
  );
  process.stdout.write(`Schema applied. ${rows[0].n} tables in public.\n`);
} catch (error) {
  console.error("Schema apply failed:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await client.end();
}
