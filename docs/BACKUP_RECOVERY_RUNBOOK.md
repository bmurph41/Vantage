# Backup & Recovery Runbook

**Platform:** Marinalytics  
**Last Updated:** February 2026  
**Owner:** Engineering Team

---

## 1. Backup Strategy Overview

| Backup Type | Frequency | Retention | Method |
|-------------|-----------|-----------|--------|
| Automated DB snapshots | Daily | 7 days | Replit/Neon managed |
| Point-in-time recovery | Continuous | 7 days | Neon WAL archiving |
| Manual full export | Weekly | 30 days | pg_dump to secure storage |
| Schema export | Every migration | Indefinite | Git (drizzle migrations) |

---

## 2. Automated Backups (Neon/Replit Managed)

Replit's managed PostgreSQL (backed by Neon) provides:

- **Continuous WAL archiving** for point-in-time recovery
- **Daily snapshots** retained for 7 days
- **Automatic failover** for database availability

No action required — these run automatically.

---

## 3. Manual Backup Procedure

### 3.1 Full Database Export

```bash
# Set connection string
export DATABASE_URL="postgresql://user:pass@host:port/dbname?sslmode=require"

# Full backup with compression
pg_dump "$DATABASE_URL" \
  --format=custom \
  --compress=9 \
  --verbose \
  --file="marinalytics-backup-$(date +%Y%m%d-%H%M%S).dump"

# Verify backup integrity
pg_restore --list "marinalytics-backup-*.dump" | head -20
```

### 3.2 Schema-Only Export

```bash
pg_dump "$DATABASE_URL" \
  --schema-only \
  --file="marinalytics-schema-$(date +%Y%m%d).sql"
```

### 3.3 Table-Specific Backup

```bash
# Backup critical tables only
pg_dump "$DATABASE_URL" \
  --format=custom \
  --table=organizations \
  --table=users \
  --table=projects \
  --table=crm_contacts \
  --table=crm_companies \
  --table=crm_deals \
  --table=audit_logs \
  --file="marinalytics-critical-$(date +%Y%m%d).dump"
```

---

## 4. Recovery Procedures

### 4.1 Point-in-Time Recovery (Neon)

1. Navigate to the Neon dashboard for your project
2. Select **Branches** → **Restore**
3. Choose the target timestamp
4. Neon will create a new branch at that point in time
5. Verify data integrity on the restored branch
6. If confirmed, promote the restored branch to primary

### 4.2 Full Restore from Backup

```bash
# Restore from custom-format dump
pg_restore \
  --dbname="$DATABASE_URL" \
  --clean \
  --if-exists \
  --verbose \
  "marinalytics-backup-YYYYMMDD-HHMMSS.dump"
```

### 4.3 Partial Table Restore

```bash
# Restore specific table(s) from a full backup
pg_restore \
  --dbname="$DATABASE_URL" \
  --table=crm_contacts \
  --clean \
  --if-exists \
  "marinalytics-backup-YYYYMMDD-HHMMSS.dump"
```

### 4.4 Schema Migration Recovery

If a Drizzle migration fails:

1. Check the migration status: `npx drizzle-kit status`
2. Review the failed migration in `drizzle/` directory
3. If safe, manually revert the SQL changes
4. Re-run: `npx drizzle-kit push:pg`
5. If data was corrupted, restore from the last known good backup

---

## 5. Post-Recovery Verification

After any restore operation, run these checks:

```sql
-- 1. Verify row counts on critical tables
SELECT 'organizations' as tbl, count(*) FROM organizations
UNION ALL SELECT 'users', count(*) FROM users
UNION ALL SELECT 'projects', count(*) FROM projects
UNION ALL SELECT 'crm_contacts', count(*) FROM crm_contacts
UNION ALL SELECT 'crm_companies', count(*) FROM crm_companies
UNION ALL SELECT 'crm_deals', count(*) FROM crm_deals
UNION ALL SELECT 'audit_logs', count(*) FROM audit_logs;

-- 2. Verify latest records exist (not stale)
SELECT max(created_at) as latest_record FROM audit_logs;
SELECT max(updated_at) as latest_update FROM projects;

-- 3. Verify foreign key integrity
SELECT count(*) as orphaned_contacts 
FROM crm_contacts c 
LEFT JOIN organizations o ON c.org_id = o.id 
WHERE o.id IS NULL;

-- 4. Verify indexes exist
SELECT indexname, tablename 
FROM pg_indexes 
WHERE schemaname = 'public' 
ORDER BY tablename;
```

---

## 6. Disaster Recovery Drill Schedule

| Drill Type | Frequency | Duration | Owner |
|------------|-----------|----------|-------|
| Backup verification | Monthly | 1 hour | On-call engineer |
| Table restore test | Monthly | 2 hours | On-call engineer |
| Full disaster recovery | Quarterly | 4 hours | Engineering lead |
| Schema rollback test | Per migration | 30 min | Deploying engineer |

### Drill Procedure

1. Export current production backup
2. Restore to a staging/test environment
3. Run verification queries (Section 5)
4. Test application functionality against restored data
5. Document results and any issues in the drill log
6. If issues found, update this runbook

---

## 7. Escalation Path

| Severity | Scenario | Action | Contact |
|----------|----------|--------|---------|
| P1 | Complete data loss | Restore from Neon PITR + notify stakeholders | Engineering lead |
| P2 | Partial data corruption | Restore affected tables from backup | On-call engineer |
| P3 | Migration failure | Rollback migration, restore schema | Deploying engineer |
| P4 | Stale backup detected | Re-run manual backup, investigate cron | Any engineer |

---

## 8. Storage & Retention

- Manual backups stored in secure, encrypted storage
- Backups older than 30 days are automatically purged
- Schema exports are retained in Git history indefinitely
- Backup encryption: AES-256 at rest
- Access: restricted to engineering team leads
