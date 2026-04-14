# Backup and Disaster Recovery

Last updated: 2026-04-14

This document covers backup procedures, restore workflows, and incident response
for the MarinaMatch platform database hosted on Neon Serverless PostgreSQL.

---

## 1. Database Provider: Neon Serverless PostgreSQL

Neon provides built-in backup capabilities:

| Feature | Free Tier | Pro Plan |
|---|---|---|
| Automatic daily backups | 7-day retention | 30-day retention |
| Point-in-Time Recovery (PITR) | Not available | Available (near-zero RPO) |
| Branching (instant DB copies) | Limited | Unlimited |
| WAL archival | Basic | Continuous |

**Branching** is the primary mechanism for safe restores and testing. A Neon branch
is an instant, copy-on-write clone of the database at a specific point in time.
Creating a branch does not affect the production database.

---

## 2. Manual Backup Procedure

### On-demand pg_dump

Run from any machine with `pg_dump` installed and network access to the Neon endpoint:

```bash
# Create a custom-format backup (compressed, supports selective restore)
pg_dump "$DATABASE_URL" \
  --format=custom \
  --no-owner \
  --no-privileges \
  --file="backup_$(date +%Y%m%d_%H%M%S).dump"

# For a plain SQL backup (human-readable, larger file)
pg_dump "$DATABASE_URL" \
  --format=plain \
  --no-owner \
  --no-privileges \
  --file="backup_$(date +%Y%m%d_%H%M%S).sql"
```

### Verify backup integrity

```bash
# List contents of a custom-format backup
pg_restore --list backup_YYYYMMDD_HHMMSS.dump | head -20

# Check file size is reasonable (should be > 0 bytes)
ls -lh backup_YYYYMMDD_HHMMSS.dump
```

### Recommended backup schedule

| Frequency | Method | Retention |
|---|---|---|
| Continuous | Neon automatic (WAL-based) | Per plan (7 or 30 days) |
| Weekly | Manual pg_dump to secure storage | 90 days |
| Before any migration | Manual pg_dump | Until migration verified |

**Important:** Always take a manual backup before running any schema migration or
bulk data operation.

---

## 3. Restore Procedure

### Option A: Restore to a Neon branch (recommended — non-destructive)

This is the safest approach. It creates a new isolated database without touching production.

1. Open the Neon Console and create a new branch from the desired point in time.
2. Copy the new branch's connection string.
3. Restore the backup into the new branch:

```bash
pg_restore \
  --dbname="$NEW_BRANCH_URL" \
  --clean \
  --if-exists \
  --no-owner \
  --no-privileges \
  backup.dump
```

4. Run the verification queries (see Section 5).
5. If the restore looks correct, update the application's `DATABASE_URL` to point
   to the new branch, or promote the branch to replace the original.

### Option B: Restore using Neon PITR (Pro plan only)

1. Open the Neon Console.
2. Navigate to the branch you want to restore.
3. Select "Restore to point in time" and choose the target timestamp.
4. Neon creates a new branch at that exact WAL position.
5. Verify and promote as needed.

### Option C: Restore directly to production (use only as last resort)

```bash
# WARNING: This overwrites production data. Only use when no other option exists.
# Take a fresh backup of current state first, even if corrupted.
pg_dump "$DATABASE_URL" --format=custom --file="pre_restore_$(date +%Y%m%d_%H%M%S).dump"

# Then restore
pg_restore \
  --dbname="$DATABASE_URL" \
  --clean \
  --if-exists \
  --no-owner \
  --no-privileges \
  backup.dump
```

---

## 4. Recovery Time and Point Objectives

| Metric | Target | Method |
|---|---|---|
| RPO (Recovery Point Objective) | 24 hours (daily backups) | Automatic Neon backups |
| RPO with PITR | Near-zero (seconds) | Pro plan WAL archival |
| RTO (Recovery Time Objective) | < 1 hour | Neon branch restore |
| RTO full environment | < 4 hours | Full rebuild from backup + env config |

### Critical tables (prioritize verification after any restore)

These tables contain financial data, compliance records, or billing state that
cannot be reconstructed from other sources:

| Table | Reason |
|---|---|
| `fund_capital_movements` | Immutable ledger of all capital calls and distributions |
| `fund_investors` | LP commitment and contact data |
| `financial_audit_log` | Append-only compliance audit trail (protected by PG RULES) |
| `billing_subscriptions` | Active subscription and payment state |
| `distribution_approvals` | Approval workflow state for fund distributions |
| `fund_period_locks` | Period lock state preventing retroactive edits |
| `organizations` | Tenant root records — all other data references these |
| `users` | Authentication and authorization records |

---

## 5. Verification Queries

Run these after every restore to confirm data integrity.

### Critical table row counts

```sql
SELECT 'organizations' AS tbl, count(*) FROM organizations
UNION ALL SELECT 'users', count(*) FROM users
UNION ALL SELECT 'crm_contacts', count(*) FROM crm_contacts
UNION ALL SELECT 'crm_companies', count(*) FROM crm_companies
UNION ALL SELECT 'crm_deals', count(*) FROM crm_deals
UNION ALL SELECT 'modeling_projects', count(*) FROM modeling_projects
UNION ALL SELECT 'fund_capital_movements', count(*) FROM fund_capital_movements
UNION ALL SELECT 'fund_investors', count(*) FROM fund_investors
UNION ALL SELECT 'financial_audit_log', count(*) FROM financial_audit_log
UNION ALL SELECT 'billing_subscriptions', count(*) FROM billing_subscriptions
ORDER BY tbl;
```

### Referential integrity checks

