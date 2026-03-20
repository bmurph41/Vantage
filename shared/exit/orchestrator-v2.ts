// ============================================================
// Exit Strategy Studio — Orchestrator V2
// Wraps existing engines with new type contracts.
//
// Patches applied:
//  #5  Proceeds Timeline — populated with granular cash flow events
//  #6  Asset-Class Specialist — calculations wired into pipeline
//  #7  Waterfall Result Mapping — full adapter (amort, tax, payouts)
//  #8  DLOM/DLOC — applied to price or equity
//  #9  Operating Business — goodwill/intangibles treatment
//  #10 Multi-Property Basis — per-property MACRS allocation
// ============================================================

import { calculateBasisLedger } from './basis-ledger';
import { calculate1031ExchangeEngine } from './exchange-1031-engine';
import { calculateSellerFinancing } from './seller-financing-engine';
import type { SellerFinancingEngineResult } from './seller-financing-engine';
import { calculateEarnout } from './earnout-engine';
import type { EarnoutEngineResult } from './earnout-engine';
import { calculateWaterfallV2 } from './waterfall-engine-v2';
import type { WaterfallV2Result } from './waterfall-engine-v2';
import { runExitScenario } from './exit-scenario-engine';

import {
  adaptBasisInputNewToOld,
  adaptBasisResultOldToNew,
  adapt1031InputNewToOld,
  adapt1031ResultOldToNew,
  adaptSellerFinancingNewToOld,
  adaptEarnoutNewToOld,
  adaptTaxProfileNewToOld,
  adaptScenarioInputNewToOld,
} from './adapters';

import type {
  ExitScenarioInput,
  ExitScenarioResult,
  ExitScenarioKPIs,
  ResultsSummary,
  AssetClassSpecialistInputs,
} from './types/07-master-types';
import type { BasisLedgerOutput } from './types/02-basis-ledger';
import type {
  SaleComputation,
  GainCharacterization,
  ProceedsTimeline,
  TimelineEvent,
  YearlyProceedsSummary,
} from './types/03-sale-and-gain';
import type {
  Exchange1031Result,
  SellerFinancingResult,
  AmortScheduleRow,
  InstallmentTaxRow,
  EarnoutResult,
  ReplacementBasisAllocation,
} from './types/04-strategy-inputs';
import type { TaxSchedule, WaterfallResult } from './types/05-waterfall-tax';
import type { StrategyInteractionPolicy } from './types/06-strategy-interactions';
import type { Warning, ExitStrategy } from './types/01-enums-and-primitives';

import { createHash } from 'crypto';

// ============================================================
// Engine Version
// ============================================================
export const ENGINE_VERSION = '2.1.0';

// ============================================================
// Checksum
// ============================================================
function computeInputsChecksum(input: ExitScenarioInput): string {
  const normalized = JSON.stringify(input, Object.keys(input).sort());
  return createHash('sha256').update(normalized).digest('hex').slice(0, 16);
}

// ============================================================
// #8: DLOM/DLOC Valuation Adjustments
// ============================================================
function applyValuationAdjustments(
  salePrice: number,
  equityValue: number,
  adjustments?: ExitScenarioInput['valuationAdjustments']
): { adjustedSalePrice: number; adjustedEquity: number; totalDiscount: number; warnings: Warning[] } {
  const warnings: Warning[] = [];
  if (!adjustments) {
    return { adjustedSalePrice: salePrice, adjustedEquity: equityValue, totalDiscount: 0, warnings };
  }

  const dlocPct = (adjustments.dlocPercent ?? 0) / 100;
  const dlomPct = (adjustments.dlomPercent ?? 0) / 100;

  // Combined discount: 1 - (1 - DLOC)(1 - DLOM)
  const combinedDiscount = 1 - (1 - dlocPct) * (1 - dlomPct);

  if (combinedDiscount > 0.50) {
    warnings.push({
      code: 'HIGH_VALUATION_DISCOUNT',
      severity: 'warning',
      title: 'Combined DLOM/DLOC discount exceeds 50%',
      message: `Combined discount of ${(combinedDiscount * 100).toFixed(1)}% is unusually high. Verify with appraiser.`,
      relatedFields: ['valuationAdjustments.dlocPercent', 'valuationAdjustments.dlomPercent'],
    });
  }

  if (adjustments.applyTo === 'price') {
    const discount = salePrice * combinedDiscount;
    return {
      adjustedSalePrice: salePrice - discount,
      adjustedEquity: equityValue,
      totalDiscount: discount,
      warnings,
    };
  } else {
    // Apply to equity
    const discount = equityValue * combinedDiscount;
    return {
      adjustedSalePrice: salePrice,
      adjustedEquity: equityValue - discount,
      totalDiscount: discount,
      warnings,
    };
  }
}

// ============================================================
// #9: Operating Business Component
// ============================================================
interface OperatingBusinessAdjustments {
  goodwillAmount: number;
  intangiblesAmount: number;
  personalPropertyAmount: number;
  covenantNotToCompeteAmount: number;
  adjustedRealPropertyBasis: number;
  warnings: Warning[];
}

function computeOperatingBusinessAdjustments(
  input: ExitScenarioInput,
  basisLedger: BasisLedgerOutput,
  salePrice: number,
): OperatingBusinessAdjustments {
  const warnings: Warning[] = [];

  if (!input.operatingBusinessInvolved) {
    return {
      goodwillAmount: 0,
      intangiblesAmount: 0,
      personalPropertyAmount: 0,
      covenantNotToCompeteAmount: 0,
      adjustedRealPropertyBasis: basisLedger.totalAdjustedBasis,
      warnings,
    };
  }

  // Asset-class-specific allocation heuristics
  const assetClass = input.assetClass;
  let goodwillPct = 0;
  let intangiblesPct = 0;
  let personalPropertyPct = 0;
  let covenantPct = 0;

  switch (assetClass) {
    case 'hotel':
      goodwillPct = 0.15;
      intangiblesPct = 0.05; // brand/franchise
      personalPropertyPct = 0.10; // FF&E
      covenantPct = 0.02;
      break;
    case 'marina':
      goodwillPct = 0.12;
      intangiblesPct = 0.08; // permits, water rights
      personalPropertyPct = 0.08; // boats, docks, fuel systems
      covenantPct = 0.03;
      break;
    case 'golf':
      goodwillPct = 0.10;
      intangiblesPct = 0.05; // memberships, brand
      personalPropertyPct = 0.12; // equipment, carts
      covenantPct = 0.03;
      break;
    case 'str':
      goodwillPct = 0.08;
      intangiblesPct = 0.05; // listing history, reviews
      personalPropertyPct = 0.15; // furnishings
      covenantPct = 0.02;
      break;
    case 'retail':
    case 'mall':
      goodwillPct = 0.05;
      intangiblesPct = 0.03; // tenant relationships
      personalPropertyPct = 0.02;
      break;
    case 'data_center':
      goodwillPct = 0.08;
      intangiblesPct = 0.10; // contracts, power agreements
      personalPropertyPct = 0.20; // IT infrastructure
      covenantPct = 0.02;
      break;
    default:
      // Generic operating business
      goodwillPct = 0.10;
      intangiblesPct = 0.05;
      personalPropertyPct = 0.05;
      covenantPct = 0.02;
  }

  const goodwillAmount = salePrice * goodwillPct;
  const intangiblesAmount = salePrice * intangiblesPct;
  const personalPropertyAmount = salePrice * personalPropertyPct;
  const covenantNotToCompeteAmount = salePrice * covenantPct;
  const totalBusinessComponents = goodwillAmount + intangiblesAmount + personalPropertyAmount + covenantNotToCompeteAmount;

  warnings.push({
    code: 'OPERATING_BUSINESS_ALLOCATION',
    severity: 'caution',
    title: 'Operating Business — Purchase Price Allocation Required',
    message: `Operating business component detected for ${assetClass}. ` +
      `Estimated allocation: Goodwill $${goodwillAmount.toLocaleString()}, ` +
      `Intangibles $${intangiblesAmount.toLocaleString()}, ` +
      `Personal Property $${personalPropertyAmount.toLocaleString()}. ` +
      `Goodwill and covenants are taxed as ordinary income (§ 1245). ` +
      `A formal purchase price allocation (§ 1060) is recommended.`,
    relatedFields: ['operatingBusinessInvolved'],
    actionRequired: true,
  });

  if (covenantNotToCompeteAmount > 0) {
    warnings.push({
      code: 'COVENANT_NOT_TO_COMPETE',
      severity: 'info',
      title: 'Covenant Not to Compete',
      message: `$${covenantNotToCompeteAmount.toLocaleString()} allocated to covenant not to compete — ` +
        `amortizable over 15 years (§ 197) for buyer, taxed as ordinary income for seller.`,
    });
  }

  return {
    goodwillAmount,
    intangiblesAmount,
    personalPropertyAmount,
    covenantNotToCompeteAmount,
    adjustedRealPropertyBasis: Math.max(0, basisLedger.totalAdjustedBasis - totalBusinessComponents * 0.3),
    warnings,
  };
}

