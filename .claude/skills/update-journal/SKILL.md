---
name: update-journal
description: Append a structured session entry to MARINAMATCH_JOURNAL.md. Use at the END of any non-trivial session — when shipping code, fixing bugs, completing audits, or wrapping up. Also use when the user says "update the journal", "log this session", "wrap up", or completes one of the build priorities listed in CLAUDE.md.
argument-hint: [topic — optional one-line subject for the entry]
allowed-tools: Read, Edit, Bash(date:*)
---

# Update Journal

Appends a structured entry to `~/workspace/MARINAMATCH_JOURNAL.md` so the next session can pick up cold.

## Required entry shape

Insert at the TOP of the journal (most recent first), under the existing date headers. Use this template — fill in from conversation context, do NOT prompt the user for fields they've already given:

```markdown
## ✅ <one-line subject> (YYYY-MM-DD)

<2–4 sentence summary of what was accomplished and why it matters>

### What changed
- `path/to/file.ts` — <specific change, line numbers if surgical>
- `path/to/other.ts` — <specific change>

### Decisions made
- <key decision + rationale, especially if it overrides a default or surprises the next reader>

### Verification
- <test command + result, e.g. "204/204 vitest pass; fm-audit harness 18/18 PASS">

### Next session
- <concrete next step the next session should pick up>
- <any known follow-ups or deferred items>
```

## Steps

1. Get today's date: `date +%Y-%m-%d`
2. Read `~/workspace/MARINAMATCH_JOURNAL.md` to find the insertion point (TOP, above the most recent entry)
3. Compose the entry using ONLY facts established in the current conversation. Do not invent files, commits, or test results.
4. Use the Edit tool to insert the entry. Do not rewrite the whole file.

## Constraints

- **One entry per session** — do not split across multiple entries unless the user explicitly worked on unrelated tracks
- **Never delete prior entries** — the journal is append-only history
- **No marketing language** — "shipped", "fixed", "added" are fine; avoid "comprehensive", "robust", "powerful"
- **Cite exact file paths** — future sessions grep this for context
- **If verification didn't run**, say so explicitly: "tsc skipped (OOM)", "manual smoke only, no automated tests"
