# STR Metrics — Short-Term Rental Analytics Reference

For StayMate and any STR analytics work in MarinaMatch.

---

## 1. Core STR Metric Definitions

### RevPAR (Revenue Per Available Room-Night)
```
RevPAR = Total Room Revenue / Total Available Room-Nights
       = ADR × Occupancy Rate
```
The single most important STR metric. Captures both pricing power and demand.

### ADR (Average Daily Rate)
```
ADR = Total Room Revenue / Total Occupied Room-Nights
```
Measures pricing power independent of occupancy.

### Occupancy Rate
```
Occupancy = Occupied Room-Nights / Available Room-Nights × 100
```
Available room-nights = number of properties × days in period (minus blocked dates).

### Booking Lead Time
```
Lead Time = AVG(check_in_date - booking_created_date)
```
Shorter lead times = more last-minute demand (or pricing too low).

### Length of Stay (LOS)
```
LOS = AVG(check_out_date - check_in_date)
```
Longer LOS = lower turnover cost, but potentially lower ADR.

### Gross Booking Value (GBV)
```
GBV = Total guest payments including cleaning fees, service fees
Net Revenue = GBV - platform fees - cleaning costs - taxes
```

---

## 2. Palm Harbor / FL Coastal Benchmarks

### Seasonal Patterns (Gulf Coast Florida)

| Season | Months | Occupancy | ADR Range | Notes |
|---|---|---|---|---|
| Peak | Jan–Apr | 75–90% | $250–$450 | Snowbird + spring break |
| Shoulder | May, Nov–Dec | 55–70% | $180–$300 | Holidays boost Dec |
| Off-peak | Jun–Oct | 35–55% | $120–$220 | Hurricane season, summer heat |

### Annual Benchmarks (FL Coastal 2-3BR)

| Metric | Budget | Good | Excellent |
|---|---|---|---|
| Annual Occupancy | 55% | 65% | 75%+ |
| ADR | $180 | $250 | $350+ |
| RevPAR | $99 | $162 | $262+ |
| Annual Revenue (per unit) | $36K | $59K | $96K+ |
| Operating Expense Ratio | 45% | 35% | 28% |
| Net Yield on Purchase Price | 4% | 7% | 10%+ |

### Cleaning & Turnover Costs
- 2BR: $100–$150 per turn
- 3BR: $150–$225 per turn
- Turns per month at 65% occ / 3.5 avg LOS: ~5.6 turns

---

## 3. SQL Queries (StayMate SQLite Schema)

### Monthly RevPAR
```sql
SELECT
  strftime('%Y-%m', gt.check_in) as month,
  COUNT(DISTINCT gt.id) as bookings,
  SUM(julianday(gt.check_out) - julianday(gt.check_in)) as nights_sold,
  ROUND(SUM(gt.total_price), 2) as total_revenue,
  ROUND(SUM(gt.total_price) / SUM(julianday(gt.check_out) - julianday(gt.check_in)), 2) as adr,
  -- Available nights = days_in_month × active properties
  ROUND(
    SUM(julianday(gt.check_out) - julianday(gt.check_in)) * 100.0 /
    (CAST(strftime('%d', date(gt.check_in, 'start of month', '+1 month', '-1 day')) AS REAL) *
     (SELECT COUNT(*) FROM properties WHERE host_id = gt.host_id AND status = 'active')),
  1) as occupancy_pct
FROM guest_tokens gt
WHERE gt.host_id = ? AND gt.is_demo = 0 AND gt.status = 'confirmed'
GROUP BY month
ORDER BY month;
```

### ADR Trend
```sql
SELECT
  strftime('%Y-%m', check_in) as month,
  ROUND(SUM(total_price) / SUM(julianday(check_out) - julianday(check_in)), 2) as adr,
  COUNT(*) as bookings
FROM guest_tokens
WHERE host_id = ? AND is_demo = 0 AND status = 'confirmed'
GROUP BY month ORDER BY month;
```

### Booking Lead Time Distribution
```sql
SELECT
  CASE
    WHEN julianday(check_in) - julianday(created_at) < 7 THEN 'Last minute (<7d)'
    WHEN julianday(check_in) - julianday(created_at) < 30 THEN 'Short (7-30d)'
    WHEN julianday(check_in) - julianday(created_at) < 90 THEN 'Medium (30-90d)'
    ELSE 'Long (90d+)'
  END as lead_bucket,
  COUNT(*) as bookings,
  ROUND(AVG(total_price), 2) as avg_revenue
FROM guest_tokens
WHERE host_id = ? AND is_demo = 0
GROUP BY lead_bucket;
```

### Length of Stay Distribution
```sql
SELECT
  CASE
    WHEN julianday(check_out) - julianday(check_in) <= 2 THEN '1-2 nights'
    WHEN julianday(check_out) - julianday(check_in) <= 4 THEN '3-4 nights'
    WHEN julianday(check_out) - julianday(check_in) <= 7 THEN '5-7 nights'
    ELSE '7+ nights'
  END as los_bucket,
  COUNT(*) as bookings,
  ROUND(AVG(total_price), 2) as avg_revenue,
  ROUND(AVG(total_price / (julianday(check_out) - julianday(check_in))), 2) as avg_nightly
FROM guest_tokens
WHERE host_id = ? AND is_demo = 0
GROUP BY los_bucket;
```

