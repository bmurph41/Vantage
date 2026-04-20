#!/usr/bin/env bash
# scripts/install-hooks.sh
#
# Installs git hooks:
#   pre-commit — regenerates db/schema-index.ts and stages the result
#   pre-push   — blocks pushes when migration stubs are missing
#
# Run once per clone:
#
#   bash scripts/install-hooks.sh
#
# Or, once the npm convenience script is available:
#   npm run install-hooks
#
# If a hook already exists it is preserved as <hook>.bak before the
# new hook is written, so existing custom hooks are not lost.
#
set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"

if [ -z "$REPO_ROOT" ]; then
  echo "[install-hooks] Not inside a git repository — skipping hook installation." >&2
  exit 0
fi

HOOKS_DIR="$REPO_ROOT/.git/hooks"
mkdir -p "$HOOKS_DIR"

# ── pre-commit hook ──────────────────────────────────────────────────────────

PRE_COMMIT_FILE="$HOOKS_DIR/pre-commit"

if [ -f "$PRE_COMMIT_FILE" ]; then
  BACKUP="$PRE_COMMIT_FILE.bak"
  cp "$PRE_COMMIT_FILE" "$BACKUP"
  echo "[install-hooks] Existing pre-commit hook backed up to $BACKUP"
fi

cat > "$PRE_COMMIT_FILE" <<'HOOK'
#!/usr/bin/env bash
# pre-commit hook — auto-installed by scripts/install-hooks.sh
#
# Regenerates db/schema-index.ts from the db/schema-*.ts files that exist on
# disk and automatically stages the result so the commit always contains an
# up-to-date barrel export.  This prevents stale re-exports when schema files
# are added or removed.

set -euo pipefail

echo "[pre-commit] Syncing db/schema-index.ts..."

if ! npx --no-install tsx scripts/sync-schema-index.ts; then
  echo "[pre-commit] ERROR: sync-schema-index.ts failed — aborting commit." >&2
  exit 1
fi

# Stage the (possibly updated) file so the commit reflects the fresh content.
git add db/schema-index.ts

echo "[pre-commit] db/schema-index.ts is up to date."
HOOK

chmod +x "$PRE_COMMIT_FILE"
echo "[install-hooks] pre-commit hook installed at $PRE_COMMIT_FILE"

# ── pre-push hook ────────────────────────────────────────────────────────────

PRE_PUSH_FILE="$HOOKS_DIR/pre-push"

if [ -f "$PRE_PUSH_FILE" ]; then
  BACKUP="$PRE_PUSH_FILE.bak"
  cp "$PRE_PUSH_FILE" "$BACKUP"
  echo "[install-hooks] Existing pre-push hook backed up to $BACKUP"
fi

cat > "$PRE_PUSH_FILE" <<'HOOK'
#!/usr/bin/env bash
# pre-push hook — auto-installed by scripts/install-hooks.sh
#
# Runs `npm run gen:migrations` before every push.  If the script exits with
# a non-zero code (meaning at least one migration stub is missing), the push
# is aborted so the developer can add the stub before retrying.

set -euo pipefail

echo "[pre-push] Checking for missing migration stubs..."

if ! npm run gen:migrations --silent; then
  echo ""
  echo "[pre-push] ERROR: Missing migration stubs detected (see output above)."
  echo "  1. Paste the generated stubs into server/db-startup-migrations.ts"
  echo "  2. Adjust the column types to match your schema"
  echo "  3. Commit the updated file, then push again"
  echo ""
  echo "  To skip this check for a single push (not recommended):"
  echo "    git push --no-verify"
  echo ""
  exit 1
fi

echo "[pre-push] Migration stubs OK — proceeding with push."
HOOK

chmod +x "$PRE_PUSH_FILE"
echo "[install-hooks] pre-push hook installed at $PRE_PUSH_FILE"

echo ""
echo "[install-hooks] All hooks installed successfully."
echo "[install-hooks]   pre-commit: keeps db/schema-index.ts in sync automatically"
echo "[install-hooks]   pre-push:   verifies migration stubs are present before push"
echo "[install-hooks] To bypass hooks for a single operation (not recommended):"
echo "[install-hooks]   git commit --no-verify  /  git push --no-verify"
