import type { OMTemplate } from './index';

export const strOMTemplate: OMTemplate = {
  id: 'str-standard',
  name: 'Short-Term Rental Offering Memorandum',
  assetClass: 'str',
  description: 'Offering memorandum template for short-term rental portfolios with channel mix analysis, ADR/RevPAR trends, listing-level performance detail, and STR regulatory context.',
  sections: [
    {
      id: 'executive-summary',
      title: 'Executive Summary',
      type: 'executive_summary',
      required: true,
      defaultContent: 'Investment highlights covering listing count, blended ADR, RevPAR, portfolio occupancy, trailing-twelve-month NOI, asking price, cap rate, and the investment thesis for the STR portfolio.',
    },
    {
      id: 'property-overview',
      title: 'Property Overview',
      type: 'property_overview',
      required: true,
      defaultContent: 'Portfolio composition including number of listings, geographic distribution, property type mix (single-family, condo, townhome, cabin), bedroom/bathroom/guest-capacity distribution, year built/renovated, and on-site amenities (hot tub, pool, waterfront access).',
    },
    {
      id: 'financial-analysis',
      title: 'Financial Analysis',
      type: 'financial_analysis',
      required: true,
      defaultContent: 'Revenue breakdown by channel (Airbnb, VRBO, Booking.com, direct), ADR and occupancy trends, RevPAR analysis, channel commission and payment-processing expense, cleaning fee pass-through, operating expense breakdown (utilities, supplies, management fees, repairs), NOI walk, and pro forma projections.',
    },
    {
      id: 'listing-schedule',
      title: 'Listing Schedule',
      type: 'rent_roll',
      required: true,
      defaultContent: 'Listing-level detail including address, bedrooms/bathrooms/guest capacity, average nightly rate, trailing-twelve-month occupancy, annual revenue, year-over-year performance, channel mix, and listing-specific notes (recent renovations, regulatory standing).',
    },
    {
      id: 'operations-summary',
      title: 'Operations Summary',
      type: 'operations',
      required: true,
      defaultContent: 'Property management structure (in-house vs third-party PMS), channel distribution strategy and commission economics, dynamic pricing approach, cleaning and turnover operations, guest communication and review management, maintenance protocols, and staffing model.',
    },
    {
      id: 'market-overview',
      title: 'Market Overview',
      type: 'market_overview',
      required: true,
      defaultContent: 'Submarket demand drivers (leisure tourism, business travel, events), seasonality patterns, competitive STR supply, hotel competitive set, STR regulatory environment (local ordinances, permit/licensing requirements, occupancy taxes), and AirDNA/Key Data market benchmarks.',
    },
    {
      id: 'comparable-sales',
      title: 'Comparable Sales',
      type: 'comps',
      required: false,
      defaultContent: 'Recent STR portfolio and individual short-term rental transactions in the submarket with price per unit, price per bedroom, cap rates, RevPAR multiples, and channel performance context.',
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
      defaultContent: 'Supporting documentation including historical channel performance reports, occupancy and ADR detail by month, STR permits and licensing, HOA/condo association rules, property condition reports, and historical operating statements.',
    },
  ],
};