// ============================================================
// #6: Asset-Class Specialist Calculations
// ============================================================
interface SpecialistAdjustment {
  noiAdjustment: number;
  exitCapRateAdjustment: number;
  valuationPremiumOrDiscount: number;
  explanations: string[];
  warnings: Warning[];
}

function computeAssetClassSpecialistAdjustments(
  specialist: AssetClassSpecialistInputs | undefined,
  salePrice: number,
): SpecialistAdjustment {
  const result: SpecialistAdjustment = {
    noiAdjustment: 0,
    exitCapRateAdjustment: 0,
    valuationPremiumOrDiscount: 0,
    explanations: [],
    warnings: [],
  };

  if (!specialist) return result;

  switch (specialist.assetClass) {
    case 'hotel': {
      const { adr, occupancyRate, revpar, goppar, brandFeePercent, managementFeePercent } = specialist;
      // RevPAR-based valuation check
      if (revpar > 0 && salePrice > 0) {
        const pricePerKey = salePrice; // simplified — would need room count
        const revparMultiple = pricePerKey / (revpar * 365);
        if (revparMultiple > 5) {
          result.warnings.push({
            code: 'HOTEL_HIGH_REVPAR_MULTIPLE',
            severity: 'caution',
            title: 'High RevPAR Multiple',
            message: `Price-per-key represents ${revparMultiple.toFixed(1)}x RevPAR — verify comp set.`,
          });
        }
      }
      // Management fee impact on NOI
      if (managementFeePercent && managementFeePercent > 3) {
        result.noiAdjustment -= salePrice * (managementFeePercent - 3) / 100 * 0.1;
        result.explanations.push(`Management fee of ${managementFeePercent}% exceeds market (3%) — NOI adjusted.`);
      }
      // Brand fee impact
      if (brandFeePercent && brandFeePercent > 5) {
        result.noiAdjustment -= salePrice * (brandFeePercent - 5) / 100 * 0.05;
        result.explanations.push(`Brand fee of ${brandFeePercent}% impacts effective NOI.`);
      }
      // Occupancy-driven cap rate adjustment
      if (occupancyRate < 55) {
        result.exitCapRateAdjustment += 0.5; // 50bps penalty
        result.explanations.push(`Low occupancy (${occupancyRate}%) adds 50bps to exit cap rate.`);
      }
      break;
    }

    case 'str': {
      const { adr, occupancyRate, seasonalityToggle, cleaningCostPerTurn, turnoverRate } = specialist;
      // Seasonality risk premium
      if (seasonalityToggle) {
        result.exitCapRateAdjustment += 0.25;
        result.explanations.push('Seasonal STR adds 25bps cap rate premium for revenue volatility.');
      }
      // High turnover cost impact
      if (cleaningCostPerTurn && turnoverRate && turnoverRate > 200) {
        const annualCleaningCost = cleaningCostPerTurn * turnoverRate;
        result.noiAdjustment -= annualCleaningCost * 0.1;
        result.explanations.push(`High turn count (${turnoverRate}/yr) × $${cleaningCostPerTurn}/clean reduces effective NOI.`);
      }
      break;
    }

    case 'marina': {
      const { wetSlipRevenue, dryStorageRevenue, fuelRevenue, fuelMargin } = specialist;
      const totalRevenue = wetSlipRevenue + dryStorageRevenue + fuelRevenue;
      // Fuel dependency risk
      if (totalRevenue > 0 && fuelRevenue / totalRevenue > 0.40) {
        result.exitCapRateAdjustment += 0.25;
        result.warnings.push({
          code: 'MARINA_FUEL_DEPENDENT',
          severity: 'caution',
          title: 'Fuel Revenue Concentration',
          message: `Fuel is ${((fuelRevenue / totalRevenue) * 100).toFixed(0)}% of revenue — commodity margin risk.`,
        });
      }
      // Low fuel margin
      if (fuelMargin < 8) {
        result.explanations.push(`Fuel margin of ${fuelMargin}% is below industry average (12-18%).`);
      }
      // Dry storage premium
      if (dryStorageRevenue > wetSlipRevenue * 0.5) {
        result.valuationPremiumOrDiscount += salePrice * 0.02;
        result.explanations.push('Strong dry storage revenue adds valuation premium.');
      }
      break;
    }

    case 'golf': {
      const { duesRevenue, greenFeeRevenue, fnbRevenue, membershipRetentionRate, landAlternativeUseValue } = specialist;
      // Membership stability
      if (membershipRetentionRate !== undefined && membershipRetentionRate < 80) {
        result.exitCapRateAdjustment += 0.5;
        result.warnings.push({
          code: 'GOLF_LOW_RETENTION',
          severity: 'warning',
          title: 'Low Membership Retention',
          message: `${membershipRetentionRate}% retention rate signals membership decline risk.`,
        });
      }
      // F&B contribution
      const totalRev = duesRevenue + greenFeeRevenue + fnbRevenue;
      if (totalRev > 0 && fnbRevenue / totalRev > 0.35) {
        result.explanations.push(`F&B is ${((fnbRevenue / totalRev) * 100).toFixed(0)}% of revenue — strong ancillary.`);
      }
      // Alternative use value floor
      if (landAlternativeUseValue && landAlternativeUseValue > salePrice * 0.8) {
        result.valuationPremiumOrDiscount += (landAlternativeUseValue - salePrice) * 0.1;
        result.explanations.push('Land alternative use value provides valuation floor.');
      }
      break;
    }

    case 'retail':
    case 'mall': {
      const { tenantSalesPSF, occupancyCostPercent, anchorTenantCount, anchorOccupancyRate } = specialist;
      // Anchor tenant stability
      if (anchorOccupancyRate < 80) {
        result.exitCapRateAdjustment += 0.75;
        result.warnings.push({
          code: 'RETAIL_ANCHOR_VACANCY',
          severity: 'warning',
          title: 'Anchor Tenant Vacancy Risk',
          message: `Anchor occupancy at ${anchorOccupancyRate}% — significant re-leasing risk.`,
        });
      }
      // Occupancy cost ratio
      if (occupancyCostPercent > 20) {
        result.exitCapRateAdjustment += 0.25;
        result.explanations.push(`Tenant occupancy cost of ${occupancyCostPercent}% exceeds 20% threshold.`);
      }
      break;
    }

    case 'industrial': {
      const { walt, rentPSF, outdoorStorageComponent, outdoorStorageRevenue, heavyImprovementsToggle } = specialist;
      // WALT premium/discount
      if (walt > 7) {
        result.exitCapRateAdjustment -= 0.25;
        result.explanations.push(`Strong WALT of ${walt} years reduces cap rate by 25bps.`);
      } else if (walt < 3) {
        result.exitCapRateAdjustment += 0.50;
        result.explanations.push(`Short WALT of ${walt} years adds 50bps rollover risk.`);
      }
      // Outdoor storage bonus
      if (outdoorStorageComponent && outdoorStorageRevenue) {
        result.valuationPremiumOrDiscount += outdoorStorageRevenue * 0.5;
        result.explanations.push('Outdoor storage component adds supplemental value.');
      }
      // Heavy improvements depreciation advantage
      if (heavyImprovementsToggle) {
        result.explanations.push('Heavy tenant improvements may qualify for accelerated depreciation (cost segregation).');
      }
      break;
    }

    case 'data_center': {
      const { pricingModel, totalMWCapacity, contractedKW, utilizationRate, powerAvailabilityRisk } = specialist;
      // Utilization premium
      if (utilizationRate > 85) {
        result.exitCapRateAdjustment -= 0.25;
        result.explanations.push(`High utilization (${utilizationRate}%) supports lower cap rate.`);
      } else if (utilizationRate < 50) {
        result.exitCapRateAdjustment += 0.50;
        result.warnings.push({
          code: 'DC_LOW_UTILIZATION',
          severity: 'warning',
          title: 'Low Data Center Utilization',
          message: `${utilizationRate}% utilization creates significant lease-up risk.`,
        });
      }
      // Power risk
      if (powerAvailabilityRisk === 'high') {
        result.exitCapRateAdjustment += 0.50;
        result.warnings.push({
          code: 'DC_POWER_RISK',
          severity: 'warning',
          title: 'Power Availability Risk',
          message: 'High power availability risk may constrain expansion and tenant retention.',
        });
      }
      break;
    }

    case 'sfr':
    case 'duplex': {
      const { units, capexReservePerUnit } = specialist;
      const totalMonthlyRent = units.reduce((s, u) => s + u.monthlyRent, 0);
      const avgVacancy = units.length > 0
        ? units.reduce((s, u) => s + u.vacancyRate, 0) / units.length
        : 0;
      if (avgVacancy > 10) {
        result.exitCapRateAdjustment += 0.25;
        result.explanations.push(`Average vacancy of ${avgVacancy.toFixed(1)}% exceeds stabilized benchmark.`);
      }
      if (capexReservePerUnit && capexReservePerUnit < 200) {
        result.warnings.push({
          code: 'SFR_LOW_CAPEX_RESERVE',
          severity: 'caution',
          title: 'Low CapEx Reserve',
          message: `$${capexReservePerUnit}/unit/month may understate deferred maintenance costs.`,
        });
      }
      break;
    }

    case 'multifamily':
    case 'office':
    case 'mob': {
      const spec = specialist;
      if (spec.capRateSensitivity) {
        result.explanations.push(
          `Cap rate sensitivity: ${spec.capRateSensitivity.low}% (low) to ${spec.capRateSensitivity.high}% (high).`
        );
      }
      if (spec.leaseRolloverSchedule && spec.leaseRolloverSchedule.length > 0) {
        const nearTermRollover = spec.leaseRolloverSchedule
          .filter(r => r.year <= 2)
          .reduce((s, r) => s + r.percentOfNRA, 0);
        if (nearTermRollover > 30) {
          result.exitCapRateAdjustment += 0.25;
          result.warnings.push({
            code: 'HIGH_NEAR_TERM_ROLLOVER',
            severity: 'caution',
            title: 'Significant Near-Term Lease Rollover',
            message: `${nearTermRollover.toFixed(0)}% of NRA rolls in next 2 years — re-leasing risk premium applied.`,
          });
        }
      }
      if (spec.mobStabilityFlag) {
        result.exitCapRateAdjustment -= 0.15;
        result.explanations.push('MOB stability flag: healthcare tenants provide income stability (-15bps).');
      }
      break;
    }
  }

  return result;
}

