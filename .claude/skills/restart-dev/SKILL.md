---
name: restart-dev
description: Cleanly restart the MarinaMatch dev server (tsx server) and probe /api/health to confirm it came up. Use when you've made a route change, schema change, env-var change, or middleware change that needs the server reloaded — or when the user reports "the change isn't taking effect" or asks to restart the server. Always use this instead of running `pkill` + `npm run dev` ad-hoc.
allowed-tools: Bash(bash:*), Bash(curl:*)
---

# Restart Dev Server

The CLAUDE.md flags "route change has no effect" as one of the top failure modes in this codebase. This skill encapsulates the canonical kill + restart + health-probe flow so you never forget the probe step.

## How to run

```bash
bash ${CLAUDE_SKILL_DIR}/scripts/restart.sh
```

The script:
1. Sends `pkill -f 'tsx server'` (idempotent — no-op if not running)
2. Waits 1s for the port to free
3. Starts `npm run dev` in the background, redirecting logs to `/tmp/devserver.log`
4. Polls `http://localhost:5000/api/health` for up to 15s
5. Exits 0 on healthy, exits 1 + dumps the last 30 log lines on failure

## When to invoke

- After editing any file under `server/routes/`, `server/middleware/`, `server/services/` (if exported as a route handler)
- After any DB schema migration (the `raw-sql-migration` skill runs this for you)
- After changing env vars or `.env`
- After installing a new npm package

## When NOT to invoke

- Pure frontend changes (Vite hot-reloads)
- Test runs (vitest doesn't need the dev server)
- Read-only file inspection

## Failure handling

If the health probe times out, READ `/tmp/devserver.log` first — the dump shows compile errors, port conflicts, or DB connection failures. Don't blindly retry; fix the root cause.
