#!/usr/bin/env tsx
/**
 * Generate CREATE INDEX stubs for missing indexes detected by check-schema-drift.ts
 * Run from workspace root: npx tsx scripts/gen-missing-indexes.ts
 */
import { readFileSync, readdirSync } from "fs";
import { resolve, join, dirname } from "path";
import { fileURLToPath } from "url";
import { PgTable, getTableConfig } from "drizzle-orm/pg-core";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

async function loadSchemas(): Promise<Record<string, unknown>[]> {
  const results: Record<string, unknown>[] = [];
  results.push(await import("../shared/schema"));
  try { results.push(await import("../shared/docket-schema")); } catch {}
  try { results.push(await import("../shared/pnl-pipeline-schema")); } catch {}
  const dbDir = join(root, "db");
  const dbFiles = readdirSync(dbDir).filter(f => f.startsWith("schema-") && f.endsWith(".ts"));
  for (const f of dbFiles) {
    try { results.push(await import(join(dbDir, f))); } catch {}
  }
  return results;
}

async function main() {
  const schemas = await loadSchemas();
  const seenTables = new Set<string>();
  const stubs: string[] = [];

  for (const schema of schemas) {
    for (const [, value] of Object.entries(schema)) {
      if (!value || typeof value !== "object") continue;
      try {
        const config = getTableConfig(value as PgTable);
        const tableName = config.name;
        if (seenTables.has(tableName)) continue;
        seenTables.add(tableName);

        for (const idx of (config.indexes || [])) {
          const idxName = idx.config.name;
          const unique = idx.config.unique ? "UNIQUE " : "";
          const cols = (idx.config.columns || []).map((c: any) => {
            if (typeof c === "string") return c;
            if (c?._.name) return c._.name;
            if (c?.name) return c.name;
            return null;
          }).filter(Boolean).join(", ");

          if (!cols) {
            process.stderr.write(`SKIP ${idxName} on ${tableName} — can't resolve columns\n`);
            continue;
          }
          stubs.push(`  { name: "${tableName}: index ${idxName}", sql: \`CREATE ${unique}INDEX IF NOT EXISTS ${idxName} ON ${tableName}(${cols})\` },`);
        }
      } catch { /* not a PgTable */ }
    }
  }

  for (const s of stubs) process.stdout.write(s + "\n");
  process.stderr.write(`Done: ${stubs.length} index stubs generated\n`);
}

main();
