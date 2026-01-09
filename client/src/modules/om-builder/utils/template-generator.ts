import type { OmPage, OmBlock, BlockType } from "../types";

export interface TemplateDefinition {
  id: string;
  name: string;
  description: string;
  category: 'executive' | 'financial' | 'marina' | 'complete';
  thumbnail?: string;
  pages: TemplatePageDefinition[];
}

export interface TemplatePageDefinition {
  title: string;
  blocks: TemplateBlockDefinition[];
}

export interface TemplateBlockDefinition {
  type: BlockType;
  dataBindings?: Record<string, string>;
  staticContent?: Record<string, any>;
  position?: { x: number; y: number; width: number; height: number };
}

export const PROFESSIONAL_TEMPLATES: TemplateDefinition[] = [
  {
    id: 'executive-overview',
    name: 'Executive Overview',
    description: 'Professional executive summary with key metrics and investment thesis',
    category: 'executive',
    pages: [
      {
        title: 'Executive Summary',
        blocks: [
          {
            type: 'heroKpiGrid',
            dataBindings: {
              'items[0].value': 'purchasePrice',
              'items[1].value': 'noi',
              'items[2].value': 'cashFlow',
              'items[3].value': 'capRate',
            },
            staticContent: {
              items: [
                { label: 'Purchase Price', value: '{{purchasePrice}}', variant: 'teal', icon: 'dollar' },
                { label: 'NOI', value: '{{noi}}', variant: 'green', icon: 'trending' },
                { label: 'Cash Flow', value: '{{cashFlow}}', variant: 'blue', icon: 'dollar' },
                { label: 'Cap Rate', value: '{{capRate}}', variant: 'orange', icon: 'percent' },
              ],
            },
            position: { x: 50, y: 50, width: 700, height: 120 },
          },
          {
            type: 'executiveSummary',
            dataBindings: {
              propertyName: 'name',
              propertyAddress: 'address',
            },
            staticContent: {
              investmentThesis: 'This marina represents an exceptional acquisition opportunity with strong cash flow potential and significant upside through operational improvements and rent roll optimization.',
              propertyDescription: 'A well-positioned waterfront property with excellent access and modern amenities.',
            },
            position: { x: 50, y: 190, width: 700, height: 300 },
          },
        ],
      },
    ],
  },
  {
    id: 'financial-analysis',
    name: 'Financial Analysis',
    description: 'Comprehensive financial metrics with NOI, returns, and capital structure',
    category: 'financial',
    pages: [
      {
        title: 'Financial Overview',
        blocks: [
          {
            type: 'financialAnalysis',
            dataBindings: {
              npv: 'npv',
              irr: 'irr',
              dcr: 'dcr',
              grm: 'grm',
              oer: 'oer',
            },
            staticContent: {
              title: 'Financial Measures',
              metrics: [
                { label: 'Net Present Value', value: '{{npv}}', subtext: 'NPV' },
                { label: 'Internal Rate of Return', value: '{{irr}}', subtext: 'IRR' },
                { label: 'Debt Coverage Ratio', value: '{{dcr}}', subtext: 'DCR' },
                { label: 'Gross Rent Multiplier', value: '{{grm}}', subtext: 'GRM' },
                { label: 'Operating Expense Ratio', value: '{{oer}}', subtext: 'OER' },
              ],
              layout: 'grid',
              columns: 3,
            },
            position: { x: 50, y: 50, width: 340, height: 200 },
          },
          {
            type: 'investmentReturns',
            dataBindings: {
              cashOnCash: 'cashOnCash',
              roi: 'roi',
              capRate: 'capRate',
            },
            staticContent: {
              cashOnCash: 0,
              roi: 0,
              capRate: 0,
              grossRentalYield: 0,
              grm: 0,
            },
            position: { x: 410, y: 50, width: 340, height: 200 },
          },
          {
            type: 'financialBreakdown',
            dataBindings: {
              purchasePrice: 'purchasePrice',
              closingCosts: 'closingCosts',
              loanAmount: 'loanAmount',
              downPayment: 'downPayment',
            },
            staticContent: {
              purchasePrice: 0,
              closingCosts: 0,
              improvements: 0,
              reserves: 0,
              loanAmount: 0,
              downPayment: 0,
              totalEquityRequired: 0,
            },
            position: { x: 50, y: 270, width: 340, height: 280 },
          },
          {
            type: 'financingOverview',
            dataBindings: {
              loanAmount: 'loanAmount',
              interestRate: 'interestRate',
            },
            staticContent: {
              loanAmount: 0,
              downPayment: 0,
              ltv: 0,
              interestRate: 0,
              amortization: 0,
              monthlyPayment: 0,
              dcr: 0,
            },
            position: { x: 410, y: 270, width: 340, height: 280 },
          },
        ],
      },
      {
        title: 'Operating Analysis',
        blocks: [
          {
            type: 'operatingAnalysis',
            dataBindings: {
              goi: 'goi',
              totalExpenses: 'totalExpenses',
              noi: 'noi',
            },
            staticContent: {
              title: 'Annual Property Operating Data',
              items: [],
            },
            position: { x: 50, y: 50, width: 450, height: 400 },
          },
        ],
      },
    ],
  },
  {
    id: 'marina-metrics',
    name: 'Marina Performance',
    description: 'Marina-specific KPIs including slip occupancy, REVPS, and fuel metrics',
    category: 'marina',
    pages: [
      {
        title: 'Marina Performance',
        blocks: [
          {
            type: 'marinaKpis',
            dataBindings: {
              slipOccupancy: 'occupancyRate',
              revps: 'revenuePerSlip',
              wetSlips: 'wetSlips',
              dryStorage: 'dryStorage',
            },
            staticContent: {
              slipOccupancy: 0,
              revps: 0,
              ancillaryRevenueMix: 0,
              fuelMargin: 0,
              wetSlips: 0,
              dryStorage: 0,
              totalLinearFeet: 0,
            },
            position: { x: 50, y: 50, width: 700, height: 200 },
          },
        ],
      },
    ],
  },
  {
    id: 'complete-om',
    name: 'Complete Offering Memorandum',
    description: 'Full professional OM with all sections - Executive, Financial, Operations, and Marina',
    category: 'complete',
    pages: [
      {
        title: 'Cover',
        blocks: [
          {
            type: 'heading',
            staticContent: {
              text: 'Confidential Offering Memorandum',
            },
            position: { x: 50, y: 300, width: 700, height: 80 },
          },
          {
            type: 'text',
            dataBindings: {
              propertyName: 'name',
              address: 'address',
            },
            staticContent: {
              markdown: '**{{name}}**\n\n{{address}}',
            },
            position: { x: 50, y: 400, width: 700, height: 100 },
          },
        ],
      },
      {
        title: 'Executive Summary',
        blocks: [
          {
            type: 'heroKpiGrid',
            staticContent: {
              items: [
                { label: 'Purchase Price', value: '$0', variant: 'teal', icon: 'dollar' },
                { label: 'NOI', value: '$0', variant: 'green', icon: 'trending' },
                { label: 'Cash Flow', value: '$0', variant: 'blue', icon: 'dollar' },
                { label: 'Cap Rate', value: '0.0%', variant: 'orange', icon: 'percent' },
              ],
            },
            position: { x: 50, y: 50, width: 700, height: 120 },
          },
          {
            type: 'executiveSummary',
            staticContent: {
              investmentThesis: 'Investment thesis will be populated from project data.',
              propertyDescription: 'Property description will be populated from project data.',
            },
            position: { x: 50, y: 190, width: 700, height: 300 },
          },
        ],
      },
      {
        title: 'Financial Analysis',
        blocks: [
          {
            type: 'financialAnalysis',
            staticContent: {
              title: 'Financial Measures',
              metrics: [],
              layout: 'grid',
              columns: 3,
            },
            position: { x: 50, y: 50, width: 700, height: 250 },
          },
          {
            type: 'investmentReturns',
            staticContent: {
              cashOnCash: 0,
              roi: 0,
              capRate: 0,
              grossRentalYield: 0,
              grm: 0,
            },
            position: { x: 50, y: 320, width: 700, height: 200 },
          },
        ],
      },
      {
        title: 'Cash Flow Forecast',
        blocks: [
          {
            type: 'cashFlowForecast',
            staticContent: {
              title: '5-Year Cash Flow Projection',
              years: [],
            },
            position: { x: 50, y: 50, width: 700, height: 400 },
          },
        ],
      },
      {
        title: 'Marina Operations',
        blocks: [
          {
            type: 'marinaKpis',
            staticContent: {
              slipOccupancy: 0,
              revps: 0,
              ancillaryRevenueMix: 0,
              fuelMargin: 0,
              wetSlips: 0,
              dryStorage: 0,
              totalLinearFeet: 0,
            },
            position: { x: 50, y: 50, width: 700, height: 200 },
          },
        ],
      },
    ],
  },
];

