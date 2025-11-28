# MarinaMatch Backup and Recovery Procedures

## Overview

This document outlines the backup and recovery procedures for the MarinaMatch platform, ensuring data integrity and business continuity.

## Database Backup Strategy

### Neon PostgreSQL Automated Backups

MarinaMatch uses Neon serverless PostgreSQL, which provides:

- **Continuous Backup**: Point-in-time recovery (PITR) with 7-day retention
- **Automatic Snapshots**: Daily snapshots of your database
- **Branching**: Create instant database copies for testing/development

### Manual Backup Procedures

#### Full Database Export

```bash
# Export entire database
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql

# Export specific tables
pg_dump $DATABASE_URL -t users -t organizations -t projects > core_backup.sql
```

#### Critical Tables Priority

1. **Tier 1 - Business Critical** (daily backup)
   - `users`, `organizations`, `user_sessions`
   - `projects`, `modeling_scenarios`
   - `vdr_documents`, `vdr_folders`, `vdr_permissions`

2. **Tier 2 - Operational** (weekly backup)
   - `deals`, `contacts`, `companies`, `properties`
   - `rent_roll_entries`, `fuel_transactions`
   - `calendar_events`, `activities`

3. **Tier 3 - Analytics** (monthly backup)
   - `security_audit_log`, `vdr_audit_log`
   - `scenario_comments`, `approval_notifications`

### Backup Schedule

| Backup Type | Frequency | Retention | Storage |
|-------------|-----------|-----------|---------|
| PITR | Continuous | 7 days | Neon |
| Daily Snapshot | Every 24h | 30 days | Neon |
| Weekly Export | Sundays 2AM | 90 days | S3/GCS |
| Monthly Archive | 1st of month | 1 year | Cold Storage |

## File/Document Backup

### VDR Document Storage

VDR documents are stored in:
- Local: `uploads/vdr/` directory
- Backup location: Cloud object storage (S3/GCS)

```bash
# Sync VDR documents to backup storage
aws s3 sync uploads/vdr/ s3://marinamatch-backups/vdr/

# Or with Google Cloud
gsutil -m rsync -r uploads/vdr/ gs://marinamatch-backups/vdr/
```

### Document Backup Schedule

- **Real-time**: Replicate uploads to cloud storage
- **Daily**: Full sync with version comparison
- **Weekly**: Archive old versions to cold storage

## Recovery Procedures

### Scenario 1: Point-in-Time Recovery (Database Corruption)

1. **Assess the Issue**
   ```bash
   # Check recent database activity
   SELECT * FROM security_audit_log 
   WHERE created_at > NOW() - INTERVAL '1 hour'
   ORDER BY created_at DESC;
   ```

2. **Identify Recovery Point**
   - Determine the last known good state
   - Use Neon console to select recovery timestamp

3. **Create Recovery Branch**
   - In Neon dashboard: Create branch from point-in-time
   - Test data integrity on branch

4. **Promote Recovery Branch**
   - Update DATABASE_URL to recovered branch
   - Restart application

### Scenario 2: Full Database Restore

1. **Stop Application**
   ```bash
   # Stop all workflows
   ```

2. **Restore from Backup**
   ```bash
   # Restore full database
   psql $DATABASE_URL < backup_20231128.sql
   ```

3. **Verify Data Integrity**
   ```bash
   # Count critical records
   psql $DATABASE_URL -c "SELECT COUNT(*) FROM users"
   psql $DATABASE_URL -c "SELECT COUNT(*) FROM projects"
   ```

4. **Restart Application**

### Scenario 3: VDR Document Recovery

1. **Identify Missing Documents**
   ```bash
   # Query VDR documents
   SELECT id, name, storage_path FROM vdr_documents 
   WHERE deleted_at IS NOT NULL;
   ```

2. **Restore from Backup**
   ```bash
   # Restore specific file
   aws s3 cp s3://marinamatch-backups/vdr/file.pdf uploads/vdr/file.pdf
   ```

3. **Update Database Record**
   ```sql
   UPDATE vdr_documents 
   SET deleted_at = NULL 
   WHERE id = 'document-id';
   ```

### Scenario 4: User Account Recovery

1. **Reset User Session**
   ```sql
   DELETE FROM user_sessions WHERE user_id = 'user-id';
   ```

2. **Clear MFA (if locked out)**
   ```sql
   UPDATE users SET 
     mfa_enabled = false,
     mfa_secret = NULL,
     mfa_backup_codes = NULL
   WHERE id = 'user-id';
   ```

3. **Trigger Password Reset**
   - Use admin panel or direct API call

## Disaster Recovery Plan

### RTO (Recovery Time Objective): 4 hours
### RPO (Recovery Point Objective): 1 hour

### DR Runbook

1. **Detection** (15 min)
   - Monitoring alerts trigger
   - Health check failure at /health
   - User reports

2. **Assessment** (30 min)
   - Identify affected systems
   - Determine scope of impact
   - Select recovery strategy

3. **Recovery Execution** (2-3 hours)
   - Execute appropriate recovery scenario
   - Validate system functionality
   - Verify data integrity

4. **Post-Incident** (1 hour)
   - Document incident
   - Update procedures
   - Communicate to stakeholders

## Health Monitoring

### Endpoints

- `/health` - Overall system health
- `/health/ready` - Kubernetes readiness probe
- `/health/live` - Kubernetes liveness probe
- `/metrics` - Application metrics

### Monitoring Checks

```bash
# Check health status
curl https://marinamatch.replit.app/health

# Expected healthy response
{
  "status": "healthy",
  "checks": {
    "database": { "status": "healthy", "latencyMs": 15 },
    "cache": { "status": "healthy" },
    "jobQueue": { "status": "healthy" }
  }
}
```

## Security Considerations

### Backup Encryption

- All backups encrypted at rest with AES-256
- Encryption keys stored in secure key management service
- Access logs maintained for all backup operations

### Access Control

- Backup access limited to designated administrators
- MFA required for all backup/restore operations
- All access logged in security audit trail

### Retention Compliance

- GDPR: User data deletion within 30 days of request
- SOC 2: Audit logs retained for 7 years
- Financial data: Retained per regulatory requirements

## Testing Schedule

| Test Type | Frequency | Last Tested | Next Scheduled |
|-----------|-----------|-------------|----------------|
| Backup Verification | Weekly | - | - |
| Point-in-Time Recovery | Monthly | - | - |
| Full DR Exercise | Quarterly | - | - |
| Document Restore | Monthly | - | - |

## Contact Information

### Incident Response Team

- **Primary On-Call**: (configure in PagerDuty/Opsgenie)
- **Secondary On-Call**: (backup contact)
- **Database Admin**: (DBA contact)
- **Security Team**: (security contact)

### Escalation Path

1. On-call engineer (15 min response)
2. Team lead (30 min escalation)
3. Engineering manager (1 hour escalation)
4. CTO (critical incidents)