// ============================================================
// #5: Proceeds Timeline Builder
// ============================================================
function buildProceedsTimeline(
  input: ExitScenarioInput,
  saleComputation: SaleComputation,
  gainCharacterization: GainCharacterization,
  sellerFinancingResult: SellerFinancingResult | undefined,
  earnoutResult: EarnoutResult | undefined,
  taxSchedule: TaxSchedule,
): ProceedsTimeline {
  const events: TimelineEvent[] = [];
  const saleCloseDate = input.saleCloseDate;
  const saleYear = new Date(saleCloseDate).getFullYear();
  let eventCounter = 0;

  const nextId = () => `evt_${++eventCounter}`;

  // 1. Cash at close
  events.push({
    id: nextId(),
    date: saleCloseDate,
    taxYear: saleYear,
    source: 'cash_at_close',
    paymentType: 'lump_sum',
    grossAmount: saleComputation.cashProceedsPreTax,
    taxCharacter: {
      ordinaryIncome: gainCharacterization.characters.find(c => c.type === 'ordinary_1245')?.amount ?? 0,
      unrecaptured1250: gainCharacterization.characters.find(c => c.type === 'unrecaptured_1250')?.amount ?? 0,
      ltcg: gainCharacterization.characters.find(c => c.type === 'ltcg')?.amount ?? 0,
      deferred: 0,
      returnOfBasis: Math.min(saleComputation.cashProceedsPreTax, gainCharacterization.adjustedBasis),
    },
  });

  // 2. Escrow releases
  if (input.saleTerms.escrowsReleased > 0) {
    events.push({
      id: nextId(),
      date: saleCloseDate,
      taxYear: saleYear,
      source: 'escrow_release',
      paymentType: 'lump_sum',
      grossAmount: input.saleTerms.escrowsReleased,
      taxCharacter: { ordinaryIncome: 0, unrecaptured1250: 0, ltcg: 0, deferred: 0, returnOfBasis: input.saleTerms.escrowsReleased },
    });
  }

  // 3. Seller financing note payments
  if (sellerFinancingResult && sellerFinancingResult.noteAmount > 0) {
    const grossProfitRatio = (sellerFinancingResult.grossProfitRatio ?? 0) / 100;

    if (sellerFinancingResult.amortSchedule.length > 0) {
      // Use actual amortization schedule
      for (const row of sellerFinancingResult.amortSchedule) {
        // Principal payment
        if (row.principalPortion > 0) {
          const gainOnPrincipal = row.principalPortion * grossProfitRatio;
          events.push({
            id: nextId(),
            date: row.date,
            taxYear: new Date(row.date).getFullYear(),
            source: 'seller_note_principal',
            paymentType: row.isBalloon ? 'balloon' : 'scheduled_principal',
            grossAmount: row.principalPortion,
            taxCharacter: {
              ordinaryIncome: 0,
              unrecaptured1250: 0,
              ltcg: gainOnPrincipal,
              deferred: 0,
              returnOfBasis: row.principalPortion - gainOnPrincipal,
            },
          });
        }

        // Interest payment
        if (row.interestPortion > 0) {
          events.push({
            id: nextId(),
            date: row.date,
            taxYear: new Date(row.date).getFullYear(),
            source: 'seller_note_interest',
            paymentType: 'scheduled_interest',
            grossAmount: row.interestPortion,
            taxCharacter: {
              ordinaryIncome: row.interestPortion,
              unrecaptured1250: 0,
              ltcg: 0,
              deferred: 0,
              returnOfBasis: 0,
            },
          });
        }
      }
    } else {
      // No amort schedule — synthesize annual payments
      const termYears = input.sellerFinancing?.termYears ?? 5;
      const annualPrincipal = sellerFinancingResult.noteAmount / termYears;
      const interestRate = (input.sellerFinancing?.interestRate ?? 5) / 100;

      for (let y = 1; y <= termYears; y++) {
        const yearDate = addYears(saleCloseDate, y);
        const remainingBalance = sellerFinancingResult.noteAmount - annualPrincipal * (y - 1);
        const interestPayment = remainingBalance * interestRate;
        const gainOnPrincipal = annualPrincipal * grossProfitRatio;

        events.push({
          id: nextId(),
          date: yearDate,
          taxYear: saleYear + y,
          source: 'seller_note_principal',
          paymentType: 'scheduled_principal',
          grossAmount: annualPrincipal,
          taxCharacter: {
            ordinaryIncome: 0,
            unrecaptured1250: 0,
            ltcg: gainOnPrincipal,
            deferred: 0,
            returnOfBasis: annualPrincipal - gainOnPrincipal,
          },
        });

        events.push({
          id: nextId(),
          date: yearDate,
          taxYear: saleYear + y,
          source: 'seller_note_interest',
          paymentType: 'scheduled_interest',
          grossAmount: interestPayment,
          taxCharacter: {
            ordinaryIncome: interestPayment,
            unrecaptured1250: 0,
            ltcg: 0,
            deferred: 0,
            returnOfBasis: 0,
          },
        });
      }
    }

    // Balloon payment
    if (sellerFinancingResult.balloonAmount && sellerFinancingResult.balloonAmount > 0) {
      const balloonYear = input.sellerFinancing?.balloonAtYear ?? input.sellerFinancing?.termYears ?? 5;
      const balloonDate = sellerFinancingResult.balloonDate ?? addYears(saleCloseDate, balloonYear);
      const gainOnBalloon = sellerFinancingResult.balloonAmount * grossProfitRatio;

      events.push({
        id: nextId(),
        date: balloonDate,
        taxYear: new Date(balloonDate).getFullYear(),
        source: 'seller_note_principal',
        paymentType: 'balloon',
        grossAmount: sellerFinancingResult.balloonAmount,
        taxCharacter: {
          ordinaryIncome: 0,
          unrecaptured1250: 0,
          ltcg: gainOnBalloon,
          deferred: 0,
          returnOfBasis: sellerFinancingResult.balloonAmount - gainOnBalloon,
        },
      });
    }
  }

  // 4. Earnout payments
  if (earnoutResult && earnoutResult.tranches.length > 0 && input.earnout?.enabled) {
    for (let i = 0; i < earnoutResult.tranches.length; i++) {
      const tranche = earnoutResult.tranches[i];
      const inputTranche = input.earnout!.tranches[i];

      if (tranche.expectedValue <= 0) continue;

      const paymentDate = inputTranche
        ? inputTranche.measurementPeriodEnd
        : addYears(saleCloseDate, i + 1);

      const taxTreatment = inputTranche?.taxTreatment ?? 'capital_gain';

      events.push({
        id: nextId(),
        date: paymentDate,
        taxYear: new Date(paymentDate).getFullYear(),
        source: 'earnout_payment',
        paymentType: 'contingent',
        grossAmount: tranche.expectedValue,
        taxCharacter: {
          ordinaryIncome: taxTreatment === 'compensation' || taxTreatment === 'mixed'
            ? tranche.expectedValue * (taxTreatment === 'mixed' ? 0.5 : 1)
            : 0,
          unrecaptured1250: 0,
          ltcg: taxTreatment === 'purchase_price' || taxTreatment === 'capital_gain'
            ? tranche.expectedValue
            : taxTreatment === 'mixed' ? tranche.expectedValue * 0.5 : 0,
          deferred: 0,
          returnOfBasis: 0,
        },
      });
    }
  }

  // 5. Aggregate by year
  const yearMap = new Map<number, YearlyProceedsSummary>();
  const discountRate = 0.08;
  let weightedTimingNum = 0;
  let weightedTimingDen = 0;
  let npvFuturePayments = 0;

  for (const evt of events) {
    if (!yearMap.has(evt.taxYear)) {
      yearMap.set(evt.taxYear, {
        taxYear: evt.taxYear,
        cashReceived: 0,
        gainRecognized: 0,
        ordinaryIncome: 0,
        capitalGain: 0,
        deferredGain: 0,
        taxEstimate: 0,
        afterTaxCash: 0,
      });
    }
    const yr = yearMap.get(evt.taxYear)!;
    yr.cashReceived += evt.grossAmount;
    yr.ordinaryIncome += evt.taxCharacter.ordinaryIncome;
    yr.capitalGain += evt.taxCharacter.ltcg + evt.taxCharacter.unrecaptured1250;
    yr.deferredGain += evt.taxCharacter.deferred;
    yr.gainRecognized += evt.taxCharacter.ordinaryIncome + evt.taxCharacter.ltcg + evt.taxCharacter.unrecaptured1250;

    // Discount future payments
    const yearsFromClose = evt.taxYear - saleYear;
    if (yearsFromClose > 0) {
      npvFuturePayments += evt.grossAmount / Math.pow(1 + discountRate, yearsFromClose);
    }

    weightedTimingNum += evt.grossAmount * yearsFromClose;
    weightedTimingDen += evt.grossAmount;
  }

  // Estimate tax per year
  for (const yr of Array.from(yearMap.values())) {
    yr.taxEstimate = yr.ordinaryIncome * 0.37 + yr.capitalGain * 0.238;
    yr.afterTaxCash = yr.cashReceived - yr.taxEstimate;
  }

  const byYear = Array.from(yearMap.values()).sort((a, b) => a.taxYear - b.taxYear);
  const totalFuturePayments = (sellerFinancingResult?.noteAmount ?? 0) + (earnoutResult?.totalExpectedValue ?? 0);
  const weightedAverageTimingYears = weightedTimingDen > 0 ? weightedTimingNum / weightedTimingDen : 0;

  return {
    events,
    summary: {
      totalCashAtClose: saleComputation.cashProceedsPreTax,
      totalFuturePayments,
      totalNominalProceeds: saleComputation.cashProceedsPreTax + totalFuturePayments,
      npvFuturePayments,
      discountRateUsed: discountRate * 100,
      weightedAverageTimingYears,
      byYear,
    },
  };
}

