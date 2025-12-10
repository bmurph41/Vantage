import { db } from "./db";
import { omTemplates } from "@shared/schema";

const canonicalPageTemplates = [
  {
    ownerType: "global",
    ownerId: null,
    name: "Executive Summary",
    scope: "page",
    category: "overview",
    templateData: {
      title: "Executive Summary",
      layoutType: "single-column",
      blocks: [
        {
          type: "heading",
          content: { text: "Executive Summary", level: 1 },
          order: 1
        },
        {
          type: "text",
          content: {
            markdown: "**[Property Name]** represents a compelling investment opportunity in the **[Market Name]** marina sector. This **[Property Type]** offers investors an attractive combination of stable cash flows, value-add potential, and strategic market positioning.\n\nKey investment highlights include:\n- Strong occupancy rates with established tenant base\n- Below-market rents providing organic growth opportunity\n- Strategic waterfront location with high barriers to entry\n- Experienced management team with proven track record"
          },
          order: 2
        },
        {
          type: "kpi",
          content: {
            items: [
              { label: "Purchase Price", value: "$X,XXX,XXX", subtext: "Per slip: $XX,XXX" },
              { label: "Going-In Cap Rate", value: "X.X%", subtext: "Year 1 NOI" },
              { label: "Total Slips", value: "XXX", subtext: "Wet + Dry" }
            ]
          },
          order: 3
        }
      ]
    }
  },
  {
    ownerType: "global",
    ownerId: null,
    name: "Investment Highlights",
    scope: "page",
    category: "overview",
    templateData: {
      title: "Investment Highlights",
      layoutType: "single-column",
      blocks: [
        {
          type: "heading",
          content: { text: "Investment Highlights", level: 1 },
          order: 1
        },
        {
          type: "callout",
          content: {
            variant: "success",
            title: "Strong Cash Flow Profile",
            text: "Stabilized NOI with consistent year-over-year growth from established slip rental operations."
          },
          order: 2
        },
        {
          type: "callout",
          content: {
            variant: "success",
            title: "Value-Add Opportunity",
            text: "Below-market rents with potential 15-25% upside through lease mark-to-market and operational improvements."
          },
          order: 3
        },
        {
          type: "callout",
          content: {
            variant: "success",
            title: "Prime Waterfront Location",
            text: "Irreplaceable waterfront positioning with high barriers to entry and limited competing supply."
          },
          order: 4
        },
        {
          type: "callout",
          content: {
            variant: "success",
            title: "Diverse Revenue Streams",
            text: "Multiple income sources including slip rentals, dry storage, fuel sales, and ancillary services."
          },
          order: 5
        }
      ]
    }
  },
  {
    ownerType: "global",
    ownerId: null,
    name: "Market Overview",
    scope: "page",
    category: "market",
    templateData: {
      title: "Market Overview",
      layoutType: "two-column",
      columns: { leftWidthPercent: 50, rightWidthPercent: 50 },
      blocks: [
        {
          type: "heading",
          content: { text: "Market Overview", level: 1 },
          style: { column: "left" },
          order: 1
        },
        {
          type: "text",
          content: {
            markdown: "The **[Market Name]** marina market demonstrates strong fundamentals with growing demand for boat slip rentals and limited new supply due to regulatory constraints and waterfront development restrictions.\n\n**Key Market Drivers:**\n- Growing boating population in the region\n- Limited competitive supply within 25-mile radius\n- Strong household income demographics\n- Year-round boating climate"
          },
          style: { column: "left" },
          order: 2
        },
        {
          type: "chart",
          content: {
            title: "Regional Slip Occupancy Trends",
            chartType: "line",
            data: [
              { name: "2020", value: 85 },
              { name: "2021", value: 88 },
              { name: "2022", value: 91 },
              { name: "2023", value: 93 },
              { name: "2024", value: 95 }
            ]
          },
          style: { column: "right" },
          order: 3
        },
        {
          type: "kpi",
          content: {
            items: [
              { label: "Market Occupancy", value: "94%", subtext: "5-year high" },
              { label: "Avg Slip Rate", value: "$XXX/ft", subtext: "Annual growth: 5%" },
              { label: "Wait List", value: "XXX boats", subtext: "2+ year wait" }
            ]
          },
          style: { column: "right" },
          order: 4
        }
      ]
    }
  },
  {
    ownerType: "global",
    ownerId: null,
    name: "Financial Summary",
    scope: "page",
    category: "financials",
    templateData: {
      title: "Financial Summary",
      layoutType: "single-column",
      blocks: [
        {
          type: "heading",
          content: { text: "Financial Summary", level: 1 },
          order: 1
        },
        {
          type: "table",
          content: {
            columns: [
              { id: "metric", label: "Operating Metrics" },
              { id: "y1", label: "Year 1", align: "right" },
              { id: "y3", label: "Year 3", align: "right" },
              { id: "y5", label: "Year 5", align: "right" }
            ],
            rows: [
              { metric: "Gross Potential Revenue", y1: "$X,XXX,XXX", y3: "$X,XXX,XXX", y5: "$X,XXX,XXX" },
              { metric: "Less: Vacancy & Collection Loss", y1: "($XXX,XXX)", y3: "($XXX,XXX)", y5: "($XXX,XXX)" },
              { metric: "Effective Gross Income", y1: "$X,XXX,XXX", y3: "$X,XXX,XXX", y5: "$X,XXX,XXX" },
              { metric: "Operating Expenses", y1: "($XXX,XXX)", y3: "($XXX,XXX)", y5: "($XXX,XXX)" },
              { metric: "Net Operating Income", y1: "$XXX,XXX", y3: "$X,XXX,XXX", y5: "$X,XXX,XXX" }
            ]
          },
          order: 2
        },
        {
          type: "chart",
          content: {
            title: "NOI Projection",
            chartType: "bar",
            data: [
              { name: "Year 1", value: 750000 },
              { name: "Year 2", value: 825000 },
              { name: "Year 3", value: 900000 },
              { name: "Year 4", value: 950000 },
              { name: "Year 5", value: 1000000 }
            ]
          },
          order: 3
        }
      ]
    }
  },
  {
    ownerType: "global",
    ownerId: null,
    name: "Property Overview",
    scope: "page",
    category: "property",
    templateData: {
      title: "Property Overview",
      layoutType: "hero-with-body",
      heroImageUrl: "",
      heroOverlay: true,
      blocks: [
        {
          type: "heading",
          content: { text: "Property Overview", level: 1 },
          order: 1
        },
        {
          type: "text",
          content: {
            markdown: "**[Property Name]** is a **[XXX]-slip** full-service marina located in **[City, State]**. The property features a mix of wet slips, dry storage, and comprehensive boating amenities serving the **[Market Area]** boating community.\n\n**Property Features:**\n- XXX wet slips (XX to XXX feet)\n- XXX dry storage spaces\n- Full-service fuel dock\n- On-site ship store and provisions\n- Professional maintenance and repair services\n- 24/7 security and gated access"
          },
          order: 2
        },
        {
          type: "kpi",
          content: {
            items: [
              { label: "Total Slips", value: "XXX", subtext: "Wet + Dry" },
              { label: "Waterfront", value: "X,XXX ft", subtext: "Linear feet" },
              { label: "Land Area", value: "XX acres", subtext: "Upland + Submerged" }
            ]
          },
          order: 3
        }
      ]
    }
  },
  {
    ownerType: "global",
    ownerId: null,
    name: "Cover Page",
    scope: "page",
    category: "cover",
    templateData: {
      title: "Investment Memorandum",
      layoutType: "cover",
      heroImageUrl: "",
      heroOverlay: true,
      showHeader: false,
      showFooter: false,
      showPageNumber: false,
      blocks: []
    }
  }
];

export async function seedTemplates() {
  console.log("Seeding canonical page templates...");
  
  for (const template of canonicalPageTemplates) {
    try {
      await db.insert(omTemplates).values(template).onConflictDoNothing();
      console.log(`✓ Seeded template: ${template.name}`);
    } catch (error) {
      console.error(`✗ Failed to seed template ${template.name}:`, error);
    }
  }
  
  console.log("Template seeding complete.");
}
