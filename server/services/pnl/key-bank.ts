// =============================================================================
// FILE: server/services/pnl/key-bank.ts
//
// Closed-vocabulary key bank for the P&L classifier (B3 step 2).
//
// Each entry pairs a canonical key (matching pnl_canonical_line_items.canonical_key
// = camelCase as seeded from shared/direct-input-coa.ts + canonical-seed.ts) with:
//   - section: revenue | cogs | expense | payroll | non_operating | business_income
//   - department: routing label used downstream
//   - aliases: 3-6 normalized synonyms the classifier should recognize inline
//
// The bank is asset-class-scoped — the classifier prompt only enumerates keys
// valid for the project's asset class, so cross-class fuzzy collision is
// structurally impossible (e.g., "Gas" in a marina P&L can never resolve to a
// non-marina Utilities key when the marina bank is in force).
//
// Plus universal blocks:
//   - UNIVERSAL_KEYS: keys present in every asset class (insurance, property tax,
//     utilities, marketing, admin, payroll, depreciation, interest, income tax,
//     sales tax flagged for review).
//   - MUST_REVIEW_DENY_LIST: normalized labels that ALWAYS route to needs_review,
//     even on display-name fuzzy hits — checked BEFORE tryCanonicalMatch.
// =============================================================================

export interface KeyBankEntry {
  canonicalKey: string;
  section: 'revenue' | 'cogs' | 'expense' | 'payroll' | 'non_operating' | 'business_income';
  department: string;
  aliases: string[];
  /** Soft hint: prefer this key as a CATCH-ALL only when no granular subtype fits. */
  catchAll?: boolean;
  /** Soft hint: classifier should lean toward needs_review for this key. */
  reviewLean?: boolean;
}

// -----------------------------------------------------------------------------
// MUST_REVIEW_DENY_LIST
// Normalized labels (lowercased, ampersands→and, punctuation stripped, single
// space) that ALWAYS short-circuit to needs_review. Checked BEFORE
// tryCanonicalMatch so a displayName fuzzy hit can't smuggle them past.
//
// Two categories:
//   1. Pass-through / ambiguous accounting (sales tax, suspense, opening
//      balance equity) — never a P&L expense in the underwriting sense.
//   2. Bookkeeping placeholders (ask my accountant, unassigned, ?) — by
//      definition not classified.
// -----------------------------------------------------------------------------
export const MUST_REVIEW_DENY_LIST: ReadonlyArray<string> = [
  'sales tax',
  'sales tax payable',
  'sales tax expense',
  'sales tax collected',
  'sales taxes',
  'state sales tax',
  'local sales tax',
  'ask my accountant',
  'ask accountant',
  'suspense',
  'suspense account',
  'opening balance',
  'opening balance equity',
  'opening bal equity',
  'undefined',
  'unassigned',
  'uncategorized',
  'uncategorized expense',
  'uncategorized income',
  'unknown',
  '?',
];

export function isMustReviewLabel(normalized: string): boolean {
  const s = (normalized ?? '').trim().toLowerCase();
  if (!s) return false;
  for (const deny of MUST_REVIEW_DENY_LIST) {
    if (s === deny) return true;
    // Allow tight contains for QuickBooks-style "Sales Tax - NJ" / "Sales Tax — 2024"
    if (deny.length >= 8 && s.startsWith(deny)) return true;
  }
  return false;
}

