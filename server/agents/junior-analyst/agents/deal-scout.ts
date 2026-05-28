import { BaseAgent } from '../base-agent';
import { jaBus } from '../event-bus';

const SCORING_CRITERIA = [
  { key: 'has_address', label: 'Address on file', weight: 10 },
  { key: 'has_ask_price', label: 'Ask price provided', weight: 15 },
  { key: 'marina_asset_class', label: 'Marina / waterfront asset class', weight: 20 },
  { key: 'price_range_ok', label: 'Ask price in typical acquisition range ($2M–$50M)', weight: 15 },
  { key: 'active_stage', label: 'Stage indicates active outreach', weight: 10 },
];

export class DealScoutAgent extends BaseAgent {
  readonly id = 'deal_scout' as const;
  readonly name = 'Deal Scout';

  register(): void {
    jaBus.on('deal:created', async (payload) => {
      try {
        if (!await this.isEnabled(payload.orgId)) return;
        const mode = await this.getMode(payload.orgId);
        if (mode !== 'assisted') return;

        const score = this.scoreDeal(payload);

        const priority = score.total >= 50 ? 'high' : score.total >= 25 ? 'normal' : 'low';
        const grade = score.total >= 60 ? 'A' : score.total >= 40 ? 'B' : score.total >= 20 ? 'C' : 'D';

        const gaps = SCORING_CRITERIA
          .filter(c => !score.hits.includes(c.key))
          .map(c => c.label);

        await this.createSuggestion({
          orgId: payload.orgId,
          dealId: payload.dealId,
          agentId: this.id,
          agentName: this.name,
          type: 'deal_scored',
          title: `Deal scored: ${payload.dealName} — Grade ${grade} (${score.total}/100)`,
          body: `Initial screening score: **${score.total}/100 (${grade})**.\n\n${gaps.length > 0 ? `**Missing data that would improve the score:**\n${gaps.map(g => `• ${g}`).join('\n')}` : 'All key data points are present — ready for deeper underwriting.'}`,
          data: { dealId: payload.dealId, score: score.total, grade, hits: score.hits, gaps },
          priority,
          triggeredBy: 'deal:created',
        });
      } catch (err) {
        this.error('Failed to score deal', err);
      }
    });

    jaBus.on('deal:stage_changed', async (payload) => {
      try {
        if (!await this.isEnabled(payload.orgId)) return;
        const mode = await this.getMode(payload.orgId);
        if (mode !== 'assisted') return;

        const isHighValue = ['loi', 'under_contract', 'due_diligence', 'closing'].includes(payload.to?.toLowerCase());
        if (!isHighValue) return;

        await this.createSuggestion({
          orgId: payload.orgId,
          dealId: payload.dealId,
          agentId: this.id,
          agentName: this.name,
          type: 'stage_advancement',
          title: `${payload.dealName} advanced to ${payload.to}`,
          body: `"${payload.dealName}" moved from **${payload.from}** → **${payload.to}**. This stage typically requires updated financials, comp validation, and a refreshed pro forma. Want me to run a full underwriting pass?`,
          data: { from: payload.from, to: payload.to },
          priority: 'high',
          triggeredBy: 'deal:stage_changed',
        });
      } catch (err) {
        this.error('Failed to handle stage change', err);
      }
    });

    this.log('Registered (deal:created, deal:stage_changed)');
  }

  private scoreDeal(payload: { dealId: string; dealName: string; stage: string; address?: string; askPrice?: number; assetClass?: string }): { total: number; hits: string[] } {
    const hits: string[] = [];
    let total = 0;

    if (payload.address) { hits.push('has_address'); total += 10; }
    if (payload.askPrice && payload.askPrice > 0) { hits.push('has_ask_price'); total += 15; }
    if (payload.assetClass?.toLowerCase().includes('marina')) { hits.push('marina_asset_class'); total += 20; }
    if (payload.askPrice && payload.askPrice >= 2_000_000 && payload.askPrice <= 50_000_000) { hits.push('price_range_ok'); total += 15; }
    const activeStages = ['prospect', 'outreach', 'negotiation', 'loi', 'under_contract', 'due_diligence'];
    if (activeStages.some(s => payload.stage?.toLowerCase().includes(s))) { hits.push('active_stage'); total += 10; }

    return { total: Math.min(total, 100), hits };
  }
}