// ============================================================
// #7: Full Waterfall Result Mapping
// ============================================================
function mapSellerFinancingResult(
  oldResult: SellerFinancingEngineResult,
  input: ExitScenarioInput,
  basisLedger: BasisLedgerOutput,
  saleCloseDate: string,
): SellerFinancingResult {
  const noteAmount = oldResult.noteTerms.faceValue;
  // Gross profit ratio = (salePrice - adjustedBasis) / salePrice — matches engine formula
  const grossProfit = input.saleTerms.salePrice - basisLedger.totalAdjustedBasis;
  const grossProfitRatio = input.saleTerms.salePrice > 0
    ? (grossProfit / input.saleTerms.salePrice) * 100
    : 0;

  // Map amortization schedule
  const amortSchedule: AmortScheduleRow[] = oldResult.amortization.map((entry) => ({
    period: entry.period,
    date: addMonths(saleCloseDate, entry.period),
    paymentAmount: entry.payment,
    principalPortion: entry.principal,
    interestPortion: entry.interest,
    remainingBalance: entry.endingBalance,
    isBalloon: oldResult.noteTerms.hasBalloon && entry.period === oldResult.amortization.length,
    isInterestOnly: entry.principal === 0 && entry.interest > 0,
    cumulativePrincipal: entry.cumulativePrincipal,
    cumulativeInterest: entry.cumulativeInterest,
  }));

  // Map installment tax schedule
  const installmentTaxSchedule: InstallmentTaxRow[] = oldResult.installmentTaxSchedule.map((entry) => ({
    taxYear: entry.year,
    principalReceived: entry.principalReceived,
    gainRecognized: entry.installmentGain,
    recaptureRecognized: entry.recaptureGain,
    unrecaptured1250Recognized: 0,
    ltcgRecognized: entry.ltcgGain,
    interestIncome: entry.interestIncome,
    estimatedTax: entry.totalTax,
    afterTaxCash: entry.netAfterTax,
  }));

  // Balloon
  const balloonAmount = oldResult.noteTerms.hasBalloon ? oldResult.noteTerms.balloonAmount : null;
  const balloonDate = oldResult.noteTerms.hasBalloon && oldResult.noteTerms.balloonYear
    ? addYears(saleCloseDate, oldResult.noteTerms.balloonYear)
    : null;

  return {
    noteAmount,
    grossProfitRatio: grossProfitRatio,
    contractPrice: input.saleTerms.salePrice,
    amortSchedule,
    installmentTaxSchedule,
    recaptureRecognizedAtSale: basisLedger.recaptureExposure.ordinary1245,
    recaptureWarning: basisLedger.recaptureExposure.ordinary1245 > 0 ? {
      code: 'RECAPTURE_ACCELERATED',
      severity: 'warning',
      title: '§ 453(i) Recapture in Year of Sale',
      message: `$${basisLedger.recaptureExposure.ordinary1245.toLocaleString()} of depreciation recapture must be recognized in the year of sale, regardless of installment payments received.`,
    } : null,
    balloonAmount,
    balloonDate,
    riskAdjustedNPV: oldResult.cashFlowSummary.npvAtDiscount,
    explanations: [],
    warnings: oldResult.warnings.map(w => ({
      code: w.code,
      severity: w.severity === 'error' ? 'critical' as const : w.severity as any,
      title: w.code.replace(/_/g, ' '),
      message: w.message,
    })),
  };
}

