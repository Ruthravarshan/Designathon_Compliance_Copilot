// The corporate proxy blocks binaries.prisma.sh, so `prisma generate` cannot
// fetch the native engines. The generated client uses engineType = "client"
// (WASM query compiler + pg driver adapter) and never loads them, so stub
// files only need to satisfy the CLI's existence check. On networks with
// access, real engines are downloaded and this wrapper runs the plain command.
import { existsSync, mkdirSync, statSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const webRoot = fileURLToPath(new URL("..", import.meta.url));
const repoRoot = join(webRoot, "..", "..");
const enginesDir = join(repoRoot, "node_modules", "@prisma", "engines");
const binName = process.platform === "win32" ? "prisma.cmd" : "prisma";
const prismaBin = join(repoRoot, "node_modules", ".bin", binName);

const targets = {
  win32: { query: "query_engine-windows.dll.node", schema: "schema-engine-windows.exe" },
  linux: {
    query: "libquery_engine-debian-openssl-3.0.x.so.node",
    schema: "schema-engine-debian-openssl-3.0.x",
  },
  darwin: { query: "libquery_engine-darwin.dylib.node", schema: "schema-engine-darwin" },
};

const platform = targets[process.platform];
const stubThreshold = 1024 * 1024;

function needsStub(path) {
  if (!existsSync(path)) return true;
  try {
    return statSync(path).size < stubThreshold;
  } catch {
    return true;
  }
}

let env = process.env;
let note = "";

if (platform && existsSync(enginesDir)) {
  const queryPath = join(enginesDir, platform.query);
  const schemaPath = join(enginesDir, platform.schema);

  if (needsStub(queryPath) || needsStub(schemaPath)) {
    mkdirSync(enginesDir, { recursive: true });
    if (needsStub(queryPath)) writeFileSync(queryPath, "stub: no native query engine\n");
    if (needsStub(schemaPath)) writeFileSync(schemaPath, "stub: no native schema engine\n");
    env = {
      ...process.env,
      PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING: "1",
      PRISMA_QUERY_ENGINE_LIBRARY: queryPath,
      PRISMA_SCHEMA_ENGINE_BINARY: schemaPath,
    };
    note = " (using WASM client stubs; native engines unavailable)";
  }
}

process.stdout.write(`Generating Prisma client${note}\n`);
const result = spawnSync(prismaBin, ["generate"], {
  cwd: webRoot,
  env,
  stdio: "inherit",
  shell: process.platform === "win32",
});

process.exit(result.status ?? 1);
