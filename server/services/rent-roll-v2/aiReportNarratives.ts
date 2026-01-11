import OpenAI from "openai";
import type { ReportData, ReportMetrics, ReportProjectBreakdown, ReportStorageTypeBreakdown } from "@shared/schema";

const openai = new OpenAI({
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
});

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

export async function generateReportNarrative(
  metrics: ReportMetrics,
  projectBreakdown: ReportProjectBreakdown[],
  storageTypeBreakdown: ReportStorageTypeBreakdown[],
  filters: { projectIds?: string[]; year?: number }
): Promise<string> {
  const projectCount = projectBreakdown.length;
  const topProjects = projectBreakdown.slice(0, 3);
  const topStorageTypes = storageTypeBreakdown.slice(0, 3);

  // Build contract expiration section
  let expirationSection = '';
  if (metrics.contractExpirations && metrics.contractExpirations.length > 0) {
    expirationSection = `
CONTRACT EXPIRATIONS (UPCOMING RENEWALS):
${metrics.contractExpirations.map(exp => 
  `- Next ${exp.window}: ${exp.count} leases expiring, ${formatCurrency(exp.revenueAtRisk)} revenue at risk`
).join('\n')}
`;
  }

  // Build tenant LTV section
  let ltvSection = '';
  if (metrics.tenantLTV) {
    const ltv = metrics.tenantLTV;
    ltvSection = `
TENANT LIFETIME VALUE (LTV) ANALYSIS:
- Average Customer LTV: ${formatCurrency(ltv.averageLTV)}
- Median Customer LTV: ${formatCurrency(ltv.medianLTV)}
- Total Portfolio LTV: ${formatCurrency(ltv.totalLTV)}
- LTV Distribution:
${ltv.ltvDistribution.map(d => `  ${d.bucket}: ${d.count} tenants (${formatCurrency(d.totalRevenue)})`).join('\n')}
- Top 5 Tenants by LTV:
${ltv.topTenants.slice(0, 5).map((t, i) => 
  `  ${i + 1}. ${t.tenantName}: ${formatCurrency(t.totalRevenue)} (${t.leaseCount} lease${t.leaseCount > 1 ? 's' : ''}, ${t.tenureMonths} month tenure)`
).join('\n')}
`;
  }

  // Build repeat customer section
  let repeatSection = '';
  if (metrics.repeatCustomers) {
    const rep = metrics.repeatCustomers;
    repeatSection = `
REPEAT CUSTOMER ANALYSIS:
- Total Customers: ${rep.totalCustomerCount}
- Repeat Customers (2+ leases): ${rep.repeatCustomerCount} (${formatPercent(rep.repeatRate)})
- Revenue from Repeat Customers: ${formatCurrency(rep.repeatCustomerRevenue)} (${formatPercent(rep.repeatRevenuePercentage)} of total)
${rep.repeatCustomers.length > 0 ? `- Top Repeat Customers:
${rep.repeatCustomers.slice(0, 5).map((c, i) => 
  `  ${i + 1}. ${c.tenantName}: ${c.leaseCount} leases, ${formatCurrency(c.totalRevenue)}`
).join('\n')}` : ''}
`;
  }

  const prompt = `You are a marina industry analyst providing an executive summary for a rent roll report. 
Write a concise, professional narrative (4-5 paragraphs) summarizing the following portfolio metrics.
Focus on key insights, trends, and actionable observations. Use specific numbers and percentages.
Include analysis of contract expirations, customer lifetime value, and repeat customer retention if data is available.

PORTFOLIO OVERVIEW:
- Total Projects: ${projectCount}
- Active Leases: ${metrics.activeLeases} of ${metrics.totalLeases} total
- Total Revenue: ${formatCurrency(metrics.totalRevenue)}
- Average Lease Value: ${formatCurrency(metrics.averageLeaseValue)}
- Portfolio Occupancy: ${formatPercent(metrics.occupancyRate)} (${metrics.occupancyNumerator} / ${metrics.occupancyDenominator} slot-seasons)
- Economic Vacancy: ${formatCurrency(metrics.economicVacancy)} (${formatPercent(metrics.potentialRevenue > 0 ? (metrics.economicVacancy / metrics.potentialRevenue) * 100 : 0)})
- Potential Revenue: ${formatCurrency(metrics.potentialRevenue)}

TENANT MOVEMENT:
- Move-Ins: ${metrics.moveIns}
- Move-Outs: ${metrics.moveOuts}
- Net Change: ${metrics.netChange > 0 ? '+' : ''}${metrics.netChange}
- Average Vessel LOA: ${metrics.averageLOA.toFixed(1)} ft
${expirationSection}${ltvSection}${repeatSection}
TOP PROJECTS BY REVENUE:
${topProjects.map((p, i) => `${i + 1}. ${p.projectName}: ${formatCurrency(p.revenue)} (${p.activeLeases} leases, ${formatPercent(p.occupancyRate)} occupancy)`).join('\n')}

REVENUE BY STORAGE TYPE:
${topStorageTypes.map((s, i) => `${i + 1}. ${s.storageType}: ${formatCurrency(s.revenue)} (${s.leaseCount} leases, ${formatPercent(s.percentage)} of total)`).join('\n')}

Write the executive summary now. Be specific, insightful, and professional. Highlight:
1. Portfolio performance and occupancy
2. Upcoming contract expirations and renewal risk
3. Customer lifetime value insights and top-value tenants
4. Repeat customer retention and loyalty patterns
5. Actionable recommendations for revenue optimization`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are a professional marina industry analyst. Write concise, data-driven executive summaries that help marina operators and private equity investors understand portfolio performance, customer value, and renewal risk.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 1200,
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      return "Unable to generate AI narrative at this time.";
    }

    return content.trim();
  } catch (error) {
    console.error("Error generating AI narrative:", error);
    return "AI narrative generation is temporarily unavailable. Please try again later.";
  }
}
