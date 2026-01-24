import { db } from "../db";
import { omTemplates } from "@shared/schema";
import { eq, and } from "drizzle-orm";

interface SystemTemplate {
  name: string;
  scope: 'system' | 'organization' | 'user';
  category: 'om' | 'ic_memo' | 'executive_summary' | 'page' | 'block' | 'pdf';
  content: any;
}

const PDF_TEMPLATES: SystemTemplate[] = [
  {
    name: "Standard PDF Template",
    scope: "system",
    category: "pdf",
    content: {
      templateType: "standard",
      description: "Basic marina overview, 2-3 pages with essential property and financial information",
      pageCount: { min: 2, max: 3 },
      sections: [
        { name: "Cover Page", included: true },
        { name: "Property Overview", included: true },
        { name: "Financial Summary", included: true },
        { name: "Rent Roll Summary", included: true },
        { name: "Investment Highlights", included: true },
        { name: "Disclaimer", included: true },
      ],
      settings: {
        headerLogo: true,
        footerPageNumbers: true,
        confidentialMark: true,
        colorScheme: "professional",
      }
    }
  },
  {
    name: "Premium PDF Template",
    scope: "system",
    category: "pdf",
    content: {
      templateType: "premium",
      description: "Detailed financials with charts and projections, 5-7 pages",
      pageCount: { min: 5, max: 7 },
      sections: [
        { name: "Cover Page", included: true },
        { name: "Executive Summary", included: true },
        { name: "Property Overview", included: true },
        { name: "Financial Summary", included: true },
        { name: "Revenue Projections", included: true },
        { name: "Rent Roll Summary", included: true },
        { name: "Operations Overview", included: true },
        { name: "Investment Highlights", included: true },
        { name: "Disclaimer", included: true },
      ],
      settings: {
        headerLogo: true,
        footerPageNumbers: true,
        confidentialMark: true,
        includeCharts: true,
        colorScheme: "premium",
      }
    }
  },
  {
    name: "Executive PDF Template",
    scope: "system",
    category: "pdf",
    content: {
      templateType: "executive",
      description: "Full comprehensive report with all details, 8-12 pages",
      pageCount: { min: 8, max: 12 },
      sections: [
        { name: "Cover Page", included: true },
        { name: "Table of Contents", included: true },
        { name: "Executive Summary", included: true },
        { name: "Property Overview", included: true },
        { name: "Financial Summary", included: true },
        { name: "Revenue Projections & Analysis", included: true },
        { name: "Rent Roll Analysis", included: true },
        { name: "Operations Overview", included: true },
        { name: "Investment Highlights & Value Proposition", included: true },
        { name: "Terms & Disclaimer", included: true },
      ],
      settings: {
        headerLogo: true,
        footerPageNumbers: true,
        confidentialMark: true,
        includeCharts: true,
        includeTableOfContents: true,
        detailedAnalysis: true,
        colorScheme: "executive",
      }
    }
  },
];

