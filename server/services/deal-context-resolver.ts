/**
 * Deal Context Resolver
 *
 * Given a dealId, modelingProjectId, and/or workspaceId, fetches and formats
 * a compact context block (< ~1,500 tokens) for injection into AI Advisor
 * system prompts.
 *
 * All queries are org-scoped to prevent cross-tenant data exposure.
 *
 * Sections resolved:
 *  - Deal summary (name, stage, asset class, location, value)
 *  - Modeling project core (purchase price, cap rate, EBITDA)
 *  - Pro forma / valuation snapshot (NOI, revenue, expenses)
 *  - Returns / DCF — base case exit scenario (IRR, equity multiple, hold period)
 *  - Capital stack (LTV, total debt, equity)
 */

import { db } from '../db';
import { eq, and, desc } from 'drizzle-orm';
import {
  crmDeals,
  modelingProjects,
  valuationSnapshots,
  exitScenarios,
  capitalStacks,
  dealWorkspaces,
} from '@shared/schema';

export interface DealContextSummary {
  dealName?: string;
  projectName?: string;
  injectedSections: string[];
}

export interface DealContextResult {
  contextBlock: string;
  summary: DealContextSummary;
}

interface ResolverInput {
  dealId?: string;
  modelingProjectId?: string;
  workspaceId?: string;
}

function fmtMoney(n: string | number | null | undefined): string {
  if (n == null || n === '') return 'N/A';
  const num = Number(n);
  if (isNaN(num)) return 'N/A';
  if (Math.abs(num) >= 1_000_000) return `$${(num / 1_000_000).toFixed(2)}M`;
  if (Math.abs(num) >= 1_000) return `$${(num / 1_000).toFixed(0)}K`;
  return `$${num.toFixed(0)}`;
}

function fmtPct(n: string | number | null | undefined, isDecimal = true): string {
  if (n == null || n === '') return 'N/A';
  const num = Number(n);
  if (isNaN(num)) return 'N/A';
  return isDecimal ? `${(num * 100).toFixed(2)}%` : `${num.toFixed(2)}%`;
}

function fmtMultiple(n: string | number | null | undefined): string {
  if (n == null || n === '') return 'N/A';
  const num = Number(n);
  if (isNaN(num)) return 'N/A';
  return `${num.toFixed(2)}x`;
}