// -----------------------------------------------------------------------------
// UNIVERSAL_KEYS — applicable to every asset class.
// Below-NOI keys (depreciation, interest, income tax) route to non_operating.
// Sales tax is present but reviewLean=true and also caught by deny-list above.
// -----------------------------------------------------------------------------
const UNIVERSAL_KEYS: KeyBankEntry[] = [
  // Operating expenses (universal)
  { canonicalKey: 'annualInsurance',  section: 'expense', department: 'General',
    aliases: ['insurance', 'insurance expense', 'business insurance', 'liability insurance', 'property insurance', 'general liability'] },
  { canonicalKey: 'annualPropertyTax', section: 'expense', department: 'General',
    aliases: ['property tax', 'property taxes', 'real estate tax', 'real estate taxes', 'realty tax', 'rett'] },
  { canonicalKey: 'annualMaintenance', section: 'expense', department: 'General',
    aliases: ['maintenance', 'maintenance and repairs', 'repairs and maintenance', 'r and m', 'building maintenance', 'general repairs'] },
  { canonicalKey: 'annualUtilities', section: 'expense', department: 'General',
    aliases: ['utilities', 'electric', 'electricity', 'water', 'sewer', 'natural gas heat', 'heating gas'] },
  { canonicalKey: 'annualMarketing', section: 'expense', department: 'General',
    aliases: ['marketing', 'advertising', 'promotion', 'promotions', 'website', 'social media'] },
  { canonicalKey: 'annualAdmin', section: 'expense', department: 'General',
    aliases: ['admin', 'admin and general', 'general and admin', 'office supplies', 'office expense', 'general expense'] },
  // Other Income / Other Revenue (universal)
  { canonicalKey: 'annualOtherIncome', section: 'revenue', department: 'General',
    aliases: ['other income', 'miscellaneous income', 'misc income', 'sundry income'],
    catchAll: true },

  // Payroll (universal — granular plus aggregate fallback)
  { canonicalKey: 'annualPayroll', section: 'payroll', department: 'Payroll',
    aliases: ['payroll', 'wages and salaries', 'compensation', 'labor cost', 'employee compensation', 'staff wages'],
    catchAll: true },

  // Below-NOI — non_operating
  { canonicalKey: 'annualDepreciation', section: 'non_operating', department: 'General',
    aliases: ['depreciation', 'depreciation expense', 'amortization', 'depreciation and amortization', 'd and a'] },
  { canonicalKey: 'annualInterestExpense', section: 'non_operating', department: 'General',
    aliases: ['interest expense', 'interest', 'mortgage interest', 'loan interest', 'note interest', 'interest paid'] },
  { canonicalKey: 'annualIncomeTax', section: 'non_operating', department: 'General',
    aliases: ['income tax', 'corporate income tax', 'corp income tax', 'state income tax', 'federal income tax', 'nys corp tax', 'ptet', 'pass through entity tax'] },
  { canonicalKey: 'annualSalesTaxExpense', section: 'non_operating', department: 'General',
    aliases: ['sales tax expense', 'sales tax'],
    reviewLean: true },
];

