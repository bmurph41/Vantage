#!/bin/bash
# Post-merge setup script — runs automatically after every task merge.
#
# Steps:
#   1. Install/update Node dependencies.
#   2. Apply any pending Drizzle schema migrations to the live database (db:push).
#   3. Run the schema-drift check to verify the live DB matches shared/schema.ts.
#
# Schema-drift check exit codes (from scripts/check-schema-drift.ts):
#   0 — schema and DB are in sync (clean pass)
#   1 — drift detected — a per-table summary of missing / extra columns is
#       printed to stderr so developers know exactly what to fix:
#         • MISSING column/table → run:  npx tsx scripts/generate-startup-migrations.ts
#           then paste the output into server/db-startup-migrations.ts and commit.
#         • EXTRA column         → review whether a DROP COLUMN migration is needed.
#   2 — check could not connect to the database (env / network issue)
#
# DevOps note:
#   The drift check is a *hard gate* — any detected drift will fail the merge so
#   that schema inconsistencies can never silently reach production.  If drift is
#   reported, fix it before merging:
#     • MISSING COLUMN/TABLE → run:  npx tsx scripts/generate-startup-migrations.ts
#       then paste the output into server/db-startup-migrations.ts and commit.
#     • EXTRA COLUMN         → review whether a DROP COLUMN migration is needed.
#     • EXTRA TABLE          → add a matching Drizzle definition to shared/schema.ts
#       or add a DROP TABLE migration and commit.

set -e

# Step 1 — dependencies
npm install --prefer-offline

# Step 2 — apply schema migrations
timeout 60 bash -c 'yes | npm run db:push' || echo "db:push skipped (timeout or no changes needed)"

# Step 3 — schema drift check (hard gate: exits non-zero if drift is detected)
echo ""
echo "Running schema drift check..."
npx tsx scripts/check-schema-drift.ts