### Property Performance Comparison
```sql
SELECT
  p.name as property_name,
  COUNT(gt.id) as total_bookings,
  SUM(julianday(gt.check_out) - julianday(gt.check_in)) as total_nights,
  ROUND(SUM(gt.total_price), 2) as total_revenue,
  ROUND(SUM(gt.total_price) / NULLIF(SUM(julianday(gt.check_out) - julianday(gt.check_in)), 0), 2) as adr,
  ROUND(AVG(gr.rating), 1) as avg_rating
FROM properties p
LEFT JOIN guest_tokens gt ON gt.property_id = p.id AND gt.is_demo = 0
LEFT JOIN guest_ratings gr ON gr.property_id = p.id
WHERE p.host_id = ?
GROUP BY p.id, p.name;
```

---

## 4. Analytics V2 Dashboard Sections

| Section | Primary Metric | Chart Type | Query |
|---|---|---|---|
| Revenue Overview | Monthly RevPAR | Line chart (RevPAR + ADR dual axis) | Monthly RevPAR query |
| Occupancy Trend | Occupancy % | Area chart with seasonal bands | Monthly RevPAR query |
| Booking Patterns | Lead Time | Stacked bar (lead buckets by month) | Lead Time query |
| Length of Stay | Avg LOS | Histogram | LOS Distribution query |
| Property Comparison | RevPAR by property | Horizontal bar chart | Property Performance query |
| Guest Satisfaction | Avg Rating | Stat cards + trend line | Rating query |
| Channel Mix | Revenue by source | Donut chart | Channel query |

---

## 5. Recharts Components

### RevPAR + ADR Dual Axis
```tsx
<ResponsiveContainer width="100%" height={300}>
  <ComposedChart data={monthlyData}>
    <CartesianGrid strokeDasharray="3 3" />
    <XAxis dataKey="month" />
    <YAxis yAxisId="left" tickFormatter={v => `$${v}`} />
    <YAxis yAxisId="right" orientation="right" tickFormatter={v => `${v}%`} />
    <Bar yAxisId="left" dataKey="revpar" fill="#4ECDC4" name="RevPAR" />
    <Line yAxisId="left" dataKey="adr" stroke="#FF6B6B" name="ADR" />
    <Line yAxisId="right" dataKey="occupancy_pct" stroke="#95E1D3" name="Occupancy" />
    <Tooltip />
    <Legend />
  </ComposedChart>
</ResponsiveContainer>
```

### Seasonal Occupancy with Benchmark Bands
```tsx
<ResponsiveContainer width="100%" height={250}>
  <AreaChart data={monthlyData}>
    <CartesianGrid strokeDasharray="3 3" />
    <XAxis dataKey="month" />
    <YAxis domain={[0, 100]} tickFormatter={v => `${v}%`} />
    <Area dataKey="benchmark_high" fill="#E8F5E9" stroke="none" />
    <Area dataKey="benchmark_low" fill="white" stroke="none" />
    <Line dataKey="occupancy_pct" stroke="#4ECDC4" strokeWidth={2} />
    <Tooltip />
  </AreaChart>
</ResponsiveContainer>
```

---

## 6. Seasonal Patterns — Palm Harbor

```
Jan: ████████████████░░░░ 80%  Peak start (snowbirds arrive)
Feb: █████████████████░░░ 85%  Peak (spring training nearby)
Mar: ██████████████████░░ 90%  Peak (spring break)
Apr: ████████████████░░░░ 80%  Peak tapering
May: ████████████░░░░░░░░ 60%  Shoulder
Jun: ██████████░░░░░░░░░░ 50%  Off-peak start
Jul: ████████░░░░░░░░░░░░ 40%  Off-peak (heat + storms)
Aug: ████████░░░░░░░░░░░░ 40%  Off-peak (hurricane season)
Sep: ███████░░░░░░░░░░░░░ 35%  Lowest (peak hurricane)
Oct: █████████░░░░░░░░░░░ 45%  Recovery begins
Nov: ███████████░░░░░░░░░ 55%  Shoulder (Thanksgiving bump)
Dec: █████████████░░░░░░░ 65%  Shoulder → Peak (holidays)
```

Key pricing strategy implications:
- Dynamic pricing essential: 2-3x rate swing between Sep and Mar
- Minimum stay requirements: 7-night min in peak, 2-night min off-peak
- Last-minute discounts effective Jun-Sep to fill gaps
- Early bird pricing (90+ day bookings) captures snowbird planners

---

## 7. Channel Mix Analysis

### Airbnb vs Booking.com vs Direct

| Metric | Airbnb | Booking.com | Direct |
|---|---|---|---|
| Typical Commission | 3% host + 14% guest | 15% host | 0% (payment processing only) |
| Effective Take Rate | ~14-17% | ~15% | ~3% |
| Guest Quality (avg rating) | Higher (review culture) | Mixed | Highest (repeat guests) |
| Booking Lead Time | Longer (30-60d) | Shorter (7-30d) | Variable |
| Cancellation Rate | Low (strict policies) | Higher (free cancellation common) | Lowest |
| ADR Comparison | Baseline | -5 to -10% | +5 to +10% |

### Channel Mix Query
```sql
SELECT
  gt.source as channel,
  COUNT(*) as bookings,
  SUM(gt.total_price) as gross_revenue,
  ROUND(AVG(gt.total_price / NULLIF(julianday(gt.check_out) - julianday(gt.check_in), 0)), 2) as adr,
  ROUND(AVG(julianday(gt.check_in) - julianday(gt.created_at)), 1) as avg_lead_days
FROM guest_tokens gt
WHERE gt.host_id = ? AND gt.is_demo = 0
GROUP BY gt.source;
```

Optimal channel mix target: 40% Airbnb, 25% Booking.com, 35% Direct
(maximize direct bookings to reduce commission spend)
