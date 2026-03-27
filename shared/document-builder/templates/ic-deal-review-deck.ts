/**
 * IC / Deal Review Deck Template
 * Modeled after the Southern Marinas internal deal review presentation.
 * 14 sections, institutional CRE deck format.
 *
 * Style: Navy/white corporate palette, clean sans-serif, data-dense tables,
 *        sponsor logo top-right, "PROPRIETARY AND CONFIDENTIAL" footer.
 */

export const IC_DEAL_REVIEW_DECK_TEMPLATE = {
  id: 'tpl_ic_deal_review_deck_marina_v1',
  name: 'IC Deal Review Deck — Marina Acquisition',
  description: 'Internal investment committee deal review presentation for marina acquisitions. Includes executive summary, ground leases, rent roll analysis, competitive set, financial projections, debt term sheet, and sensitivity analysis.',
  category: 'ic_memo',
  documentType: 'ic_memo' as const,
  assetClass: 'marina' as const,
  audience: ['investment_committee', 'private_equity'] as const,
  estimatedPages: { min: 14, max: 20 },
  defaultExportFormat: 'pdf' as const,
  supportedExportFormats: ['pdf', 'pptx'] as const,

  style: {
    palette: {
      primary: '#1B365D',      // Navy
      secondary: '#FFFFFF',    // White
      accent: '#4A90D9',       // Light blue
      text: '#1B365D',
      tableHeader: '#1B365D',
      tableHeaderText: '#FFFFFF',
      tableAlt: '#F5F7FA',
      highlight: '#FFD700',    // Yellow highlight for key metrics
      footer: '#666666',
    },
    typography: {
      headingFont: 'Inter, Helvetica Neue, sans-serif',
      bodyFont: 'Inter, Helvetica Neue, sans-serif',
      headingSize: '28px',
      subheadingSize: '14px',
      bodySize: '11px',
      tableSize: '10px',
    },
    layout: {
      pageSize: 'landscape',   // Deck format = 16:9
      margins: { top: 60, right: 40, bottom: 40, left: 40 },
      headerHeight: 50,
      footerText: 'PROPRIETARY AND CONFIDENTIAL',
      showPageNumbers: true,
      showSponsorLogo: true,
    },
  },

  sections: [
    // ─── 1. COVER ──────────────────────────────────────────────────────────
    {
      key: 'ic_cover',
      title: 'Cover',
      order: 1,
      enabled: true,
      required: true,
      description: 'Title slide with property name, location, date, sponsor logo',
      tokens: ['PROPERTY_NAME', 'PROPERTY_CITY', 'PROPERTY_STATE', 'DOCUMENT_DATE', 'SPONSOR_LOGO_URL', 'HERO_IMAGE_URL'],
      blocks: [
        { type: 'image', key: 'hero', config: { fullBleed: true, overlay: 'rgba(27,54,93,0.55)' } },
        { type: 'heading', key: 'title', config: { level: 1, text: '{{PROPERTY_NAME}}', color: '#FFFFFF' } },
        { type: 'text', key: 'location', config: { text: '{{PROPERTY_CITY}}, {{PROPERTY_STATE}}', color: '#FFFFFF', size: '18px' } },
        { type: 'image', key: 'logo', config: { position: 'bottom-center', maxHeight: 80 } },
      ],
    },

    // ─── 2. EXECUTIVE SUMMARY ──────────────────────────────────────────────
    {
      key: 'ic_executive_summary',
      title: 'Executive Summary',
      order: 2,
      enabled: true,
      required: true,
      description: 'Property narrative, key stats callout, upside bullets, base case returns',
      tokens: [
        'PROPERTY_NAME', 'PROPERTY_CITY', 'PROPERTY_STATE', 'EXEC_SUMMARY_NARRATIVE',
        'PURCHASE_PRICE', 'IRR_GROSS', 'IRR_NET', 'EM_GROSS', 'EM_NET',
        'YEAR1_CAP_RATE', 'YEAR1_EBITDAM', 'TOTAL_SLIPS', 'AVG_LOA',
        'BNB_VESSEL_COUNT', 'UPSIDE_BULLETS', 'STORAGE_RATE_CAGR',
        'EXPENSE_CAGR', 'INSURANCE_CAGR', 'PROPERTY_TAX_CAGR', 'EXIT_YEAR',
      ],
      blocks: [
        { type: 'heading', key: 'title', config: { level: 1, text: 'Executive Summary' } },
        { type: 'text', key: 'narrative', config: { token: 'EXEC_SUMMARY_NARRATIVE' } },
        { type: 'text', key: 'property_overview_label', config: { text: 'Property Overview', bold: true } },
        { type: 'bullet_list', key: 'property_bullets', config: { token: 'UPSIDE_BULLETS' } },
        { type: 'metric_grid', key: 'base_case_returns', config: {
          title: 'SM Base Case Returns',
          columns: 2,
          metrics: [
            { label: 'Proposed Purchase Price', token: 'PURCHASE_PRICE', format: 'currency' },
            { label: 'Base Case IRR (Gross / Net)', tokens: ['IRR_GROSS', 'IRR_NET'], format: 'percent_pair' },
            { label: 'Base Case EM (Gross / Net)', tokens: ['EM_GROSS', 'EM_NET'], format: 'multiple_pair' },
            { label: 'Year 1 Cap Rate', token: 'YEAR1_CAP_RATE', format: 'percent' },
            { label: 'Year 1 EBITDAM', token: 'YEAR1_EBITDAM', format: 'currency' },
            { label: 'Storage Rate CAGR', token: 'STORAGE_RATE_CAGR', format: 'percent' },
          ],
        }},
      ],
    },

    // ─── 3. GROUND LEASES ──────────────────────────────────────────────────
    {
      key: 'ic_ground_leases',
      title: 'Ground Leases',
      order: 3,
      enabled: true,
      required: false,
      description: '4-panel ground/parking/street/hotel lease structure + projected lease expense table',
      tokens: [
        'GL_LESSOR', 'GL_LESSEE', 'GL_DATE', 'GL_TERM_EXPIRY', 'GL_RENT_TERMS',
        'PARKING_LEASE_LESSOR', 'PARKING_LEASE_SPACES',
        'NW_STREET_LEASE_LESSOR', 'NW_STREET_LEASE_RENT',
        'TDOCK_HOTEL_LESSOR', 'TDOCK_HOTEL_RENT',
        'LEASE_EXPENSE_TABLE',
      ],
      blocks: [
        { type: 'heading', key: 'title', config: { level: 1, text: 'Ground Leases' } },
        { type: 'table', key: 'ground_lease', config: { title: 'Ground Lease', style: 'key_value', rows: [
          { label: 'Lessor', token: 'GL_LESSOR' },
          { label: 'Lessee', token: 'GL_LESSEE' },
          { label: 'Date of Lease', token: 'GL_DATE' },
          { label: 'Term', token: 'GL_TERM_EXPIRY' },
          { label: 'Rent', token: 'GL_RENT_TERMS' },
        ]}},
        { type: 'table', key: 'parking_lease', config: { title: 'Parking Lease', style: 'key_value', rows: [
          { label: 'Lessor', token: 'PARKING_LEASE_LESSOR' },
          { label: 'Spaces', token: 'PARKING_LEASE_SPACES' },
        ]}},
        { type: 'table', key: 'nw_street_lease', config: { title: 'North Washington Street Lease', style: 'key_value', rows: [
          { label: 'Lessor', token: 'NW_STREET_LEASE_LESSOR' },
          { label: 'Rent', token: 'NW_STREET_LEASE_RENT' },
        ]}},
        { type: 'table', key: 'tdock_lease', config: { title: 'T-Dock Hotel Lease', style: 'key_value', rows: [
          { label: 'Lessor', token: 'TDOCK_HOTEL_LESSOR' },
          { label: 'Rent', token: 'TDOCK_HOTEL_RENT' },
        ]}},
        { type: 'table', key: 'lease_expense_projections', config: { title: 'Lease Expense Projections', token: 'LEASE_EXPENSE_TABLE', style: 'year_projection' } },
      ],
    },

    // ─── 4. PROPERTY OVERVIEW ──────────────────────────────────────────────
    {
      key: 'ic_property_overview',
      title: 'Property Overview',
      order: 4,
      enabled: true,
      required: true,
      description: 'Aerial/site map with labeled docks (A-G), amenities list',
      tokens: ['AERIAL_IMAGE_URL', 'DOCK_MAP_IMAGE_URL', 'PROPERTY_NAME', 'TOTAL_SLIPS', 'PARKING_SPACES', 'BNB_VESSEL_COUNT'],
      blocks: [
        { type: 'heading', key: 'title', config: { level: 1, text: 'Property Overview' } },
        { type: 'image', key: 'aerial', config: { token: 'DOCK_MAP_IMAGE_URL', fullBleed: true, caption: 'Labeled dock layout with amenities' } },
      ],
    },

    // ─── 5. COMPETITIVE SET OVERVIEW ───────────────────────────────────────
    {
      key: 'ic_competitive_set',
      title: 'Competitive Set Overview',
      order: 5,
      enabled: true,
      required: false,
      description: 'Map + detailed comp table: Name, Ownership, Rating, Distance, Slip Count, Occupancy, Rates, % Variance',
      tokens: ['COMP_SET_MAP_IMAGE_URL', 'COMP_SET_TABLE', 'PROPERTY_NAME'],
      blocks: [
        { type: 'heading', key: 'title', config: { level: 1, text: 'Competitive Set Overview' } },
        { type: 'image', key: 'comp_map', config: { token: 'COMP_SET_MAP_IMAGE_URL' } },
        { type: 'table', key: 'comp_table', config: {
          token: 'COMP_SET_TABLE',
          style: 'comp_comparison',
          columns: ['Name', 'Ownership', 'Overall Property Rating', 'Distance to Subject', 'Slip Count', 'Est. Occupancy', 'Waitlist',
                    'Avg Rate ($/ft.) - Summer', '% Var to Subject', 'Avg Rate ($/ft.) - Winter', '% Var to Subject',
                    'Avg Rate ($/ft/night) - Daily', '% Var to Subject', 'Avg Rate ($/ft/night) - Weekly', '% Var to Subject',
                    'Avg Rate ($/ft/night) - Monthly', '% Var to Subject', 'Liveaboard Fee', '% Var to Subject', 'Notes'],
          subjectColumn: 0,
          highlightVariance: true,
        }},
      ],
    },

    // ─── 6. RENT ROLL ANALYSIS ─────────────────────────────────────────────
    {
      key: 'ic_rent_roll',
      title: 'Rent Roll Analysis',
      order: 6,
      enabled: true,
      required: true,
      description: 'Summer + Winter tables with Contract Length Allocation, Slip Status Allocation side panels, historical rate growth',
      tokens: [
        'SUMMER_RENT_ROLL_TABLE', 'WINTER_RENT_ROLL_TABLE',
        'SUMMER_OCCUPANCY', 'WINTER_OCCUPANCY', 'SUMMER_RATE_PER_FT', 'WINTER_RATE_PER_FT',
        'HISTORICAL_RATE_GROWTH_TABLE',
      ],
      blocks: [
        { type: 'heading', key: 'title', config: { level: 1, text: 'Rent Roll Analysis' } },
        { type: 'text', key: 'rates_narrative', config: { text: 'Current Rates & Seasonality', bold: true } },
        { type: 'table', key: 'summer_table', config: { title: 'SUMMER', token: 'SUMMER_RENT_ROLL_TABLE', style: 'rent_roll',
          columns: ['Location', 'Average Contract Length', 'Capacity', 'Leasable', 'Leased', 'Avg. LOA', 'Occupancy', 'Total Annualized Effective Revenue', 'Revenue per Occ. Space'] }},
        { type: 'table', key: 'winter_table', config: { title: 'WINTER', token: 'WINTER_RENT_ROLL_TABLE', style: 'rent_roll',
          columns: ['Location', 'Average Contract Length', 'Capacity', 'Leasable', 'Leased', 'Avg. LOA', 'Occupancy', 'Total Annualized Effective Revenue', 'Revenue per Occ. Space'] }},
        { type: 'table', key: 'historical_rates', config: { title: 'HISTORICAL RATE GROWTH', token: 'HISTORICAL_RATE_GROWTH_TABLE', style: 'rate_growth' } },
      ],
    },

    // ─── 7. STORAGE REVENUE ANALYSIS ───────────────────────────────────────
    {
      key: 'ic_storage_revenue',
      title: 'Storage Revenue Analysis',
      order: 7,
      enabled: true,
      required: false,
      description: 'Revenue breakdown table + pie chart: Summer/Winter/Transient/Liveaboard/Other mix',
      tokens: ['STORAGE_REVENUE', 'TRANSIENT_REVENUE', 'LIVEABOARD_REVENUE', 'STORAGE_REV_PCT'],
      blocks: [
        { type: 'heading', key: 'title', config: { level: 1, text: 'Storage Revenue Analysis' } },
        { type: 'text', key: 'narrative', config: { text: 'The Storage operation at {{PROPERTY_NAME}} accounts for {{STORAGE_REV_PCT}} of Gross Revenue.' } },
        { type: 'table', key: 'revenue_breakdown', config: { style: 'revenue_breakdown', title: 'Revenue' } },
        { type: 'chart', key: 'revenue_mix_pie', config: { chartType: 'pie', title: 'Revenue Mix', dataFields: ['Summer', 'Winter', 'Transient', 'Liveaboard Fees', 'Dingy Storage'] } },
      ],
    },

    // ─── 8. B&B AFLOAT ─────────────────────────────────────────────────────
    {
      key: 'ic_bnb_afloat',
      title: 'B&B Afloat',
      order: 8,
      enabled: true,
      required: false,
      description: 'B&B narrative + vessel/room table with rates and revenue',
      tokens: ['BNB_NARRATIVE', 'BNB_VESSEL_TABLE', 'BNB_TOTAL_REVENUE'],
      blocks: [
        { type: 'heading', key: 'title', config: { level: 1, text: 'B&B Afloat' } },
        { type: 'text', key: 'narrative', config: { token: 'BNB_NARRATIVE' } },
        { type: 'table', key: 'vessel_table', config: {
          token: 'BNB_VESSEL_TABLE',
          columns: ['Vessel/Room', '# of Bed/Bath', 'Starting Rates', 'FC Revenue'],
          style: 'bnb_vessel',
          showTotal: true, totalLabel: 'Total B&B Afloat Revenue:', totalToken: 'BNB_TOTAL_REVENUE',
        }},
      ],
    },

    // ─── 9. FINANCIAL OVERVIEW ─────────────────────────────────────────────
    {
      key: 'ic_financial_overview',
      title: 'Financial Overview',
      order: 9,
      enabled: true,
      required: true,
      description: 'Revenue mix pie, Gross Profit pie, Revenue Mix bar by year, EBITDAM Growth bar by year',
      tokens: [
        'STORAGE_REV_PCT', 'MARINA_AMENITIES_REV_PCT', 'SERVICE_REV_PCT', 'BNB_REV_PCT', 'THIRD_PARTY_LEASE_REV_PCT',
        'REVENUE_BY_YEAR_CHART', 'EBITDAM_BY_YEAR_CHART',
      ],
      blocks: [
        { type: 'heading', key: 'title', config: { level: 1, text: 'Financial Overview' } },
        { type: 'chart', key: 'revenue_pie', config: { chartType: 'pie', title: 'Revenue Mix', position: 'top-left' } },
        { type: 'chart', key: 'revenue_bar', config: { chartType: 'stacked_bar', title: 'Revenue Mix by Year', token: 'REVENUE_BY_YEAR_CHART', position: 'top-right' } },
        { type: 'chart', key: 'gp_pie', config: { chartType: 'pie', title: 'Gross Profit Mix', position: 'bottom-left' } },
        { type: 'chart', key: 'ebitdam_bar', config: { chartType: 'bar', title: 'EBITDAM Growth', token: 'EBITDAM_BY_YEAR_CHART', position: 'bottom-right' } },
      ],
    },

    // ─── 10. SAMPLE DEBT TERM SHEET ────────────────────────────────────────
    {
      key: 'ic_debt_term_sheet',
      title: 'Sample Debt Financing Term Sheet',
      order: 10,
      enabled: true,
      required: false,
      description: 'Structured debt term sheet table matching the Constitution Marina layout',
      tokens: [
        'PURCHASE_PRICE', 'EXIT_YEAR', 'RECOURSE', 'LOAN_AMOUNT', 'LTV', 'LOAN_TYPE',
        'LOAN_TERM_YEARS', 'AMORTIZATION_YEARS', 'IO_PERIOD_MONTHS', 'PI_ADS', 'IO_ADS',
        'RATE_STRUCTURE', 'INTEREST_RATE', 'PREPAYMENT_PENALTY',
        'FINANCING_FEE_PCT', 'EXTENSION_FEE_PCT', 'EXIT_FEE_PCT', 'DSCR_COVENANT',
      ],
      blocks: [
        { type: 'heading', key: 'title', config: { level: 1, text: 'Sample Debt Financing Term Sheet' } },
        { type: 'table', key: 'term_sheet', config: {
          style: 'term_sheet',
          headerRow: [{ label: 'Purchase Price: {{PURCHASE_PRICE}}' }, { label: 'Exit Year: {{EXIT_YEAR}}', value: 'Bank' }],
          rows: [
            { label: 'Recourse', token: 'RECOURSE' },
            { label: 'Loan Amount', token: 'LOAN_AMOUNT' },
            { label: 'Loan Type', token: 'LOAN_TYPE' },
            { label: 'LTV', token: 'LTV' },
            { label: 'Loan Term (Yrs.)', token: 'LOAN_TERM_YEARS' },
            { label: 'Amortization (Yrs.)', token: 'AMORTIZATION_YEARS' },
            { label: 'Interest Only Period (Months)', token: 'IO_PERIOD_MONTHS' },
            { label: 'P&I ADS', token: 'PI_ADS', italic: true },
            { label: 'Interest-Only ADS', token: 'IO_ADS', italic: true },
            { label: 'Rate Structure', token: 'RATE_STRUCTURE', bold: true },
            { label: 'Interest Rate', token: 'INTEREST_RATE', bold: true },
            { label: 'Prepayment Penalty', token: 'PREPAYMENT_PENALTY', bold: true },
            { label: 'Financing Fees', token: 'FINANCING_FEE_PCT' },
            { label: 'Extension Fees', token: 'EXTENSION_FEE_PCT' },
            { label: 'Exit Fees', token: 'EXIT_FEE_PCT' },
            { label: 'DSCR Covenant (Ratio)', token: 'DSCR_COVENANT' },
          ],
        }},
      ],
    },

    // ─── 11. UNDERWRITING ASSUMPTIONS ──────────────────────────────────────
    {
      key: 'ic_underwriting_assumptions',
      title: 'Underwriting Assumptions',
      order: 11,
      enabled: true,
      required: true,
      description: 'Sources & Uses, Key Operating Assumptions (revenue/expense CAGRs), Summary Operating Projections table',
      tokens: [
        'SOURCES_USES_TABLE', 'PURCHASE_PRICE', 'CLOSING_COSTS', 'TRANSITION_COSTS',
        'WORKING_CAPITAL', 'TOTAL_USES', 'EQUITY_AMOUNT', 'EQUITY_PCT', 'LOAN_AMOUNT', 'LTV',
        'STORAGE_RATE_CAGR', 'NON_STORAGE_REV_CAGR', 'REVENUE_CAGR',
        'PAYROLL_CAGR', 'INSURANCE_CAGR', 'PROPERTY_TAX_CAGR', 'EXPENSE_CAGR',
        'INTEREST_RATE', 'AMORTIZATION_YEARS', 'LOAN_TERM_YEARS',
        'EXIT_YEAR', 'EXIT_CAP_RATE', 'EXIT_VALUE',
        'OPERATING_PROJECTIONS_TABLE',
      ],
      blocks: [
        { type: 'heading', key: 'title', config: { level: 1, text: 'Underwriting Assumptions' } },
        { type: 'table', key: 'sources_uses', config: { token: 'SOURCES_USES_TABLE', style: 'sources_uses', title: 'Funding Sources and Uses' } },
        { type: 'table', key: 'key_assumptions', config: { title: 'Key Operating Assumptions', style: 'assumptions_grid' } },
        { type: 'table', key: 'operating_projections', config: { token: 'OPERATING_PROJECTIONS_TABLE', title: 'Summary Operating Projections', style: 'year_projection' } },
      ],
    },

    // ─── 12. PRO FORMA FINANCIALS ──────────────────────────────────────────
    {
      key: 'ic_proforma_financials',
      title: 'Pro Forma Financials',
      order: 12,
      enabled: true,
      required: true,
      description: 'Full summary table: occupancy, Revenue, COGS, OpEx, EBITDAM, EBITDA, CapEx, NOI, DSCR, Cap Rate, IRR, EM',
      tokens: ['PROFORMA_SUMMARY_TABLE', 'SUMMER_OCCUPANCY', 'WINTER_OCCUPANCY'],
      blocks: [
        { type: 'heading', key: 'title', config: { level: 1, text: 'Pro Forma Financials' } },
        { type: 'table', key: 'summary_projections', config: {
          token: 'PROFORMA_SUMMARY_TABLE',
          title: 'Summary Operating Projections',
          style: 'proforma_summary',
          includeActuals: true,
          projectionYears: 5,
          showCAGR: true,
          sections: ['occupancy', 'revenue', 'cogs', 'opex', 'ebitdam', 'mgmtFee', 'ebitda', 'capex', 'noi', 'dscr', 'capRate', 'irr', 'em'],
        }},
      ],
    },

    // ─── 13. PRO FORMA DETAIL ──────────────────────────────────────────────
    {
      key: 'ic_proforma_detail',
      title: 'Pro Forma Detail',
      order: 13,
      enabled: true,
      required: true,
      description: 'Line-item revenue, COGS, Gross Profit, OpEx by year with CAGR + % of Rev columns, adjustments footnotes',
      tokens: ['PROFORMA_DETAIL_TABLE', 'ADJUSTMENTS_FOOTNOTES'],
      blocks: [
        { type: 'heading', key: 'title', config: { level: 1, text: 'Pro Forma Detail' } },
        { type: 'table', key: 'detail_table', config: {
          token: 'PROFORMA_DETAIL_TABLE',
          style: 'proforma_detail',
          sections: [
            { title: 'Revenue', lines: ['Storage', 'Marina & Amenities', 'Ship Store/Retail', 'Service', 'Third-Party Leases', 'B&B Afloat'] },
            { title: 'COGS', lines: ['Marina & Amenities', 'Ship Store/Retail', 'Service', 'B&B Afloat'] },
            { title: 'Gross Profit', lines: ['Storage', 'Marina & Amenities', 'Ships Store/Retail', 'Service', 'Third-Party Leases', 'B&B Afloat'] },
            { title: 'Operating Expenses', lines: ['Payroll', 'General & Administrative', 'Advertising', 'Repairs & Maintenance', 'Utilities', 'Licenses & Permits', 'Security & Contract Services', 'Bank/Credit Card Fees', 'Insurance', 'Property Taxes', 'Lease Expenses'] },
          ],
          showGrowthPct: true,
          showCAGR: true,
          showPctOfRev: true,
        }},
        { type: 'text', key: 'adjustments', config: { token: 'ADJUSTMENTS_FOOTNOTES', style: 'footnotes' } },
      ],
    },

    // ─── 14. RETURN SUMMARY & SENSITIVITY ──────────────────────────────────
    {
      key: 'ic_return_sensitivity',
      title: 'Return Summary & Sensitivity Analysis',
      order: 14,
      enabled: true,
      required: true,
      description: 'Return summary box, Revenue CAGR chart, EBITDAM CAGR chart, 4 sensitivity tables',
      tokens: [
        'IRR_GROSS', 'IRR_NET', 'EM_GROSS', 'EM_NET', 'LEVERAGED_GAIN',
        'UNLEVERAGED_IRR', 'UNLEVERAGED_MOE', 'UNLEVERAGED_GAIN',
        'EXIT_CAP_RATE', 'YEAR1_CAP_RATE', 'BPS_SPREAD',
        'REVENUE_CAGR', 'EBITDAM_CAGR',
        'REVENUE_CAGR_CHART', 'EBITDAM_CAGR_CHART',
        'SENSITIVITY_RATE_GROWTH', 'SENSITIVITY_INSURANCE',
        'SENSITIVITY_PAYROLL', 'SENSITIVITY_PROPERTY_TAX',
      ],
      blocks: [
        { type: 'heading', key: 'title', config: { level: 1, text: 'Return Summary & Sensitivity Analysis' } },
        { type: 'metric_grid', key: 'return_summary', config: {
          title: 'Return Summary | {{EXIT_YEAR}} Exit',
          style: 'return_summary_box',
          metrics: [
            { label: 'Leveraged IRR (Gross / Net)', tokens: ['IRR_GROSS', 'IRR_NET'] },
            { label: 'Leveraged MoE (Gross / Net)', tokens: ['EM_GROSS', 'EM_NET'] },
            { label: 'Leveraged Gain', token: 'LEVERAGED_GAIN' },
            { label: 'Unleveraged IRR', token: 'UNLEVERAGED_IRR' },
            { label: 'Unleveraged MoE', token: 'UNLEVERAGED_MOE' },
            { label: 'Unleveraged Gain', token: 'UNLEVERAGED_GAIN' },
            { label: 'Exit Cap Rate', token: 'EXIT_CAP_RATE' },
            { label: 'Year 1 Going-In Cap Rate', token: 'YEAR1_CAP_RATE' },
            { label: 'BPS Spread', token: 'BPS_SPREAD' },
          ],
        }},
        { type: 'chart', key: 'revenue_cagr', config: { chartType: 'bar_with_cagr', title: 'Revenue CAGR (in $ Millions)', token: 'REVENUE_CAGR_CHART', cagrToken: 'REVENUE_CAGR' } },
        { type: 'chart', key: 'ebitdam_cagr', config: { chartType: 'bar_with_cagr', title: 'EBITDAM CAGR (in $ Millions)', token: 'EBITDAM_CAGR_CHART', cagrToken: 'EBITDAM_CAGR' } },
        { type: 'heading', key: 'sensitivity_header', config: { level: 2, text: 'Sensitivity Analysis' } },
        { type: 'table', key: 'sens_rate_growth', config: {
          token: 'SENSITIVITY_RATE_GROWTH', style: 'sensitivity',
          title: '5-Yr. Rate Gr. CAGR',
          columns: ['Scenario', 'CAGR', 'IRR (Gross)'],
          highlightBaseCase: true,
        }},
        { type: 'table', key: 'sens_insurance', config: {
          token: 'SENSITIVITY_INSURANCE', style: 'sensitivity',
          title: 'Insurance CAGR',
          columns: ['Scenario', 'CAGR', 'IRR (Gross)'],
          highlightBaseCase: true,
        }},
        { type: 'table', key: 'sens_payroll', config: {
          token: 'SENSITIVITY_PAYROLL', style: 'sensitivity',
          title: 'Payroll',
          columns: ['Scenario', 'CAGR', 'IRR (Gross)'],
          highlightBaseCase: true,
        }},
        { type: 'table', key: 'sens_property_tax', config: {
          token: 'SENSITIVITY_PROPERTY_TAX', style: 'sensitivity',
          title: 'Property Taxes',
          columns: ['Scenario', 'CAGR', 'IRR (Gross)'],
          highlightBaseCase: true,
        }},
      ],
    },
  ],

  // All required tokens for this template
  requiredTokens: [
    'PROPERTY_NAME', 'PROPERTY_CITY', 'PROPERTY_STATE', 'PURCHASE_PRICE',
    'IRR_GROSS', 'IRR_NET', 'EM_GROSS', 'EM_NET', 'YEAR1_CAP_RATE', 'YEAR1_EBITDAM',
    'TOTAL_SLIPS', 'EXEC_SUMMARY_NARRATIVE',
  ],
  optionalTokens: [
    'SPONSOR_LOGO_URL', 'HERO_IMAGE_URL', 'AERIAL_IMAGE_URL', 'DOCK_MAP_IMAGE_URL',
    'BNB_VESSEL_TABLE', 'COMP_SET_TABLE', 'COMP_SET_MAP_IMAGE_URL',
    'SENSITIVITY_RATE_GROWTH', 'SENSITIVITY_INSURANCE', 'SENSITIVITY_PAYROLL', 'SENSITIVITY_PROPERTY_TAX',
  ],
};
