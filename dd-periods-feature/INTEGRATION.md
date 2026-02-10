# DD Period Tracking Feature - Integration Guide

## 1. Run Migration
```bash
psql $DATABASE_URL -f migration-003-periods.sql
```

## 2. Copy Files
```bash
cp useDdPeriods.ts client/src/hooks/
cp DdPeriodTracker.tsx client/src/components/workspace/
```

## 3. Add Routes to dd-checklist-routes.ts
The routes in dd-period-routes.ts need to be added INSIDE the existing
dd-checklist-routes.ts file, before the final `export` statement.
Copy everything between the route comments.

## 4. Add Schema Additions to shared/schema.ts
Add ddChecklistItemPeriods table definition and the new columns
(hasPeriods, periodConfig) to ddChecklistItems.

## 5. Update DdChecklistPanel.tsx
In the item drawer, add a "Periods" tab:
```tsx
import DdPeriodTracker, { PeriodProgressBadge } from './DdPeriodTracker';

// In item row (after status badge):
{item.hasPeriods && <PeriodProgressBadge itemId={item.id} />}

// In item drawer tabs, add "Periods" tab:
<DdPeriodTracker itemId={selectedItem.id} />
```

## Progress Calculation Hierarchy
- **Overall %** = average of all section %s
- **Section %** = average of all item %s within it
- **Item %** = 
  - If has periods: (received periods / total periods) × 100
  - If no periods: approved/provided/waived = 100%, else 0%
