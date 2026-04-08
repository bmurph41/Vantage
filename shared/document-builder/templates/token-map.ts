/**
 * Document Studio — Master Token Map
 *
 * Every {{TOKEN}} used across IC Deal Review Deck and Offering Memorandum templates.
 * Tokens are categorized by data source and binding type:
 *   - "live"   = auto-resolved from Vantage workspace (modeling project, deal, rent roll, etc.)
 *   - "manual" = user-entered or section-specific content filled by the document author
 *
 * Binding paths use dot-notation referencing Vantage data models:
 *   deal.*              → crmDeals table
 *   property.*          → crmProperties table
 *   modeling.*          → modelingProjects + scenarioVersions
 *   proforma.*          → underwriting assumptions / pro forma outputs
 *   rentroll.*          → rent roll aggregates
 *   capitalStack.*      → capitalStacks + debtTranches
 *   exit.*              → exitScenarios + exitScenarioKpis
 *   comps.*             → salesComps aggregates
 *   demographics.*      → targetDemographics
 *   org.*               → organizations table
 */

// ─── Token Binding Types ────────────────────────────────────────────────────

export type TokenSource =
  | 'deal'
  | 'property'
  | 'modeling'
  | 'proforma'
  | 'rentroll'
  | 'capitalStack'
  | 'exit'
  | 'comps'
  | 'demographics'
  | 'org'
  | 'manual';

export interface TokenDefinition {
  token: string;               // e.g. "PROPERTY_NAME"
  label: string;               // Human-readable label
  source: TokenSource;         // Data source category
  bindingPath?: string;        // Dot-path to workspace data (null for manual)
  format?: 'currency' | 'percent' | 'number' | 'date' | 'text';
  description: string;
  usedIn: ('ic_deck' | 'om')[];
}

// ─── Complete Token Registry ────────────────────────────────────────────────