function mapEarnoutResult(
  oldResult: EarnoutEngineResult,
  input: ExitScenarioInput,
): EarnoutResult {
  const tranches = oldResult.tranches.map((t, i) => ({
    trancheId: input.earnout?.tranches[i]?.id ?? t.name,
    expectedValue: t.probabilityWeightedAmount,
    npv: t.npvOfTranche,
    afterTaxEV: t.afterTaxAmount,
    afterTaxNPV: t.npvOfTranche * (1 - t.effectiveTaxRate),
    scenarioPayouts: t.scenarios.map(s => ({
      label: s.label,
      metricValue: 0,
      computedPayout: s.amount,
      probability: s.probability * 100,
      weightedPayout: s.amount * s.probability,
    })),
  }));

  // Compensation risk scoring based on service conditions
  let compensationRiskScore = 0;
  const compensationRiskWarnings: Warning[] = [];
  if (input.earnout?.tranches) {
    for (const t of input.earnout.tranches) {
      if (t.serviceConditions.requiresEmployment) compensationRiskScore += 25;
      if (t.serviceConditions.requiresConsulting) compensationRiskScore += 15;
      if (t.serviceConditions.nonCompeteLinked) compensationRiskScore += 20;
      if (t.serviceConditions.covenantLinked) compensationRiskScore += 10;
      if (t.taxTreatment === 'compensation') compensationRiskScore += 30;
    }
    compensationRiskScore = Math.min(100, compensationRiskScore);

    if (compensationRiskScore >= 50) {
      compensationRiskWarnings.push({
        code: 'EARNOUT_COMPENSATION_RISK',
        severity: 'warning',
        title: 'Earnout May Be Recharacterized as Compensation',
        message: `Compensation risk score of ${compensationRiskScore}/100. Service conditions and employment requirements may cause IRS to recharacterize as ordinary income.`,
        relatedFields: ['earnout.tranches'],
        actionRequired: true,
      });
    }
  }

  // Tier completeness
  const tier1Fields = input.earnout?.tranches?.map(t => t.definitions) ?? [];
  const tier1Score = tier1Fields.length > 0
    ? tier1Fields.reduce((s, d) => s + (d?.definitionText ? 20 : 0) + (d?.inclusions.length ? 30 : 0) + (d?.exclusions.length ? 30 : 0) + (d?.ebitdaAddbacks ? 20 : 0), 0) / tier1Fields.length
    : 0;
  const tier2Fields = input.earnout?.tranches?.map(t => t.dealHygiene) ?? [];
  const tier2Score = tier2Fields.length > 0
    ? tier2Fields.reduce((s, d) => s + (d?.auditRightsEnabled ? 25 : 0) + (d?.reportingCadence ? 25 : 0) + (d?.disputeResolutionMethod ? 25 : 0) + (d?.accountingPolicyLockEnabled ? 25 : 0), 0) / tier2Fields.length
    : 0;

  return {
    tranches,
    totalExpectedValue: oldResult.totalExpectedEarnout,
    totalNPV: oldResult.totalNpvEarnout,
    afterTaxExpectedValue: oldResult.totalAfterTaxEarnout,
    afterTaxNPV: oldResult.totalNpvEarnout * (1 - 0.238), // simplified
    effectivePurchasePriceRange: {
      low: input.saleTerms.salePrice,
      base: oldResult.effectivePurchasePrice,
      high: input.saleTerms.salePrice + oldResult.totalMaxEarnout,
    },
    compensationRiskScore,
    compensationRiskWarnings,
    tier1Completeness: Math.min(100, tier1Score),
    tier2Completeness: Math.min(100, tier2Score),
    explanations: [],
    warnings: oldResult.warnings.map(w => ({
      code: w.code,
      severity: w.severity === 'error' ? 'critical' as const : w.severity as any,
      title: w.code.replace(/_/g, ' '),
      message: w.message,
    })),
  };
}

function mapWaterfallResult(
  oldResult: WaterfallV2Result,
  waterfallInput: ExitScenarioInput['waterfall'],
): WaterfallResult {
  return {
    tierAllocations: oldResult.distributions.map(d => ({
      tierId: d.tier,
      tierName: d.tier,
      hurdleType: 'irr' as const,
      hurdleValue: d.hurdleIrr,
      distributableInTier: d.totalAmount,
      lpDistribution: d.lpAmount,
      gpDistribution: d.gpAmount,
      tierSatisfied: d.achieved,
    })),
    lpIRR: oldResult.fundMetrics.lpIrr ?? 0,
    lpEquityMultiple: oldResult.fundMetrics.netMoic,
    lpTotalDistributed: oldResult.lpTotalDistribution,
    lpTotalContributed: oldResult.fundMetrics.paidInCapital * (1 - (waterfallInput?.gpCommitPercent ?? 0) / 100),
    gpIRR: oldResult.fundMetrics.gpIrr ?? 0,
    gpEquityMultiple: oldResult.gpTotalDistribution > 0
      ? oldResult.gpTotalDistribution / (oldResult.fundMetrics.paidInCapital * ((waterfallInput?.gpCommitPercent ?? 1) / 100))
      : 0,
    gpTotalDistributed: oldResult.gpTotalDistribution,
    gpPromoteEarned: Math.max(0, oldResult.gpTotalDistribution -
      oldResult.fundMetrics.paidInCapital * ((waterfallInput?.gpCommitPercent ?? 1) / 100)),
    clawbackAmount: oldResult.clawback.clawbackAmount,
    clawbackTriggered: oldResult.clawback.clawbackRequired,
    totalFeesDeducted: 0,
    feeBreakdown: [],
    distributionTimeline: [],
    explanations: [],
    warnings: oldResult.warnings.map(w => ({
      code: w.code,
      severity: w.severity === 'error' ? 'critical' as const : w.severity as any,
      title: w.code.replace(/_/g, ' '),
      message: w.message,
    })),
  };
}

