# DCF Refactor — Integration Guide

**Date:** March 6, 2026
**Scope:** Layers 1–4 (Foundation → Validation → Simulation → Decision Support)

---

## File Manifest

### Shared Finance Utilities (new — create these directories)
| File | Layer | Purpose |
|------|-------|---------|
| `shared/finance/xirr.ts` | 2 | Canonical XIRR, NPV, equity multiple |
| `shared/finance/distributions.ts` | 3 | Stats, sampling, seeded PRNG |
| `shared/finance/tornado.ts` | 4 | One-at-a-time driver sensitivity |
| `shared/finance/attribution.ts` | 4 | OLS regression on MC samples |
| `shared/finance/memo-generator.ts` | 4 | Deterministic IC memo (3 tones) |

### Backend Services (replace/add)
| File | Layer | Purpose |
|------|-------|---------|
| `server/services/dcf-calculator-service.ts` | 1 | **REPLACE** existing — now consumes Multi-Year Projection |
| `server/services/finance/cashflow-parity.ts` | 2 | Cash flow canonicalizer for parity testing |
| `server/services/dcf-scenario-layer.ts` | 3 | Base/upside/downside + weighted expected case |
| `server/services/dcf-simulation-service.ts` | 3 | Monte Carlo (fast + exact modes) |
| `server/services/dcf-decision-support-service.ts` | 4 | Orchestrates tornado + attribution + memo |
| `server/routes/dcf-routes.ts` | 1-4 | All DCF endpoints (register in routes.ts) |

### Tests
| File | Layer |
|------|-------|
| `server/__tests__/irr-parity.test.ts` | 2 |
| `server/__tests__/monte-carlo.test.ts` | 3 |
| `server/__tests__/decision-support.test.ts` | 4 |

### Frontend
| File | Layer |
|------|-------|
| `client/src/components/workspace/DCFMonteCarloPanel.tsx` | 3-4 |

---

## Integration Steps

### Step 1: Copy shared utilities

```bash
mkdir -p shared/finance
cp shared/finance/xirr.ts <your-project>/shared/finance/
cp shared/finance/distributions.ts <your-project>/shared/finance/
cp shared/finance/tornado.ts <your-project>/shared/finance/
cp shared/finance/attribution.ts <your-project>/shared/finance/
cp shared/finance/memo-generator.ts <your-project>/shared/finance/
```

### Step 2: Copy backend services

```bash
mkdir -p server/services/finance
cp server/services/finance/cashflow-parity.ts <your-project>/server/services/finance/
cp server/services/dcf-calculator-service.ts <your-project>/server/services/  # REPLACES existing
cp server/services/dcf-scenario-layer.ts <your-project>/server/services/
cp server/services/dcf-simulation-service.ts <your-project>/server/services/
cp server/services/dcf-decision-support-service.ts <your-project>/server/services/
cp server/routes/dcf-routes.ts <your-project>/server/routes/
```

### Step 3: Wire routes into routes.ts

In your existing `server/routes.ts`, add:

```typescript
import { registerDCFRoutes } from './routes/dcf-routes';
import { computeDirectInputFinancials } from './services/direct-input-engine';
import { computeMultiYearProjection } from './services/multi-year-projection-engine';
// import { generateDebtSchedule } from '../shared/debt/debt-engine';  // if available

// Inside your route registration function:
registerDCFRoutes(app, {
  pool,
  authenticateUser,
  computeDirectInputFinancials,
  computeMultiYearProjection,
  generateDebtSchedule: undefined, // wire in when debt engine is available
});
```

### Step 4: Reconcile existing XIRR

Your existing `calculateXIRR` in `server/utils/financial-calculations.ts` should be replaced with a re-export:

```typescript
// server/utils/financial-calculations.ts
// Replace the existing calculateXIRR implementation with:
export { calculateXIRR, calculateNPV, calculateEquityMultiple, type DatedCashFlow } from '../../shared/finance/xirr';
```

This ensures ALL consumers (DCF, Pro Forma, Quick IRR, Monte Carlo) use the same function.

### Step 5: Frontend integration

In your existing `dcf-calculator.tsx`, add:

```tsx
import { DCFMonteCarloPanel, DecisionSupportAccordion } from '../../components/workspace/DCFMonteCarloPanel';

// Inside your JSX, after the existing DCF content:
<DCFMonteCarloPanel projectId={projectId} />
<DecisionSupportAccordion projectId={projectId} />
```

