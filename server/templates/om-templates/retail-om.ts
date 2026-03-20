import type { OMTemplate } from './index';

export const retailOMTemplate: OMTemplate = {
  id: 'retail-standard',
  name: 'Retail Offering Memorandum',
  assetClass: 'retail',
  description: 'Retail property offering memorandum template with tenant roster, lease analysis, co-tenancy details, and trade area demographics.',
  sections: [
    {
      id: 'executive-summary',
      title: 'Executive Summary',
      type: 'executive_summary',
      required: true,
      defaultContent: 'Investment highlights including total GLA, occupancy rate, weighted average lease term (WALT), anchor tenant overview, in-place NOI, and cap rate.',
    },
    {
      id: 'property-overview',
      title: 'Property Overview',
      type: 'property_overview',
      required: true,
      defaultContent: 'Property details including total GLA, pad sites, parking count and ratio, signage, visibility, access points, year built/renovated, and anchor/inline tenant breakdown.',
    },
    {
      id: 'financial-analysis',
      title: 'Financial Analysis',
      type: 'financial_analysis',
      required: true,
      defaultContent: 'In-place rent roll analysis, base rent by tenant, percentage rent structure, CAM/tax/insurance recoveries, vacancy loss, operating expenses, NOI, and pro forma assumptions.',
    },
    {
      id: 'tenant-profiles',
      title: 'Tenant Profiles',
      type: 'rent_roll',
      required: true,
      defaultContent: 'Detailed tenant roster with lease terms, base rent, rent escalations, options to renew, co-tenancy clauses, exclusivity provisions, and tenant credit ratings.',
    },
    {
      id: 'market-overview',
      title: 'Market Overview',
      type: 'market_overview',
      required: true,
      defaultContent: 'Trade area demographics (1/3/5 mile rings), population density, average household income, traffic counts, competitive retail inventory, and absorption trends.',
    },
    {
      id: 'comparable-sales',
      title: 'Comparable Sales',
      type: 'comps',
      required: false,
      defaultContent: 'Recent retail property transactions in the trade area with price per SF, cap rates, occupancy at sale, and tenant quality comparison.',
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
      defaultContent: 'Supporting materials including lease abstracts, site plan, demographic reports, traffic studies, and historical operating statements.',
    },
  ],
};