// -----------------------------------------------------------------------------
// MARINA_KEYS — marina-specific vocabulary, Phase B v1 enriched (50+ keys).
//
// Subtype keys come BEFORE aggregate "annualDockageRevenue" / "annualServiceRevenue"
// in the prompt ordering so Claude prefers granular when present (per trace
// section-6 routing-rule discipline).
// -----------------------------------------------------------------------------
const MARINA_KEYS: KeyBankEntry[] = [
  // ── Storage / Dockage subtypes (prefer subtypes before aggregate) ──
  { canonicalKey: 'annualSummerDockageRevenue', section: 'revenue', department: 'Storage',
    aliases: ['summer dockage', 'summer dockage revenue', 'seasonal dockage', 'summer slip revenue', 'summer storage'] },
  { canonicalKey: 'annualWinterStorageRevenue', section: 'revenue', department: 'Storage',
    aliases: ['winter storage', 'winter storage revenue', 'winter dockage', 'off-season storage', 'cold storage'] },
  { canonicalKey: 'annualLandStorageRevenue', section: 'revenue', department: 'Storage',
    aliases: ['land storage', 'land storage revenue', 'outside storage', 'outdoor storage', 'yard storage'] },
  { canonicalKey: 'annualTransientDockageRevenue', section: 'revenue', department: 'Storage',
    aliases: ['transient dockage', 'transient slip', 'overnight dockage', 'guest dockage', 'transient revenue'] },
  { canonicalKey: 'annualMooringRevenue', section: 'revenue', department: 'Storage',
    aliases: ['mooring', 'mooring revenue', 'mooring fees', 'buoy rental', 'mooring rental'] },
  { canonicalKey: 'annualDryStackStorageRevenue', section: 'revenue', department: 'Storage',
    aliases: ['dry stack', 'dry stack storage', 'rack storage', 'dry rack', 'high-and-dry'] },
  { canonicalKey: 'annualDockageRevenue', section: 'revenue', department: 'Storage',
    aliases: ['dockage', 'annual dockage', 'slip revenue', 'slip rental', 'dock fees', 'marina income'],
    catchAll: true },
  { canonicalKey: 'annualMarinaOperationsRevenue', section: 'revenue', department: 'Storage',
    aliases: ['marina operations', 'marina ops', 'marina fees', 'dock fees', 'harbor fees'],
    catchAll: true },

  // ── Service revenue subtypes ──
  { canonicalKey: 'annualHaulingRevenue', section: 'revenue', department: 'Service',
    aliases: ['hauling', 'haul out', 'launch and haul', 'lift fee', 'haul fee', 'crane fee'] },
  { canonicalKey: 'annualBottomPaintRevenue', section: 'revenue', department: 'Service',
    aliases: ['bottom paint', 'bottom painting', 'antifouling', 'hull paint', 'bottom paint revenue'] },
  { canonicalKey: 'annualBottomWashRevenue', section: 'revenue', department: 'Service',
    aliases: ['bottom wash', 'pressure wash', 'hull wash', 'boat wash', 'cleaning revenue'] },
  { canonicalKey: 'annualShrinkWrapRevenue', section: 'revenue', department: 'Service',
    aliases: ['shrink wrap', 'shrinkwrap', 'winterization wrap', 'shrink', 'winter wrap'] },
  { canonicalKey: 'annualDocksideElectricRevenue', section: 'revenue', department: 'Service',
    aliases: ['dockside electric', 'shore power', 'slip electric', 'electric income', 'power resale'] },
  { canonicalKey: 'annualSubcontractedRepairsRevenue', section: 'revenue', department: 'Service',
    aliases: ['subcontracted repairs', 'sub repairs', 'outside repair', 'contracted repairs', 'sub work'] },
  { canonicalKey: 'annualServiceLaborRevenue', section: 'revenue', department: 'Service',
    aliases: ['service labor', 'mechanic labor', 'shop labor', 'labor billed', 'labor income'],
    reviewLean: true },
  { canonicalKey: 'annualServiceRevenue', section: 'revenue', department: 'Service',
    aliases: ['service revenue', 'service income', 'service department', 'repairs revenue', 'mechanical revenue'],
    catchAll: true },

  // ── Fuel revenue ──
  { canonicalKey: 'annualFuelRevenue', section: 'revenue', department: 'Fuel',
    aliases: ['fuel revenue', 'fuel sales', 'gas dock', 'gas dock revenue', 'gas sales', 'diesel sales', 'fuel income'] },
  { canonicalKey: 'annualNewBoatFuelRevenue', section: 'revenue', department: 'Fuel',
    aliases: ['new boat fuel', 'delivery fuel', 'boat delivery fuel', 'new-boat gas'] },

  // ── Ship store + rental + other ──
  { canonicalKey: 'annualShipStoreRevenue', section: 'revenue', department: "Ship's Store",
    aliases: ['ship store', 'ship store sales', 'chandlery', 'store revenue', 'retail sales', 'marine store'] },
  { canonicalKey: 'annualRentalIncome', section: 'revenue', department: 'Marina & Amenities',
    aliases: ['rental income', 'boat rental', 'kayak rental', 'paddleboard rental', 'rental revenue'] },
  { canonicalKey: 'annualOtherRevenue', section: 'revenue', department: 'Marina & Amenities',
    aliases: ['other revenue', 'miscellaneous revenue', 'sundry revenue', 'misc revenue'],
    catchAll: true },

  // ── Boat Sales revenue (business_income — segregated below NOI) ──
  { canonicalKey: 'annualUsedBoatSalesRevenue', section: 'business_income', department: 'Boat Sales',
    aliases: ['used boat sales', 'used boats', 'pre-owned boat sales', 'brokerage boats', 'used boat revenue'] },
  { canonicalKey: 'annualNewBoatSalesRevenue', section: 'business_income', department: 'Boat Sales',
    aliases: ['new boat sales', 'new boats', 'new boat revenue', 'boat dealer sales'] },
  { canonicalKey: 'annualTradeInRevenue', section: 'business_income', department: 'Boat Sales',
    aliases: ['trade in', 'trade-in', 'trade in revenue', 'trade allowance'] },
  { canonicalKey: 'annualBoatSalesCommissionsRevenue', section: 'business_income', department: 'Boat Sales',
    aliases: ['boat sales commissions', 'boat commission', 'sales commissions earned'],
    catchAll: true },
  { canonicalKey: 'annualBrokerageCommissionsRevenue', section: 'business_income', department: 'Boat Brokerage',
    aliases: ['brokerage commissions', 'broker commission', 'brokerage fees', 'broker fees'] },
  { canonicalKey: 'annualFinanceCommissionRevenue', section: 'business_income', department: 'Boat Brokerage',
    aliases: ['finance commission', 'f and i commission', 'financing commission', 'lender commission'] },
  { canonicalKey: 'annualWarrantyRevenue', section: 'business_income', department: 'Boat Sales',
    aliases: ['warranty revenue', 'warranty sales', 'warranty income'] },
  { canonicalKey: 'annualExtendedWarrantyRevenue', section: 'business_income', department: 'Boat Sales',
    aliases: ['extended warranty revenue', 'extended warranty sales', 'extended warranty income'] },

  // ── Boat Sales COGS (business_income) ──
  { canonicalKey: 'annualBoatPurchasesCOGS', section: 'business_income', department: 'Boat Sales',
    aliases: ['boat purchases', 'cost of boats sold', 'boat cogs', 'boat acquisition cost'] },
  { canonicalKey: 'annualBoatsAndTrailersCOGS', section: 'business_income', department: 'Boat Sales',
    aliases: ['boats and trailers', 'trailers cogs', 'boat and trailer cost'] },
  { canonicalKey: 'annualPartsCOGS', section: 'business_income', department: 'Boat Sales',
    aliases: ['parts cogs', 'parts cost', 'parts and accessories', 'parts purchases'] },
  { canonicalKey: 'annualSubcontractedRepairsCOGS', section: 'business_income', department: 'Service',
    aliases: ['subcontracted repairs cogs', 'sub repair cost', 'outside labor cost'] },
  { canonicalKey: 'annualExtendedWarrantyCOGS', section: 'business_income', department: 'Boat Sales',
    aliases: ['extended warranty cogs', 'extended warranty cost', 'warranty refund'] },
  { canonicalKey: 'annualDocumentServicesCOGS', section: 'business_income', department: 'Boat Sales',
    aliases: ['document services', 'doc fees', 'documentation fees', 'titling fees'] },
  { canonicalKey: 'annualEquipmentSuppliesCOGS', section: 'business_income', department: 'Boat Sales',
    aliases: ['equipment and supplies cogs', 'equipment cost', 'supplies cost'] },
  { canonicalKey: 'annualTradePayoffCOGS', section: 'business_income', department: 'Boat Sales',
    aliases: ['trade payoff', 'trade-in payoff', 'lien payoff'] },
  { canonicalKey: 'annualGenericCOGS', section: 'business_income', department: 'Boat Sales',
    aliases: ['cost of goods sold', 'cogs', 'cogs general', 'merchandise cost'],
    catchAll: true },

  // ── Boat Sales operating expense (business_income) ──
  { canonicalKey: 'annualSalesmenCommissionsExpense', section: 'business_income', department: 'Boat Sales',
    aliases: ['salesmen commissions', 'salesperson commissions', 'sales commissions paid'] },
  { canonicalKey: 'annualBoatSalesCommissionsExpense', section: 'business_income', department: 'Boat Sales',
    aliases: ['commissions paid', 'boat sales commissions paid', 'commission expense'] },

  // ── Fuel + Store COGS (operating expense; above NOI) ──
  { canonicalKey: 'annualFuelCOGS', section: 'cogs', department: 'Fuel',
    aliases: ['fuel cogs', 'cost of fuel', 'fuel cost', 'fuel purchases', 'cogs fuel', 'cogs - fuel', 'gas cogs'] },
  { canonicalKey: 'annualStoreCOGS', section: 'cogs', department: "Ship's Store",
    aliases: ['ship store cogs', 'store cogs', 'cost of merchandise', 'merchandise cost', 'retail cogs'] },

  // ── Payroll (marina-granular) ──
  { canonicalKey: 'annualSalariesExpense', section: 'payroll', department: 'Payroll',
    aliases: ['salaries', 'wages', 'salaries and wages', 'staff salaries', 'employee salaries'] },
  { canonicalKey: 'annualPayrollTaxesExpense', section: 'payroll', department: 'Payroll',
    aliases: ['payroll taxes', 'payroll tax', 'fica', 'futa', 'sui', 'sui tax', 'medicare', 'social security tax', 'workers comp', 'workers compensation', 'workmens comp'] },
  { canonicalKey: 'annualPayrollProcessingExpense', section: 'expense', department: 'General',
    aliases: ['payroll processing', 'payroll fees', 'adp fees', 'paychex fees', 'gusto fees'] },

  // ── Occupancy ──
  { canonicalKey: 'annualRentExpense', section: 'expense', department: 'General',
    aliases: ['rent', 'rent expense', 'facility lease', 'ground lease', 'lease expense'] },

  // ── Operating expenses (marina-granular) ──
  { canonicalKey: 'annualDredging', section: 'expense', department: 'General',
    aliases: ['dredging', 'dredge', 'channel dredging', 'harbor maintenance'] },
  { canonicalKey: 'annualOutsideServicesExpense', section: 'expense', department: 'General',
    aliases: ['outside services', 'contract services', 'contracted services', 'consulting fees'] },
  { canonicalKey: 'annualAutomobileExpense', section: 'expense', department: 'General',
    aliases: ['automobile', 'auto expense', 'vehicle expense', 'truck expense', 'fuel for vehicles'] },
  { canonicalKey: 'annualComputerInternetExpense', section: 'expense', department: 'General',
    aliases: ['computer', 'internet', 'computer and internet', 'it expense', 'software'] },
  { canonicalKey: 'annualProfessionalFees', section: 'expense', department: 'General',
    aliases: ['professional fees', 'legal', 'legal fees', 'accounting', 'accounting fees', 'cpa fees', 'attorney'] },
  { canonicalKey: 'annualBankMerchantFees', section: 'expense', department: 'General',
    aliases: ['bank fees', 'bank charges', 'credit card fees', 'merchant fees', 'processing fees', 'credit report fees'] },
  { canonicalKey: 'annualLicensesPermits', section: 'expense', department: 'General',
    aliases: ['licenses', 'permits', 'licenses and permits', 'dues', 'llc filing', 'business license'] },
  { canonicalKey: 'annualOtherExpenses', section: 'expense', department: 'General',
    aliases: ['other expenses', 'miscellaneous expense', 'misc expense', 'sundry expense'],
    catchAll: true },
];

