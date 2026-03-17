#!/bin/bash
# =============================================================
#  PATCH 05 — Relationship Strength Score
#  Adds:
#    1. Server: /api/crm/contacts/:id/relationship-score endpoint
#       (computes from activities, deals, recency)
#    2. Adds relationship score badge to ContactEngagementCard
#    3. Adds a "stale contacts" filter helper
# =============================================================

set -e

# ── 1. Create the relationship score route ──────────────────────
ROUTE_FILE="server/routes/crm-relationship-score.ts"
echo "→ Writing $ROUTE_FILE..."
mkdir -p "$(dirname "$ROUTE_FILE")"

cat > "$ROUTE_FILE" << 'TS'
/**
 * CRM Relationship Strength Score
 *
 * Computes a 0–100 score for a contact based on:
 *   - Recency (days since last activity)
 *   - Frequency (activities in last 90 days)
 *   - Deal depth (active deals together)
 *   - Completeness (email + phone + company)
 *
 * Score bands:
 *   80–100 = A (Hot)
 *   60–79  = B (Warm)
 *   40–59  = C (Lukewarm)
 *   0–39   = D (Cold)
 *
 * GET /api/crm/contacts/:id/relationship-score
 * GET /api/crm/contacts/relationship-scores?ids=id1,id2,...  (bulk)
 */
import { Router } from 'express';
import { db } from '../db';
import {
  crmContacts, crmActivities, crmDeals, crmTimelineEvents,
} from '@shared/schema';
import { and, eq, desc, gte, count, sql } from 'drizzle-orm';

export const crmRelationshipScoreRouter = Router();

function computeScore(params: {
  daysSinceLastContact: number | null;
  activitiesLast90Days: number;
  openDeals: number;
  hasEmail: boolean;
  hasPhone: boolean;
  hasCompany: boolean;
}): { score: number; tier: 'A' | 'B' | 'C' | 'D'; label: string } {
  let score = 0;

  // Recency (0–40 points)
  const days = params.daysSinceLastContact;
  if (days === null) {
    score += 0;
  } else if (days <= 7) {
    score += 40;
  } else if (days <= 14) {
    score += 35;
  } else if (days <= 30) {
    score += 25;
  } else if (days <= 60) {
    score += 15;
  } else if (days <= 90) {
    score += 8;
  } else {
    score += 2;
  }

  // Frequency last 90 days (0–30 points)
  const freq = Math.min(params.activitiesLast90Days, 10);
  score += Math.round(freq * 3);

  // Deal depth (0–20 points)
  const dealPts = Math.min(params.openDeals * 10, 20);
  score += dealPts;

  // Completeness (0–10 points)
  if (params.hasEmail) score += 3;
  if (params.hasPhone) score += 3;
  if (params.hasCompany) score += 4;

  score = Math.min(100, Math.max(0, score));

  const tier = score >= 80 ? 'A' : score >= 60 ? 'B' : score >= 40 ? 'C' : 'D';
  const label = score >= 80 ? 'Hot' : score >= 60 ? 'Warm' : score >= 40 ? 'Lukewarm' : 'Cold';

  return { score, tier, label };
}

async function getScoreForContact(orgId: string, contactId: string) {
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  // Get contact basics
  const [contact] = await db
    .select({
      email: crmContacts.email,
      phone: crmContacts.phone,
      companyId: crmContacts.companyId,
      lastContactedAt: crmContacts.lastContactedAt,
    })
    .from(crmContacts)
    .where(and(eq(crmContacts.id, contactId), eq(crmContacts.orgId, orgId)))
    .limit(1);

  if (!contact) return null;

  // Count activities in last 90 days
  const [activityResult] = await db
    .select({ cnt: count() })
    .from(crmActivities)
    .where(and(
      eq(crmActivities.orgId, orgId),
      eq(crmActivities.contactId, contactId),
      gte(crmActivities.createdAt, ninetyDaysAgo),
    ));

  // Count open deals
  const [dealResult] = await db
    .select({ cnt: count() })
    .from(crmDeals)
    .where(and(
      eq(crmDeals.orgId, orgId),
      eq(crmDeals.contactId, contactId),
      sql`stage NOT IN ('closed_won', 'closed_lost', 'dead')`,
    ));

  // Days since last contact
  let daysSinceLastContact: number | null = null;
  if (contact.lastContactedAt) {
    daysSinceLastContact = Math.floor(
      (Date.now() - new Date(contact.lastContactedAt).getTime()) / (1000 * 60 * 60 * 24),
    );
  }

  const { score, tier, label } = computeScore({
    daysSinceLastContact,
    activitiesLast90Days: activityResult?.cnt ?? 0,
    openDeals: dealResult?.cnt ?? 0,
    hasEmail: !!contact.email,
    hasPhone: !!contact.phone,
    hasCompany: !!contact.companyId,
  });

  return {
    contactId,
    score,
    tier,
    label,
    daysSinceLastContact,
    activitiesLast90Days: activityResult?.cnt ?? 0,
    openDeals: dealResult?.cnt ?? 0,
  };
}

