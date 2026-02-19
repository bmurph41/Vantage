import {
  fetchInventoryUnits,
  fetchOccupancyEvents,
  fetchOfflineBlocks,
  fetchBandBreakdown,
  computeCompressionAnalytics,
} from './utilization-service';
import { getWaitlistMetrics } from './waitlist-service';
import type { InventoryUnit, OccupancyEvent } from './utilization-types';
import { daysBetween } from './overlap';

export interface DiagnosisSignal {
  signalType: 'priceHigh' | 'constraint' | 'friction' | 'downtime';
  label: string;
  description: string;
  confidence: number;
  evidence: Record<string, any>;
}

export interface SegmentDiagnosis {
  unitType: string;
  bandKey: string | null;
  bandLabel: string;
  unitUtilPct: number;
  weightedUtilPct: number;
  totalUnits: number;
  occupiedUnits: number;
  offlineUnits: number;
  signals: DiagnosisSignal[];
  primarySignal: string | null;
  summaryText: string;
}

const UNDERUTIL_THRESHOLD = 65;

function matchesBand(unit: InventoryUnit, bandKey: string | null | undefined): boolean {
  if (bandKey === null || bandKey === undefined) return unit.bandKey === null || unit.bandKey === undefined;
  return unit.bandKey === bandKey;
}

function computeEffectiveRate(
  occupancy: OccupancyEvent[],
  units: InventoryUnit[],
  unitType: string,
  bandKey?: string | null,
): { segmentRate: number; count: number } {
  const unitIds = new Set(
    units
      .filter(u => u.unitType === unitType && matchesBand(u, bandKey))
      .map(u => u.id)
  );

  const relevantOcc = occupancy.filter(o => unitIds.has(o.unitId) && o.monthlyRevenue > 0);
  if (relevantOcc.length === 0) return { segmentRate: 0, count: 0 };

  const totalRevenue = relevantOcc.reduce((s, o) => s + o.monthlyRevenue, 0);
  return { segmentRate: totalRevenue / relevantOcc.length, count: relevantOcc.length };
}

function computeGlobalAvgRate(
  occupancy: OccupancyEvent[],
  units: InventoryUnit[],
  unitType: string,
): number {
  const unitIds = new Set(
    units.filter(u => u.unitType === unitType).map(u => u.id)
  );
  const relevantOcc = occupancy.filter(o => unitIds.has(o.unitId) && o.monthlyRevenue > 0);
  if (relevantOcc.length === 0) return 0;
  return relevantOcc.reduce((s, o) => s + o.monthlyRevenue, 0) / relevantOcc.length;
}

function priceHighSignal(
  occupancy: OccupancyEvent[],
  units: InventoryUnit[],
  unitType: string,
  bandKey: string | null,
): DiagnosisSignal | null {
  const { segmentRate, count } = computeEffectiveRate(occupancy, units, unitType, bandKey);
  if (count < 1 || segmentRate === 0) return null;

  const globalRate = computeGlobalAvgRate(occupancy, units, unitType);
  if (globalRate === 0) return null;

  const ratio = segmentRate / globalRate;
  if (ratio <= 1.15) return null;

  const pctAbove = Math.round((ratio - 1) * 100);
  const confidence = Math.min(0.95, 0.5 + (ratio - 1.15) * 2);

  return {
    signalType: 'priceHigh',
    label: 'Rate above segment average',
    description: `Effective rate is ${pctAbove}% above the ${unitType} average ($${Math.round(segmentRate)}/mo vs $${Math.round(globalRate)}/mo), which may suppress demand.`,
    confidence: Math.round(confidence * 100) / 100,
    evidence: { segmentRate: Math.round(segmentRate), globalRate: Math.round(globalRate), ratio: Math.round(ratio * 100) / 100, leaseCount: count },
  };
}

