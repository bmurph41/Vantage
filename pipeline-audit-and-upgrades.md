# MarinaMatch Financial Pipeline — Comprehensive Audit & Upgrade Plan

## Pipeline Overview

```
PDF/Excel Upload → Parse/OCR → AI Categorize → User Review → Import to Actuals
    → Historical P&L → Pro Forma Engine → Pricing → Debt/Capital Stack → Returns
```

---

## 1. DOCUMENT PARSING (pdfTableExtractor.ts, doc-intel-service.ts)

### Current State
- **PDF**: Geometry-based extraction via pdfjs-dist (206 lines) — good upgrade from whitespace parsing
- **Excel**: XLSX.js parsing with multi-sheet, multi-year support (553→992 in doc-intel-service)
- **OCR fallback**: `extractDocument()` for scanned PDFs

### Issues Found
| # | Issue | Severity | Impact |
|---|-------|----------|--------|
| 1 | **No PDF column header validation** — geometry extractor groups tokens into rows/cells but doesn't verify that detected columns match expected P&L structure (Date, Description, Amount). Misaligned columns silently produce wrong amounts. | HIGH | Wrong actuals flowing into model |
| 2 | **Excel parser assumes layout** — expects specific column positions; doesn't handle P&L formats where amounts are in different columns per year | MEDIUM | Some Excel P&Ls fail to parse |
| 3 | **No multi-currency detection** — amounts parsed as-is with no currency normalization | LOW | Edge case for international marinas |

### Recommended Upgrades
- **Column confidence scoring**: After extracting columns, score how well they match expected P&L structure (header names, numeric patterns). Reject/flag low-confidence extractions.
- **Smart column detection**: Use AI to identify which columns contain amounts vs descriptions vs dates, rather than relying on positional assumptions.

---

## 2. AI CATEGORIZATION (doc-intel-service.ts → aiCategorizeItems)

### Current State
- **Model**: `gpt-4o-mini` with `temperature: 0.1`
- **Three-pass system**: (1) Built-in exclusion patterns, (2) Learned rules + alias bank, (3) AI fallback for uncategorized
- **Learning**: High-confidence AI results (≥0.85) auto-promoted to alias bank via `learnAlias()`
- **Exclusion**: Regex patterns for totals/subtotals/NOI/EBITDA lines

### Issues Found
| # | Issue | Severity | Impact |
|---|-------|----------|--------|
| 4 | **AI prompt sends ALL items in single batch** — no chunking. Large P&Ls (200+ line items) may exceed token limits or degrade quality. | HIGH | Silent truncation, missing categorizations |
| 5 | **No amount context in AI prompt** — AI sees raw text + amount but doesn't know the document total. A $500K "Fuel Revenue" vs $500 "Fuel Expense" distinction is lost. | MEDIUM | Revenue/expense misclassification |
| 6 | **Section context not passed to AI** — if the PDF has clear "Revenue" / "Expenses" sections, that context isn't forwarded to the AI categorizer. | HIGH | Revenue items miscategorized as expenses |
| 7 | **Exclusion pattern `\btotal\b` is too aggressive** — excludes legitimate items like "Total Boat Club Memberships" which is a revenue line, not a summary | MEDIUM | Revenue data lost |
| 8 | **AI learns from its own outputs** — when confidence ≥ 0.85, result is auto-promoted to alias bank. If AI is wrong, the error propagates permanently. | MEDIUM | Compounding errors over time |
| 9 | **No batch deduplication** — same item text across multiple uploads gets re-categorized by AI each time instead of hitting the alias bank | LOW | Wasted API calls |

### Recommended Upgrades
- **Chunked AI batching**: Split items into batches of 50, with section context per batch
- **Section-aware AI prompt**: Pass the P&L section header (Revenue/COGS/Expenses) from the PDF structure to the AI prompt
- **Smarter exclusion**: Replace `\btotal\b` with `^total\s` (line starts with "total") + check if it's a summary row (has matching detail rows)
- **Confidence decay for AI-learned aliases**: Auto-learned aliases start at 0.85 confidence, decay by 0.05 each time they're overridden by a user
- **Amount-range context**: Include section totals so AI understands magnitude

