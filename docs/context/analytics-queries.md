# Analytics Queries — Pre-Built SQL Library

Every metric in MarinaMatch analytics. All queries use `$1` for parameterized `org_id`.

---

## 1. Pipeline Analytics

### Pipeline Velocity (avg days per stage)
```sql
-- Route: GET /api/analytics/pipeline-velocity
SELECT
  ps.name as stage_name,
  ps.position as stage_position,
  COUNT(d.id) as deal_count,
  AVG(EXTRACT(EPOCH FROM (
    COALESCE(d.stage_changed_at, NOW()) - d.stage_entered_at
  )) / 86400)::numeric(10,1) as avg_days_in_stage,
  SUM(d.deal_value) as total_value
FROM crm_deals d
JOIN crm_pipeline_stages ps ON ps.id = d.stage_id
WHERE d.org_id = $1 AND d.status = 'active'
GROUP BY ps.name, ps.position
ORDER BY ps.position;
```

### Conversion Funnel (stage-to-stage)
```sql
-- Route: GET /api/analytics/conversion-funnel
WITH stage_counts AS (
  SELECT
    ps.name as stage_name,
    ps.position,
    COUNT(*) as entered_count
  FROM crm_deals d
  JOIN crm_pipeline_stages ps ON ps.id = d.stage_id
  WHERE d.org_id = $1
  GROUP BY ps.name, ps.position
)
SELECT
  stage_name,
  entered_count,
  ROUND(entered_count * 100.0 / FIRST_VALUE(entered_count) OVER (ORDER BY position), 1) as pct_of_top
FROM stage_counts
ORDER BY position;
```

### Deal Value by Stage
```sql
-- Route: GET /api/analytics/deal-value-by-stage
SELECT
  ps.name as stage_name,
  ps.position,
  COUNT(d.id) as deal_count,
  SUM(d.deal_value) as total_value,
  AVG(d.deal_value) as avg_value,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY d.deal_value) as median_value
FROM crm_deals d
JOIN crm_pipeline_stages ps ON ps.id = d.stage_id
WHERE d.org_id = $1 AND d.status = 'active'
GROUP BY ps.name, ps.position
ORDER BY ps.position;
```

### Win/Loss Rate by Month
```sql
-- Route: GET /api/analytics/win-loss-rate
SELECT
  DATE_TRUNC('month', updated_at) as month,
  SUM(CASE WHEN status = 'won' THEN 1 ELSE 0 END) as won,
  SUM(CASE WHEN status = 'lost' THEN 1 ELSE 0 END) as lost,
  ROUND(
    SUM(CASE WHEN status = 'won' THEN 1 ELSE 0 END) * 100.0 /
    NULLIF(SUM(CASE WHEN status IN ('won','lost') THEN 1 ELSE 0 END), 0), 1
  ) as win_rate_pct
FROM crm_deals
WHERE org_id = $1 AND status IN ('won', 'lost')
GROUP BY 1 ORDER BY 1;
```

### Hook & Component Pattern
```tsx
// client/src/hooks/use-pipeline-analytics.ts
export function usePipelineVelocity(orgId: string) {
  return useQuery({
    queryKey: ['analytics', 'pipeline-velocity', orgId],
    queryFn: () => apiRequest('/api/analytics/pipeline-velocity'),
  });
}

// Render: BarChart with stages on X, avg_days on Y
<ResponsiveContainer width="100%" height={300}>
  <BarChart data={data}>
    <XAxis dataKey="stage_name" />
    <YAxis label={{ value: 'Days', angle: -90 }} />
    <Bar dataKey="avg_days_in_stage" fill="#4ECDC4" />
    <Tooltip />
  </BarChart>
</ResponsiveContainer>
```

---

## 2. CRM Activity Analytics

### Activity Frequency by Type
```sql
-- Route: GET /api/analytics/activity-frequency
SELECT
  activity_type,
  DATE_TRUNC('week', created_at) as week,
  COUNT(*) as count
FROM crm_activities
WHERE org_id = $1 AND created_at > NOW() - INTERVAL '90 days'
GROUP BY activity_type, week
ORDER BY week, activity_type;
```

### Stale Deals (no activity in 14+ days)
```sql
-- Route: GET /api/analytics/stale-deals
SELECT
  d.id, d.name, d.deal_value, ps.name as stage_name,
  MAX(a.created_at) as last_activity,
  EXTRACT(EPOCH FROM (NOW() - MAX(a.created_at)))/86400 as days_silent
FROM crm_deals d
JOIN crm_pipeline_stages ps ON ps.id = d.stage_id
LEFT JOIN crm_activities a ON a.entity_id = d.id::text AND a.entity_type = 'deal'
WHERE d.org_id = $1 AND d.status = 'active'
GROUP BY d.id, d.name, d.deal_value, ps.name
HAVING MAX(a.created_at) IS NULL OR NOW() - MAX(a.created_at) > INTERVAL '14 days'
ORDER BY days_silent DESC NULLS FIRST;
```

