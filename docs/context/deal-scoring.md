# Deal Scoring System — End-to-End

## 1. Scoring Criteria and Weights

The scoring system maps to the Investment Criteria buy-box. Each criterion
is scored 0-100 individually, then weighted to produce a composite score.

### Default Criteria (CRE Acquisition)

| Criterion | Weight | Scoring Logic |
|---|---|---|
| Cap Rate | 20% | Linear interpolation: target=6.5% scores 100, ±200bps from target scores 0 |
| DSCR | 20% | Linear: <1.0 scores 0, 1.25 scores 70, 1.40+ scores 100 |
| Location Quality | 15% | Subjective 0-10 scale (user-input), mapped to 0-100 |
| Occupancy | 15% | Linear: <60% scores 0, 85% scores 80, 95%+ scores 100 |
| Price/Unit | 15% | vs. market comps: at median=80, <75th pctile=100, >125th=0 |
| Asset Condition | 10% | Age-based: <10yr=90, 10-20yr=70, 20-30yr=50, 30+yr=30. Adjusted by recent CapEx |
| Market Fundamentals | 5% | Population growth + employment growth composite |

### Marina-Specific Overrides
When assetClass includes 'marina':
- Replace "Price/Unit" with "Price/Slip"
- Add "Water Depth" criterion (weight: redistributed from Asset Condition)
- Add "Protected Harbor" boolean bonus (+5 points to composite)

## 2. TypeScript Scoring Function

```typescript
// server/services/deal-scoring-service.ts

interface ScoringInput {
  capRate: number;           // decimal (0.065 = 6.5%)
  dscr: number;              // ratio (1.25)
  locationScore: number;     // 0-10 user input
  occupancyRate: number;     // decimal (0.85 = 85%)
  pricePerUnit: number;      // $/unit or $/slip
  marketMedianPPU: number;   // market comp median
  assetAge: number;          // years
  recentCapEx: boolean;      // significant CapEx in last 3 years
  populationGrowth: number;  // decimal (0.02 = 2%)
  employmentGrowth: number;  // decimal
  assetClass: string;
}

interface ScoringOutput {
  compositeScore: number;     // 0-100
  grade: 'A+' | 'A' | 'B+' | 'B' | 'C';
  criterionScores: Record<string, { raw: number; weighted: number }>;
  flags: string[];            // warnings/notes
}

export function scoreDeal(input: ScoringInput): ScoringOutput {
  const scores: Record<string, number> = {};
  const flags: string[] = [];

  // Cap Rate: target 6.5%, ±200bps band
  const capTarget = 0.065;
  const capDeviation = Math.abs(input.capRate - capTarget);
  scores.capRate = Math.max(0, 100 - (capDeviation / 0.02) * 100);
  if (input.capRate < 0.04) flags.push('Cap rate below 4% — verify pricing');
  if (input.capRate > 0.10) flags.push('Cap rate above 10% — elevated risk');

  // DSCR
  if (input.dscr < 1.0) scores.dscr = 0;
  else if (input.dscr >= 1.40) scores.dscr = 100;
  else scores.dscr = ((input.dscr - 1.0) / 0.40) * 100;

  // Location
  scores.location = (input.locationScore / 10) * 100;

  // Occupancy
  if (input.occupancyRate < 0.60) scores.occupancy = 0;
  else if (input.occupancyRate >= 0.95) scores.occupancy = 100;
  else scores.occupancy = ((input.occupancyRate - 0.60) / 0.35) * 100;

  // Price/Unit vs market
  const ppuRatio = input.pricePerUnit / input.marketMedianPPU;
  if (ppuRatio <= 0.75) scores.pricePerUnit = 100;
  else if (ppuRatio >= 1.25) scores.pricePerUnit = 0;
  else scores.pricePerUnit = (1.25 - ppuRatio) / 0.50 * 100;

  // Asset Condition
  let conditionBase: number;
  if (input.assetAge < 10) conditionBase = 90;
  else if (input.assetAge < 20) conditionBase = 70;
  else if (input.assetAge < 30) conditionBase = 50;
  else conditionBase = 30;
  scores.assetCondition = input.recentCapEx ? Math.min(100, conditionBase + 15) : conditionBase;

  // Market Fundamentals
  const marketScore = ((input.populationGrowth + input.employmentGrowth) / 2) / 0.03 * 100;
  scores.marketFundamentals = Math.min(100, Math.max(0, marketScore));

  // Weights
  const weights: Record<string, number> = {
    capRate: 0.20, dscr: 0.20, location: 0.15,
    occupancy: 0.15, pricePerUnit: 0.15,
    assetCondition: 0.10, marketFundamentals: 0.05,
  };

  // Composite
  let composite = 0;
  const criterionScores: Record<string, { raw: number; weighted: number }> = {};
  for (const [key, weight] of Object.entries(weights)) {
    const raw = scores[key] ?? 0;
    const weighted = raw * weight;
    criterionScores[key] = { raw: Math.round(raw), weighted: Math.round(weighted * 10) / 10 };
    composite += weighted;
  }

  composite = Math.round(composite);

  // Grade
  let grade: ScoringOutput['grade'];
  if (composite >= 90) grade = 'A+';
  else if (composite >= 75) grade = 'A';
  else if (composite >= 60) grade = 'B+';
  else if (composite >= 45) grade = 'B';
  else grade = 'C';

  return { compositeScore: composite, grade, criterionScores, flags };
}
```

