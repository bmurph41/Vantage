import { db } from '../../db';
import { eq, and, desc, inArray } from 'drizzle-orm';
import {
  pricingRules,
  pricingRecommendations,
} from '../../../shared/schema';
import { computeCompressionAnalytics, getSummary, fetchBandBreakdown } from './utilization-service';
import { getWaitlistMetrics } from './waitlist-service';

interface RuleCondition {
  metric: string;
  operator: 'gt' | 'gte' | 'lt' | 'lte' | 'eq';
  value: number;
  windowDays?: number;
}

interface DriverResult {
  metric: string;
  currentValue: number;
  threshold: number;
  operator: string;
  windowDays?: number;
  satisfied: boolean;
}

function compareValue(actual: number, operator: string, threshold: number): boolean {
  switch (operator) {
    case 'gt': return actual > threshold;
    case 'gte': return actual >= threshold;
    case 'lt': return actual < threshold;
    case 'lte': return actual <= threshold;
    case 'eq': return actual === threshold;
    default: return false;
  }
}

function operatorLabel(op: string): string {
  switch (op) {
    case 'gt': return '>';
    case 'gte': return '≥';
    case 'lt': return '<';
    case 'lte': return '≤';
    case 'eq': return '=';
    default: return op;
  }
}

function metricLabel(metric: string): string {
  switch (metric) {
    case 'weightedUtilPct': return 'Weighted Utilization';
    case 'unitUtilPct': return 'Unit Utilization';
    case 'compressionDaysPct': return 'Compression Days %';
    case 'avgUtilizationPct': return 'Avg Utilization';
    case 'waitlistCount': return 'Waitlist Count';
    case 'conversionRate': return 'Waitlist Conversion Rate';
    default: return metric;
  }
}

async function resolveMetricValue(
  metric: string,
  propertyId: string,
  orgId: string,
  windowDays: number = 56,
  unitType?: string | null,
  bandKey?: string | null,
): Promise<number> {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - windowDays);
  const periodStart = start.toISOString().slice(0, 10);
  const periodEnd = end.toISOString().slice(0, 10);

  const unitTypes = unitType ? [unitType] : undefined;

  switch (metric) {
    case 'weightedUtilPct': {
      if (bandKey) {
        const bands = await fetchBandBreakdown(propertyId, periodStart, periodEnd, 'contracted');
        const band = bands.find((b: any) => b.bandKey === bandKey && (!unitType || b.unitType === unitType));
        return band?.weightedUtilPct ?? 0;
      }
      const summary = await getSummary(propertyId, periodStart, periodEnd, 'marina', 'contracted', unitTypes);
      if (unitType && summary.byUnitType?.length) {
        const ut = summary.byUnitType.find((u: any) => u.unitType === unitType);
        if (ut) return ut.weightedUtil?.weightedUtilPct ?? 0;
      }
      return summary.overall?.weightedUtil?.weightedUtilPct ?? 0;
    }
    case 'unitUtilPct': {
      if (bandKey) {
        const bands = await fetchBandBreakdown(propertyId, periodStart, periodEnd, 'contracted');
        const band = bands.find((b: any) => b.bandKey === bandKey && (!unitType || b.unitType === unitType));
        return band?.unitUtilPct ?? 0;
      }
      const summary = await getSummary(propertyId, periodStart, periodEnd, 'marina', 'contracted', unitTypes);
      if (unitType && summary.byUnitType?.length) {
        const ut = summary.byUnitType.find((u: any) => u.unitType === unitType);
        if (ut) return ut.unitUtil?.utilizationPct ?? 0;
      }
      return summary.overall?.unitUtil?.utilizationPct ?? 0;
    }
    case 'compressionDaysPct': {
      const compression = await computeCompressionAnalytics(
        propertyId, periodStart, periodEnd, 90, 'contracted', unitTypes
      );
      return compression.compressionDaysPct;
    }
    case 'avgUtilizationPct': {
      const compression = await computeCompressionAnalytics(
        propertyId, periodStart, periodEnd, 90, 'contracted', unitTypes
      );
      return compression.avgUtilizationPct;
    }
    case 'waitlistCount': {
      const metrics = await getWaitlistMetrics(propertyId, orgId);
      return metrics.waitlistCount;
    }
    case 'conversionRate': {
      const metrics = await getWaitlistMetrics(propertyId, orgId);
      return metrics.conversionRate;
    }
    default:
      return 0;
  }
}

