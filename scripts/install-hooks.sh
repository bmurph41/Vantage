#!/usr/bin/env bash
# scripts/install-hooks.sh
#
# Installs a git pre-push hook that blocks pushes when migration stubs are
# missing.  Run once per clone:
#
#   bash scripts/install-hooks.sh
#
# Or, once the npm convenience script is available:
#   npm run install-hooks
#
# If a pre-push hook already exists it is preserved as pre-push.bak before the
# new hook is written, so existing custom hooks are not lost.
#
set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"

if [ -z "$REPO_ROOT" ]; then
  echo "[install-hooks] Not inside a git repository — skipping hook installation." >&2
  exit 0
fi

HOOKS_DIR="$REPO_ROOT/.git/hooks"
HOOK_FILE="$HOOKS_DIR/pre-push"

mkdir -p "$HOOKS_DIR"

if [ -f "$HOOK_FILE" ]; then
  BACKUP="$HOOK_FILE.bak"
  cp "$HOOK_FILE" "$BACKUP"
  echo "[install-hooks] Existing pre-push hook backed up to $BACKUP"
fi

cat > "$HOOK_FILE" <<'HOOK'
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

chmod +x "$HOOK_FILE"

echo "[install-hooks] pre-push hook installed at $HOOK_FILE"
echo "[install-hooks] Every future 'git push' will verify migration stubs are present."
echo "[install-hooks] To bypass a single push (not recommended): git push --no-verify"