function constraintSignal(
  units: InventoryUnit[],
  unitType: string,
  bandKey: string | null,
): DiagnosisSignal | null {
  const segmentUnits = units.filter(
    u => u.unitType === unitType && matchesBand(u, bandKey)
  );
  if (segmentUnits.length === 0) return null;

  let constraintCount = 0;
  const issues: string[] = [];

  const attrs = segmentUnits.map(u => u.capacityAttributes ?? {});

  const hasBeamLimits = attrs.filter((a: any) => a.maxBeamFt && a.maxBeamFt < 16).length;
  if (hasBeamLimits > segmentUnits.length * 0.3) {
    constraintCount++;
    issues.push('narrow beam limits');
  }

  const hasPowerLimits = attrs.filter((a: any) => !a.power_50a && !a.power_100a).length;
  if (hasPowerLimits > segmentUnits.length * 0.5) {
    constraintCount++;
    issues.push('limited power availability (no 50A/100A)');
  }

  const hasDepthLimits = attrs.filter((a: any) => a.minDepthFt && a.minDepthFt < 5).length;
  if (hasDepthLimits > segmentUnits.length * 0.3) {
    constraintCount++;
    issues.push('shallow draft restrictions');
  }

  const dockTypes = new Set(attrs.map((a: any) => a.dockType).filter(Boolean));
  if (dockTypes.size === 1) {
    const singleType = [...dockTypes][0];
    if (singleType === 'fixed') {
      constraintCount++;
      issues.push('fixed dock only (no floating)');
    }
  }

  if (constraintCount === 0) return null;

  const confidence = Math.min(0.85, 0.3 + constraintCount * 0.2);

  return {
    signalType: 'constraint',
    label: 'Physical constraint mismatch',
    description: `${issues.join(', ')} — ${Math.round(segmentUnits.length * (constraintCount / 4) * 100 / segmentUnits.length)}% of units may be mismatched to demand.`,
    confidence: Math.round(confidence * 100) / 100,
    evidence: { constraintCount, issues, totalUnits: segmentUnits.length },
  };
}

function frictionSignal(
  waitlistCount: number,
  conversionRate: number,
  unitUtilPct: number,
): DiagnosisSignal | null {
  if (waitlistCount > 3 && unitUtilPct < UNDERUTIL_THRESHOLD) {
    const confidence = Math.min(0.8, 0.4 + (waitlistCount - 3) * 0.05);
    return {
      signalType: 'friction',
      label: 'High interest but low conversion',
      description: `${waitlistCount} waitlist entries but only ${Math.round(unitUtilPct)}% utilization — possible onboarding friction or slow offer turnaround.`,
      confidence: Math.round(confidence * 100) / 100,
      evidence: { waitlistCount, conversionRate: Math.round(conversionRate * 100) / 100, unitUtilPct: Math.round(unitUtilPct) },
    };
  }

  if (unitUtilPct < 40 && waitlistCount === 0) {
    return {
      signalType: 'friction',
      label: 'Low visibility / no inbound interest',
      description: `No waitlist entries and ${Math.round(unitUtilPct)}% utilization — segment may lack marketing exposure or listing visibility.`,
      confidence: 0.35,
      evidence: { waitlistCount, unitUtilPct: Math.round(unitUtilPct) },
    };
  }

  return null;
}

function downtimeSignal(
  offlineBlocks: any[],
  units: InventoryUnit[],
  unitType: string,
  bandKey: string | null,
  periodStart: string,
  periodEnd: string,
): DiagnosisSignal | null {
  const segmentUnits = units.filter(
    u => u.unitType === unitType && matchesBand(u, bandKey)
  );
  if (segmentUnits.length === 0) return null;

  const segmentUnitIds = new Set(segmentUnits.map(u => u.id));
  const totalDays = daysBetween(periodStart, periodEnd);

  let offlineDays = 0;
  const reasonCounts: Record<string, number> = {};

  for (const block of offlineBlocks) {
    let affectsSegment = false;
    if (block.scopeType === 'unit' && block.unitId && segmentUnitIds.has(block.unitId)) {
      affectsSegment = true;
    } else if (block.scopeType === 'band' && block.scopeKey === bandKey) {
      affectsSegment = true;
    } else if (block.scopeType === 'unit_type' && block.scopeKey === unitType) {
      affectsSegment = true;
    } else if (block.scopeType === 'property') {
      affectsSegment = true;
    }

    if (!affectsSegment) continue;

    const bStart = new Date(Math.max(new Date(block.startDate).getTime(), new Date(periodStart).getTime()));
    const bEnd = block.endDate
      ? new Date(Math.min(new Date(block.endDate).getTime(), new Date(periodEnd).getTime()))
      : new Date(periodEnd);
    const days = Math.max(0, daysBetween(bStart.toISOString().slice(0, 10), bEnd.toISOString().slice(0, 10)));
    offlineDays += days;

    const reason = block.reasonCode || 'unspecified';
    reasonCounts[reason] = (reasonCounts[reason] || 0) + days;
  }

  const offlinePct = (offlineDays / (segmentUnits.length * totalDays)) * 100;
  if (offlinePct < 5) return null;

  const topReason = Object.entries(reasonCounts).sort((a, b) => b[1] - a[1])[0];
  const confidence = Math.min(0.95, 0.4 + offlinePct / 100);

  return {
    signalType: 'downtime',
    label: 'Elevated offline / downtime',
    description: `${Math.round(offlinePct)}% of capacity-days offline${topReason ? ` (primary cause: ${topReason[0]})` : ''}. Reducing downtime could recover ${Math.round(offlinePct * 0.7)}%+ utilization.`,
    confidence: Math.round(confidence * 100) / 100,
    evidence: { offlineDays, offlinePct: Math.round(offlinePct), reasonBreakdown: reasonCounts, affectedUnits: segmentUnits.length, totalDays },
  };
}