// -----------------------------------------------------------------------------
// Per-asset-class bank
// -----------------------------------------------------------------------------
const BANK_BY_ASSET_CLASS: Record<string, KeyBankEntry[]> = {
  marina: MARINA_KEYS,
  // Other asset classes fall through to UNIVERSAL_KEYS only — they don't get
  // marina-specific subtypes injected, which would corrupt their routing.
};

/**
 * Get the closed-vocabulary key bank for an asset class.
 * Returns asset-class-specific entries followed by universal entries.
 * Universal entries come LAST so asset-class subtypes have ordering priority
 * (the classifier prompt preserves order = preference).
 */
export function getKeyBank(assetClass: string | null | undefined): KeyBankEntry[] {
  const ac = (assetClass ?? '').toLowerCase().trim();
  const specific = BANK_BY_ASSET_CLASS[ac] ?? [];
  return [...specific, ...UNIVERSAL_KEYS];
}

/**
 * Build the "ENUMERATED KEYS" block embedded in the classifier system prompt.
 * Format: one line per key:
 *   canonicalKey [section/department] — aliases: a, b, c [CATCH-ALL] [REVIEW-LEAN]
 * Order is preserved (subtypes first, then aggregates/catch-alls, then universal).
 */
export function formatKeyBankForPrompt(assetClass: string | null | undefined): string {
  const bank = getKeyBank(assetClass);
  const lines = bank.map(e => {
    const tags: string[] = [];
    if (e.catchAll) tags.push('[CATCH-ALL]');
    if (e.reviewLean) tags.push('[REVIEW-LEAN]');
    return `- ${e.canonicalKey} [${e.section}/${e.department}] — ${e.aliases.join(', ')}${tags.length ? ' ' + tags.join(' ') : ''}`;
  });
  return lines.join('\n');
}