## 3. DB Schema

```sql
-- Investment criteria (buy-box config per org)
CREATE TABLE IF NOT EXISTS investment_criteria (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id),
  name VARCHAR(255) NOT NULL DEFAULT 'Default',
  criteria JSONB NOT NULL,  -- { capRate: { weight, target, min, max }, ... }
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Computed scores per deal
CREATE TABLE IF NOT EXISTS deal_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  deal_id UUID NOT NULL REFERENCES crm_deals(id) ON DELETE CASCADE,
  criteria_id UUID REFERENCES investment_criteria(id),
  composite_score INTEGER NOT NULL,   -- 0-100
  grade VARCHAR(2) NOT NULL,          -- A+, A, B+, B, C
  criterion_scores JSONB NOT NULL,    -- { capRate: { raw, weighted }, ... }
  flags TEXT[],
  scored_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(deal_id, criteria_id)
);

CREATE INDEX idx_deal_scores_org ON deal_scores(org_id);
CREATE INDEX idx_deal_scores_deal ON deal_scores(deal_id);
CREATE INDEX idx_deal_scores_grade ON deal_scores(org_id, grade);
```

## 4. API Route

```typescript
// Route: POST /api/deals/:dealId/score
// Computes score on demand, stores result, returns it
// Uses pool.query() (deal_scores may have RLS)

// Route: GET /api/deals/:dealId/score
// Returns latest score or 404

// Route: GET /api/analytics/deal-scores
// Returns all scored deals for org — used in map + list views
// Query params: ?grade=A+,A&minScore=75&assetClass=marina
```

## 5. UI Components

### Score Badge
```tsx
// Compact badge shown on Kanban cards, list views, map pins
function DealScoreBadge({ score, grade }: { score: number; grade: string }) {
  const color = grade.startsWith('A') ? 'green' : grade.startsWith('B') ? 'yellow' : 'red';
  return (
    <Badge variant={color} title={`Score: ${score}/100`}>
      {grade}
    </Badge>
  );
}
```

### Criterion Breakdown Cards
```tsx
// Full breakdown on deal record page — shows each criterion
function ScoreBreakdown({ criterionScores, flags }: ScoringOutput) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {Object.entries(criterionScores).map(([key, { raw, weighted }]) => (
        <Card key={key}>
          <CardHeader className="pb-1">
            <span className="text-sm text-muted-foreground">{formatLabel(key)}</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-mono">{raw}</div>
            <Progress value={raw} className="mt-1" />
            <span className="text-xs">Weighted: {weighted.toFixed(1)}</span>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
```

### Radar Chart
```tsx
// Spider/radar chart showing all criteria at once
import { RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer } from 'recharts';

function ScoreRadar({ criterionScores }: { criterionScores: ScoringOutput['criterionScores'] }) {
  const data = Object.entries(criterionScores).map(([key, { raw }]) => ({
    criterion: formatLabel(key),
    score: raw,
    fullMark: 100,
  }));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <RadarChart data={data}>
        <PolarGrid />
        <PolarAngleAxis dataKey="criterion" tick={{ fontSize: 11 }} />
        <Radar dataKey="score" stroke="#4ECDC4" fill="#4ECDC4" fillOpacity={0.3} />
      </RadarChart>
    </ResponsiveContainer>
  );
}
```

## 6. Grade Mapping on Marina Map

Scores map to pin colors on the Property Intelligence Map:

| Grade | Color | Hex | Map Pin Style |
|---|---|---|---|
| A+ | Emerald | #10B981 | Large pin, pulsing |
| A | Green | #22C55E | Large pin |
| B+ | Yellow | #EAB308 | Medium pin |
| B | Orange | #F97316 | Medium pin |
| C | Red | #EF4444 | Small pin |

Filter controls on the map allow filtering by grade range.

## 7. Kanban & List View Integration

### Kanban Cards
- Show `DealScoreBadge` in top-right corner of card
- Sort option: "By Score (highest first)"
- Color-coded left border matches grade color

### List/Table View
- Score column with sortable header
- Grade filter in column header dropdown
- Inline sparkline showing score trend if re-scored over time
