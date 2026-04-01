---
name: data-analysis-patterns
description: >
  Use for any analytics, metrics, SQL query building, dashboard design,
  or data interpretation task. Triggers: cohort analysis, funnel metrics,
  conversion rates, time-series analysis, KPI definition, pipeline velocity,
  deal analytics, guest analytics, operational metrics, or any "show me the
  numbers" request for MarinaMatch or StayMate.
---

# Data Analysis Patterns — Expert Reference

## CRE Deal Analytics (MarinaMatch)

### Pipeline Velocity Metrics
```sql
-- Average days per stage
SELECT
  stage_name,
  AVG(days_in_stage) as avg_days,
  COUNT(*) as deal_count,
  SUM(CASE WHEN exited_reason = 'won' THEN 1 ELSE 0 END) as won,
  SUM(CASE WHEN exited_reason = 'lost' THEN 1 ELSE 0 END) as lost
FROM deal_stage_history
WHERE org_id = $1
GROUP BY stage_name
ORDER BY stage_position;
```

### Conversion Rate by Stage
```sql
-- Stage-to-stage conversion funnel
SELECT
  from_stage,
  to_stage,
  COUNT(*) as transitions,
  COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (PARTITION BY from_stage) as conversion_pct
FROM deal_transitions
WHERE org_id = $1
GROUP BY from_stage, to_stage;
```

### Deal Velocity (Days to Close)
```sql
SELECT
  DATE_TRUNC('month', created_at) as cohort_month,
  AVG(EXTRACT(EPOCH FROM (closed_at - created_at))/86400) as avg_days_to_close,
  COUNT(*) as deals_closed,
  SUM(deal_value) as total_value
FROM crm_deals
WHERE status = 'won' AND org_id = $1
GROUP BY 1 ORDER BY 1;
```

### Activity Coverage (deals with no recent activity)
```sql
SELECT
  d.id, d.name, d.deal_value,
  MAX(a.created_at) as last_activity,
  EXTRACT(EPOCH FROM (NOW() - MAX(a.created_at)))/86400 as days_since_activity
FROM crm_deals d
LEFT JOIN crm_activities a ON a.entity_id = d.id AND a.entity_type = 'deal'
WHERE d.org_id = $1 AND d.status = 'active'
GROUP BY d.id, d.name, d.deal_value
HAVING days_since_activity > 14 OR MAX(a.created_at) IS NULL
ORDER BY days_since_activity DESC NULLS FIRST;
```

## STR Analytics (StayMate)

### Core Metrics
```
RevPAR = ADR × Occupancy Rate
     OR = Total Revenue / Available Room Nights

ADR = Total Room Revenue / Rooms Sold (occupied nights)

Occupancy Rate = Nights Booked / Total Available Nights

Booking Lead Time = AVG(check_in_date - booking_created_at)

Length of Stay = AVG(check_out_date - check_in_date)
```

### RevPAR Query (StayMate SQLite)
```sql
SELECT
  strftime('%Y-%m', check_in) as month,
  COUNT(*) as bookings,
  SUM(julianday(check_out) - julianday(check_in)) as nights_booked,
  ROUND(SUM(julianday(check_out) - julianday(check_in)) * 100.0 /
    (strftime('%d', date(check_in,'start of month','+1 month','-1 day')) *
     (SELECT COUNT(*) FROM properties WHERE host_id = gt.host_id)), 1) as occupancy_pct
FROM guest_tokens gt
WHERE host_id = ? AND is_demo = 0
GROUP BY month ORDER BY month;
```

### Guest Satisfaction Signals
```sql
-- Rating distribution by property
SELECT
  p.name as property_name,
  AVG(gr.rating) as avg_rating,
  COUNT(*) as total_ratings,
  SUM(CASE WHEN gr.rating >= 4 THEN 1 ELSE 0 END) * 100.0 / COUNT(*) as pct_positive
FROM guest_ratings gr
JOIN properties p ON p.id = gr.property_id
WHERE gr.host_id = ?
GROUP BY p.name;
```

## Dashboard Design Principles

### KPI Hierarchy (top of every dashboard)
1. Primary metric (the one number that matters most)
2. 3–5 supporting metrics with trend vs prior period
3. Actionable alert list (things requiring attention today)

### Chart Type Selection
| Data type | Best chart |
|---|---|
| Trend over time | Line chart |
| Category comparison | Bar chart (horizontal if many categories) |
| Part-to-whole | Donut (max 5 segments) |
| Correlation | Scatter plot |
| Pipeline stages | Funnel chart |
| Distribution | Histogram or box plot |
| Single KPI | Stat card with sparkline |

### Recharts Implementation Pattern (MarinaMatch / StayMate)
```tsx
import { LineChart, Line, XAxis, YAxis, CartesianGrid,
         Tooltip, ResponsiveContainer } from 'recharts'

// Always wrap in ResponsiveContainer — never hardcode width
<ResponsiveContainer width="100%" height={300}>
  <LineChart data={data}>
    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
    <XAxis dataKey="month" tick={{ fontSize: 12 }} />
    <YAxis tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} />
    <Tooltip formatter={(v) => formatCurrency(v)} />
    <Line type="monotone" dataKey="noi" stroke="#4ECDC4" strokeWidth={2} dot={false} />
  </LineChart>
</ResponsiveContainer>
```
