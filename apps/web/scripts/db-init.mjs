// Applies prisma/sql/init.sql followed by the numbered migrations. Used where
// Prisma's migration engine cannot download (blocked network); on open networks
// `prisma db push` also works.
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { Client } from "pg";

const sqlDir = fileURLToPath(new URL("../prisma/sql", import.meta.url));
const connectionString = process.env.DATABASE_URL;
const files = [
  join(sqlDir, "init.sql"),
  ...readdirSync(sqlDir)
    .filter((file) => /^\d{3}-.+\.sql$/.test(file))
    .sort()
    .map((file) => join(sqlDir, file)),
];

if (!connectionString) {
  console.error("DATABASE_URL is required. Run with: node --env-file=.env scripts/db-init.mjs");
  process.exit(1);
}

const client = new Client({ connectionString });

try {
  await client.connect();
  for (const file of files) {
    await client.query(readFileSync(file, "utf8"));
  }
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