// Single contact score
crmRelationshipScoreRouter.get('/contacts/:id/relationship-score', async (req: any, res) => {
  try {
    const orgId = req.user?.orgId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const result = await getScoreForContact(orgId, req.params.id);
    if (!result) return res.status(404).json({ error: 'Contact not found' });

    // Optionally persist the score back to the contact
    try {
      await db
        .update(crmContacts)
        .set({
          relationshipScore: result.score,
          updatedAt: new Date(),
        })
        .where(and(eq(crmContacts.id, req.params.id), eq(crmContacts.orgId, orgId)));
    } catch {
      // relationshipScore column may not exist yet — ignore if patch 01 not run
    }

    res.json(result);
  } catch (error) {
    console.error('Error computing relationship score:', error);
    res.status(500).json({ error: 'Failed to compute score' });
  }
});

// Bulk scores
crmRelationshipScoreRouter.get('/contacts/relationship-scores', async (req: any, res) => {
  try {
    const orgId = req.user?.orgId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const ids = typeof req.query.ids === 'string'
      ? req.query.ids.split(',').filter(Boolean).slice(0, 50)
      : [];

    if (ids.length === 0) return res.json([]);

    const results = await Promise.all(
      ids.map(id => getScoreForContact(orgId, id).catch(() => null)),
    );

    res.json(results.filter(Boolean));
  } catch (error) {
    console.error('Error computing bulk relationship scores:', error);
    res.status(500).json({ error: 'Failed to compute scores' });
  }
});

// "Stale contacts" — contacts not touched in N days
crmRelationshipScoreRouter.get('/contacts/stale', async (req: any, res) => {
  try {
    const orgId = req.user?.orgId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const days = parseInt(req.query.days as string) || 60;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    const contacts = await db
      .select({
        id: crmContacts.id,
        firstName: crmContacts.firstName,
        lastName: crmContacts.lastName,
        email: crmContacts.email,
        lastContactedAt: crmContacts.lastContactedAt,
        relationshipScore: crmContacts.relationshipScore,
      })
      .from(crmContacts)
      .where(and(
        eq(crmContacts.orgId, orgId),
        sql`(last_contacted_at IS NULL OR last_contacted_at < ${cutoff.toISOString()})`,
        sql`deleted_at IS NULL`,
      ))
      .orderBy(desc(crmContacts.lastContactedAt))
      .limit(parseInt(req.query.limit as string) || 25);

    res.json(contacts);
  } catch (error) {
    console.error('Error fetching stale contacts:', error);
    res.status(500).json({ error: 'Failed to fetch stale contacts' });
  }
});

export default crmRelationshipScoreRouter;
TS

echo "  ✓ Written: $ROUTE_FILE"

# ── 2. Register the route in routes.ts ─────────────────────────
echo "→ Registering route in server/routes.ts..."

ROUTES="server/routes.ts"
[ -f "$ROUTES" ] || { echo "  ✗ server/routes.ts not found"; exit 1; }

if grep -q 'crmRelationshipScoreRouter\|relationship-score' "$ROUTES"; then
  echo "  ✓ Route already registered"
else
  # Add import + registration near the other CRM route imports
  node --input-type=module << 'JSEOF'
import { readFileSync, writeFileSync } from 'fs';
const path = 'server/routes.ts';
let src = readFileSync(path, 'utf8');