### Step 6: Copy and run tests

```bash
cp server/__tests__/irr-parity.test.ts <your-project>/server/__tests__/
cp server/__tests__/monte-carlo.test.ts <your-project>/server/__tests__/
cp server/__tests__/decision-support.test.ts <your-project>/server/__tests__/

# Run
npx vitest run server/__tests__/irr-parity.test.ts
npx vitest run server/__tests__/monte-carlo.test.ts
npx vitest run server/__tests__/decision-support.test.ts
```

---

## Import Path Adjustments

The files use relative imports based on the standard layout:

```
project-root/
├── shared/
│   └── finance/
│       ├── xirr.ts
│       ├── distributions.ts
│       ├── tornado.ts
│       ├── attribution.ts
│       └── memo-generator.ts
├── server/
│   ├── services/
│   │   ├── finance/
│   │   │   └── cashflow-parity.ts
│   │   ├── dcf-calculator-service.ts
│   │   ├── dcf-scenario-layer.ts
│   │   ├── dcf-simulation-service.ts
│   │   └── dcf-decision-support-service.ts
│   ├── routes/
│   │   └── dcf-routes.ts
│   └── __tests__/
│       ├── irr-parity.test.ts
│       ├── monte-carlo.test.ts
│       └── decision-support.test.ts
└── client/
    └── src/
        └── components/
            └── workspace/
                └── DCFMonteCarloPanel.tsx
```

If your project uses different paths, adjust the `import` statements accordingly.

---

## Known Adjustments Needed

1. **Debt engine**: If `shared/debt/debt-engine.ts` exports `generateDebtSchedule()`, wire it into `registerDCFRoutes`. Currently defaults to no-debt if not provided.

2. **Feature gating (Layer 4)**: The `checkEntitlement()` function in `dcf-decision-support-service.ts` queries `organizations.subscription_tier`. If this column doesn't exist, it falls back to `entitled = true` (MVP mode). Tighten once you have a tier system.

3. **DB column names**: All SQL uses snake_case. If any column names differ in your schema, update the raw SQL queries in the loaders.

4. **memo-generator.ts imports**: The `import type` from `dcf-scenario-layer` may need path adjustment depending on your tsconfig.

---

## Endpoint Summary

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/modeling/projects/:projectId/dcf` | Full DCF analysis |
| POST | `/api/dcf/quick-irr` | Quick IRR (body: `{ projectId }`) |
| POST | `/api/modeling/projects/:projectId/dcf/monte-carlo` | Monte Carlo sim |
| GET | `/api/modeling/projects/:projectId/dcf/decision-support` | Fast decision support |
| POST | `/api/modeling/projects/:projectId/dcf/decision-support` | Full decision support + MC |

All under `/api/modeling/projects/` are CSRF-exempt per existing middleware config.

---

## Testing Smoke Test

After integration, verify with:

```bash
# 1. Existing tests still pass
npx vitest run server/services/__tests__/direct-input-e2e.test.ts 2>&1 | tail -3

# 2. New parity tests pass
npx vitest run server/__tests__/irr-parity.test.ts

# 3. Monte Carlo tests pass
npx vitest run server/__tests__/monte-carlo.test.ts

# 4. Decision support tests pass
npx vitest run server/__tests__/decision-support.test.ts

# 5. Full DCF endpoint (against test project)
curl -s -X POST "http://localhost:5000/api/modeling/projects/6b3a9021-f393-489d-9274-321ac76eae08/dcf" \
  -H "Content-Type: application/json" \
  -H "Cookie: csrf_token=test123" \
  -H "x-csrf-token: test123" \
  -d '{"discountRate": 10}' | node -e "const d=require('fs').readFileSync('/dev/stdin','utf8'); const j=JSON.parse(d); console.log('IRR:', j.irr, '| EM:', j.equityMultiple)"

# 6. Monte Carlo endpoint
curl -s -X POST "http://localhost:5000/api/modeling/projects/6b3a9021-f393-489d-9274-321ac76eae08/dcf/monte-carlo" \
  -H "Content-Type: application/json" \
  -H "Cookie: csrf_token=test123" \
  -H "x-csrf-token: test123" \
  -d '{"n": 500, "seed": 42}' | node -e "const d=require('fs').readFileSync('/dev/stdin','utf8'); const j=JSON.parse(d); console.log('MC P50 IRR:', j.stats?.irr?.p50, '| Time:', j.computeTimeMs, 'ms')"
```