export async function resolveDealContext(
  orgId: string,
  input: ResolverInput
): Promise<DealContextResult | null> {
  let { dealId, modelingProjectId, workspaceId } = input;

  if (!dealId && !modelingProjectId && !workspaceId) return null;

  const lines: string[] = [];
  const injectedSections: string[] = [];
  let dealName: string | undefined;
  let projectName: string | undefined;

  try {
    // 0. If workspaceId is provided, resolve dealId and modelingProjectId from it
    if (workspaceId) {
      const [ws] = await db
        .select({
          dealId: dealWorkspaces.dealId,
          modelingProjectId: dealWorkspaces.modelingProjectId,
          name: dealWorkspaces.name,
        })
        .from(dealWorkspaces)
        .where(and(eq(dealWorkspaces.id, workspaceId), eq(dealWorkspaces.orgId, orgId)))
        .limit(1);

      if (ws) {
        if (!dealId && ws.dealId) dealId = ws.dealId;
        if (!modelingProjectId && ws.modelingProjectId) modelingProjectId = ws.modelingProjectId;
      }
    }

    // 1. Deal summary — org-scoped via ownerId
    if (dealId) {
      const [deal] = await db
        .select({
          id: crmDeals.id,
          title: crmDeals.title,
          stage: crmDeals.stage,
          assetClass: crmDeals.assetClass,
          city: crmDeals.city,
          state: crmDeals.state,
          value: crmDeals.value,
          type: crmDeals.type,
          modelingProjectId: crmDeals.modelingProjectId,
          probability: crmDeals.probability,
          priority: crmDeals.priority,
        })
        .from(crmDeals)
        .where(
          and(
            eq(crmDeals.id, dealId),
            eq(crmDeals.ownerId, orgId) // org-scope
          )
        )
        .limit(1);

      if (deal) {
        dealName = deal.title;
        // Backfill modelingProjectId from the deal if not yet known
        if (!modelingProjectId && deal.modelingProjectId) {
          modelingProjectId = deal.modelingProjectId;
        }
        lines.push(`### Deal Summary`);
        lines.push(`- **Name**: ${deal.title}`);
        lines.push(`- **Stage**: ${deal.stage}`);
        lines.push(`- **Asset Class**: ${deal.assetClass ?? 'N/A'}`);
        lines.push(`- **Location**: ${[deal.city, deal.state].filter(Boolean).join(', ') || 'N/A'}`);
        lines.push(`- **Deal Value**: ${fmtMoney(deal.value)}`);
        lines.push(`- **Priority**: ${deal.priority}`);
        lines.push(`- **Close Probability**: ${deal.probability != null ? `${deal.probability}%` : 'N/A'}`);
        injectedSections.push('Deal Summary');
      }
    }

    // 2. Modeling project — org-scoped
    if (modelingProjectId) {
      const [project] = await db
        .select({
          id: modelingProjects.id,
          marinaName: modelingProjects.marinaName,
          purchasePrice: modelingProjects.purchasePrice,
          year1CapRate: modelingProjects.year1CapRate,
          ebitda: modelingProjects.ebitda,
          assetClass: modelingProjects.assetClass,
          uwStage: modelingProjects.uwStage,
          city: modelingProjects.city,
          state: modelingProjects.state,
          totalStorageUnits: modelingProjects.totalStorageUnits,
          dealId: modelingProjects.dealId,
        })
        .from(modelingProjects)
        .where(
          and(
            eq(modelingProjects.id, modelingProjectId),
            eq(modelingProjects.orgId, orgId) // org-scope
          )
        )
        .limit(1);

      if (project) {
        projectName = project.marinaName;
        if (!dealName) dealName = project.marinaName;

        // Backfill deal info when only modelingProjectId was supplied
        if (!dealId && project.dealId) {
          const [linkedDeal] = await db
            .select({
              id: crmDeals.id,
              title: crmDeals.title,
              stage: crmDeals.stage,
              assetClass: crmDeals.assetClass,
              city: crmDeals.city,
              state: crmDeals.state,
              value: crmDeals.value,
              probability: crmDeals.probability,
              priority: crmDeals.priority,
            })
            .from(crmDeals)
            .where(
              and(
                eq(crmDeals.id, project.dealId),
                eq(crmDeals.ownerId, orgId) // org-scope
              )
            )
            .limit(1);

          if (linkedDeal) {
            dealName = linkedDeal.title;
            lines.push(`### Deal Summary`);
            lines.push(`- **Name**: ${linkedDeal.title}`);
            lines.push(`- **Stage**: ${linkedDeal.stage}`);
            lines.push(`- **Asset Class**: ${linkedDeal.assetClass ?? 'N/A'}`);
            lines.push(`- **Location**: ${[linkedDeal.city, linkedDeal.state].filter(Boolean).join(', ') || 'N/A'}`);
            lines.push(`- **Deal Value**: ${fmtMoney(linkedDeal.value)}`);
            lines.push(`- **Priority**: ${linkedDeal.priority}`);
            lines.push(`- **Close Probability**: ${linkedDeal.probability != null ? `${linkedDeal.probability}%` : 'N/A'}`);
            injectedSections.push('Deal Summary');
          }
        }

        lines.push(`\n### Financial Model — ${project.marinaName}`);
        lines.push(`- **Purchase Price**: ${fmtMoney(project.purchasePrice)}`);
        lines.push(
          `- **Year 1 Cap Rate**: ${project.year1CapRate != null ? `${project.year1CapRate}%` : 'N/A'}`
        );
        lines.push(`- **EBITDA**: ${fmtMoney(project.ebitda)}`);
        lines.push(`- **Asset Class**: ${project.assetClass ?? 'N/A'}`);
        lines.push(`- **UW Stage**: ${project.uwStage ?? 'N/A'}`);
        const loc = [project.city, project.state].filter(Boolean).join(', ');
        if (loc) lines.push(`- **Location**: ${loc}`);
        if (project.totalStorageUnits) lines.push(`- **Total Units**: ${project.totalStorageUnits}`);
        injectedSections.push('Financial Model');

        // 3. Latest valuation snapshot — org-scoped
        const [snapshot] = await db
          .select({
            noi: valuationSnapshots.noi,
            grossRevenue: valuationSnapshots.grossRevenue,
            operatingExpenses: valuationSnapshots.operatingExpenses,
            capRate: valuationSnapshots.capRate,
            irr: valuationSnapshots.irr,
            equityMultiple: valuationSnapshots.equityMultiple,
            indicatedValue: valuationSnapshots.indicatedValue,
            snapshotDate: valuationSnapshots.snapshotDate,
          })
          .from(valuationSnapshots)
          .where(
            and(
              eq(valuationSnapshots.modelingProjectId, modelingProjectId),
              eq(valuationSnapshots.orgId, orgId)
            )
          )
          .orderBy(desc(valuationSnapshots.snapshotDate))
          .limit(1);

        if (snapshot && (snapshot.noi || snapshot.grossRevenue)) {
          const dateStr = snapshot.snapshotDate
            ? new Date(snapshot.snapshotDate).toLocaleDateString()
            : 'N/A';
          lines.push(`\n### Pro Forma / Valuation Metrics (as of ${dateStr})`);
          lines.push(`- **NOI**: ${fmtMoney(snapshot.noi)}`);
          lines.push(`- **Gross Revenue**: ${fmtMoney(snapshot.grossRevenue)}`);
          lines.push(`- **Operating Expenses**: ${fmtMoney(snapshot.operatingExpenses)}`);
          lines.push(`- **Cap Rate**: ${fmtPct(snapshot.capRate)}`);
          lines.push(`- **Indicated Value**: ${fmtMoney(snapshot.indicatedValue)}`);
          if (snapshot.irr) lines.push(`- **IRR (Snapshot)**: ${fmtPct(snapshot.irr)}`);
          if (snapshot.equityMultiple)
            lines.push(`- **Equity Multiple (Snapshot)**: ${fmtMultiple(snapshot.equityMultiple)}`);
          injectedSections.push('Pro Forma Metrics');
        }

        // 4. Most recent exit scenario (base case preferred) — org-scoped
        const exitRows = await db
          .select({
            name: exitScenarios.name,
            isBaseCase: exitScenarios.isBaseCase,
            holdingPeriodYears: exitScenarios.holdingPeriodYears,
            exitCapRate: exitScenarios.exitCapRate,
            projectedSalePrice: exitScenarios.projectedSalePrice,
            irr: exitScenarios.irr,
            moic: exitScenarios.moic,
          })
          .from(exitScenarios)
          .where(
            and(
              eq(exitScenarios.modelingProjectId, modelingProjectId),
              eq(exitScenarios.orgId, orgId)
            )
          )
          .orderBy(desc(exitScenarios.updatedAt))
          .limit(5);

        const exitScenario =
          exitRows.find((r) => r.isBaseCase) ?? exitRows[0] ?? null;

        if (exitScenario && (exitScenario.irr || exitScenario.moic || exitScenario.projectedSalePrice)) {
          lines.push(
            `\n### Returns & DCF (${exitScenario.name}${exitScenario.isBaseCase ? ' — Base Case' : ''})`
          );
          lines.push(`- **Levered IRR**: ${fmtPct(exitScenario.irr)}`);
          lines.push(`- **Equity Multiple (MOIC)**: ${fmtMultiple(exitScenario.moic)}`);
          lines.push(
            `- **Hold Period**: ${exitScenario.holdingPeriodYears != null ? `${exitScenario.holdingPeriodYears} years` : 'N/A'}`
          );
          lines.push(`- **Exit Cap Rate**: ${fmtPct(exitScenario.exitCapRate)}`);
          lines.push(`- **Projected Sale Price**: ${fmtMoney(exitScenario.projectedSalePrice)}`);
          injectedSections.push('Returns & DCF');
        }

        // 5. Active capital stack — org-scoped
        const [capitalStack] = await db
          .select({
            name: capitalStacks.name,
            totalDebt: capitalStacks.totalDebt,
            totalEquity: capitalStacks.totalEquity,
            ltv: capitalStacks.ltv,
            blendedDebtRate: capitalStacks.blendedDebtRate,
            totalCapitalization: capitalStacks.totalCapitalization,
          })
          .from(capitalStacks)
          .where(
            and(
              eq(capitalStacks.modelingProjectId, modelingProjectId),
              eq(capitalStacks.orgId, orgId),
              eq(capitalStacks.isActive, true)
            )
          )
          .limit(1);

        if (capitalStack && (capitalStack.totalDebt || capitalStack.totalEquity)) {
          lines.push(`\n### Capital Stack (${capitalStack.name})`);
          lines.push(`- **Total Capitalization**: ${fmtMoney(capitalStack.totalCapitalization)}`);
          lines.push(`- **Total Debt**: ${fmtMoney(capitalStack.totalDebt)}`);
          lines.push(`- **Total Equity**: ${fmtMoney(capitalStack.totalEquity)}`);
          lines.push(`- **LTV**: ${fmtPct(capitalStack.ltv)}`);
          lines.push(`- **Blended Debt Rate**: ${fmtPct(capitalStack.blendedDebtRate)}`);
          injectedSections.push('Capital Stack');
        }
      }
    }

    if (lines.length === 0) return null;

    const contextBlock = [
      '## CURRENT DEAL CONTEXT — LIVE DATA (Auto-Injected)',
      'The following data has been automatically loaded from the platform for this deal/project.',
      'Use these specific numbers when answering questions about this deal.',
      '',
      ...lines,
    ].join('\n');

    return {
      contextBlock,
      summary: { dealName, projectName, injectedSections },
    };
  } catch (err) {
    console.error('[DealContextResolver] Error resolving context:', err);
    return null;
  }
}