### Activity Coverage (% of active deals touched this week)
```sql
-- Route: GET /api/analytics/activity-coverage
SELECT
  COUNT(DISTINCT d.id) as total_active,
  COUNT(DISTINCT CASE
    WHEN a.created_at > NOW() - INTERVAL '7 days' THEN d.id
  END) as touched_this_week,
  ROUND(
    COUNT(DISTINCT CASE WHEN a.created_at > NOW() - INTERVAL '7 days' THEN d.id END) * 100.0 /
    NULLIF(COUNT(DISTINCT d.id), 0), 1
  ) as coverage_pct
FROM crm_deals d
LEFT JOIN crm_activities a ON a.entity_id = d.id::text AND a.entity_type = 'deal'
WHERE d.org_id = $1 AND d.status = 'active';
```

---

## 3. Financial Model Analytics

### NOI Distribution Across Portfolio
```sql
-- Route: GET /api/analytics/noi-distribution
SELECT
  d.name as deal_name,
  mpc.data->>'noi' as noi,
  mpc.data->>'capRate' as cap_rate,
  mpc.data->>'assetClass' as asset_class
FROM crm_deals d
JOIN modeling_projects mp ON mp.id = d.modeling_project_id
JOIN modeling_project_config mpc ON mpc.project_id = mp.id AND mpc.key = 'deal_assumptions'
WHERE d.org_id = $1;
```

### Cap Rate Distribution
```sql
-- Route: GET /api/analytics/cap-rate-distribution
-- Render: Histogram with 25bps buckets
SELECT
  ROUND((mpc.data->>'capRate')::numeric, 3) as cap_rate_bucket,
  COUNT(*) as deal_count,
  SUM((mpc.data->>'purchasePrice')::numeric) as total_value
FROM modeling_project_config mpc
JOIN modeling_projects mp ON mp.id = mpc.project_id
WHERE mp.org_id = $1 AND mpc.key = 'deal_assumptions'
GROUP BY 1 ORDER BY 1;
```

---

## 4. Workflow Analytics

### Rule Execution Rates
```sql
-- Route: GET /api/analytics/workflow-execution
SELECT
  wr.name as rule_name,
  wr.trigger_type,
  COUNT(wl.id) as executions,
  SUM(CASE WHEN wl.status = 'success' THEN 1 ELSE 0 END) as successes,
  SUM(CASE WHEN wl.status = 'error' THEN 1 ELSE 0 END) as errors,
  MAX(wl.created_at) as last_executed
FROM workflow_rules wr
LEFT JOIN workflow_logs wl ON wl.rule_id = wr.id
WHERE wr.org_id = $1
GROUP BY wr.id, wr.name, wr.trigger_type
ORDER BY executions DESC;
```

### Most-Triggered Rules (top 10)
```sql
-- Route: GET /api/analytics/top-triggered-rules
SELECT
  wr.name, wr.trigger_type, COUNT(wl.id) as trigger_count
FROM workflow_rules wr
JOIN workflow_logs wl ON wl.rule_id = wr.id
WHERE wr.org_id = $1 AND wl.created_at > NOW() - INTERVAL '30 days'
GROUP BY wr.id, wr.name, wr.trigger_type
ORDER BY trigger_count DESC LIMIT 10;
```

---

## 5. Marketplace Analytics

### Source Performance
```sql
-- Route: GET /api/analytics/source-performance
SELECT
  d.source,
  COUNT(*) as total_sourced,
  SUM(CASE WHEN d.status = 'won' THEN 1 ELSE 0 END) as converted,
  ROUND(
    SUM(CASE WHEN d.status = 'won' THEN 1 ELSE 0 END) * 100.0 / NULLIF(COUNT(*), 0), 1
  ) as conversion_pct,
  AVG(d.deal_value) as avg_deal_value
FROM crm_deals d
WHERE d.org_id = $1 AND d.source IS NOT NULL
GROUP BY d.source
ORDER BY conversion_pct DESC;
```

### Sourced-to-Pipeline Conversion
```sql
-- Route: GET /api/analytics/sourced-to-pipeline
SELECT
  DATE_TRUNC('month', d.created_at) as month,
  SUM(CASE WHEN d.source = 'marketplace' THEN 1 ELSE 0 END) as from_marketplace,
  SUM(CASE WHEN d.source = 'direct' THEN 1 ELSE 0 END) as direct,
  SUM(CASE WHEN d.source = 'referral' THEN 1 ELSE 0 END) as referral,
  COUNT(*) as total
FROM crm_deals d
WHERE d.org_id = $1
GROUP BY 1 ORDER BY 1;
```

---

## 6. User/Org Analytics

### Feature Usage
```sql
-- Route: GET /api/analytics/feature-usage
SELECT
  feature_name,
  COUNT(DISTINCT user_id) as unique_users,
  COUNT(*) as total_uses,
  MAX(created_at) as last_used
FROM feature_usage_log
WHERE org_id = $1 AND created_at > NOW() - INTERVAL '30 days'
GROUP BY feature_name
ORDER BY total_uses DESC;
```

### Most Active Users
```sql
-- Route: GET /api/analytics/active-users
SELECT
  u.id, u.name, u.email,
  COUNT(a.id) as activity_count,
  COUNT(DISTINCT DATE(a.created_at)) as active_days,
  MAX(a.created_at) as last_active
FROM users u
JOIN crm_activities a ON a.created_by = u.id
WHERE u.org_id = $1 AND a.created_at > NOW() - INTERVAL '30 days'
GROUP BY u.id, u.name, u.email
ORDER BY activity_count DESC;
```