const SYSTEM_TEMPLATES: SystemTemplate[] = [
  {
    name: "Standard Offering Memorandum",
    scope: "system",
    category: "om",
    content: {
      pages: [
        {
          title: "Cover Page",
          type: "cover",
          sortOrder: 0,
          blocks: [
            { type: "image", config: { binding: "marina_hero_image", height: "40vh" } },
            { type: "text", config: { content: "{{marinaName}}", style: "h1" } },
            { type: "text", config: { content: "Investment Offering Memorandum", style: "subtitle" } },
            { type: "text", config: { content: "Prepared by {{companyName}}", style: "caption" } },
          ]
        },
        {
          title: "Executive Summary",
          type: "section",
          sortOrder: 1,
          blocks: [
            { type: "text", config: { content: "Executive Summary", style: "h2" } },
            { type: "kpi", config: { kpis: [
              { label: "Purchase Price", binding: "underwriting.purchasePrice", format: "currency" },
              { label: "Total Slips", binding: "underwriting.totalSlips", format: "number" },
              { label: "Cap Rate", binding: "underwriting.capRate", format: "percent" },
              { label: "NOI", binding: "underwriting.noi", format: "currency" },
            ]}},
            { type: "text", config: { binding: "executiveSummary", style: "body" } },
          ]
        },
        {
          title: "Property Overview",
          type: "section",
          sortOrder: 2,
          blocks: [
            { type: "text", config: { content: "Property Overview", style: "h2" } },
            { type: "table", config: { binding: "propertyDetails", columns: ["Feature", "Value"] } },
            { type: "image", config: { binding: "aerial_view", caption: "Aerial View" } },
          ]
        },
        {
          title: "Financial Summary",
          type: "section",
          sortOrder: 3,
          blocks: [
            { type: "text", config: { content: "Financial Summary", style: "h2" } },
            { type: "chart", config: { type: "bar", binding: "revenueBreakdown", title: "Revenue by Category" } },
            { type: "table", config: { binding: "proForma", title: "5-Year Pro Forma" } },
          ]
        },
        {
          title: "Market Analysis",
          type: "section",
          sortOrder: 4,
          blocks: [
            { type: "text", config: { content: "Market Analysis", style: "h2" } },
            { type: "kpi", config: { kpis: [
              { label: "Median Income", binding: "demographics.medianIncome", format: "currency" },
              { label: "Population Growth", binding: "demographics.populationGrowth", format: "percent" },
              { label: "Boat Registrations", binding: "demographics.boatRegistrations", format: "number" },
            ]}},
            { type: "text", config: { binding: "marketAnalysis", style: "body" } },
          ]
        },
        {
          title: "Comparable Sales",
          type: "section",
          sortOrder: 5,
          blocks: [
            { type: "text", config: { content: "Comparable Sales", style: "h2" } },
            { type: "table", config: { binding: "salesComps", title: "Recent Marina Sales" } },
            { type: "kpi", config: { kpis: [
              { label: "Avg Price/Slip", binding: "salesComps.averagePricePerSlip", format: "currency" },
              { label: "Median Cap Rate", binding: "salesComps.medianCapRate", format: "percent" },
            ]}},
          ]
        },
      ],
      settings: {
        theme: "professional",
        headerLogo: true,
        footerPageNumbers: true,
        includeDisclaimer: true,
      }
    }
  },
  {
    name: "Investment Committee Memo",
    scope: "system",
    category: "ic_memo",
    content: {
      pages: [
        {
          title: "IC Memo Header",
          type: "cover",
          sortOrder: 0,
          blocks: [
            { type: "text", config: { content: "INVESTMENT COMMITTEE MEMORANDUM", style: "h1" } },
            { type: "text", config: { content: "{{marinaName}} - {{location}}", style: "h2" } },
            { type: "table", config: { 
              rows: [
                ["To:", "Investment Committee"],
                ["From:", "{{dealTeam}}"],
                ["Date:", "{{currentDate}}"],
                ["Subject:", "{{marinaName}} Acquisition Recommendation"],
              ]
            }},
          ]
        },
        {
          title: "Investment Thesis",
          type: "section",
          sortOrder: 1,
          blocks: [
            { type: "text", config: { content: "Investment Thesis", style: "h2" } },
            { type: "text", config: { binding: "investmentThesis", style: "body" } },
            { type: "kpi", config: { kpis: [
              { label: "Purchase Price", binding: "underwriting.purchasePrice", format: "currency" },
              { label: "Target IRR", binding: "underwriting.irr", format: "percent" },
              { label: "Cash-on-Cash", binding: "underwriting.cashOnCash", format: "percent" },
              { label: "Hold Period", binding: "underwriting.holdPeriod", format: "years" },
            ]}},
          ]
        },
        {
          title: "Transaction Summary",
          type: "section",
          sortOrder: 2,
          blocks: [
            { type: "text", config: { content: "Transaction Summary", style: "h2" } },
            { type: "table", config: { binding: "capitalStack", title: "Capital Stack" } },
            { type: "table", config: { binding: "sourcesUses", title: "Sources & Uses" } },
          ]
        },
        {
          title: "Risk Analysis",
          type: "section",
          sortOrder: 3,
          blocks: [
            { type: "text", config: { content: "Risk Analysis", style: "h2" } },
            { type: "table", config: { 
              binding: "riskMatrix",
              columns: ["Risk Factor", "Probability", "Impact", "Mitigation"],
            }},
          ]
        },
        {
          title: "Recommendation",
          type: "section",
          sortOrder: 4,
          blocks: [
            { type: "text", config: { content: "Recommendation", style: "h2" } },
            { type: "text", config: { binding: "recommendation", style: "body" } },
            { type: "text", config: { content: "Approval Requested:", style: "h3" } },
            { type: "table", config: { 
              rows: [
                ["Purchase Authorization:", "{{purchasePrice}}"],
                ["Financing Commitment:", "{{debtAmount}}"],
                ["Equity Investment:", "{{equityAmount}}"],
              ]
            }},
          ]
        },
      ],
      settings: {
        theme: "modern",
        headerLogo: true,
        footerPageNumbers: true,
        confidential: true,
      }
    }
  },
  {
    name: "Executive Summary Block",
    scope: "system",
    category: "block",
    content: {
      type: "kpi",
      config: {
        layout: "grid-4",
        kpis: [
          { label: "Purchase Price", binding: "underwriting.purchasePrice", format: "currency" },
          { label: "Cap Rate", binding: "underwriting.capRate", format: "percent" },
          { label: "Total Slips", binding: "underwriting.totalSlips", format: "number" },
          { label: "Occupancy", binding: "underwriting.occupancy", format: "percent" },
        ]
      }
    }
  },
  {
    name: "Financial Overview Block",
    scope: "system",
    category: "block",
    content: {
      type: "kpi",
      config: {
        layout: "grid-3",
        kpis: [
          { label: "Gross Revenue", binding: "underwriting.grossRevenue", format: "currency" },
          { label: "NOI", binding: "underwriting.noi", format: "currency" },
          { label: "Debt Service", binding: "underwriting.debtService", format: "currency" },
        ]
      }
    }
  },
  {
    name: "Market Demographics Block",
    scope: "system",
    category: "block",
    content: {
      type: "kpi",
      config: {
        layout: "grid-4",
        kpis: [
          { label: "Median Income", binding: "demographics.medianIncome", format: "currency" },
          { label: "Population Growth", binding: "demographics.populationGrowth", format: "percent" },
          { label: "Boat Registrations", binding: "demographics.boatRegistrations", format: "number" },
          { label: "Water Access Homes", binding: "demographics.waterAccessHouseholds", format: "number" },
        ]
      }
    }
  },
  {
    name: "Comp Analysis Page",
    scope: "system",
    category: "page",
    content: {
      title: "Comparable Analysis",
      type: "section",
      blocks: [
        { type: "text", config: { content: "Comparable Sales Analysis", style: "h2" } },
        { type: "kpi", config: { kpis: [
          { label: "Avg $/Slip", binding: "salesComps.averagePricePerSlip", format: "currency" },
          { label: "Median Cap", binding: "salesComps.medianCapRate", format: "percent" },
          { label: "Recent Sales", binding: "salesComps.recentSalesCount", format: "number" },
        ]}},
        { type: "table", config: { binding: "salesComps", title: "Comparable Sales" } },
        { type: "chart", config: { type: "scatter", binding: "priceVsSlips", title: "Price vs Slip Count" } },
      ]
    }
  },
];