export async function getRulesForOrg(orgId: string) {
  return db.select().from(pricingRules).where(
    eq(pricingRules.orgId, orgId)
  ).orderBy(desc(pricingRules.priority));
}

export async function createRule(data: {
  orgId: string;
  name: string;
  description?: string | null;
  unitType?: string | null;
  bandKey?: string | null;
  conditions: RuleCondition[];
  action: 'increase' | 'decrease' | 'hold';
  adjustmentPct: number;
  cooldownDays?: number;
  priority?: number;
}) {
  const [rule] = await db.insert(pricingRules).values({
    orgId: data.orgId,
    name: data.name,
    description: data.description ?? null,
    unitType: data.unitType ?? null,
    bandKey: data.bandKey ?? null,
    conditions: data.conditions,
    action: data.action,
    adjustmentPct: String(data.adjustmentPct),
    cooldownDays: data.cooldownDays ?? 90,
    priority: data.priority ?? 0,
  }).returning();
  return rule;
}

export async function seedDefaultRules(orgId: string) {
  const existing = await db.select({ id: pricingRules.id }).from(pricingRules).where(
    eq(pricingRules.orgId, orgId)
  );
  if (existing.length > 0) return { seeded: false, count: existing.length };

  const defaults = [
    {
      orgId,
      name: 'High Utilization + Waitlist Demand',
      description: 'When weighted utilization exceeds 92% over 56 days and waitlist has 5+ entries, recommend a 5% rate increase.',
      conditions: [
        { metric: 'weightedUtilPct', operator: 'gte' as const, value: 92, windowDays: 56 },
        { metric: 'waitlistCount', operator: 'gte' as const, value: 5 },
      ],
      action: 'increase' as const,
      adjustmentPct: '5',
      cooldownDays: 90,
      priority: 10,
    },
    {
      orgId,
      name: 'Compression Threshold Exceeded',
      description: 'When 30%+ of days are above 90% utilization over the last 30 days, recommend a 3% rate increase.',
      conditions: [
        { metric: 'compressionDaysPct', operator: 'gte' as const, value: 30, windowDays: 30 },
      ],
      action: 'increase' as const,
      adjustmentPct: '3',
      cooldownDays: 60,
      priority: 5,
    },
    {
      orgId,
      name: 'Low Utilization Alert',
      description: 'When average utilization drops below 50% over 30 days, recommend a 5% rate decrease to stimulate demand.',
      conditions: [
        { metric: 'avgUtilizationPct', operator: 'lt' as const, value: 50, windowDays: 30 },
      ],
      action: 'decrease' as const,
      adjustmentPct: '5',
      cooldownDays: 60,
      priority: 3,
    },
  ];

  for (const rule of defaults) {
    await db.insert(pricingRules).values(rule);
  }

  return { seeded: true, count: defaults.length };
}