export function generatePagesFromTemplate(template: TemplateDefinition): OmPage[] {
  return template.pages.map((pageDef, pageIndex) => ({
    id: `page_${Date.now()}_${pageIndex}`,
    title: pageDef.title,
    blocks: pageDef.blocks.map((blockDef, blockIndex) => ({
      id: `block_${Date.now()}_${pageIndex}_${blockIndex}`,
      type: blockDef.type,
      content: blockDef.staticContent || getDefaultContentForBlockType(blockDef.type),
      dataBinding: blockDef.dataBindings ? {
        sourceType: 'underwriting' as const,
        bindingRole: 'primary',
        query: blockDef.dataBindings,
      } : undefined,
      position: blockDef.position || { x: 50, y: 50 + blockIndex * 150, width: 700, height: 120 },
      meta: { zIndex: blockIndex + 1 },
    })),
  }));
}

function getDefaultContentForBlockType(type: BlockType): any {
  switch (type) {
    case 'heroKpiGrid':
      return {
        items: [
          { label: 'Purchase Price', value: '$0', variant: 'teal', icon: 'dollar' },
          { label: 'NOI', value: '$0', variant: 'green', icon: 'trending' },
          { label: 'Cash Flow', value: '$0', variant: 'blue', icon: 'dollar' },
          { label: 'Cap Rate', value: '0.0%', variant: 'orange', icon: 'percent' },
        ],
      };
    case 'executiveSummary':
      return {
        investmentThesis: 'Investment thesis placeholder',
        propertyDescription: 'Property description placeholder',
      };
    case 'financialAnalysis':
      return {
        title: 'Financial Measures',
        metrics: [],
        layout: 'grid',
        columns: 3,
      };
    case 'heading':
      return { text: 'Section Title' };
    case 'text':
      return { markdown: 'Enter text here...' };
    default:
      return {};
  }
}

export function getTemplatesByCategory(category?: string): TemplateDefinition[] {
  if (!category || category === 'all') {
    return PROFESSIONAL_TEMPLATES;
  }
  return PROFESSIONAL_TEMPLATES.filter(t => t.category === category);
}