---

## 3. ALIAS MATCHING (pnl-alias-matcher.ts)

### Current State
- **Exact match**: Normalized label → COA code lookup (confidence from DB)
- **Fuzzy match**: Word overlap scoring, scaled by 0.8, threshold > 0.4
- **Section fallback**: Falls back to `_MISCELLANEOUS` codes at 0.3 confidence

### Issues Found
| # | Issue | Severity | Impact |
|---|-------|----------|--------|
| 10 | **Fuzzy matching is naive** — simple word overlap, no Levenshtein/Jaro-Winkler distance. "Fuel Sales Revenue" won't match "Revenue from Fuel Sales" well. | HIGH | Many items fall through to expensive AI call |
| 11 | **No synonym awareness** — "Wages" vs "Salaries" vs "Compensation" vs "Labor" are treated as completely different words | HIGH | Common P&L terms miss alias matches |
| 12 | **0.4 threshold too low** — allows poor matches that confuse users during review | MEDIUM | User trust erosion |

### Recommended Upgrades
- **Token-set ratio matching**: Use token set intersection (ignoring word order) — "Fuel Sales Revenue" ↔ "Revenue from Fuel Sales" = 100%
- **Synonym dictionary**: Map common P&L synonyms (wages↔salaries↔compensation, repairs↔maintenance, etc.)
- **Raise fuzzy threshold to 0.55**: Reduces false positives, routes genuinely ambiguous items to AI

---

## 4. PROMOTE TO ACTUALS (promote-to-actuals.ts)

### Current State
- Maps pnlFacts → modelingActuals using COA lookup + user-confirmed overrides
- Respects resolvedDepartment and resolvedBucket from user review
- Fallback chain: user-confirmed → COA seed → canonical → heuristic

### Issues Found
| # | Issue | Severity | Impact |
|---|-------|----------|--------|
| 13 | **No deduplication guard** — re-running promote without clearing old actuals creates duplicates | HIGH | Doubled revenue/expenses in model |
| 14 | **Period key mismatch possible** — pnlFacts store period as various formats; modelingActuals expect specific year/period format | MEDIUM | Data assigned to wrong year |

### Recommended Upgrades
- **Upsert logic**: Use `ON CONFLICT (projectId, year, category, subcategory, department)` to update instead of insert
- **Period normalization gate**: Validate and normalize period keys before promote

---

## 5. PRO FORMA ENGINE (pro-forma-engine-service.ts) — 1544 lines

### Current State ✅ (Recently Fixed)
- Monthly-first projections with annual rollups
- XIRR-based IRR (levered + unlevered)
- Above/below line position support
- Debt integration with DSCR
- Exit waterfall with selling fees, loan payoff, working capital

### Remaining Issues
| # | Issue | Severity | Impact |
|---|-------|----------|--------|
| 15 | **Seasonality applied uniformly** — seasonal profiles adjust monthly weights but don't account for items that are genuinely non-seasonal (insurance, property tax) | MEDIUM | Expenses artificially seasonal |
| 16 | **No vacancy/collection loss modeling** — revenue is gross with no explicit vacancy factor | MEDIUM | Revenue overstated |
| 17 | **Exit cap rate is a single input** — no spread-over-going-in or reversion logic | LOW | Standard for basic models |

### Recommended Upgrades
- **Per-line-item seasonality override**: Flag items as "seasonal" or "flat" in assumptions
- **Vacancy & collection loss**: Add as a configurable deduction from gross revenue (standard in CRE underwriting)

---

## 6. CAPITAL STACK SERVICE (capital-stack-service.ts) — 903 lines

### Current State
- Multi-tranche debt support with equity layers
- Waterfall distribution (LP/GP)
- IRR via Newton-Raphson

### Issues Found
| # | Issue | Severity | Impact |
|---|-------|----------|--------|
| 18 | **NOI growth is simple compound** — `NOI * (1 + rate)^year` ignores the detailed line-item projections from Pro Forma | HIGH | Capital stack projections diverge from Pro Forma |
| 19 | **Gross Revenue = NOI / 0.6 hardcoded** — assumes 60% NOI margin for all properties | HIGH | Completely wrong for most marinas |
| 20 | **CapEx = 3% of NOI hardcoded** — ignores actual capex assumptions | MEDIUM | Inconsistent with Pro Forma |
| 21 | **IRR calculated separately from Pro Forma** — uses its own cash flow construction, not the Pro Forma's | HIGH | Two different IRRs shown to user |

