import {
  CashflowPeriod,
  PartnerInfo,
  TaxInputs,
  TaxSettings,
  WaterfallTierConfig,
  TaxInteractionMode,
  PeriodResult,
  CalculateResult,
  PartnerMetric,
} from './types';
import { ZERO, fromCentsStr, maxBigInt, sumMap } from './money';
import { runTaxEngine } from './taxEngine';
import { runWaterfallEngine, createInitialState } from './waterfallEngine';
import { computePartnerIRR, computePartnerMOIC, PartnerCashflowEntry } from './irrAdapter';

export function runCoordinator(
  periods: CashflowPeriod[],
  partners: PartnerInfo[],
  tiers: WaterfallTierConfig[],
  taxInputs: TaxInputs,
  taxSettings: TaxSettings,
  periodsPerYear: number,
): CalculateResult {
  const state = createInitialState(partners);
  const periodResults: PeriodResult[] = [];
  const preTaxCashflows = new Map<string, PartnerCashflowEntry[]>();
  const afterTaxCashflows = new Map<string, PartnerCashflowEntry[]>();

  for (const p of partners) {
    const investmentEntry: PartnerCashflowEntry = {
      periodIndex: -1,
      date: periods[0]?.periodStart ?? new Date(),
      investmentCents: p.equityContributedCents,
      distributionCents: ZERO,
    };
    preTaxCashflows.set(p.partnerId, [investmentEntry]);
    afterTaxCashflows.set(p.partnerId, [{ ...investmentEntry }]);
  }

  for (const period of periods) {
    const taxResult = taxSettings.enabled
      ? runTaxEngine(period, partners, taxInputs, taxSettings.taxMode, periodsPerYear)
      : { totalTaxBuckets: { ordinaryCents: ZERO, capGainCents: ZERO, recaptureCents: ZERO, lossCents: ZERO }, partnerTaxes: [], warnings: [] };

    let waterfallResult;
    const preTaxDist = new Map<string, bigint>();
    const afterTaxDist = new Map<string, bigint>();
    const allWarnings = [...period.warnings, ...taxResult.warnings];

    switch (taxSettings.taxInteractionMode) {
      case 'waterfall_pre_tax': {
        waterfallResult = runWaterfallEngine(
          period.cashAvailableCents, tiers, partners, state, periodsPerYear,
        );
        allWarnings.push(...waterfallResult.warnings);
        for (const p of partners) {
          const dist = waterfallResult.distributionsByPartner.get(p.partnerId) || ZERO;
          preTaxDist.set(p.partnerId, dist);
          const tax = taxResult.partnerTaxes.find(t => t.partnerId === p.partnerId);
          const taxDue = tax?.taxDueCents || ZERO;
          afterTaxDist.set(p.partnerId, maxBigInt(ZERO, dist - taxDue));
        }
        break;
      }

      case 'waterfall_after_tax': {
        const totalTax = taxResult.partnerTaxes.reduce((s, t) => s + t.taxDueCents, ZERO);
        const afterTaxCash = maxBigInt(ZERO, period.cashAvailableCents - totalTax);
        if (totalTax > period.cashAvailableCents) {
          allWarnings.push(`Period ${period.periodIndex}: taxes exceed cash available.`);
        }
        waterfallResult = runWaterfallEngine(
          afterTaxCash, tiers, partners, state, periodsPerYear,
        );
        allWarnings.push(...waterfallResult.warnings);
        for (const p of partners) {
          const dist = waterfallResult.distributionsByPartner.get(p.partnerId) || ZERO;
          preTaxDist.set(p.partnerId, dist);
          afterTaxDist.set(p.partnerId, dist);
        }
        break;
      }

      case 'tax_distribution_layer': {
        const taxDistTier: WaterfallTierConfig = {
          tierOrder: 0,
          tierType: 'tax_distribution',
          prefRate: null,
          catchUpTargetGpShare: null,
          irrHurdle: null,
          equityMultipleHurdle: null,
          lpSplit: null,
          gpSplit: null,
          notes: 'Auto-inserted tax distribution tier',
        };
        const combinedTiers = [taxDistTier, ...tiers.map(t => ({ ...t, tierOrder: t.tierOrder + 1 }))];
        waterfallResult = runWaterfallEngine(
          period.cashAvailableCents, combinedTiers, partners, state, periodsPerYear, taxResult.partnerTaxes,
        );
        allWarnings.push(...waterfallResult.warnings);
        for (const p of partners) {
          const dist = waterfallResult.distributionsByPartner.get(p.partnerId) || ZERO;
          preTaxDist.set(p.partnerId, dist);
          const tax = taxResult.partnerTaxes.find(t => t.partnerId === p.partnerId);
          const taxDue = tax?.taxDueCents || ZERO;
          afterTaxDist.set(p.partnerId, maxBigInt(ZERO, dist - taxDue));
        }
        break;
      }
    }

    for (const p of partners) {
      const preTaxEntries = preTaxCashflows.get(p.partnerId)!;
      preTaxEntries.push({
        periodIndex: period.periodIndex,
        date: period.periodEnd,
        investmentCents: ZERO,
        distributionCents: preTaxDist.get(p.partnerId) || ZERO,
      });
      const afterTaxEntries = afterTaxCashflows.get(p.partnerId)!;
      afterTaxEntries.push({
        periodIndex: period.periodIndex,
        date: period.periodEnd,
        investmentCents: ZERO,
        distributionCents: afterTaxDist.get(p.partnerId) || ZERO,
      });
    }

    periodResults.push({
      periodIndex: period.periodIndex,
      periodStart: period.periodStart.toISOString(),
      periodEnd: period.periodEnd.toISOString(),
      cashAvailableCents: fromCentsStr(period.cashAvailableCents),
      taxableBucketsCents: {
        ordinary: fromCentsStr(taxResult.totalTaxBuckets.ordinaryCents),
        capGain: fromCentsStr(taxResult.totalTaxBuckets.capGainCents),
        recapture: fromCentsStr(taxResult.totalTaxBuckets.recaptureCents),
      },
      taxesByPartner: taxResult.partnerTaxes.map(t => ({
        partnerId: t.partnerId,
        taxDueCents: fromCentsStr(t.taxDueCents),
        ordinaryTaxCents: fromCentsStr(t.ordinaryTaxCents),
        capGainTaxCents: fromCentsStr(t.capGainTaxCents),
        recaptureTaxCents: fromCentsStr(t.recaptureTaxCents),
      })),
      distributionsPreTaxByPartner: partners.map(p => ({
        partnerId: p.partnerId,
        amountCents: fromCentsStr(preTaxDist.get(p.partnerId) || ZERO),
      })),
      distributionsAfterTaxByPartner: partners.map(p => ({
        partnerId: p.partnerId,
        amountCents: fromCentsStr(afterTaxDist.get(p.partnerId) || ZERO),
      })),
      waterfallBreakdown: (waterfallResult?.tierBreakdown || []).map(tb => ({
        tierOrder: tb.tierOrder,
        tierType: tb.tierType,
        allocations: tb.allocations.map(a => ({
          partnerId: a.partnerId,
          amountCents: fromCentsStr(a.amountCents),
        })),
      })),
      warnings: allWarnings,
    });
  }

  const preTaxIRRByPartner: PartnerMetric[] = [];
  const afterTaxIRRByPartner: PartnerMetric[] = [];
  const preTaxMOICByPartner: PartnerMetric[] = [];
  const afterTaxMOICByPartner: PartnerMetric[] = [];
  const taxDragByPartner: PartnerMetric[] = [];

  for (const p of partners) {
    const preTaxEntries = preTaxCashflows.get(p.partnerId) || [];
    const afterTaxEntries = afterTaxCashflows.get(p.partnerId) || [];

    const preTaxIrr = computePartnerIRR(preTaxEntries);
    const afterTaxIrr = computePartnerIRR(afterTaxEntries);

    preTaxIRRByPartner.push({ partnerId: p.partnerId, value: preTaxIrr });
    afterTaxIRRByPartner.push({ partnerId: p.partnerId, value: afterTaxIrr });

    const totalPreTaxDist = preTaxEntries.reduce((s, e) => s + e.distributionCents, ZERO);
    const totalAfterTaxDist = afterTaxEntries.reduce((s, e) => s + e.distributionCents, ZERO);

    preTaxMOICByPartner.push({ partnerId: p.partnerId, value: computePartnerMOIC(p.equityContributedCents, totalPreTaxDist) });
    afterTaxMOICByPartner.push({ partnerId: p.partnerId, value: computePartnerMOIC(p.equityContributedCents, totalAfterTaxDist) });

    const drag = (preTaxIrr !== null && afterTaxIrr !== null) ? afterTaxIrr - preTaxIrr : null;
    taxDragByPartner.push({ partnerId: p.partnerId, value: drag });
  }

  return {
    ok: true,
    periodResults,
    summary: {
      preTaxIRRByPartner,
      afterTaxIRRByPartner,
      preTaxMOICByPartner,
      afterTaxMOICByPartner,
      taxDragByPartner,
    },
  };
}
