import type { OMTemplate } from './index';

export const hotelOMTemplate: OMTemplate = {
  id: 'hotel-standard',
  name: 'Hotel Offering Memorandum',
  assetClass: 'hotel',
  description: 'Hospitality-focused offering memorandum template with RevPAR analysis, ADR trends, occupancy metrics, and F&B revenue breakdowns.',
  sections: [
    {
      id: 'executive-summary',
      title: 'Executive Summary',
      type: 'executive_summary',
      required: true,
      defaultContent: 'Investment overview highlighting room count, brand affiliation, RevPAR index, trailing-twelve-month performance, and acquisition pricing metrics (price per key, cap rate).',
    },
    {
      id: 'property-overview',
      title: 'Property Overview',
      type: 'property_overview',
      required: true,
      defaultContent: 'Property details including room types and count, meeting/event space, F&B outlets, fitness center, pool, brand standards compliance, PIP status, and recent capital improvements.',
    },
    {
      id: 'financial-analysis',
      title: 'Financial Analysis',
      type: 'financial_analysis',
      required: true,
      defaultContent: 'Detailed P&L analysis including rooms revenue, F&B revenue, other operated departments, undistributed expenses, management fees, FF&E reserve, NOI, and EBITDA. Key metrics: RevPAR, ADR, occupancy rate, GOP margin.',
    },
    {
      id: 'market-overview',
      title: 'Market Overview',
      type: 'market_overview',
      required: true,
      defaultContent: 'Competitive set analysis (STR report summary), demand generators (corporate, leisure, group), new supply pipeline, market RevPAR trends, and airport/tourism statistics.',
    },
    {
      id: 'comparable-sales',
      title: 'Comparable Sales',
      type: 'comps',
      required: false,
      defaultContent: 'Recent hotel transactions in the market with price per key, cap rate, RevPAR multiples, and brand/flag details.',
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
      defaultContent: 'Supporting materials including STR reports, franchise agreement summary, PIP estimates, historical operating statements, and site plan.',
    },
  ],
};
