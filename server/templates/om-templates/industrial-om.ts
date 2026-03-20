import type { OMTemplate } from './index';

export const industrialOMTemplate: OMTemplate = {
  id: 'industrial-standard',
  name: 'Industrial Offering Memorandum',
  assetClass: 'industrial',
  description: 'Industrial property offering memorandum template covering clear height, dock configuration, tenant profiles, and logistics market analysis.',
  sections: [
    {
      id: 'executive-summary',
      title: 'Executive Summary',
      type: 'executive_summary',
      required: true,
      defaultContent: 'Investment highlights including total SF, clear height, dock doors, occupancy, WALT, in-place NOI, cap rate, and proximity to major transportation corridors.',
    },
    {
      id: 'property-overview',
      title: 'Property Overview',
      type: 'property_overview',
      required: true,
      defaultContent: 'Property specifications including total warehouse/office SF, clear height, column spacing, dock-high and grade-level doors, truck court depth, trailer parking, power supply, ESFR sprinklers, and site acreage.',
    },
    {
      id: 'financial-analysis',
      title: 'Financial Analysis',
      type: 'financial_analysis',
      required: true,
      defaultContent: 'In-place rent roll summary, base rent per SF (warehouse vs office), expense recoveries (NNN structure), operating expenses, real estate taxes, insurance, CAM, NOI, and mark-to-market analysis.',
    },
    {
      id: 'tenant-profiles',
      title: 'Tenant Profiles',
      type: 'rent_roll',
      required: true,
      defaultContent: 'Tenant roster with lease terms, base rent, annual escalations, renewal options, tenant improvement allowances, and business descriptions. Credit analysis for investment-grade tenants.',
    },
    {
      id: 'market-overview',
      title: 'Market Overview',
      type: 'market_overview',
      required: true,
      defaultContent: 'Industrial submarket analysis including vacancy rates, asking rents, absorption trends, new construction pipeline, e-commerce demand drivers, and proximity to ports, airports, and interstate highways.',
    },
    {
      id: 'comparable-sales',
      title: 'Comparable Sales',
      type: 'comps',
      required: false,
      defaultContent: 'Recent industrial transactions in the submarket with price per SF, cap rates, clear heights, and tenant quality comparison.',
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
      defaultContent: 'Supporting materials including building plans, environmental reports (Phase I/II), ALTA survey, roof warranty, and historical operating statements.',
    },
  ],
};