```sql
-- Orphaned deals (deal references a non-existent org)
SELECT 'orphaned_deals' AS check_name, count(*)
FROM crm_deals d
LEFT JOIN organizations o ON d.org_id = o.id
WHERE o.id IS NULL;

-- Orphaned contacts
SELECT 'orphaned_contacts' AS check_name, count(*)
FROM crm_contacts c
LEFT JOIN organizations o ON c.org_id = o.id
WHERE o.id IS NULL;

-- Orphaned modeling projects
SELECT 'orphaned_projects' AS check_name, count(*)
FROM modeling_projects p
LEFT JOIN organizations o ON p.org_id = o.id
WHERE o.id IS NULL;

-- Users without an organization
SELECT 'orphaned_users' AS check_name, count(*)
FROM users u
LEFT JOIN organizations o ON u.org_id = o.id
WHERE o.id IS NULL AND u.org_id IS NOT NULL;

-- Capital movements referencing non-existent funds
SELECT 'orphaned_capital_movements' AS check_name, count(*)
FROM fund_capital_movements m
LEFT JOIN modeling_projects p ON m.project_id = p.id
WHERE p.id IS NULL;
```

### Audit log integrity

```sql
-- The financial_audit_log table should have PG RULES preventing UPDATE/DELETE.
-- Verify the rules still exist after restore:
SELECT rulename, ev_type
FROM pg_rules
WHERE tablename = 'financial_audit_log';

-- Verify audit log is non-empty and spans expected date range
SELECT
  count(*) AS total_entries,
  min(created_at) AS earliest_entry,
  max(created_at) AS latest_entry
FROM financial_audit_log;
```

---

## 6. Incident Response Checklist

### Scenario A: Accidental table drop

1. **Do not panic.** Neon retains WAL history.
2. Stop the application to prevent further writes:
   ```bash
   pkill -f 'tsx server'
   ```
3. Create a Neon branch from a point in time before the drop.
4. Extract the dropped table from the branch:
   ```bash
   pg_dump "$BRANCH_URL" --table=<table_name> --format=plain > recovered_table.sql
   ```
5. Apply the recovered table to production:
   ```bash
   psql "$DATABASE_URL" < recovered_table.sql
   ```
6. Run verification queries (Section 5).
7. Restart the application:
   ```bash
   npm run dev
   ```
8. Document the incident in `MARINAMATCH_JOURNAL.md`.

### Scenario B: Accidental row deletion

1. Create a Neon branch from before the deletion.
2. Identify the deleted rows:
   ```sql
   -- On the branch: find rows that exist in the branch but not in production
   -- Export them from the branch
   ```
3. Re-insert the rows into production using an INSERT statement or `pg_dump --table --data-only`.
4. Run verification queries.
5. Document the incident.

### Scenario C: Schema migration failure

1. Stop the application:
   ```bash
   pkill -f 'tsx server'
   ```
2. Assess the damage — check which DDL statements succeeded before the failure:
   ```sql
   -- Check current table structure
   \d <affected_table>
   -- Compare against expected schema
   ```
3. If partially applied, manually reverse the completed steps using `ALTER TABLE` / `DROP` statements.
4. If the database is in an unrecoverable state, restore from the pre-migration backup
   (you did take one per Section 2, right?).
5. Fix the migration script and re-run.
6. Document what went wrong and update the migration process.

**Reminder:** Never use `npm run db:push` for migrations. Always use raw SQL via `psql`.

### Scenario D: Full database corruption

1. Stop the application immediately.
2. Attempt to create a Neon branch — if Neon's storage layer is intact, branching
   will give you a clean copy.
3. If branching fails, restore from the most recent pg_dump backup:
   ```bash
   # Create a fresh Neon branch or project
   pg_restore --dbname="$NEW_DB_URL" --clean --if-exists backup.dump
   ```
4. Update `DATABASE_URL` in environment configuration to point to the restored database.
5. Run full verification (Section 5).
6. Restart the application.
7. Notify stakeholders of any data loss window (time between last backup and incident).
8. Conduct a post-mortem and document in the journal.

---

## 7. Scheduled Backup Verification

A weekly verification job should run to detect data anomalies early.

### What it checks

- All critical tables are non-empty
- Row counts have not dropped more than 10% from the previous week
- Referential integrity holds (no orphaned records)
- Audit log protection rules are in place

### Running the verification

```bash
node scripts/verify-backup.mjs
```

The script outputs a JSON report and exits with code 0 (all checks passed) or
code 1 (one or more checks failed).

### Cron setup (if running on a persistent server)

```bash
# Run every Monday at 06:00 UTC
0 6 * * 1 cd /home/runner/workspace && node scripts/verify-backup.mjs >> /var/log/backup-verify.log 2>&1
```

For Replit or serverless environments, trigger the script manually each week or
integrate it into a CI pipeline that runs on a schedule.

---

## 8. Pre-Migration Backup Checklist

Before running any database migration:

- [ ] Take a manual pg_dump backup
- [ ] Verify the backup file size is reasonable
- [ ] Run `pg_restore --list` to confirm the backup is valid
- [ ] Create a Neon branch as an additional safety net
- [ ] Test the migration on the branch first
- [ ] Only then apply to production
- [ ] Run verification queries after the migration
- [ ] Keep the backup for at least 30 days

---

## 9. Contacts and Escalation

| Role | Action |
|---|---|
| Lead Developer (Brett) | First responder for all DB incidents |
| Neon Support | For platform-level issues (branching failures, WAL corruption) |
| Hosting Provider | For environment/networking issues affecting DB connectivity |

---

## Appendix: File Locations

| File | Purpose |
|---|---|
| `docs/operations/backup-recovery.md` | This document |
| `scripts/verify-backup.mjs` | Automated verification script |
| `MARINAMATCH_JOURNAL.md` | Session journal — document all incidents here |
