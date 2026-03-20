import type { OMTemplate } from './index';

export const marinaOMTemplate: OMTemplate = {
  id: 'marina-standard',
  name: 'Marina Offering Memorandum',
  assetClass: 'marina',
  description: 'Comprehensive offering memorandum template for marina properties including waterfront details, slip inventory, and marine-specific financials.',
  sections: [
    {
      id: 'executive-summary',
      title: 'Executive Summary',
      type: 'executive_summary',
      required: true,
      defaultContent: 'This section provides a high-level overview of the marina investment opportunity, highlighting key financial metrics, property characteristics, and the investment thesis.',
    },
    {
      id: 'property-overview',
      title: 'Property Overview',
      type: 'property_overview',
      required: true,
      defaultContent: 'Detailed description of the marina property including waterfront footage, slip count and mix (wet/dry), fuel dock capacity, ship store, boat ramp access, services offered, and on-site amenities.',
    },
    {
      id: 'financial-analysis',
      title: 'Financial Analysis',
      type: 'financial_analysis',
      required: true,
      defaultContent: 'Revenue breakdown by profit center (wet slips, dry storage, fuel, ship store, boat rentals, service/repair), operating expenses, NOI analysis, and pro forma projections.',
    },
    {
      id: 'operations-summary',
      title: 'Operations Summary',
      type: 'operations',
      required: true,
      defaultContent: 'Overview of marina operations including staffing, maintenance programs, seasonal patterns, occupancy trends, and capital improvement plans.',
    },
    {
      id: 'market-overview',
      title: 'Market Overview',
      type: 'market_overview',
      required: true,
      defaultContent: 'Analysis of the local boating market, registered vessel counts, competing marinas, barriers to entry, waterfront development trends, and regional economic indicators.',
    },
    {
      id: 'comparable-sales',
      title: 'Comparable Sales',
      type: 'comps',
      required: false,
      defaultContent: 'Recent marina transactions in the region with per-slip pricing, cap rates, and key deal metrics for valuation context.',
    },
    {
      id: 'photos',
      title: 'Property Photos',
      type: 'photos',
      required: false,
    },
    {
      id: 'appendix',
      title: 'Appendix',
      type: 'appendix',
      required: false,
      defaultContent: 'Supporting documentation including site plan, slip layout, permits, environmental reports, and historical financial statements.',
    },
  ],
};