export async function diagnoseUnderutilization(
  propertyId: string,
  orgId: string,
  periodStart: string,
  periodEnd: string,
): Promise<SegmentDiagnosis[]> {
  const [units, occupancy, offlineBlocks, bandBreakdown, waitlistMetrics] = await Promise.all([
    fetchInventoryUnits(propertyId),
    fetchOccupancyEvents(propertyId, periodStart, periodEnd),
    fetchOfflineBlocks(propertyId, periodStart, periodEnd),
    fetchBandBreakdown(propertyId, periodStart, periodEnd, 'contracted'),
    getWaitlistMetrics(orgId, propertyId).catch(() => ({ waitlistCount: 0, conversionRate: 0, avgTimeToOffer: 0, demandByBand: {}, demandByType: {} })),
  ]);

  const diagnoses: SegmentDiagnosis[] = [];

  for (const band of bandBreakdown) {
    const utilPct = band.unitUtilPct ?? 0;
    const wUtilPct = band.weightedUtilPct ?? 0;

    if (utilPct >= UNDERUTIL_THRESHOLD && wUtilPct >= UNDERUTIL_THRESHOLD) continue;

    const signals: DiagnosisSignal[] = [];

    const priceSignal = priceHighSignal(occupancy, units, band.unitType, band.bandKey);
    if (priceSignal) signals.push(priceSignal);

    const constraintSig = constraintSignal(units, band.unitType, band.bandKey);
    if (constraintSig) signals.push(constraintSig);

    const bandWaitlist = (waitlistMetrics as any).demandByBand?.[band.bandKey] ?? 0;
    const frictionSig = frictionSignal(
      bandWaitlist || waitlistMetrics.waitlistCount,
      waitlistMetrics.conversionRate,
      utilPct,
    );
    if (frictionSig) signals.push(frictionSig);

    const downtimeSig = downtimeSignal(offlineBlocks, units, band.unitType, band.bandKey, periodStart, periodEnd);
    if (downtimeSig) signals.push(downtimeSig);

    if (signals.length === 0) {
      signals.push({
        signalType: 'friction',
        label: 'No clear root cause identified',
        description: `Utilization is ${Math.round(utilPct)}% — further investigation of market demand and competitive pricing recommended.`,
        confidence: 0.2,
        evidence: { unitUtilPct: Math.round(utilPct) },
      });
    }

    signals.sort((a, b) => b.confidence - a.confidence);

    const primarySignal = signals[0];
    const signalLabels = signals.slice(0, 2).map(s => s.label.toLowerCase()).join(' + ');
    const bandLabel = band.bandLabel || band.bandKey || band.unitType;
    const summaryText = `${bandLabel} lagging: ${Math.round(utilPct)}% util; primary signal: ${signalLabels}`;

    diagnoses.push({
      unitType: band.unitType,
      bandKey: band.bandKey ?? null,
      bandLabel,
      unitUtilPct: Math.round(utilPct * 10) / 10,
      weightedUtilPct: Math.round(wUtilPct * 10) / 10,
      totalUnits: band.totalUnits ?? 0,
      occupiedUnits: band.occupiedUnits ?? 0,
      offlineUnits: band.offlineUnits ?? 0,
      signals,
      primarySignal: primarySignal?.signalType ?? null,
      summaryText,
    });
  }

  diagnoses.sort((a, b) => a.unitUtilPct - b.unitUtilPct);

  return diagnoses;
}