export const MASTER_TOKEN_MAP: TokenDefinition[] = [

  // ═══════════════════════════════════════════════════════════════════════════
  // PROPERTY / DEAL IDENTITY
  // ═══════════════════════════════════════════════════════════════════════════
  { token: 'PROPERTY_NAME', label: 'Property Name', source: 'deal', bindingPath: 'deal.title', format: 'text', description: 'Marina / property name', usedIn: ['ic_deck', 'om'] },
  { token: 'PROPERTY_ADDRESS', label: 'Property Address', source: 'property', bindingPath: 'property.address', format: 'text', description: 'Full street address', usedIn: ['ic_deck', 'om'] },
  { token: 'PROPERTY_CITY', label: 'City', source: 'deal', bindingPath: 'deal.ddCity', format: 'text', description: 'City name', usedIn: ['ic_deck', 'om'] },
  { token: 'PROPERTY_STATE', label: 'State', source: 'deal', bindingPath: 'deal.ddState', format: 'text', description: 'State abbreviation', usedIn: ['ic_deck', 'om'] },
  { token: 'PROPERTY_ZIP', label: 'ZIP Code', source: 'property', bindingPath: 'property.zipCode', format: 'text', description: 'ZIP/Postal code', usedIn: ['om'] },
  { token: 'LOCATION_TAGLINE', label: 'Location Tagline', source: 'manual', description: 'One-line location marketing tagline', usedIn: ['om'] },
  { token: 'SELLER_NAME', label: 'Seller Name', source: 'manual', description: 'Seller entity name', usedIn: ['ic_deck'] },
  { token: 'BROKER_NAME', label: 'Broker Name', source: 'manual', description: 'Listing broker name', usedIn: ['ic_deck', 'om'] },
  { token: 'BROKER_FIRM', label: 'Broker Firm', source: 'manual', description: 'Brokerage firm name', usedIn: ['om'] },
  { token: 'SPONSOR_LOGO_URL', label: 'Sponsor Logo', source: 'manual', description: 'URL to sponsor/buyer logo image', usedIn: ['ic_deck'] },
  { token: 'BROKER_LOGO_URL', label: 'Broker Logo', source: 'manual', description: 'URL to broker firm logo image', usedIn: ['om'] },
  { token: 'DOCUMENT_DATE', label: 'Document Date', source: 'manual', format: 'date', description: 'Date on cover page', usedIn: ['ic_deck', 'om'] },
  { token: 'HERO_IMAGE_URL', label: 'Hero Image', source: 'manual', description: 'Cover page hero photo URL', usedIn: ['ic_deck', 'om'] },
  { token: 'GALLERY_IMAGE_1_URL', label: 'Gallery Photo 1', source: 'manual', description: 'Large left photo for property gallery page', usedIn: ['ic_deck'] },
  { token: 'GALLERY_IMAGE_2_URL', label: 'Gallery Photo 2', source: 'manual', description: 'Top-right photo for property gallery page', usedIn: ['ic_deck'] },
  { token: 'GALLERY_IMAGE_3_URL', label: 'Gallery Photo 3', source: 'manual', description: 'Bottom-right photo for property gallery page', usedIn: ['ic_deck'] },
  { token: 'AERIAL_IMAGE_URL', label: 'Aerial Image', source: 'manual', description: 'Aerial/site map photo URL', usedIn: ['ic_deck', 'om'] },
  { token: 'DOCK_MAP_IMAGE_URL', label: 'Dock Map Image', source: 'manual', description: 'Labeled dock layout aerial URL', usedIn: ['ic_deck', 'om'] },
  { token: 'CONFIDENTIAL_LABEL', label: 'Confidential Label', source: 'manual', description: 'e.g. "PROPRIETARY AND CONFIDENTIAL"', usedIn: ['ic_deck', 'om'] },

  // ═══════════════════════════════════════════════════════════════════════════
  // PROPERTY PHYSICAL DETAILS
  // ═══════════════════════════════════════════════════════════════════════════
  { token: 'TOTAL_SLIPS', label: 'Total Wet Slips', source: 'property', bindingPath: 'property.totalSlips', format: 'number', description: 'Total numbered wet slips', usedIn: ['ic_deck', 'om'] },
  { token: 'LINEAR_FEET', label: 'Linear Feet of Dockage', source: 'property', bindingPath: 'property.linearFeet', format: 'number', description: 'Total linear feet of dockage', usedIn: ['om'] },
  { token: 'AVG_LOA', label: 'Avg LOA (ft)', source: 'rentroll', bindingPath: 'rentroll.avgLOA', format: 'number', description: 'Average length overall of slips', usedIn: ['ic_deck'] },
  { token: 'MAX_BOAT_LENGTH', label: 'Max Boat Length', source: 'property', bindingPath: 'property.maxBoatLength', format: 'number', description: 'Max accommodated boat length (ft)', usedIn: ['om'] },
  { token: 'DOCK_TYPE', label: 'Dock Type', source: 'manual', description: 'e.g. Floating, Fixed', usedIn: ['om'] },
  { token: 'SIZE_RANGE', label: 'Slip Size Range', source: 'manual', description: "e.g. 20' - 150'", usedIn: ['om'] },
  { token: 'DOCKSIDE_DEPTH', label: 'Dockside Depth', source: 'manual', description: 'Water depth at docks', usedIn: ['om'] },
  { token: 'PARKING_SPACES', label: 'Parking Spaces', source: 'manual', format: 'number', description: 'Number of parking spaces', usedIn: ['ic_deck', 'om'] },
  { token: 'OWNERSHIP_TYPE', label: 'Ownership Type', source: 'manual', description: 'Ground Lease, Fee Simple, etc.', usedIn: ['ic_deck', 'om'] },
  { token: 'BUILDING_SF', label: 'Building SF', source: 'manual', format: 'number', description: 'Office/commercial building square footage', usedIn: ['om'] },
  { token: 'BNB_VESSEL_COUNT', label: 'B&B Vessel Count', source: 'manual', format: 'number', description: 'Number of B&B Afloat vessels', usedIn: ['ic_deck', 'om'] },

  // ═══════════════════════════════════════════════════════════════════════════
  // AMENITIES & SERVICES (checklist — all manual booleans)
  // ═══════════════════════════════════════════════════════════════════════════
  { token: 'HAS_FUEL_DOCK', label: 'Fuel Dock', source: 'manual', description: 'Yes/No/Detail', usedIn: ['om'] },
  { token: 'HAS_PUMP_OUT', label: 'Pump-out', source: 'manual', description: 'Yes/No', usedIn: ['om'] },
  { token: 'HAS_ELECTRIC', label: 'Dockside Electric', source: 'manual', description: 'Yes (amps detail)', usedIn: ['om'] },
  { token: 'HAS_WATER', label: 'Dockside Water', source: 'manual', description: 'Yes/No', usedIn: ['om'] },
  { token: 'HAS_SHIP_STORE', label: 'Ship Store', source: 'manual', description: 'Yes/No', usedIn: ['om'] },
  { token: 'HAS_POOL', label: 'Pool', source: 'manual', description: 'Yes/No', usedIn: ['om'] },
  { token: 'HAS_RESTAURANT', label: 'Restaurant', source: 'manual', description: 'Yes/No/Detail', usedIn: ['om'] },
  { token: 'HAS_LODGING', label: 'Lodging', source: 'manual', description: 'Yes/No/Detail', usedIn: ['om'] },
  { token: 'HAS_BOAT_RENTAL', label: 'Boat Rental', source: 'manual', description: 'Yes/No/Detail', usedIn: ['om'] },
  { token: 'HAS_LAUNDRY', label: 'Laundry', source: 'manual', description: 'Yes/No', usedIn: ['om'] },
  { token: 'HAS_SECURITY', label: 'Security', source: 'manual', description: 'Yes/No', usedIn: ['om'] },
  { token: 'HAS_WIFI', label: 'WiFi', source: 'manual', description: 'Yes/No', usedIn: ['om'] },
  { token: 'HAS_RESTROOMS', label: 'Restrooms/Showers', source: 'manual', description: 'Yes/No', usedIn: ['om'] },
  { token: 'HAS_ICE', label: 'Ice', source: 'manual', description: 'Yes/No', usedIn: ['om'] },
  { token: 'HAS_TRANSIENT', label: 'Transient Dockage', source: 'manual', description: 'Yes/No', usedIn: ['om'] },
  { token: 'WATER_SOURCE', label: 'Water Source', source: 'manual', description: 'City, Well, etc.', usedIn: ['om'] },
  { token: 'SEWER_SOURCE', label: 'Sewer', source: 'manual', description: 'City, Septic, etc.', usedIn: ['om'] },

  // ═══════════════════════════════════════════════════════════════════════════
  // FINANCIAL — PURCHASE & CAPITAL STRUCTURE (live from modeling/capitalStack)
  // ═══════════════════════════════════════════════════════════════════════════
  { token: 'PURCHASE_PRICE', label: 'Purchase Price', source: 'modeling', bindingPath: 'modeling.purchasePrice', format: 'currency', description: 'Acquisition price', usedIn: ['ic_deck', 'om'] },
  { token: 'ASKING_PRICE', label: 'Asking Price', source: 'manual', description: 'Listed asking price or "Market Bid"', usedIn: ['om'] },
  { token: 'CLOSING_COSTS', label: 'Closing Costs', source: 'capitalStack', bindingPath: 'capitalStack.closingCosts', format: 'currency', description: 'Transaction closing costs', usedIn: ['ic_deck'] },
  { token: 'TRANSITION_COSTS', label: 'Transition Costs', source: 'capitalStack', bindingPath: 'capitalStack.transitionCosts', format: 'currency', description: 'Transition/takeover costs', usedIn: ['ic_deck'] },
  { token: 'WORKING_CAPITAL', label: 'Working Capital', source: 'manual', format: 'currency', description: 'Working capital reserve at close', usedIn: ['ic_deck'] },
  { token: 'TOTAL_USES', label: 'Total Uses', source: 'capitalStack', bindingPath: 'capitalStack.totalBasis', format: 'currency', description: 'Total uses of funds', usedIn: ['ic_deck'] },
  { token: 'EQUITY_AMOUNT', label: 'Equity', source: 'capitalStack', bindingPath: 'capitalStack.totalEquity', format: 'currency', description: 'Total equity contributed', usedIn: ['ic_deck'] },
  { token: 'EQUITY_PCT', label: 'Equity %', source: 'capitalStack', bindingPath: 'capitalStack.equityPct', format: 'percent', description: 'Equity as % of total sources', usedIn: ['ic_deck'] },
  { token: 'LTV', label: 'LTV', source: 'capitalStack', bindingPath: 'capitalStack.ltv', format: 'percent', description: 'Loan-to-value ratio', usedIn: ['ic_deck'] },

  // ═══════════════════════════════════════════════════════════════════════════
  // DEBT TERMS (live from debtTranches)
  // ═══════════════════════════════════════════════════════════════════════════
  { token: 'LOAN_AMOUNT', label: 'Loan Amount', source: 'capitalStack', bindingPath: 'capitalStack.seniorDebt', format: 'currency', description: 'Senior loan amount', usedIn: ['ic_deck'] },
  { token: 'LOAN_TYPE', label: 'Loan Type', source: 'capitalStack', bindingPath: 'capitalStack.loanType', format: 'text', description: 'P&I, IO, etc.', usedIn: ['ic_deck'] },
  { token: 'LOAN_TERM_YEARS', label: 'Loan Term', source: 'capitalStack', bindingPath: 'capitalStack.loanTermYears', format: 'number', description: 'Loan term in years', usedIn: ['ic_deck'] },
  { token: 'AMORTIZATION_YEARS', label: 'Amortization', source: 'capitalStack', bindingPath: 'capitalStack.amortizationYears', format: 'number', description: 'Amortization period in years', usedIn: ['ic_deck'] },
  { token: 'IO_PERIOD_MONTHS', label: 'IO Period (months)', source: 'capitalStack', bindingPath: 'capitalStack.ioPeriodMonths', format: 'number', description: 'Interest-only period in months', usedIn: ['ic_deck'] },
  { token: 'INTEREST_RATE', label: 'Interest Rate', source: 'capitalStack', bindingPath: 'capitalStack.interestRate', format: 'percent', description: 'Annual interest rate', usedIn: ['ic_deck'] },
  { token: 'RATE_STRUCTURE', label: 'Rate Structure', source: 'manual', description: 'Fixed, Variable, Hybrid', usedIn: ['ic_deck'] },
  { token: 'RECOURSE', label: 'Recourse', source: 'manual', description: 'Recourse, Non-Recourse, Partial', usedIn: ['ic_deck'] },
  { token: 'PI_ADS', label: 'P&I Annual Debt Service', source: 'capitalStack', bindingPath: 'capitalStack.annualDebtService', format: 'currency', description: 'Annual P&I debt service', usedIn: ['ic_deck'] },
  { token: 'IO_ADS', label: 'IO Annual Debt Service', source: 'capitalStack', bindingPath: 'capitalStack.ioAnnualDebtService', format: 'currency', description: 'Interest-only annual debt service', usedIn: ['ic_deck'] },
  { token: 'PREPAYMENT_PENALTY', label: 'Prepayment Penalty', source: 'manual', description: 'Prepayment terms', usedIn: ['ic_deck'] },
  { token: 'FINANCING_FEE_PCT', label: 'Financing Fee', source: 'manual', format: 'percent', description: 'Financing fee percentage', usedIn: ['ic_deck'] },
  { token: 'EXTENSION_FEE_PCT', label: 'Extension Fee', source: 'manual', format: 'percent', description: 'Extension fee percentage', usedIn: ['ic_deck'] },
  { token: 'EXIT_FEE_PCT', label: 'Exit Fee', source: 'manual', format: 'percent', description: 'Exit fee percentage', usedIn: ['ic_deck'] },
  { token: 'DSCR_COVENANT', label: 'DSCR Covenant', source: 'manual', description: 'DSCR covenant ratio', usedIn: ['ic_deck'] },

  // ═══════════════════════════════════════════════════════════════════════════
  // KEY RETURN METRICS (live from exit/modeling)
  // ═══════════════════════════════════════════════════════════════════════════
  { token: 'IRR_GROSS', label: 'Leveraged IRR (Gross)', source: 'exit', bindingPath: 'exit.irrGross', format: 'percent', description: 'Gross leveraged IRR', usedIn: ['ic_deck'] },
  { token: 'IRR_NET', label: 'Leveraged IRR (Net)', source: 'exit', bindingPath: 'exit.irrNet', format: 'percent', description: 'Net-of-promote leveraged IRR', usedIn: ['ic_deck'] },
  { token: 'EM_GROSS', label: 'Equity Multiple (Gross)', source: 'exit', bindingPath: 'exit.emGross', format: 'number', description: 'Gross equity multiple', usedIn: ['ic_deck'] },
  { token: 'EM_NET', label: 'Equity Multiple (Net)', source: 'exit', bindingPath: 'exit.emNet', format: 'number', description: 'Net-of-promote equity multiple', usedIn: ['ic_deck'] },
  { token: 'LEVERAGED_GAIN', label: 'Leveraged Gain', source: 'exit', bindingPath: 'exit.leveragedGain', format: 'currency', description: 'Total leveraged profit', usedIn: ['ic_deck'] },
  { token: 'UNLEVERAGED_IRR', label: 'Unleveraged IRR', source: 'exit', bindingPath: 'exit.unleveragedIrr', format: 'percent', description: 'Unlevered IRR', usedIn: ['ic_deck'] },
  { token: 'UNLEVERAGED_MOE', label: 'Unleveraged MoE', source: 'exit', bindingPath: 'exit.unleveragedMoe', format: 'number', description: 'Unlevered multiple on equity', usedIn: ['ic_deck'] },
  { token: 'UNLEVERAGED_GAIN', label: 'Unleveraged Gain', source: 'exit', bindingPath: 'exit.unleveragedGain', format: 'currency', description: 'Total unlevered profit', usedIn: ['ic_deck'] },

  // ═══════════════════════════════════════════════════════════════════════════
  // OPERATING METRICS — YEAR 1 / CURRENT (live from proforma)
  // ═══════════════════════════════════════════════════════════════════════════
  { token: 'YEAR1_REVENUE', label: 'Year 1 Revenue', source: 'proforma', bindingPath: 'proforma.year1.revenue', format: 'currency', description: 'Year 1 total revenue', usedIn: ['ic_deck', 'om'] },
  { token: 'YEAR1_COGS', label: 'Year 1 COGS', source: 'proforma', bindingPath: 'proforma.year1.cogs', format: 'currency', description: 'Year 1 cost of goods sold', usedIn: ['ic_deck'] },
  { token: 'YEAR1_OPEX', label: 'Year 1 OpEx', source: 'proforma', bindingPath: 'proforma.year1.opex', format: 'currency', description: 'Year 1 operating expenses', usedIn: ['ic_deck'] },
  { token: 'YEAR1_EBITDAM', label: 'Year 1 EBITDAM', source: 'proforma', bindingPath: 'proforma.year1.ebitdam', format: 'currency', description: 'Year 1 EBITDA before mgmt fee', usedIn: ['ic_deck'] },
  { token: 'YEAR1_EBITDA', label: 'Year 1 EBITDA', source: 'proforma', bindingPath: 'proforma.year1.ebitda', format: 'currency', description: 'Year 1 EBITDA after mgmt fee', usedIn: ['ic_deck'] },
  { token: 'YEAR1_NOI', label: 'Year 1 NOI', source: 'proforma', bindingPath: 'proforma.year1.noi', format: 'currency', description: 'Year 1 NOI (after CapEx reserve)', usedIn: ['ic_deck', 'om'] },
  { token: 'YEAR1_CAP_RATE', label: 'Year 1 Cap Rate', source: 'modeling', bindingPath: 'modeling.capRate', format: 'percent', description: 'Going-in cap rate', usedIn: ['ic_deck'] },
  { token: 'YEAR1_DSCR', label: 'Year 1 DSCR', source: 'proforma', bindingPath: 'proforma.year1.dscr', format: 'number', description: 'Year 1 debt service coverage ratio', usedIn: ['ic_deck'] },
  { token: 'MGMT_FEE_PCT', label: 'Management Fee %', source: 'proforma', bindingPath: 'proforma.mgmtFeePct', format: 'percent', description: 'Management fee as % of revenue', usedIn: ['ic_deck'] },
  { token: 'CAPEX_RESERVE_PCT', label: 'CapEx Reserve %', source: 'proforma', bindingPath: 'proforma.capexReservePct', format: 'percent', description: 'CapEx reserve as % of revenue', usedIn: ['ic_deck'] },
  { token: 'FC_REVENUE', label: 'Current F/C Revenue', source: 'proforma', bindingPath: 'proforma.currentYear.revenue', format: 'currency', description: 'Current year forecast revenue', usedIn: ['om'] },
  { token: 'FC_NOI', label: 'Current F/C NOI', source: 'proforma', bindingPath: 'proforma.currentYear.noi', format: 'currency', description: 'Current year forecast NOI', usedIn: ['om'] },

  // ═══════════════════════════════════════════════════════════════════════════
  // EXIT ASSUMPTIONS (live)
  // ═══════════════════════════════════════════════════════════════════════════
  { token: 'EXIT_YEAR', label: 'Exit Year', source: 'exit', bindingPath: 'exit.exitYear', format: 'number', description: 'Planned disposition year', usedIn: ['ic_deck'] },
  { token: 'EXIT_CAP_RATE', label: 'Exit Cap Rate', source: 'exit', bindingPath: 'exit.exitCapRate', format: 'percent', description: 'Exit cap rate assumption', usedIn: ['ic_deck'] },
  { token: 'EXIT_VALUE', label: 'Exit Value', source: 'exit', bindingPath: 'exit.exitValue', format: 'currency', description: 'Projected exit value', usedIn: ['ic_deck'] },
  { token: 'BPS_SPREAD', label: 'BPS Spread', source: 'exit', bindingPath: 'exit.bpsSpread', format: 'number', description: 'BPS spread (exit cap - going-in cap)', usedIn: ['ic_deck'] },

  // ═══════════════════════════════════════════════════════════════════════════
  // GROWTH ASSUMPTIONS (live from scenario versions)
  // ═══════════════════════════════════════════════════════════════════════════
  { token: 'REVENUE_CAGR', label: 'Revenue CAGR', source: 'proforma', bindingPath: 'proforma.revenueCagr', format: 'percent', description: 'Hold-period revenue CAGR', usedIn: ['ic_deck'] },
  { token: 'STORAGE_RATE_CAGR', label: 'Storage Rate CAGR', source: 'proforma', bindingPath: 'proforma.storageRateCagr', format: 'percent', description: 'Storage rate increase CAGR', usedIn: ['ic_deck'] },
  { token: 'EXPENSE_CAGR', label: 'Expense CAGR', source: 'proforma', bindingPath: 'proforma.expenseCagr', format: 'percent', description: 'Hold-period OpEx CAGR', usedIn: ['ic_deck'] },
  { token: 'PAYROLL_CAGR', label: 'Payroll CAGR', source: 'proforma', bindingPath: 'proforma.payrollCagr', format: 'percent', description: 'Payroll expense CAGR', usedIn: ['ic_deck'] },
  { token: 'INSURANCE_CAGR', label: 'Insurance CAGR', source: 'proforma', bindingPath: 'proforma.insuranceCagr', format: 'percent', description: 'Insurance expense CAGR', usedIn: ['ic_deck'] },
  { token: 'PROPERTY_TAX_CAGR', label: 'Property Tax CAGR', source: 'proforma', bindingPath: 'proforma.propertyTaxCagr', format: 'percent', description: 'Property tax CAGR', usedIn: ['ic_deck'] },
  { token: 'NON_STORAGE_REV_CAGR', label: 'Non-Storage Rev CAGR', source: 'proforma', bindingPath: 'proforma.nonStorageRevCagr', format: 'percent', description: 'Non-storage revenue CAGR', usedIn: ['ic_deck'] },
  { token: 'EBITDAM_CAGR', label: 'EBITDAM CAGR', source: 'proforma', bindingPath: 'proforma.ebitdamCagr', format: 'percent', description: 'EBITDAM CAGR over hold period', usedIn: ['ic_deck'] },

  // ═══════════════════════════════════════════════════════════════════════════
  // OCCUPANCY & RENT ROLL (live from rent roll aggregates)
  // ═══════════════════════════════════════════════════════════════════════════
  { token: 'SUMMER_OCCUPANCY', label: 'Summer Occupancy', source: 'rentroll', bindingPath: 'rentroll.summerOccupancy', format: 'percent', description: 'Peak season occupancy rate', usedIn: ['ic_deck', 'om'] },
  { token: 'WINTER_OCCUPANCY', label: 'Winter Occupancy', source: 'rentroll', bindingPath: 'rentroll.winterOccupancy', format: 'percent', description: 'Off-season occupancy rate', usedIn: ['ic_deck'] },
  { token: 'SUMMER_RATE_PER_FT', label: 'Summer Rate $/ft', source: 'rentroll', bindingPath: 'rentroll.summerRatePerFt', format: 'currency', description: 'Avg summer seasonal rate per linear foot', usedIn: ['ic_deck', 'om'] },
  { token: 'WINTER_RATE_PER_FT', label: 'Winter Rate $/ft', source: 'rentroll', bindingPath: 'rentroll.winterRatePerFt', format: 'currency', description: 'Avg winter rate per linear foot', usedIn: ['ic_deck'] },
  { token: 'SUMMER_OCCUPIED_SLIPS', label: 'Summer Occupied Slips', source: 'rentroll', bindingPath: 'rentroll.summerOccupiedSlips', format: 'number', description: 'Number of occupied slips in summer', usedIn: ['ic_deck'] },
  { token: 'WINTER_OCCUPIED_SLIPS', label: 'Winter Occupied Slips', source: 'rentroll', bindingPath: 'rentroll.winterOccupiedSlips', format: 'number', description: 'Number of occupied slips in winter', usedIn: ['ic_deck'] },
  { token: 'STORAGE_REVENUE', label: 'Storage Revenue', source: 'proforma', bindingPath: 'proforma.currentYear.storageRevenue', format: 'currency', description: 'Total dockage/storage revenue', usedIn: ['ic_deck'] },
  { token: 'TRANSIENT_REVENUE', label: 'Transient Revenue', source: 'proforma', bindingPath: 'proforma.currentYear.transientRevenue', format: 'currency', description: 'Transient/guest dockage revenue', usedIn: ['ic_deck'] },
  { token: 'LIVEABOARD_REVENUE', label: 'Liveaboard Revenue', source: 'proforma', bindingPath: 'proforma.currentYear.liveaboardRevenue', format: 'currency', description: 'Liveaboard fee revenue', usedIn: ['ic_deck'] },
  { token: 'BNB_REVENUE', label: 'B&B Afloat Revenue', source: 'proforma', bindingPath: 'proforma.currentYear.bnbRevenue', format: 'currency', description: 'Total B&B Afloat revenue', usedIn: ['ic_deck', 'om'] },

  // ═══════════════════════════════════════════════════════════════════════════
  // REVENUE MIX PERCENTAGES
  // ═══════════════════════════════════════════════════════════════════════════
  { token: 'STORAGE_REV_PCT', label: 'Storage Revenue %', source: 'proforma', bindingPath: 'proforma.currentYear.storageRevPct', format: 'percent', description: 'Storage as % of total revenue', usedIn: ['ic_deck'] },
  { token: 'MARINA_AMENITIES_REV_PCT', label: 'Marina & Amenities %', source: 'proforma', bindingPath: 'proforma.currentYear.marinaAmenitiesRevPct', format: 'percent', description: 'Marina/amenities as % of revenue', usedIn: ['ic_deck'] },
  { token: 'SERVICE_REV_PCT', label: 'Service Revenue %', source: 'proforma', bindingPath: 'proforma.currentYear.serviceRevPct', format: 'percent', description: 'Service revenue as % of total', usedIn: ['ic_deck'] },
  { token: 'BNB_REV_PCT', label: 'B&B Revenue %', source: 'proforma', bindingPath: 'proforma.currentYear.bnbRevPct', format: 'percent', description: 'B&B Afloat as % of total revenue', usedIn: ['ic_deck'] },
  { token: 'THIRD_PARTY_LEASE_REV_PCT', label: 'Third-Party Leases %', source: 'proforma', bindingPath: 'proforma.currentYear.thirdPartyLeasePct', format: 'percent', description: 'Third-party lease income as % of revenue', usedIn: ['ic_deck'] },

  // ═══════════════════════════════════════════════════════════════════════════
  // GROUND LEASES (manual — deal-specific)
  // ═══════════════════════════════════════════════════════════════════════════
  { token: 'GL_LESSOR', label: 'Ground Lease Lessor', source: 'manual', description: 'Ground lease lessor entity', usedIn: ['ic_deck', 'om'] },
  { token: 'GL_LESSEE', label: 'Ground Lease Lessee', source: 'manual', description: 'Ground lease lessee entity', usedIn: ['ic_deck', 'om'] },
  { token: 'GL_DATE', label: 'Ground Lease Date', source: 'manual', format: 'date', description: 'Ground lease commencement date', usedIn: ['ic_deck', 'om'] },
  { token: 'GL_TERM_EXPIRY', label: 'Ground Lease Expiry', source: 'manual', format: 'date', description: 'Ground lease expiration date', usedIn: ['ic_deck', 'om'] },
  { token: 'GL_RENT_TERMS', label: 'Ground Lease Rent Terms', source: 'manual', description: 'Percentage rent structure by year range', usedIn: ['ic_deck', 'om'] },
  { token: 'GL_REMAINING_YEARS', label: 'GL Remaining Years', source: 'manual', format: 'number', description: 'Years remaining on ground lease', usedIn: ['ic_deck'] },
  { token: 'PARKING_LEASE_LESSOR', label: 'Parking Lease Lessor', source: 'manual', description: 'Parking lease lessor', usedIn: ['ic_deck', 'om'] },
  { token: 'PARKING_LEASE_SPACES', label: 'Parking Lease Spaces', source: 'manual', format: 'number', description: 'Number of parking lease spaces', usedIn: ['ic_deck', 'om'] },
  { token: 'NW_STREET_LEASE_LESSOR', label: 'NW Street Lease Lessor', source: 'manual', description: 'Secondary street lease lessor', usedIn: ['ic_deck', 'om'] },
  { token: 'NW_STREET_LEASE_RENT', label: 'NW Street Lease Rent', source: 'manual', description: 'Monthly rent and escalation terms', usedIn: ['ic_deck', 'om'] },
  { token: 'TDOCK_HOTEL_LESSOR', label: 'T-Dock/Hotel Lease Lessor', source: 'manual', description: 'T-Dock hotel lease lessor', usedIn: ['ic_deck', 'om'] },
  { token: 'TDOCK_HOTEL_RENT', label: 'T-Dock/Hotel Lease Rent', source: 'manual', description: 'T-Dock rent amount and terms', usedIn: ['ic_deck', 'om'] },

  // ═══════════════════════════════════════════════════════════════════════════
  // NARRATIVE / EXECUTIVE SUMMARY (manual or AI-generated)
  // ═══════════════════════════════════════════════════════════════════════════
  { token: 'EXEC_SUMMARY_NARRATIVE', label: 'Executive Summary', source: 'manual', description: 'Executive summary narrative paragraph(s)', usedIn: ['ic_deck', 'om'] },
  { token: 'PROPERTY_OVERVIEW_NARRATIVE', label: 'Property Overview Narrative', source: 'manual', description: 'Property overview narrative text', usedIn: ['ic_deck', 'om'] },
  { token: 'UPSIDE_BULLETS', label: 'Upside Bullet Points', source: 'manual', description: 'JSON array of upside opportunity bullets', usedIn: ['ic_deck'] },
  { token: 'INVESTMENT_HIGHLIGHTS', label: 'Investment Highlights', source: 'manual', description: 'JSON array of 4 highlight callout objects {icon, text}', usedIn: ['om'] },
  { token: 'LOCATION_OVERVIEW_NARRATIVE', label: 'Location Overview', source: 'manual', description: 'Location/market narrative text', usedIn: ['om'] },
  { token: 'BNB_NARRATIVE', label: 'B&B Afloat Narrative', source: 'manual', description: 'B&B Afloat description paragraph', usedIn: ['ic_deck', 'om'] },
  { token: 'MARKET_OVERVIEW_NARRATIVE', label: 'Market Overview', source: 'manual', description: 'Market/metro overview narrative', usedIn: ['om'] },
  { token: 'PRO_FORMA_PLAN_NARRATIVE', label: 'Pro Forma Business Plan', source: 'manual', description: 'Pro forma business plan narrative', usedIn: ['om'] },
  { token: 'ADJUSTMENTS_FOOTNOTES', label: 'Adjustments Footnotes', source: 'manual', description: 'Pro forma detail adjustments footnote block', usedIn: ['ic_deck', 'om'] },
  { token: 'OTHER_OPPORTUNITIES', label: 'Other Opportunities', source: 'manual', description: 'JSON array of opportunity callout cards not in projection', usedIn: ['om'] },

  // ═══════════════════════════════════════════════════════════════════════════
  // COMPETITIVE SET (manual — comp-specific arrays)
  // ═══════════════════════════════════════════════════════════════════════════
  { token: 'COMP_SET_TABLE', label: 'Competitive Set Table', source: 'comps', bindingPath: 'comps.compSetTable', description: 'JSON array of comp marina objects with rates, occupancy, distance, etc.', usedIn: ['ic_deck', 'om'] },
  { token: 'COMP_SET_MAP_IMAGE_URL', label: 'Comp Set Map', source: 'manual', description: 'URL to competitive set map image', usedIn: ['ic_deck', 'om'] },

  // ═══════════════════════════════════════════════════════════════════════════
  // RENT ROLL TABLES (live from rent roll)
  // ═══════════════════════════════════════════════════════════════════════════
  { token: 'SUMMER_RENT_ROLL_TABLE', label: 'Summer Rent Roll Table', source: 'rentroll', bindingPath: 'rentroll.summerTable', description: 'JSON array — summer rent roll by location/contract type', usedIn: ['ic_deck'] },
  { token: 'WINTER_RENT_ROLL_TABLE', label: 'Winter Rent Roll Table', source: 'rentroll', bindingPath: 'rentroll.winterTable', description: 'JSON array — winter rent roll by location/contract type', usedIn: ['ic_deck'] },
  { token: 'SEASONAL_RATE_TABLE', label: 'Seasonal Dockage Rates', source: 'rentroll', bindingPath: 'rentroll.seasonalRateTable', description: 'JSON — summer/winter rates by LOA bracket', usedIn: ['om'] },
  { token: 'TRANSIENT_RATE_TABLE', label: 'Transient Dockage Rates', source: 'rentroll', bindingPath: 'rentroll.transientRateTable', description: 'JSON — daily/weekly/monthly transient rates by size', usedIn: ['om'] },
  { token: 'HISTORICAL_RATE_GROWTH_TABLE', label: 'Historical Rate Growth', source: 'rentroll', bindingPath: 'rentroll.historicalRateGrowth', description: 'JSON — year-over-year rate growth table', usedIn: ['ic_deck'] },

  // ═══════════════════════════════════════════════════════════════════════════
  // B&B AFLOAT TABLE (manual)
  // ═══════════════════════════════════════════════════════════════════════════
  { token: 'BNB_VESSEL_TABLE', label: 'B&B Vessel Table', source: 'manual', description: 'JSON array of vessel objects: {name, beds, baths, startingRate, fcRevenue}', usedIn: ['ic_deck', 'om'] },
  { token: 'BNB_TOTAL_REVENUE', label: 'B&B Total Revenue', source: 'proforma', bindingPath: 'proforma.currentYear.bnbRevenue', format: 'currency', description: 'Total B&B Afloat revenue including fees', usedIn: ['ic_deck'] },

  // ═══════════════════════════════════════════════════════════════════════════
  // PRO FORMA TABLES (live from proforma projections)
  // ═══════════════════════════════════════════════════════════════════════════
  { token: 'PROFORMA_SUMMARY_TABLE', label: 'Pro Forma Summary', source: 'proforma', bindingPath: 'proforma.summaryTable', description: 'JSON — year-by-year summary: Revenue, COGS, OpEx, EBITDAM, EBITDA, NOI, DSCR, Cap Rate, IRR, EM', usedIn: ['ic_deck'] },
  { token: 'PROFORMA_DETAIL_TABLE', label: 'Pro Forma Detail', source: 'proforma', bindingPath: 'proforma.detailTable', description: 'JSON — full line-item revenue, COGS, gross profit, OpEx by year', usedIn: ['ic_deck', 'om'] },
  { token: 'SOURCES_USES_TABLE', label: 'Sources & Uses', source: 'capitalStack', bindingPath: 'capitalStack.sourcesUsesTable', description: 'JSON — structured sources and uses table', usedIn: ['ic_deck'] },
  { token: 'OPERATING_PROJECTIONS_TABLE', label: 'Summary Operating Projections', source: 'proforma', bindingPath: 'proforma.operatingProjectionsTable', description: 'JSON — condensed operating projections by year', usedIn: ['ic_deck'] },
  { token: 'LEASE_EXPENSE_TABLE', label: 'Lease Expense Projections', source: 'proforma', bindingPath: 'proforma.leaseExpenseTable', description: 'JSON — ground/parking/street lease expenses by year', usedIn: ['ic_deck', 'om'] },
  { token: 'OM_NOI_TABLE', label: 'OM NOI Forecast Table', source: 'proforma', bindingPath: 'proforma.omNoiTable', description: 'JSON — Owner F/C, Adjustment, Adj F/C columns with footnotes', usedIn: ['om'] },
  { token: 'OM_PROFORMA_TABLE', label: 'OM Pro Forma Table', source: 'proforma', bindingPath: 'proforma.omProformaTable', description: 'JSON — F/C + 5 year-by-year pro forma for OM', usedIn: ['om'] },
  { token: 'OM_EXPENSE_ASSUMPTIONS_TABLE', label: 'OM Expense Assumptions', source: 'proforma', bindingPath: 'proforma.omExpenseAssumptions', description: 'JSON — each expense line with F/C, Year 1, methodology', usedIn: ['om'] },

  // ═══════════════════════════════════════════════════════════════════════════
  // SENSITIVITY ANALYSIS (live from stress test engine)
  // ═══════════════════════════════════════════════════════════════════════════
  { token: 'SENSITIVITY_RATE_GROWTH', label: 'Rate Growth Sensitivity', source: 'proforma', bindingPath: 'proforma.sensitivityRateGrowth', description: 'JSON array — rows of {scenario, cagr, irrGross} for rate growth', usedIn: ['ic_deck'] },
  { token: 'SENSITIVITY_INSURANCE', label: 'Insurance Sensitivity', source: 'proforma', bindingPath: 'proforma.sensitivityInsurance', description: 'JSON array — insurance CAGR sensitivity', usedIn: ['ic_deck'] },
  { token: 'SENSITIVITY_PAYROLL', label: 'Payroll Sensitivity', source: 'proforma', bindingPath: 'proforma.sensitivityPayroll', description: 'JSON array — payroll CAGR sensitivity', usedIn: ['ic_deck'] },
  { token: 'SENSITIVITY_PROPERTY_TAX', label: 'Property Tax Sensitivity', source: 'proforma', bindingPath: 'proforma.sensitivityPropertyTax', description: 'JSON array — property tax CAGR sensitivity', usedIn: ['ic_deck'] },

  // ═══════════════════════════════════════════════════════════════════════════
  // DEMOGRAPHICS & MARKET (live from demographics / manual)
  // ═══════════════════════════════════════════════════════════════════════════
  { token: 'POPULATION_5MI', label: 'Population (5 mi)', source: 'demographics', bindingPath: 'demographics.population5mi', format: 'number', description: '5-mile radius population', usedIn: ['om'] },
  { token: 'POPULATION_10MI', label: 'Population (10 mi)', source: 'demographics', bindingPath: 'demographics.population10mi', format: 'number', description: '10-mile radius population', usedIn: ['om'] },
  { token: 'POPULATION_25MI', label: 'Population (25 mi)', source: 'demographics', bindingPath: 'demographics.population25mi', format: 'number', description: '25-mile radius population', usedIn: ['om'] },
  { token: 'AVG_HH_INCOME_5MI', label: 'Avg HH Income (5 mi)', source: 'demographics', bindingPath: 'demographics.avgHhIncome5mi', format: 'currency', description: '5-mile avg household income', usedIn: ['om'] },
  { token: 'MEDIAN_HH_INCOME_5MI', label: 'Median HH Income (5 mi)', source: 'demographics', bindingPath: 'demographics.medianHhIncome5mi', format: 'currency', description: '5-mile median household income', usedIn: ['om'] },
  { token: 'BOATING_PARTICIPATION_PCT', label: 'Boating Participation %', source: 'demographics', bindingPath: 'demographics.boatingParticipationPct', format: 'percent', description: '% of households participating in boating', usedIn: ['om'] },
  { token: 'TOURISM_FACTS', label: 'Key Tourism Facts', source: 'manual', description: 'JSON array of 4 tourism stat callouts', usedIn: ['om'] },
  { token: 'POPULATION_GROWTH_CHART', label: 'Population Growth Data', source: 'demographics', bindingPath: 'demographics.populationGrowthChart', description: 'JSON — population growth chart data points', usedIn: ['om'] },
  { token: 'NEIGHBORHOOD_MAP_URL', label: 'Neighborhood Map', source: 'manual', description: 'URL to neighborhood amenity map image', usedIn: ['om'] },

  // ═══════════════════════════════════════════════════════════════════════════
  // BROKER / CONTACT (OM back cover)
  // ═══════════════════════════════════════════════════════════════════════════
  { token: 'BROKER_TEAM', label: 'Broker Team', source: 'manual', description: 'JSON array of {name, title, phone, email} for broker team', usedIn: ['om'] },
  { token: 'BROKER_OF_RECORD', label: 'Broker of Record', source: 'manual', description: 'Broker of record name and license', usedIn: ['om'] },
  { token: 'FIRM_ADDRESS', label: 'Firm Address', source: 'manual', description: 'Brokerage firm address', usedIn: ['om'] },
  { token: 'TOUR_CONTACT_NAME', label: 'Tour Contact Name', source: 'manual', description: 'Property tour contact name', usedIn: ['om'] },
  { token: 'TOUR_CONTACT_PHONE', label: 'Tour Contact Phone', source: 'manual', description: 'Property tour contact phone', usedIn: ['om'] },
  { token: 'TOUR_CONTACT_EMAIL', label: 'Tour Contact Email', source: 'manual', description: 'Property tour contact email', usedIn: ['om'] },

  // ═══════════════════════════════════════════════════════════════════════════
  // REVENUE CHART DATA (live arrays for charts)
  // ═══════════════════════════════════════════════════════════════════════════
  { token: 'REVENUE_BY_YEAR_CHART', label: 'Revenue by Year', source: 'proforma', bindingPath: 'proforma.revenueByYearChart', description: 'JSON — [{year, storage, marinaAmenities, shipStore, service, thirdParty, bnb}]', usedIn: ['ic_deck'] },
  { token: 'EBITDAM_BY_YEAR_CHART', label: 'EBITDAM by Year', source: 'proforma', bindingPath: 'proforma.ebitdamByYearChart', description: 'JSON — [{year, ebitdam}] for bar chart', usedIn: ['ic_deck'] },
  { token: 'REVENUE_CAGR_CHART', label: 'Revenue CAGR Chart', source: 'proforma', bindingPath: 'proforma.revenueCagrChart', description: 'JSON — [{year, revenueMillions}] with CAGR arrow', usedIn: ['ic_deck'] },
  { token: 'EBITDAM_CAGR_CHART', label: 'EBITDAM CAGR Chart', source: 'proforma', bindingPath: 'proforma.ebitdamCagrChart', description: 'JSON — [{year, ebitdamMillions}] with CAGR arrow', usedIn: ['ic_deck'] },
];

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Get all tokens used by a specific template */
export function getTokensForTemplate(templateType: 'ic_deck' | 'om'): TokenDefinition[] {
  return MASTER_TOKEN_MAP.filter(t => t.usedIn.includes(templateType));
}

/** Get only live (auto-bound) tokens */
export function getLiveTokens(): TokenDefinition[] {
  return MASTER_TOKEN_MAP.filter(t => t.source !== 'manual' && t.bindingPath);
}

/** Get only manual tokens requiring user input */
export function getManualTokens(): TokenDefinition[] {
  return MASTER_TOKEN_MAP.filter(t => t.source === 'manual');
}

/** Get token by name */
export function getToken(tokenName: string): TokenDefinition | undefined {
  return MASTER_TOKEN_MAP.find(t => t.token === tokenName);
}

/** Count summary */
export const TOKEN_SUMMARY = {
  total: MASTER_TOKEN_MAP.length,
  live: MASTER_TOKEN_MAP.filter(t => t.source !== 'manual' && t.bindingPath).length,
  manual: MASTER_TOKEN_MAP.filter(t => t.source === 'manual').length,
  icDeck: MASTER_TOKEN_MAP.filter(t => t.usedIn.includes('ic_deck')).length,
  om: MASTER_TOKEN_MAP.filter(t => t.usedIn.includes('om')).length,
};
