import { BaseAgent } from '../base-agent';
import { jaBus } from '../event-bus';
import Anthropic from '@anthropic-ai/sdk';
import { db } from '../../../db';
import { modelingProjects } from '@shared/schema';
import { eq } from 'drizzle-orm';

export class UnderwritingAgent extends BaseAgent {
  readonly id = 'underwriting' as const;
  readonly name = 'Underwriting';

  register(): void {
    jaBus.on('pnl:imported', async (payload) => {
      try {
        if (!await this.isEnabled(payload.orgId, payload.projectId)) return;
        const mode = await this.getMode(payload.orgId, payload.projectId);
        if (mode !== 'assisted') return;

        const project = await db.select().from(modelingProjects)
          .where(eq(modelingProjects.id, payload.projectId))
          .then(r => r[0]);

        const assumptions = await this.draftAssumptions(payload, project);

        await this.createSuggestion({
          orgId: payload.orgId,
          projectId: payload.projectId,
          agentId: this.id,
          agentName: this.name,
          type: 'pro_forma_draft',
          title: `Pro forma assumptions drafted for ${payload.year}`,
          body: assumptions.summary,
          data: { year: payload.year, lineItemCount: payload.lineItemCount, assumptions: assumptions.data },
          priority: 'normal',
          triggeredBy: 'pnl:imported',
        });
      } catch (err) {
        this.error('Failed to handle pnl:imported', err);
      }
    });

    jaBus.on('deal:created', async (payload) => {
      try {
        if (!await this.isEnabled(payload.orgId)) return;
        const mode = await this.getMode(payload.orgId);
        if (mode !== 'assisted') return;

        if (!payload.address && !payload.askPrice) return;

        await this.createSuggestion({
          orgId: payload.orgId,
          dealId: payload.dealId,
          agentId: this.id,
          agentName: this.name,
          type: 'underwrite_available',
          title: `Ready to underwrite: ${payload.dealName}`,
          body: `A new deal was added${payload.address ? ` at ${payload.address}` : ''}${payload.askPrice ? ` (asking $${(payload.askPrice / 1_000_000).toFixed(1)}M)` : ''}. I can run a first-pass underwrite — pulling comps, estimating NOI, and building draft assumptions — whenever you're ready.`,
          data: { dealId: payload.dealId, address: payload.address, askPrice: payload.askPrice, assetClass: payload.assetClass },
          priority: 'low',
          triggeredBy: 'deal:created',
        });
      } catch (err) {
        this.error('Failed to handle deal:created', err);
      }
    });

    this.log('Registered (pnl:imported, deal:created)');
  }

  private async draftAssumptions(payload: { year: number; lineItemCount: number; ebitda?: number }, project: any) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return {
        summary: `${payload.lineItemCount} line items imported for ${payload.year}. Review the extracted data and set your pro forma assumptions to begin modeling.`,
        data: {},
      };
    }

    try {
      const client = new Anthropic({ apiKey });
      const ebitdaStr = payload.ebitda ? `$${(payload.ebitda / 1000).toFixed(0)}k` : 'not yet calculated';
      const prompt = `You are an institutional marina acquisition analyst. A P&L for year ${payload.year} has just been imported with ${payload.lineItemCount} line items. EBITDA is ${ebitdaStr}.

Provide a concise JSON response with suggested first-pass pro forma assumptions. Return ONLY valid JSON:
{
  "suggestedCapRate": <number 0-1>,
  "suggestedGrowthRate": <number 0-1>,
  "suggestedExpenseRatio": <number 0-1>,
  "managementFee": <number 0-1>,
  "holdPeriod": <integer years>,
  "notes": "<one sentence rationale>"
}`;

      const msg = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 300,
        messages: [{ role: 'user', content: prompt }],
      });

      const text = msg.content[0].type === 'text' ? msg.content[0].text : '{}';
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      const data = jsonMatch ? JSON.parse(jsonMatch[0]) : {};

      const capRatePct = data.suggestedCapRate ? (data.suggestedCapRate * 100).toFixed(1) : '6.5';
      const growthPct = data.suggestedGrowthRate ? (data.suggestedGrowthRate * 100).toFixed(1) : '3.0';

      return {
        summary: `${payload.year} P&L imported (${payload.lineItemCount} line items${payload.ebitda ? `, EBITDA ~${ebitdaStr}` : ''}). Suggested starting assumptions: **${capRatePct}% cap rate**, **${growthPct}% annual growth**, **${data.holdPeriod ?? 5}-year hold**. ${data.notes ?? 'Review and adjust before finalizing.'}`,
        data,
      };
    } catch (err) {
      this.error('AI assumption draft failed, using defaults', err);
      return {
        summary: `${payload.year} P&L imported (${payload.lineItemCount} line items). Review the extracted data and set your pro forma assumptions to begin modeling.`,
        data: {},
      };
    }
  }
}