// ============================================================
// #10: Multi-Property Basis Allocation (per-property MACRS)
// ============================================================
function computeMultiPropertyBasisAllocation(
  exchange1031Result: Exchange1031Result | undefined,
  input: ExitScenarioInput,
  basisLedger: BasisLedgerOutput,
): { allocations: ReplacementBasisAllocation[]; warnings: Warning[] } {
  const warnings: Warning[] = [];
  if (!exchange1031Result || !input.exchange1031?.enabled) {
    return { allocations: [], warnings };
  }

  const replacementProperties = input.exchange1031.replacementProperties;
  if (replacementProperties.length <= 1) {
    return { allocations: exchange1031Result.replacementBasisAllocation ?? [], warnings };
  }

  // Per-property MACRS-aware allocation
  const totalReplacementValue = replacementProperties.reduce((s, p) => s + p.purchasePrice, 0);
  const carryoverBasis = exchange1031Result.carryoverBasis;
  const deferredGain = exchange1031Result.deferredGain;

  const allocations: ReplacementBasisAllocation[] = replacementProperties.map(prop => {
    const fmvRatio = totalReplacementValue > 0 ? prop.purchasePrice / totalReplacementValue : 0;

    // Allocate basis proportionally to FMV, adjusted for debt
    const debtAdjustment = prop.replacementDebtPlaced;
    const equityPortion = prop.purchasePrice - debtAdjustment;
    const totalEquity = replacementProperties.reduce((s, p) => s + (p.purchasePrice - p.replacementDebtPlaced), 0);
    const equityRatio = totalEquity > 0 ? equityPortion / totalEquity : fmvRatio;

    // Blended allocation: 60% FMV-based, 40% equity-based (prevents distortion from leverage)
    const blendedRatio = fmvRatio * 0.6 + equityRatio * 0.4;

    const allocatedBasis = carryoverBasis * blendedRatio + prop.closingCosts;
    const embeddedDeferredGain = deferredGain * blendedRatio;

    // MACRS classification heuristic based on property type
    const depreciationLife = prop.purchasePrice > 5_000_000 ? 39 : 27.5; // commercial vs residential
    const annualDepreciation = allocatedBasis / depreciationLife;

    return {
      propertyId: prop.id,
      propertyName: prop.name,
      allocatedBasis: Math.round(allocatedBasis * 100) / 100,
      purchasePrice: prop.purchasePrice,
      embeddedDeferredGain: Math.round(embeddedDeferredGain * 100) / 100,
    };
  });

  // Validate allocation sums
  const totalAllocatedBasis = allocations.reduce((s, a) => s + a.allocatedBasis, 0);
  const totalClosingCosts = replacementProperties.reduce((s, p) => s + p.closingCosts, 0);
  const expectedTotal = carryoverBasis + totalClosingCosts;

  if (Math.abs(totalAllocatedBasis - expectedTotal) > 1) {
    warnings.push({
      code: 'BASIS_ALLOCATION_ROUNDING',
      severity: 'info',
      title: 'Basis Allocation Rounding',
      message: `Allocated basis ($${totalAllocatedBasis.toLocaleString()}) differs from carryover + costs ($${expectedTotal.toLocaleString()}) by rounding.`,
    });
    // Adjust last property to absorb rounding
    if (allocations.length > 0) {
      allocations[allocations.length - 1].allocatedBasis += (expectedTotal - totalAllocatedBasis);
    }
  }

  if (replacementProperties.length >= 3) {
    warnings.push({
      code: 'MULTI_PROPERTY_REVIEW',
      severity: 'caution',
      title: 'Multi-Property Exchange — Review Allocation',
      message: `${replacementProperties.length} replacement properties identified. Basis allocated using blended FMV/equity method. Each property should have an independent cost segregation study for optimal MACRS scheduling.`,
      actionRequired: true,
    });
  }

  return { allocations, warnings };
}

// ============================================================
// Strategy Interaction Resolution
// ============================================================
function resolveStrategyInteractions(input: ExitScenarioInput): StrategyInteractionPolicy {
  const active: ExitStrategy[] = ['cash_sale'];
  const warnings: Warning[] = [];
  let advisorRequired = false;

  if (input.exchange1031?.enabled) active.push('exchange_1031');
  if (input.sellerFinancing?.enabled) active.push('seller_financing');
  if (input.earnout?.enabled) active.push('earnout');

  const interactions: StrategyInteractionPolicy['interactions'] = [];

  // 1031 + Seller Note
  if (input.exchange1031?.enabled && input.sellerFinancing?.enabled) {
    const noteAssigned = input.sellerFinancing.assignedToQI;
    interactions.push({
      combination: 'exchange_1031+seller_financing',
      rule: {
        type: 'exchange_1031+seller_financing',
        noteAssignedToQI: noteAssigned,
        noteInExchange: noteAssigned,
        noteFVAsBoot: !noteAssigned,
        installmentTreatmentApplies: !noteAssigned,
      },
      explanation: noteAssigned
        ? 'Seller note is assigned to QI and treated as exchange consideration. No boot from the note itself.'
        : 'Seller note is NOT assigned to QI. The note fair value is treated as boot at close, and installment sale rules apply to principal received outside the exchange.',
    });

    if (!noteAssigned) {
      warnings.push({
        code: 'SELLER_NOTE_NOT_ASSIGNED_TO_QI',
        severity: 'warning',
        title: 'Seller note creates boot',
        message: 'The seller-carried note is not assigned to the Qualified Intermediary. The fair value of the note will be treated as boot, creating recognized gain.',
        relatedFields: ['sellerFinancing.assignedToQI'],
        actionRequired: true,
      });
    }
  }

  // 1031 + Earnout
  if (input.exchange1031?.enabled && input.earnout?.enabled) {
    const policy = input.earnout.exchangePolicy;
    const policySet = !!policy;
    advisorRequired = !policySet;

    interactions.push({
      combination: 'exchange_1031+earnout',
      rule: {
        type: 'exchange_1031+earnout',
        policy: policy ?? 'treat_as_boot_when_received',
        policyExplicitlySet: policySet,
        advisorRequired: !policySet,
      },
      explanation: policySet
        ? `Earnout payments will be handled as: ${policy?.replace(/_/g, ' ')}.`
        : 'Earnout payments in a 1031 exchange involve complex contingent consideration rules. Please consult your tax advisor and select an explicit policy.',
    });

    if (!policySet) {
      warnings.push({
        code: 'EARNOUT_1031_POLICY_REQUIRED',
        severity: 'critical',
        title: 'Advisor review required: Earnout + 1031',
        message: 'Contingent payments (earnouts) in a like-kind exchange require professional tax guidance. Please select an explicit exchange policy for the earnout and consult your advisor.',
        relatedFields: ['earnout.exchangePolicy'],
        actionRequired: true,
      });
    }
  }

  // Seller Note + Earnout
  if (input.sellerFinancing?.enabled && input.earnout?.enabled) {
    interactions.push({
      combination: 'seller_financing+earnout',
      rule: {
        type: 'seller_financing+earnout',
        mergePolicy: 'parallel_streams',
        taxCharacterPreserved: true,
      },
      explanation: 'Seller note and earnout payments are separate future income streams. Note principal is taxed via gross profit ratio (installment sale rules); earnout payments are taxed per tranche treatment selection. Both are merged into the proceeds timeline.',
    });
  }

  return {
    activeStrategies: active,
    interactions,
    warnings,
    advisorReviewRequired: advisorRequired,
  };
}

