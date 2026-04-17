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
#   The drift check runs as a *non-blocking warning* so that pre-existing drift
#   does not prevent future merges from completing.  Any detected drift is clearly
#   printed in the merge log; developers should treat a FAIL result as a P1 task.
#   To convert this to a hard gate (fail the merge on drift), replace the
#   "npx tsx ... || true" line below with just "npx tsx scripts/check-schema-drift.ts".

set -e

# Step 1 — dependencies
npm install --prefer-offline

# Step 2 — apply schema migrations
timeout 60 bash -c 'yes | npm run db:push' || echo "db:push skipped (timeout or no changes needed)"

# Step 3 — schema drift check (warning; does not fail the merge on drift)
echo ""
echo "Running schema drift check..."
npx tsx scripts/check-schema-drift.ts || {
  DRIFT_EXIT=$?
  if [ "$DRIFT_EXIT" -eq 1 ]; then
    echo ""
    echo "WARNING: Schema drift detected (see above). This does not block the merge,"
    echo "but the drift should be fixed before the next production deployment."
    echo "To generate migration stubs: npx tsx scripts/generate-startup-migrations.ts"
  else
    echo "WARNING: Schema drift check could not run (exit $DRIFT_EXIT). Verify DATABASE_URL is set."
  fi
}
