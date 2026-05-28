import { BaseAgent } from '../base-agent';
import { jaBus } from '../event-bus';
import { db } from '../../../db';
import { modelingProjects } from '@shared/schema';
import { eq } from 'drizzle-orm';

export class MarketPulseAgent extends BaseAgent {
  readonly id = 'market_pulse' as const;
  readonly name = 'Market Pulse';

  register(): void {
    jaBus.on('deal:stage_changed', async (payload) => {
      try {
        if (!await this.isEnabled(payload.orgId)) return;
        const mode = await this.getMode(payload.orgId);
        if (mode !== 'assisted') return;

        const isActiveStage = ['loi', 'under_contract', 'due_diligence'].some(s =>
          payload.to?.toLowerCase().includes(s)
        );
        if (!isActiveStage) return;

        await this.createSuggestion({
          orgId: payload.orgId,
          dealId: payload.dealId,
          agentId: this.id,
          agentName: this.name,
          type: 'market_context',
          title: `Market context for ${payload.dealName}`,
          body: `"${payload.dealName}" is now in **${payload.to}**. I can pull current benchmark data — 10-year treasury, SOFR, marina cap rate comps, and regional transaction activity — to validate your underwriting assumptions. Want me to run a market context check?`,
          data: { dealId: payload.dealId, stage: payload.to },
          priority: 'normal',
          triggeredBy: 'deal:stage_changed',
        });
      } catch (err) {
        this.error('Failed to generate market context', err);
      }
    });

    jaBus.on('pnl:imported', async (payload) => {
      try {
        if (!await this.isEnabled(payload.orgId, payload.projectId)) return;
        const mode = await this.getMode(payload.orgId, payload.projectId);
        if (mode !== 'assisted') return;

        if (!payload.ebitda || payload.ebitda <= 0) return;

        const capRateRange = { low: 0.055, high: 0.085 };
        const valueLow = Math.round(payload.ebitda / capRateRange.high / 1000) * 1000;
        const valueHigh = Math.round(payload.ebitda / capRateRange.low / 1000) * 1000;

        await this.createSuggestion({
          orgId: payload.orgId,
          projectId: payload.projectId,
          agentId: this.id,
          agentName: this.name,
          type: 'implied_value_range',
          title: `Implied value range: $${(valueLow / 1_000_000).toFixed(1)}M – $${(valueHigh / 1_000_000).toFixed(1)}M`,
          body: `Based on ${payload.year} EBITDA${payload.ebitda ? ` of ~$${(payload.ebitda / 1000).toFixed(0)}k` : ''} and current marina cap rate benchmarks (5.5%–8.5%), the implied value range is **$${(valueLow / 1_000_000).toFixed(1)}M – $${(valueHigh / 1_000_000).toFixed(1)}M**. Run the market rates module for live debt pricing.`,
          data: { year: payload.year, ebitda: payload.ebitda, valueLow, valueHigh, capRateRange },
          priority: 'normal',
          triggeredBy: 'pnl:imported',
        });
      } catch (err) {
        this.error('Failed to generate value range', err);
      }
    });

    this.log('Registered (deal:stage_changed, pnl:imported)');
  }
}