export async function seedSystemTemplates(): Promise<{ created: number; skipped: number }> {
  let created = 0;
  let skipped = 0;

  const allTemplates = [...PDF_TEMPLATES, ...SYSTEM_TEMPLATES];

  for (const template of allTemplates) {
    const existing = await db
      .select()
      .from(omTemplates)
      .where(
        and(
          eq(omTemplates.name, template.name),
          eq(omTemplates.scope, template.scope)
        )
      );

    if (existing.length > 0) {
      skipped++;
      continue;
    }

    await db.insert(omTemplates).values({
      name: template.name,
      scope: template.scope,
      category: template.category,
      content: template.content,
      userId: 'system',
    });
    created++;
  }

  return { created, skipped };
}

export async function seedPDFTemplates(): Promise<{ created: number; skipped: number }> {
  let created = 0;
  let skipped = 0;

  for (const template of PDF_TEMPLATES) {
    const existing = await db
      .select()
      .from(omTemplates)
      .where(
        and(
          eq(omTemplates.name, template.name),
          eq(omTemplates.scope, template.scope)
        )
      );

    if (existing.length > 0) {
      skipped++;
      continue;
    }

    await db.insert(omTemplates).values({
      name: template.name,
      scope: template.scope,
      category: template.category,
      content: template.content,
      userId: 'system',
    });
    created++;
  }

  return { created, skipped };
}