export async function evaluateRules(
  orgId: string,
  propertyId: string,
): Promise<{ evaluated: number; generated: number; recommendations: any[] }> {
  const rules = await db.select().from(pricingRules).where(
    and(
      eq(pricingRules.orgId, orgId),
      eq(pricingRules.status, 'active')
    )
  ).orderBy(desc(pricingRules.priority));

  let evaluated = 0;
  let generated = 0;
  const recommendations: any[] = [];

  for (const rule of rules) {
    evaluated++;
    const conditions = rule.conditions as RuleCondition[];
    const drivers: DriverResult[] = [];
    let allSatisfied = true;

    for (const cond of conditions) {
      const windowDays = cond.windowDays ?? 56;
      const currentValue = await resolveMetricValue(
        cond.metric, propertyId, orgId, windowDays, rule.unitType, rule.bandKey
      );
      const satisfied = compareValue(currentValue, cond.operator, cond.value);

      drivers.push({
        metric: cond.metric,
        currentValue: Math.round(currentValue * 100) / 100,
        threshold: cond.value,
        operator: cond.operator,
        windowDays,
        satisfied,
      });

      if (!satisfied) allSatisfied = false;
    }

    if (allSatisfied) {
      const existingPending = await db.select({ id: pricingRecommendations.id }).from(pricingRecommendations).where(
        and(
          eq(pricingRecommendations.orgId, orgId),
          eq(pricingRecommendations.propertyId, propertyId),
          eq(pricingRecommendations.ruleId, rule.id),
          eq(pricingRecommendations.status, 'pending')
        )
      );

      if (existingPending.length > 0) continue;

      const cooldownCutoff = new Date();
      cooldownCutoff.setDate(cooldownCutoff.getDate() - (rule.cooldownDays ?? 90));
      const recentResolved = await db.select({ id: pricingRecommendations.id, resolvedAt: pricingRecommendations.resolvedAt })
        .from(pricingRecommendations).where(
          and(
            eq(pricingRecommendations.orgId, orgId),
            eq(pricingRecommendations.propertyId, propertyId),
            eq(pricingRecommendations.ruleId, rule.id),
            inArray(pricingRecommendations.status, ['accepted', 'implemented', 'dismissed'])
          )
        ).orderBy(desc(pricingRecommendations.resolvedAt));

      const withinCooldown = recentResolved.some(r =>
        r.resolvedAt && r.resolvedAt >= cooldownCutoff
      );
      if (withinCooldown) continue;

      const driversSummary = drivers.map(d =>
        `${metricLabel(d.metric)}: ${d.currentValue} ${operatorLabel(d.operator)} ${d.threshold}`
      ).join('; ');

      const actionWord = rule.action === 'increase' ? 'increase' : rule.action === 'decrease' ? 'decrease' : 'hold';
      const summary = `Recommend ${actionWord} rates by ${parseFloat(rule.adjustmentPct)}%${rule.unitType ? ` for ${rule.unitType}` : ''}${rule.bandKey ? ` (${rule.bandKey})` : ''}. Drivers: ${driversSummary}`;

      const [rec] = await db.insert(pricingRecommendations).values({
        orgId,
        propertyId,
        ruleId: rule.id,
        unitType: rule.unitType,
        bandKey: rule.bandKey,
        action: rule.action,
        adjustmentPct: rule.adjustmentPct,
        status: 'pending',
        drivers,
        summary,
      }).returning();

      generated++;
      recommendations.push(rec);
    }
  }

  return { evaluated, generated, recommendations };
}

export async function getRecommendations(orgId: string, propertyId?: string, status?: string) {
  const conditions = [eq(pricingRecommendations.orgId, orgId)];
  if (propertyId) conditions.push(eq(pricingRecommendations.propertyId, propertyId));
  if (status) {
    const statuses = status.split(',') as any[];
    if (statuses.length === 1) {
      conditions.push(eq(pricingRecommendations.status, statuses[0]));
    } else {
      conditions.push(inArray(pricingRecommendations.status, statuses));
    }
  }

  return db.select().from(pricingRecommendations).where(
    and(...conditions)
  ).orderBy(desc(pricingRecommendations.evaluatedAt));
}

export async function updateRecommendationStatus(
  recId: string,
  orgId: string,
  newStatus: 'accepted' | 'dismissed' | 'implemented',
  userId?: string,
  notes?: string,
) {
  const [rec] = await db.select().from(pricingRecommendations).where(
    and(eq(pricingRecommendations.id, recId), eq(pricingRecommendations.orgId, orgId))
  );
  if (!rec) throw new Error('Recommendation not found');
  if (rec.status !== 'pending' && rec.status !== 'accepted') {
    throw new Error(`Cannot update recommendation in ${rec.status} status`);
  }

  const [updated] = await db.update(pricingRecommendations)
    .set({
      status: newStatus,
      resolvedAt: new Date(),
      resolvedBy: userId ?? null,
      notes: notes ?? null,
      updatedAt: new Date(),
    })
    .where(eq(pricingRecommendations.id, recId))
    .returning();

  return updated;
}
