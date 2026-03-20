import type { OMTemplate } from './index';

export const multifamilyOMTemplate: OMTemplate = {
  id: 'multifamily-standard',
  name: 'Multifamily Offering Memorandum',
  assetClass: 'multifamily',
  description: 'Complete offering memorandum template for multifamily residential properties with unit mix analysis, rent roll summary, and submarket demographics.',
  sections: [
    {
      id: 'executive-summary',
      title: 'Executive Summary',
      type: 'executive_summary',
      required: true,
      defaultContent: 'Investment highlights covering acquisition price, stabilized NOI, cap rate, unit count, occupancy rate, and value-add opportunity thesis.',
    },
    {
      id: 'property-overview',
      title: 'Property Overview',
      type: 'property_overview',
      required: true,
      defaultContent: 'Property details including unit mix (studio, 1BR, 2BR, 3BR+), total square footage, year built/renovated, parking ratio, amenities (pool, fitness center, clubhouse, laundry), and building construction type.',
    },
    {
      id: 'financial-analysis',
      title: 'Financial Analysis',
      type: 'financial_analysis',
      required: true,
      defaultContent: 'Detailed rent roll summary, gross potential rent, vacancy and concession loss, effective gross income, operating expenses by category, NOI, debt service, and cash-on-cash return analysis.',
    },
    {
      id: 'rent-roll',
      title: 'Rent Roll',
      type: 'rent_roll',
      required: true,
      defaultContent: 'Current rent roll with unit numbers, floor plans, square footage, current rent, market rent, lease expiration dates, and tenant status.',
    },
    {
      id: 'market-overview',
      title: 'Market Overview',
      type: 'market_overview',
      required: true,
      defaultContent: 'Submarket analysis including population growth, employment trends, median household income, rent growth trajectory, new supply pipeline, and competitive set comparison.',
    },
    {
      id: 'comparable-sales',
      title: 'Comparable Sales',
      type: 'comps',
      required: false,
      defaultContent: 'Recent multifamily transactions in the submarket with price per unit, price per SF, cap rates, and key property characteristics.',
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
      defaultContent: 'Supporting documentation including floor plans, survey, environmental Phase I, property condition report, and historical operating statements.',
    },
  ],
};