### Recommended Upgrades
- **Feed Pro Forma NOI into Capital Stack**: Instead of independent NOI projection, consume the Pro Forma's annual NOI array
- **Remove hardcoded ratios**: Use actual revenue/expense/capex from Pro Forma
- **Single source of truth for IRR**: Capital Stack should reference Pro Forma IRR, not calculate independently

---

## 7. DEAL PRICING SERVICE (deal-pricing-service.ts) — 800 lines

### Current State
- Solve for price from cap rate, year cap rate, or target IRR
- Bisection method for IRR solving
- NPV calculation

### Issues Found
| # | Issue | Severity | Impact |
|---|-------|----------|--------|
| 22 | **Independent NOI projection** — `projectNOI()` builds its own NOI series using simple growth rates, duplicating Pro Forma logic | HIGH | Price based on different NOI than Pro Forma shows |
| 23 | **No debt integration in pricing** — solves for unlevered price; doesn't account for financing terms | MEDIUM | Levered returns not reflected in pricing |

### Recommended Upgrades
- **Consume Pro Forma cash flows**: Solve for price using the actual Pro Forma projections
- **Levered price solving**: Option to solve for price given target levered IRR with actual debt terms

---

## 8. DEBT SCHEDULE SERVICE (debt-schedule-service.ts) — 417 lines

### Current State ✅ Solid
- Monthly amortization per tranche
- Forward curve integration (FRED)
- DSCR calculation against NOI

### Minor Issues
| # | Issue | Severity | Impact |
|---|-------|----------|--------|
| 24 | **No prepayment penalty modeling** | LOW | Refinance scenarios miss fees |
| 25 | **IO period transition** — interest-only → amortizing transition is month-boundary only | LOW | Edge case |

---

## PRIORITY RANKING

### 🔴 Critical (Do Now — Wrong Numbers Shown to User)
1. **#18-21: Capital Stack uses independent NOI/revenue, not Pro Forma** — biggest source of "numbers don't match"
2. **#22: Deal Pricing independent NOI** — price recommendation based on different data
3. **#4: AI batch not chunked** — large P&Ls get truncated
4. **#6: Section context missing from AI** — revenue items classified as expenses
5. **#13: Promote deduplication** — re-imports create double actuals

### 🟡 High (Next Sprint — Accuracy Improvement)
6. **#7: Overly aggressive `\btotal\b` exclusion** — losing real revenue data
7. **#10-11: Naive fuzzy matching** — too many items falling to AI
8. **#1: PDF column validation** — silent wrong amounts
9. **#5: Amount context in AI prompt** — better classification

### 🟢 Medium (Backlog — Polish)
10. **#8: AI learning decay** — prevent error propagation
11. **#15-16: Seasonality + vacancy** — underwriting refinement
12. **#12: Fuzzy threshold** — user experience
13. **#14: Period normalization** — edge case prevention

---

## RECOMMENDED IMPLEMENTATION ORDER

**Phase 1: Single Source of Truth (Capital Stack + Pricing → Pro Forma)**
- Capital Stack `generateProjections()` consumes Pro Forma NOI array
- Deal Pricing `solveForPrice()` uses Pro Forma cash flows
- Eliminates the #1 user confusion: "why do these pages show different numbers?"

**Phase 2: AI Pipeline Hardening**
- Chunk AI batches to 50 items max
- Pass section context (Revenue/COGS/Expense) to AI prompt
- Fix `\btotal\b` exclusion to be position-aware
- Add promote deduplication (upsert)

**Phase 3: Matching Quality**
- Token-set ratio fuzzy matching
- P&L synonym dictionary
- Confidence decay for AI-learned aliases

**Phase 4: Underwriting Features**
- Per-item seasonality override
- Vacancy & collection loss
- Prepayment penalty modeling
