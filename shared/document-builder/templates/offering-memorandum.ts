/**
 * Offering Memorandum Template
 * Modeled after the Colliers Leisure Property Advisors Constitution Marina OM.
 * 8 sections, formal broker-facing document.
 *
 * Style: Warm tan/cream (#F5F0E8) background, navy (#1B365D) + gold (#B8976A) accents,
 *        serif-adjacent headings, generous whitespace, large numeral section dividers,
 *        wave motif decorative elements, page numbers with section labels.
 */

export const OFFERING_MEMORANDUM_TEMPLATE = {
  id: 'tpl_offering_memorandum_marina_v1',
  name: 'Offering Memorandum — Marina',
  description: 'Professional broker-quality offering memorandum for marina dispositions. Includes executive summary with offering terms, property details with services & amenities checklist, financial overview with NOI forecast and pro forma, competitive set, and market demographics.',
  category: 'offering_memorandum',
  documentType: 'offering_memorandum' as const,
  assetClass: 'marina' as const,
  audience: ['potential_buyer', 'institutional_investor', 'private_equity', 'family_office'] as const,
  estimatedPages: { min: 28, max: 40 },
  defaultExportFormat: 'pdf' as const,
  supportedExportFormats: ['pdf', 'docx'] as const,

  style: {
    palette: {
      primary: '#1B365D',        // Navy
      secondary: '#B8976A',      // Gold/tan
      background: '#F5F0E8',     // Warm cream
      text: '#2D2D2D',
      headingText: '#B8976A',    // Gold headings
      tableHeader: '#1B365D',
      tableHeaderText: '#FFFFFF',
      tableSubheader: '#B8976A',
      tableSubheaderText: '#FFFFFF',
      tableAlt: '#FAFAF5',
      accent: '#4A6D8C',        // Mid-blue accent
      divider: '#B8976A',
      footer: '#999999',
      calloutBg: 'rgba(27,54,93,0.85)',
      calloutText: '#FFFFFF',
    },
    typography: {
      headingFont: 'Playfair Display, Georgia, serif',
      bodyFont: 'Source Sans Pro, Helvetica Neue, sans-serif',
      sectionNumberFont: 'Playfair Display, Georgia, serif',
      headingSize: '42px',
      sectionNumberSize: '120px',
      subheadingSize: '16px',
      bodySize: '11px',
      tableSize: '10px',
      captionSize: '9px',
    },
    layout: {
      pageSize: 'portrait',
      margins: { top: 50, right: 60, bottom: 60, left: 60 },
      waveMotif: true,            // Decorative wave SVG at top/bottom of pages
      sectionDividerStyle: 'large_numeral', // "1 EXECUTIVE SUMMARY" full-page divider
      pageNumberStyle: 'centered_with_section', // "3 — EXECUTIVE SUMMARY"
      confidentialLabel: true,
    },
  },

  sections: [
    // ─── 1. COVER ──────────────────────────────────────────────────────────
    {
      key: 'om_cover',
      title: 'Cover',
      order: 1,
      enabled: true,
      required: true,
      description: 'Hero image collage, property name, location, broker logo, confidential label',
      tokens: ['PROPERTY_NAME', 'PROPERTY_CITY', 'PROPERTY_STATE', 'HERO_IMAGE_URL', 'BROKER_LOGO_URL', 'CONFIDENTIAL_LABEL'],
      blocks: [
        { type: 'image', key: 'hero_collage', config: { token: 'HERO_IMAGE_URL', layout: 'collage_3' } },
        { type: 'heading', key: 'property_name', config: { level: 1, text: '{{PROPERTY_NAME}}', font: 'heading', color: '#B8976A' } },
        { type: 'text', key: 'location', config: { text: '{{PROPERTY_CITY}}, {{PROPERTY_STATE}}', color: '#B8976A', size: '18px' } },
        { type: 'text', key: 'confidential', config: { text: 'CONFIDENTIAL OFFERING MEMORANDUM', size: '10px', tracking: '0.15em' } },
        { type: 'image', key: 'broker_logo', config: { token: 'BROKER_LOGO_URL', position: 'bottom-left', maxHeight: 40 } },
      ],
    },

    // ─── 2. TABLE OF CONTENTS ──────────────────────────────────────────────
    {
      key: 'om_toc',
      title: 'Table of Contents',
      order: 2,
      enabled: true,
      required: true,
      description: 'Left: tagline with marina photo. Right: 5-section numbered layout on navy background.',
      tokens: ['PROPERTY_NAME', 'LOCATION_TAGLINE'],
      blocks: [
        { type: 'text', key: 'tagline', config: { token: 'LOCATION_TAGLINE', font: 'heading', size: '24px', italic: true } },
        { type: 'table', key: 'toc', config: {
          style: 'toc_numbered',
          entries: [
            { number: 1, title: 'EXECUTIVE SUMMARY' },
            { number: 2, title: 'PROPERTY OVERVIEW' },
            { number: 3, title: 'FINANCIAL OVERVIEW' },
            { number: 4, title: 'NEARBY MARINAS OVERVIEW' },
            { number: 5, title: 'MARKET OVERVIEW' },
          ],
        }},
      ],
    },

    // ─── 3. EXECUTIVE SUMMARY ──────────────────────────────────────────────
    {
      key: 'om_executive_summary',
      title: 'Executive Summary',
      order: 3,
      enabled: true,
      required: true,
      description: 'Section divider → Introduction narrative → Offering Terms/Summary panels → Highlights 4-grid',
      tokens: [
        'PROPERTY_NAME', 'EXEC_SUMMARY_NARRATIVE', 'ASKING_PRICE', 'OWNERSHIP_TYPE',
        'TOUR_CONTACT_NAME', 'TOUR_CONTACT_PHONE', 'TOUR_CONTACT_EMAIL',
        'TOTAL_SLIPS', 'BNB_VESSEL_COUNT', 'FC_REVENUE', 'FC_NOI', 'YEAR1_NOI',
        'INVESTMENT_HIGHLIGHTS', 'AERIAL_IMAGE_URL',
      ],
      blocks: [
        { type: 'divider', key: 'section_divider', config: { sectionNumber: 1, sectionTitle: 'EXECUTIVE SUMMARY', style: 'large_numeral' } },
        { type: 'heading', key: 'intro_title', config: { level: 2, text: 'INTRODUCTION & INVESTMENT OVERVIEW' } },
        { type: 'text', key: 'intro_narrative', config: { token: 'EXEC_SUMMARY_NARRATIVE' } },
        { type: 'image', key: 'aerial_awards', config: { token: 'AERIAL_IMAGE_URL', caption: 'Awards and accolades' } },
        { type: 'metric_grid', key: 'offering_terms', config: {
          title: 'OFFERING TERMS',
          style: 'om_offering_terms',
          background: 'rgba(27,54,93,0.85)',
          metrics: [
            { label: 'ASKING PRICE:', token: 'ASKING_PRICE' },
            { label: 'TITLE VESTING:', token: 'OWNERSHIP_TYPE' },
            { label: 'PROPERTY TOURS:', tokens: ['TOUR_CONTACT_NAME', 'TOUR_CONTACT_PHONE', 'TOUR_CONTACT_EMAIL'] },
          ],
        }},
        { type: 'metric_grid', key: 'offering_summary', config: {
          title: 'OFFERING SUMMARY',
          style: 'om_offering_summary',
          metrics: [
            { label: 'TOTAL # OF SLIPS:', token: 'TOTAL_SLIPS' },
            { label: 'TOTAL # OF B&B AFLOAT RENTAL BOATS:', token: 'BNB_VESSEL_COUNT' },
            { label: '*F/C REVENUE:', token: 'FC_REVENUE', format: 'currency' },
            { label: '*F/C NOI:', token: 'FC_NOI', format: 'currency' },
            { label: 'YEAR 1 PRO FORMA NOI:', token: 'YEAR1_NOI', format: 'currency' },
          ],
        }},
        { type: 'heading', key: 'highlights_title', config: { level: 2, text: 'Highlights' } },
        { type: 'metric_grid', key: 'highlights', config: {
          token: 'INVESTMENT_HIGHLIGHTS',
          style: 'om_highlights_4grid',
          columns: 2,
          background: 'rgba(27,54,93,0.85)',
        }},
      ],
    },

    // ─── 4. PROPERTY OVERVIEW ──────────────────────────────────────────────
    {
      key: 'om_property_overview',
      title: 'Property Overview',
      order: 4,
      enabled: true,
      required: true,
      description: 'Property Details table, Services & Amenities checklist, Utilities, Location narrative, Maps, Ground Leases, Marina asset detail, B&B Afloat',
      tokens: [
        'PROPERTY_NAME', 'PROPERTY_ADDRESS', 'OWNERSHIP_TYPE', 'TOTAL_SLIPS', 'LINEAR_FEET',
        'DOCK_TYPE', 'SIZE_RANGE', 'DOCKSIDE_DEPTH', 'PARKING_SPACES', 'BUILDING_SF',
        'HAS_FUEL_DOCK', 'HAS_PUMP_OUT', 'HAS_ELECTRIC', 'HAS_WATER', 'HAS_SHIP_STORE',
        'HAS_ICE', 'HAS_TRANSIENT', 'HAS_RESTAURANT', 'HAS_LODGING', 'HAS_POOL',
        'HAS_BOAT_RENTAL', 'HAS_LAUNDRY', 'HAS_SECURITY', 'HAS_WIFI', 'HAS_RESTROOMS',
        'WATER_SOURCE', 'SEWER_SOURCE',
        'LOCATION_OVERVIEW_NARRATIVE', 'AERIAL_IMAGE_URL', 'DOCK_MAP_IMAGE_URL',
        'GL_LESSOR', 'GL_LESSEE', 'GL_DATE', 'GL_TERM_EXPIRY', 'GL_RENT_TERMS',
        'PARKING_LEASE_LESSOR', 'PARKING_LEASE_SPACES',
        'NW_STREET_LEASE_LESSOR', 'NW_STREET_LEASE_RENT',
        'TDOCK_HOTEL_LESSOR', 'TDOCK_HOTEL_RENT',
        'SUMMER_RATE_PER_FT', 'WINTER_RATE_PER_FT', 'SEASONAL_RATE_TABLE', 'TRANSIENT_RATE_TABLE',
        'BNB_NARRATIVE', 'BNB_VESSEL_TABLE',
        'PROPERTY_OVERVIEW_NARRATIVE',
      ],
      blocks: [
        { type: 'divider', key: 'section_divider', config: { sectionNumber: 2, sectionTitle: 'PROPERTY OVERVIEW', style: 'large_numeral' } },
        // Property Details table
        { type: 'heading', key: 'details_title', config: { level: 2, text: 'PROPERTY DETAILS' } },
        { type: 'table', key: 'property_details', config: {
          title: '{{PROPERTY_NAME}}',
          style: 'om_property_details',
          rows: [
            { label: 'Address', token: 'PROPERTY_ADDRESS' },
            { label: 'Type of Ownership', token: 'OWNERSHIP_TYPE' },
            { label: 'Slips', token: 'TOTAL_SLIPS' },
            { label: 'Dock Type', token: 'DOCK_TYPE' },
            { label: 'Size Range', token: 'SIZE_RANGE' },
            { label: 'Dockside Depth', token: 'DOCKSIDE_DEPTH' },
            { label: 'Parking', token: 'PARKING_SPACES' },
          ],
        }},
        // Services & Amenities checklist
        { type: 'table', key: 'amenities', config: {
          title: 'SERVICES AND AMENITIES',
          style: 'om_amenities_checklist',
          rows: [
            { label: 'Building', token: 'BUILDING_SF' },
            { label: 'Fuel Dock', token: 'HAS_FUEL_DOCK' },
            { label: 'Pump-out', token: 'HAS_PUMP_OUT' },
            { label: 'Dockside Electric', token: 'HAS_ELECTRIC' },
            { label: 'Dockside Water', token: 'HAS_WATER' },
            { label: "Ship's Store", token: 'HAS_SHIP_STORE' },
            { label: 'Ice', token: 'HAS_ICE' },
            { label: 'Transient', token: 'HAS_TRANSIENT' },
            { label: 'Restaurant', token: 'HAS_RESTAURANT' },
            { label: 'Lodging', token: 'HAS_LODGING' },
            { label: 'Pool', token: 'HAS_POOL' },
            { label: 'Boat Rental', token: 'HAS_BOAT_RENTAL' },
            { label: 'Restroom/Showers', token: 'HAS_RESTROOMS' },
            { label: 'Laundry', token: 'HAS_LAUNDRY' },
            { label: 'Boat Service', value: 'manual' },
            { label: 'Security', token: 'HAS_SECURITY' },
            { label: 'WiFi', token: 'HAS_WIFI' },
          ],
        }},
        // Utilities
        { type: 'table', key: 'utilities', config: {
          title: 'UTILITIES TO MARINA SITE',
          style: 'om_property_details',
          rows: [
            { label: 'Water', token: 'WATER_SOURCE' },
            { label: 'Sewer', token: 'SEWER_SOURCE' },
          ],
        }},
        // Location Overview
        { type: 'heading', key: 'location_title', config: { level: 2, text: 'LOCATION OVERVIEW' } },
        { type: 'text', key: 'location_narrative', config: { token: 'LOCATION_OVERVIEW_NARRATIVE' } },
        { type: 'image', key: 'location_map', config: { token: 'AERIAL_IMAGE_URL' } },
        // Property map
        { type: 'image', key: 'dock_map', config: { token: 'DOCK_MAP_IMAGE_URL', caption: 'Property Key' } },
        // Ground Leases (4-panel)
        { type: 'heading', key: 'gl_title', config: { level: 2, text: 'GROUND LEASES' } },
        { type: 'table', key: 'ground_lease', config: { title: 'GROUND LEASE', subtitle: '{{PROPERTY_NAME}}', style: 'om_lease_panel', rows: [
          { label: 'Lessor', token: 'GL_LESSOR' },
          { label: 'Lessee', token: 'GL_LESSEE' },
          { label: 'Date of Lease', token: 'GL_DATE' },
          { label: 'Term', token: 'GL_TERM_EXPIRY' },
          { label: 'Rent', token: 'GL_RENT_TERMS' },
        ]}},
        { type: 'table', key: 'parking_lease', config: { title: 'PARKING LEASE', subtitle: '{{PROPERTY_NAME}}', style: 'om_lease_panel', rows: [
          { label: 'Lessor', token: 'PARKING_LEASE_LESSOR' },
          { label: 'Spaces', token: 'PARKING_LEASE_SPACES' },
        ]}},
        { type: 'table', key: 'tdock_lease', config: { title: 'T-DOCK HOTEL LEASE', subtitle: '{{PROPERTY_NAME}}', style: 'om_lease_panel', rows: [
          { label: 'Lessor', token: 'TDOCK_HOTEL_LESSOR' },
          { label: 'Rent', token: 'TDOCK_HOTEL_RENT' },
        ]}},
        { type: 'table', key: 'nw_lease', config: { title: 'NORTH WASHINGTON STREET LEASE', subtitle: '{{PROPERTY_NAME}}', style: 'om_lease_panel', rows: [
          { label: 'Lessor', token: 'NW_STREET_LEASE_LESSOR' },
          { label: 'Rent', token: 'NW_STREET_LEASE_RENT' },
        ]}},
        // Marina Asset — Wet Slips detail
        { type: 'heading', key: 'marina_asset_title', config: { level: 2, text: 'MARINA & AMENITIES' } },
        { type: 'text', key: 'marina_narrative', config: { token: 'PROPERTY_OVERVIEW_NARRATIVE' } },
        { type: 'table', key: 'seasonal_rates', config: { token: 'SEASONAL_RATE_TABLE', title: 'Seasonal Dockage Rates', style: 'rate_table' } },
        { type: 'table', key: 'transient_rates', config: { token: 'TRANSIENT_RATE_TABLE', title: 'Transient Dockage Rates', style: 'rate_table' } },
        // B&B Afloat
        { type: 'heading', key: 'bnb_title', config: { level: 2, text: 'B&B AFLOAT' } },
        { type: 'text', key: 'bnb_narrative', config: { token: 'BNB_NARRATIVE' } },
        { type: 'table', key: 'bnb_vessels', config: { token: 'BNB_VESSEL_TABLE', style: 'bnb_vessel',
          columns: ['Vessel/Room', '# of Bed/Bath', 'Starting Rates', 'FC Revenue'] } },
      ],
    },

    // ─── 5. FINANCIAL OVERVIEW ─────────────────────────────────────────────
    {
      key: 'om_financial_overview',
      title: 'Financial Overview',
      order: 5,
      enabled: true,
      required: true,
      description: 'Current operations narrative, NOI Forecast table with adjustments, Pro Forma plan, Assumptions, full Pro Forma, Other Opportunities',
      tokens: [
        'FC_REVENUE', 'FC_NOI', 'YEAR1_NOI',
        'OM_NOI_TABLE', 'ADJUSTMENTS_FOOTNOTES',
        'PRO_FORMA_PLAN_NARRATIVE',
        'OM_PROFORMA_TABLE', 'OM_EXPENSE_ASSUMPTIONS_TABLE',
        'OTHER_OPPORTUNITIES',
        'SUMMER_OCCUPANCY', 'SUMMER_RATE_PER_FT',
        'TOTAL_SLIPS', 'STORAGE_REVENUE',
      ],
      blocks: [
        { type: 'divider', key: 'section_divider', config: { sectionNumber: 3, sectionTitle: 'FINANCIAL OVERVIEW', style: 'large_numeral' } },
        // Current Year NOI
        { type: 'heading', key: 'noi_title', config: { level: 2, text: 'SUMMARY OF CURRENT OPERATIONS' } },
        { type: 'table', key: 'noi_table', config: {
          token: 'OM_NOI_TABLE',
          title: 'Current Year NOI Forecast',
          style: 'om_noi_forecast',
          columns: ['Line Item', 'Owner F/C', 'Adjustment Amount', 'Adj F/C'],
          sections: ['Revenue', 'COGS', 'Gross Profit', 'Operating Expenses', 'NOI'],
          showFootnotes: true,
        }},
        { type: 'text', key: 'noi_footnotes', config: { token: 'ADJUSTMENTS_FOOTNOTES', style: 'footnotes' } },
        // Pro Forma Business Plan
        { type: 'heading', key: 'pf_plan_title', config: { level: 2, text: 'PRO FORMA BUSINESS PLAN' } },
        { type: 'text', key: 'pf_plan_narrative', config: { token: 'PRO_FORMA_PLAN_NARRATIVE' } },
        // Pro Forma Assumptions
        { type: 'heading', key: 'pf_assumptions_title', config: { level: 2, text: 'PRO FORMA ASSUMPTIONS' } },
        { type: 'table', key: 'expense_assumptions', config: {
          token: 'OM_EXPENSE_ASSUMPTIONS_TABLE',
          title: 'Expense Assumptions',
          style: 'om_expense_assumptions',
          columns: ['Line Item', 'F/C Amount', 'Year 1 Amount', 'Comment / Methodology'],
        }},
        // Full Pro Forma
        { type: 'heading', key: 'proforma_title', config: { level: 2, text: 'PRO FORMA' } },
        { type: 'table', key: 'proforma', config: {
          token: 'OM_PROFORMA_TABLE',
          title: 'Pro Forma',
          style: 'om_proforma',
          columns: ['Line Item', 'F/C', 'Year 1', 'Year 2', 'Year 3', 'Year 4', 'Year 5'],
        }},
        // Other Opportunities
        { type: 'heading', key: 'opportunities_title', config: { level: 2, text: 'OTHER OPPORTUNITIES NOT IN PROJECTION' } },
        { type: 'metric_grid', key: 'opportunities', config: {
          token: 'OTHER_OPPORTUNITIES',
          style: 'om_opportunity_cards',
          columns: 3,
        }},
      ],
    },

    // ─── 6. NEARBY MARINAS OVERVIEW ────────────────────────────────────────
    {
      key: 'om_nearby_marinas',
      title: 'Nearby Marinas Overview',
      order: 6,
      enabled: true,
      required: false,
      description: 'Competitive set table + map with photo callouts',
      tokens: ['COMP_SET_TABLE', 'COMP_SET_MAP_IMAGE_URL'],
      blocks: [
        { type: 'divider', key: 'section_divider', config: { sectionNumber: 4, sectionTitle: 'NEARBY MARINAS OVERVIEW', style: 'large_numeral' } },
        { type: 'table', key: 'comp_table', config: {
          token: 'COMP_SET_TABLE',
          style: 'om_comp_table',
          columns: ['Marina', '# of Slips', 'Amenities', 'Seasonal Rates ($/LF)', 'Transient Rates ($/LF)'],
        }},
        { type: 'image', key: 'comp_map', config: { token: 'COMP_SET_MAP_IMAGE_URL', caption: 'Competitive Set Map' } },
      ],
    },

    // ─── 7. MARKET OVERVIEW ────────────────────────────────────────────────
    {
      key: 'om_market_overview',
      title: 'Market Overview',
      order: 7,
      enabled: true,
      required: false,
      description: 'Market narrative, tourism facts, population/employment, demographics 3-ring panel',
      tokens: [
        'MARKET_OVERVIEW_NARRATIVE', 'TOURISM_FACTS',
        'POPULATION_5MI', 'POPULATION_10MI', 'POPULATION_25MI',
        'AVG_HH_INCOME_5MI', 'MEDIAN_HH_INCOME_5MI', 'BOATING_PARTICIPATION_PCT',
        'POPULATION_GROWTH_CHART', 'NEIGHBORHOOD_MAP_URL',
      ],
      blocks: [
        { type: 'divider', key: 'section_divider', config: { sectionNumber: 5, sectionTitle: 'MARKET OVERVIEW', style: 'large_numeral' } },
        { type: 'text', key: 'market_narrative', config: { token: 'MARKET_OVERVIEW_NARRATIVE' } },
        { type: 'metric_grid', key: 'tourism_facts', config: {
          token: 'TOURISM_FACTS',
          style: 'om_stat_callouts',
          columns: 4,
        }},
        { type: 'chart', key: 'pop_growth', config: { chartType: 'line', title: 'Population Growth', token: 'POPULATION_GROWTH_CHART' } },
        { type: 'image', key: 'neighborhood_map', config: { token: 'NEIGHBORHOOD_MAP_URL', caption: 'Neighborhood Amenities' } },
        { type: 'metric_grid', key: 'demographics', config: {
          title: 'Demographics',
          style: 'om_demographics_3ring',
          columns: 3,
          rings: ['5 Miles', '10 Miles', '25 Miles'],
          metrics: [
            { label: 'Total Population', tokens: ['POPULATION_5MI', 'POPULATION_10MI', 'POPULATION_25MI'] },
            { label: 'Avg HH Income', tokens: ['AVG_HH_INCOME_5MI'] },
            { label: 'Median HH Income', tokens: ['MEDIAN_HH_INCOME_5MI'] },
            { label: 'Participated in Boating Last Year', tokens: ['BOATING_PARTICIPATION_PCT'] },
          ],
        }},
      ],
    },

    // ─── 8. BACK COVER / CONTACT ───────────────────────────────────────────
    {
      key: 'om_back_cover',
      title: 'Contact',
      order: 8,
      enabled: true,
      required: true,
      description: 'Broker team cards, broker of record, firm address, disclaimer text',
      tokens: ['BROKER_TEAM', 'BROKER_OF_RECORD', 'FIRM_ADDRESS', 'BROKER_FIRM'],
      blocks: [
        { type: 'heading', key: 'team_title', config: { level: 2, text: 'LEISURE PROPERTY ADVISORS', color: '#B8976A' } },
        { type: 'metric_grid', key: 'broker_team', config: {
          token: 'BROKER_TEAM',
          style: 'om_broker_cards',
          columns: 1,
          fields: ['name', 'title', 'phone', 'email'],
        }},
        { type: 'text', key: 'disclaimer', config: {
          text: 'The information contained in this Offering Memorandum is proprietary and confidential...',
          style: 'disclaimer',
          size: '8px',
        }},
      ],
    },
  ],

  requiredTokens: [
    'PROPERTY_NAME', 'PROPERTY_CITY', 'PROPERTY_STATE',
    'EXEC_SUMMARY_NARRATIVE', 'TOTAL_SLIPS', 'FC_REVENUE', 'FC_NOI',
    'BROKER_TEAM',
  ],
  optionalTokens: [
    'HERO_IMAGE_URL', 'BROKER_LOGO_URL', 'AERIAL_IMAGE_URL', 'DOCK_MAP_IMAGE_URL',
    'COMP_SET_TABLE', 'COMP_SET_MAP_IMAGE_URL',
    'INVESTMENT_HIGHLIGHTS', 'TOURISM_FACTS', 'OTHER_OPPORTUNITIES',
    'BNB_VESSEL_TABLE', 'BNB_NARRATIVE',
    'POPULATION_5MI', 'POPULATION_10MI', 'POPULATION_25MI',
  ],
};