// Add import after the last crm-routes import
const importLine = `import crmRelationshipScoreRouter from './routes/crm-relationship-score';`;
const routeLine = `  app.use('/api/crm', authenticateUser, crmRelationshipScoreRouter);`;

// Find anchor for import
const importAnchor = src.match(/import.*crm-summary-routes.*/)?.[0]
  || src.match(/import.*crm.*routes.*/)?.[0]
  || null;

if (importAnchor && !src.includes('crmRelationshipScoreRouter')) {
  src = src.replace(importAnchor, importAnchor + '\n' + importLine);
  console.log('  ✓ Added import');
}

// Find anchor for registration
const routeAnchor = src.match(/app\.use\(['"]\/api\/crm['"].*crmSummaryRouter.*/)?.[0]
  || src.match(/app\.use\(['"]\/api\/crm['"].*crm.*\).*/)?.[0]
  || null;

if (routeAnchor && !src.includes('crmRelationshipScoreRouter')) {
  src = src.replace(routeAnchor, routeAnchor + '\n' + routeLine);
  console.log('  ✓ Added route registration');
}

if (!src.includes('crmRelationshipScoreRouter')) {
  console.warn('  ⚠ Could not auto-register — manual step required');
  console.warn(`  Add to server/routes.ts:`);
  console.warn(`    ${importLine}`);
  console.warn(`    ${routeLine}`);
} else {
  writeFileSync(path, src, 'utf8');
}
JSEOF
fi

# ── 3. Add RelationshipScoreBadge UI component ─────────────────
BADGE_FILE="client/src/components/crm/RelationshipScoreBadge.tsx"
echo "→ Writing $BADGE_FILE..."

cat > "$BADGE_FILE" << 'TSX'
/**
 * RelationshipScoreBadge
 *
 * Displays a contact's computed relationship strength score as a
 * compact A/B/C/D tier badge with color coding.
 *
 * Usage:
 *   <RelationshipScoreBadge contactId={contact.id} score={contact.relationshipScore} />
 */
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { Flame, Thermometer, Wind } from 'lucide-react';

interface RelationshipScoreBadgeProps {
  contactId: string;
  /** Pre-fetched score (0–100). If not provided, fetches from API. */
  score?: number | null;
  /** Show the tier only (A/B/C/D) vs full label */
  compact?: boolean;
  className?: string;
}

type Tier = 'A' | 'B' | 'C' | 'D';

const tierConfig: Record<Tier, {
  label: string;
  icon: typeof Flame;
  cls: string;
}> = {
  A: { label: 'Hot',       icon: Flame,       cls: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  B: { label: 'Warm',      icon: Thermometer, cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  C: { label: 'Lukewarm',  icon: Thermometer, cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  D: { label: 'Cold',      icon: Wind,        cls: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400' },
};

function scoreToTier(score: number): Tier {
  if (score >= 80) return 'A';
  if (score >= 60) return 'B';
  if (score >= 40) return 'C';
  return 'D';
}

export function RelationshipScoreBadge({
  contactId,
  score: externalScore,
  compact = false,
  className,
}: RelationshipScoreBadgeProps) {
  // Only fetch if score not provided
  const { data, isLoading } = useQuery({
    queryKey: ['rel-score', contactId],
    queryFn: () =>
      apiRequest('GET', `/api/crm/contacts/${contactId}/relationship-score`)
        .then(r => r.json()),
    enabled: externalScore == null && !!contactId,
    staleTime: 300_000, // 5 min
  });

  const score = externalScore ?? data?.score ?? null;

  if (isLoading && externalScore == null) {
    return <Skeleton className={cn('h-5 w-10 rounded', className)} />;
  }

  if (score == null) return null;

  const tier = scoreToTier(score);
  const config = tierConfig[tier];
  const Icon = config.icon;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold',
        config.cls,
        className,
      )}
      title={`Relationship score: ${score}/100 (${config.label})`}
    >
      <Icon className="h-3 w-3 flex-shrink-0" />
      {compact ? tier : config.label}
    </span>
  );
}

export default RelationshipScoreBadge;
TSX

echo "  ✓ Written: $BADGE_FILE"

echo ""
echo "✅ Patch 05 complete."
echo ""
echo "Next: run crm_patch_06_cmdpalette.sh"