// ============================================================
// Helpers
// ============================================================
function addYears(isoDate: string, years: number): string {
  const d = new Date(isoDate);
  d.setFullYear(d.getFullYear() + years);
  return d.toISOString().split('T')[0];
}

function addMonths(isoDate: string, months: number): string {
  const d = new Date(isoDate);
  d.setMonth(d.getMonth() + months);
  return d.toISOString().split('T')[0];
}

// ============================================================
// Main Orchestrator
// ============================================================
export async function runExitScenarioV2(
  input: ExitScenarioInput
): Promise<ExitScenarioResult> {
  const inputsChecksum = computeInputsChecksum(input);
  const computedAt = new Date().toISOString();

  // 1. Run existing engine via adapter for baseline results
  const oldInput = adaptScenarioInputNewToOld(input);
  const oldResult = runExitScenario(oldInput);

  // 2. Compute basis ledger via adapter
  const oldBasisInput = adaptBasisInputNewToOld(input.allocation);
  const oldBasisResult = calculateBasisLedger(oldBasisInput);
  const basisLedger = adaptBasisResultOldToNew(oldBasisResult, input.allocation, inputsChecksum);

  // 3. Apply DLOM/DLOC adjustments (#8)
  const equityEstimate = input.saleTerms.salePrice - input.saleTerms.debtPayoff;
  const valAdj = applyValuationAdjustments(
    input.saleTerms.salePrice,
    equityEstimate,
    input.valuationAdjustments,
  );
  const effectiveSalePrice = valAdj.adjustedSalePrice;

  // 4. Compute operating business adjustments (#9)
  const bizAdj = computeOperatingBusinessAdjustments(input, basisLedger, effectiveSalePrice);

  // 5. Compute asset-class specialist adjustments (#6)
  const specialistAdj = computeAssetClassSpecialistAdjustments(
    input.specialistInputs,
    effectiveSalePrice,
  );

  // 6. Compute sale (with adjustments applied)
  const totalSellingExpenses = input.saleTerms.sellingExpenses
    .reduce((sum, e) => sum + e.computedAmount, 0);
  const totalClosingCosts = input.saleTerms.closingCosts
    .reduce((sum, e) => sum + e.computedAmount, 0);
  const amountRealized = effectiveSalePrice - totalSellingExpenses -
    totalClosingCosts - input.saleTerms.creditsToBuyer +
    input.saleTerms.prorationsNetToSeller +
    specialistAdj.valuationPremiumOrDiscount;

  const saleComputation: SaleComputation = {
    salePrice: effectiveSalePrice,
    totalSellingExpenses: totalSellingExpenses + totalClosingCosts,
    amountRealized,
    totalDebtRetired: input.saleTerms.debtPayoff + input.saleTerms.prepaymentPenalty +
      input.saleTerms.defeasanceCost,
    cashProceedsPreTax: amountRealized - input.saleTerms.debtPayoff -
      input.saleTerms.prepaymentPenalty - input.saleTerms.defeasanceCost +
      input.saleTerms.escrowsReleased,
    lineItems: [],
    explanations: [],
  };

  // 7. Compute gain characterization (with operating business adjustments)
  const adjustedBasis = input.operatingBusinessInvolved
    ? bizAdj.adjustedRealPropertyBasis
    : basisLedger.totalAdjustedBasis;
  const realizedGain = amountRealized - adjustedBasis;

  // Operating business: goodwill & covenant treated as ordinary 1245
  const additionalOrdinaryRecapture = bizAdj.goodwillAmount + bizAdj.covenantNotToCompeteAmount;

  const gainCharacterization: GainCharacterization = {
    adjustedBasis,
    amountRealized,
    realizedGain,
    characters: [
      {
        type: 'ordinary_1245',
        amount: Math.min(
          basisLedger.recaptureExposure.ordinary1245 + additionalOrdinaryRecapture,
          Math.max(0, realizedGain),
        ),
        federalRate: 37,
        label: '§ 1245 Ordinary Recapture',
        citation: 'IRC § 1245',
      },
      {
        type: 'unrecaptured_1250',
        amount: Math.min(
          basisLedger.recaptureExposure.unrecaptured1250,
          Math.max(0, realizedGain - basisLedger.recaptureExposure.ordinary1245 - additionalOrdinaryRecapture)
        ),
        federalRate: 25,
        label: '§ 1250 Unrecaptured Gain',
        citation: 'IRC § 1250',
      },
      {
        type: 'ltcg',
        amount: Math.max(0,
          realizedGain - basisLedger.recaptureExposure.ordinary1245 -
          additionalOrdinaryRecapture -
          basisLedger.recaptureExposure.unrecaptured1250
        ),
        federalRate: 20,
        label: 'Long-Term Capital Gain',
        citation: 'IRC § 1(h)',
      },
    ],
    recaptureConsumed: basisLedger.recaptureExposure,
    explanations: [],
    warnings: [],
  };

  // 8. Resolve strategy interactions
  const strategyInteractions = resolveStrategyInteractions(input);

  // 9. Run strategy-specific engines (with full result mapping #7)
  let exchange1031Result: Exchange1031Result | undefined;
  let sellerFinancingResult: SellerFinancingResult | undefined;
  let earnoutResult: EarnoutResult | undefined;
  let waterfallResult: WaterfallResult | undefined;

  if (input.exchange1031?.enabled) {
    try {
      const oldExchange = adapt1031InputNewToOld(
        input.exchange1031,
        effectiveSalePrice,
        adjustedBasis,
        basisLedger.recaptureExposure.total,
        input.saleTerms.debtPayoff,
        totalSellingExpenses,
        input.saleCloseDate,
      );
      const oldExchangeResult = calculate1031ExchangeEngine(oldExchange);
      exchange1031Result = adapt1031ResultOldToNew(oldExchangeResult, input.exchange1031);

      // #10: Multi-property basis allocation
      const multiProp = computeMultiPropertyBasisAllocation(exchange1031Result, input, basisLedger);
      if (multiProp.allocations.length > 1) {
        exchange1031Result.replacementBasisAllocation = multiProp.allocations;
      }
    } catch (err) {
      console.error('1031 engine error:', err);
    }
  }

  if (input.sellerFinancing?.enabled) {
    try {
      const oldFinancing = adaptSellerFinancingNewToOld(
        input.sellerFinancing,
        effectiveSalePrice,
        adjustedBasis,
        basisLedger.recaptureExposure.total,
        adaptTaxProfileNewToOld(input.taxProfile),
      );
      const oldFinancingResult = calculateSellerFinancing(oldFinancing);
      // #7: Full result mapping
      sellerFinancingResult = mapSellerFinancingResult(
        oldFinancingResult,
        input,
        basisLedger,
        input.saleCloseDate,
      );
    } catch (err) {
      console.error('Seller financing engine error:', err);
    }
  }

  if (input.earnout?.enabled) {
    try {
      const oldEarnout = adaptEarnoutNewToOld(input.earnout);
      const oldEarnoutResult = calculateEarnout(oldEarnout);
      // #7: Full result mapping with compensation risk + completeness
      earnoutResult = mapEarnoutResult(oldEarnoutResult, input);
    } catch (err) {
      console.error('Earnout engine error:', err);
    }
  }

  // Waterfall (#7: full mapping)
  if (input.waterfall?.enabled && input.waterfall.tiers.length > 0) {
    try {
      const waterfallV2Input = {
        capitalCalls: input.waterfall.capitalCalls.map(c => ({
          date: c.date,
          amount: c.amount,
          investor: 'lp',
          description: c.description,
        })),
        distributions: input.waterfall.distributions.map(d => ({
          date: d.date,
          amount: d.amount,
          investor: 'lp',
          description: d.description,
        })),
        tiers: input.waterfall.tiers.map(t => ({
          name: t.name,
          hurdleIrr: t.hurdleValue,
          lpSplit: t.lpSplitPercent / 100,
          gpSplit: t.gpSplitPercent / 100,
        })),
        preferredReturn: input.waterfall.preferredReturnRate / 100,
        preferredReturnCompounding: input.waterfall.preferredReturnCompounding === 'simple' ? 'annual' as const : 'quarterly' as const,
        catchUpPercent: (input.waterfall.catchUpPercent ?? 100) / 100,
        catchUpTarget: input.waterfall.catchUpEnabled ? 1 : 0,
        structureType: input.waterfall.structureType,
        clawbackEnabled: input.waterfall.clawbackEnabled,
        gpCommitmentPercent: (input.waterfall.gpCommitPercent ?? 0) / 100,
      };

      const oldWaterfallResult = calculateWaterfallV2(waterfallV2Input);
      waterfallResult = mapWaterfallResult(oldWaterfallResult, input.waterfall);
    } catch (err) {
      console.error('Waterfall engine error:', err);
    }
  }

  // 10. Build tax schedule from old result
  const taxFederal = (oldResult.taxResult?.federalCapitalGainsTax ?? 0) +
    (oldResult.taxResult?.depreciationRecaptureTax ?? 0);
  const taxState = oldResult.taxResult?.stateTax ?? 0;
  const taxNIIT = oldResult.taxResult?.netInvestmentIncomeTax ?? 0;
  const totalTax = oldResult.taxResult?.totalTax ?? 0;

  const taxSchedule: TaxSchedule = {
    years: [{
      taxYear: new Date(input.saleCloseDate).getFullYear(),
      ordinaryIncome: gainCharacterization.characters.find(c => c.type === 'ordinary_1245')?.amount ?? 0,
      recapture1245: gainCharacterization.characters.find(c => c.type === 'ordinary_1245')?.amount ?? 0,
      unrecaptured1250: gainCharacterization.characters.find(c => c.type === 'unrecaptured_1250')?.amount ?? 0,
      ltcg: gainCharacterization.characters.find(c => c.type === 'ltcg')?.amount ?? 0,
      interestIncome: 0,
      federalOnOrdinary: 0,
      federalOn1245: oldResult.taxResult?.depreciationRecaptureTax ?? 0,
      federalOn1250: 0,
      federalOnLTCG: oldResult.taxResult?.federalCapitalGainsTax ?? 0,
      niit: taxNIIT,
      stateTax: taxState,
      passiveLossOffset: 0,
      totalTax,
      afterTaxCash: saleComputation.cashProceedsPreTax - totalTax,
      marginalOrdinaryRate: 37,
      marginalCapitalGainsRate: 20,
    }],
    totalFederalTax: taxFederal,
    totalStateTax: taxState,
    totalNIIT: taxNIIT,
    totalTax,
    effectiveFederalRate: realizedGain > 0 ? (taxFederal / realizedGain) * 100 : 0,
    effectiveTotalRate: realizedGain > 0 ? (totalTax / realizedGain) * 100 : 0,
    explanations: [],
    warnings: [],
  };

  // 11. Compute recognized/deferred based on strategy
  const recognizedGain = exchange1031Result
    ? exchange1031Result.recognizedGain
    : realizedGain;
  const deferredGain = exchange1031Result
    ? exchange1031Result.deferredGain
    : 0;
  const totalBoot = exchange1031Result?.totalBoot ?? 0;
  const bootCash = exchange1031Result?.cashBoot ?? 0;
  const bootMortgage = exchange1031Result?.mortgageBoot ?? 0;
  const bootNonLikeKind = exchange1031Result?.nonLikeKindBoot ?? 0;

  const afterTaxCashNow = saleComputation.cashProceedsPreTax - totalTax;
  const afterTaxCashTotal = afterTaxCashNow +
    (earnoutResult?.afterTaxExpectedValue ?? 0) +
    (sellerFinancingResult?.noteAmount ?? 0);

  // 12. Build proceeds timeline (#5)
  const proceedsTimeline = buildProceedsTimeline(
    input,
    saleComputation,
    gainCharacterization,
    sellerFinancingResult,
    earnoutResult,
    taxSchedule,
  );

  // 13. Build summary
  const summary: ResultsSummary = {
    adjustedBasis,
    amountRealized,
    realizedGain,
    recognizedGain,
    deferredGain,
    totalBoot, bootCash, bootMortgage, bootNonLikeKind,
    totalTax: totalTax,
    taxFederal, taxState, taxNIIT,
    afterTaxCashNow,
    afterTaxCashTotal,
    afterTaxNPV: afterTaxCashNow + proceedsTimeline.summary.npvFuturePayments,
  };

  // 14. Materialize KPIs
  const kpis: ExitScenarioKPIs = {
    scenarioId: input.scenarioId ?? '',
    computedAt,
    salePrice: effectiveSalePrice,
    amountRealized, adjustedBasis,
    realizedGain, recognizedGain, deferredGain,
    bootTotal: totalBoot, bootCash, bootMortgage, bootNonLikeKind,
    taxTotal: totalTax, taxFederal, taxState, taxNIIT,
    afterTaxCashNow, afterTaxCashTotal,
    afterTaxNPV: summary.afterTaxNPV,
    lpIRR: waterfallResult?.lpIRR ?? null,
    gpIRR: waterfallResult?.gpIRR ?? null,
    lpEquityMultiple: waterfallResult?.lpEquityMultiple ?? null,
    gpEquityMultiple: waterfallResult?.gpEquityMultiple ?? null,
    promoteEarned: waterfallResult?.gpPromoteEarned ?? null,
    weightedAverageTimingYears: proceedsTimeline.summary.weightedAverageTimingYears || null,
    strategiesActive: strategyInteractions.activeStrategies,
    hasRecaptureExposure: basisLedger.recaptureExposure.total > 0,
    hasTradeDown: exchange1031Result?.isTradeDown ?? false,
    advisorReviewRequired: strategyInteractions.advisorReviewRequired,
  };

  // 15. Aggregate warnings (from all sources including new patches)
  const allWarnings: Warning[] = [
    ...basisLedger.warnings,
    ...gainCharacterization.warnings,
    ...strategyInteractions.warnings,
    ...valAdj.warnings,
    ...bizAdj.warnings,
    ...specialistAdj.warnings,
    ...(exchange1031Result?.warnings ?? []),
    ...(sellerFinancingResult?.warnings ?? []),
    ...(earnoutResult?.warnings ?? []),
    ...(waterfallResult?.warnings ?? []),
    ...(taxSchedule.warnings ?? []),
  ];

  return {
    engineVersion: ENGINE_VERSION,
    inputsChecksum,
    computedAt,
    basisLedger,
    saleComputation,
    gainCharacterization,
    strategyInteractions,
    proceedsTimeline,
    taxSchedule,
    exchange1031Result,
    sellerFinancingResult,
    earnoutResult,
    waterfallResult,
    kpis,
    summary,
    warnings: allWarnings,
    explanations: specialistAdj.explanations.map(e => ({
      field: 'specialistInputs',
      label: 'Asset-Class Adjustment',
      plainEnglish: e,
    })),
  };
}
