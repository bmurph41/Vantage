---
name: crm-data-modeling
description: >
  Use for any CRM design, pipeline architecture, entity modeling, activity logging,
  relationship mapping, deal scoring, or sales process questions. Triggers: pipeline
  stage design, CRM entity relationships, deal scoring models, lead qualification,
  activity tracking, relationship intelligence, contact/company/deal modeling, or
  any "how should we structure the CRM" question.
---

# CRM Building — Expert Reference

## Entity Model (MarinaMatch CRM)

```
Organization (tenant root)
    |
    +-- Contacts (people)
    |       +-- linked to Companies (many-to-many)
    |       +-- linked to Deals (many-to-many, with role)
    |
    +-- Companies (organizations)
    |       +-- linked to Contacts
    |       +-- linked to Deals
    |
    +-- Deals (opportunities)
    |       +-- belongs to Pipeline -> Stage
    |       +-- linked to Contacts, Companies
    |       +-- has Activities, Tasks, Documents
    |       +-- optionally linked to ModelingProject (Deal Room)
    |
    +-- Tasks (to-dos)
            +-- linked to any entity type
```

## Pipeline Stage Design Principles

### CRE Acquisition Pipeline (recommended stages)
```
Lead -> Qualifying -> LOI Submitted -> Due Diligence -> Under Contract -> Closed Won
                                                                       -> Closed Lost
```

| Stage | Exit Criteria | Avg Duration |
|---|---|---|
| Lead | Identified, not yet contacted | 1-14 days |
| Qualifying | Initial call done, meets buy-box | 7-30 days |
| LOI Submitted | LOI sent, awaiting response | 3-14 days |
| Due Diligence | LOI accepted, DD underway | 30-90 days |
| Under Contract | PSA executed, closing prep | 30-60 days |
| Closed Won | Deal closed | -- |

### Stage Gate Rules
- Each stage should have clear, binary exit criteria
- No deal should skip stages (log if it does — data integrity signal)
- Stale detection: flag deals with no activity after N days per stage

## Activity Logging Schema

```sql
-- Every significant event logged here
crm_activities (
  id, org_id,
  entity_type,    -- 'deal' | 'contact' | 'company' | 'task'
  entity_id,
  activity_type,  -- see types below
  description,
  created_by,
  metadata        -- JSONB: call duration, email subject, etc.
)

-- Activity types
'note' | 'call' | 'email' | 'meeting' | 'site_visit'
| 'task_completed' | 'stage_change' | 'deal_created'
| 'document_added' | 'field_updated' | 'loi_submitted'
| 'dd_started' | 'offer_received'
```

## Deal Scoring Model

### Weighted Criteria Scoring (0-100)
```typescript
interface ScoringCriteria {
  capRate: { weight: 0.20, min: 0.05, target: 0.065, max: 0.10 }
  dscr: { weight: 0.20, min: 1.10, target: 1.30, max: 2.00 }
  location: { weight: 0.15 }    // subjective 0-10 scale
  occupancy: { weight: 0.15, min: 0.60, target: 0.85, max: 1.00 }
  pricePerSlip: { weight: 0.15 } // vs market comps
  waterDepth: { weight: 0.10 }   // marina-specific
  infrastructureAge: { weight: 0.05 }
}

// Score = sum(criterionScore * weight) * 100
// A+ = 90-100, A = 75-89, B+ = 60-74, B = 45-59, C = 0-44
```

## Relationship Intelligence Patterns

### Preferred Network Scoring
```typescript
// Weighted score for each relationship
const score = (
  (dealHistory * 0.35) +      // # of deals transacted together
  (reliability * 0.30) +       // % of commitments kept
  (responsiveness * 0.20) +    // avg response time to outreach
  (networkReach * 0.15)        // # of relevant introductions made
) / 4 * 100
```

### Contact Freshness (staleness detection)
```sql
SELECT
  c.name, c.email,
  MAX(a.created_at) as last_touch,
  EXTRACT(EPOCH FROM (NOW() - MAX(a.created_at)))/86400 as days_since_touch
FROM crm_contacts c
LEFT JOIN crm_activities a ON a.entity_id = c.id AND a.entity_type = 'contact'
WHERE c.org_id = $1
GROUP BY c.id
HAVING days_since_touch > 90 OR MAX(a.created_at) IS NULL
ORDER BY days_since_touch DESC NULLS FIRST;
```

## CRM UI Principles

### Record Page Layout (3-column rule)
```
Left (~280px)  | Center (flex-1)      | Right (~320px)
Key details    | Tabbed content       | Related entities
Quick actions  | (Overview, Activity, | Recent activity
Linked objects | Documents, etc.)     | Upcoming tasks
```

### KPI Chips (top of every record)
Show 3-5 numbers at a glance. For a Deal:
- Deal Value, Stage, Days in Stage, Close Probability, Expected Close Date

### Activity Feed Design
- Reverse chronological (newest first)
- Group by date (Today, Yesterday, This Week, Earlier)
- Icon per activity type
- Inline edit for notes
- Filter by type
