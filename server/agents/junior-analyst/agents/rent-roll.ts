import { BaseAgent } from '../base-agent';
import { jaBus } from '../event-bus';

export class RentRollAgent extends BaseAgent {
  readonly id = 'rent_roll' as const;
  readonly name = 'Rent Roll';

  register(): void {
    jaBus.on('rent_roll:imported', async (payload) => {
      try {
        if (!await this.isEnabled(payload.orgId, payload.projectId)) return;
        const mode = await this.getMode(payload.orgId, payload.projectId);
        if (mode !== 'assisted') return;

        const occupancy = payload.occupancyRate ?? null;
        const insights: string[] = [];

        if (occupancy !== null) {
          if (occupancy >= 0.95) {
            insights.push(`**Occupancy at ${(occupancy * 100).toFixed(0)}%** — near full capacity, limited upside from occupancy gains; pricing power is the lever.`);
          } else if (occupancy >= 0.80) {
            insights.push(`**Occupancy at ${(occupancy * 100).toFixed(0)}%** — solid but room to fill. Consider a waiting list and rate increases for premium slips.`);
          } else {
            insights.push(`**Occupancy at ${(occupancy * 100).toFixed(0)}%** — below market norms. Investigate concessions, pricing mismatches, or deferred maintenance driving vacancy.`);
          }
        }

        insights.push(`**${payload.unitCount} units** extracted. Review for expired/month-to-month leases that represent renewal risk or repricing opportunity.`);
        insights.push('Check for any below-market rents versus current slip rates in the area — these are NOI upside candidates.');

        await this.createSuggestion({
          orgId: payload.orgId,
          projectId: payload.projectId,
          agentId: this.id,
          agentName: this.name,
          type: 'rent_roll_insights',
          title: `Rent roll analysis: ${payload.unitCount} units${occupancy !== null ? `, ${(occupancy * 100).toFixed(0)}% occupied` : ''}`,
          body: insights.join('\n\n'),
          data: { unitCount: payload.unitCount, occupancyRate: payload.occupancyRate },
          priority: occupancy !== null && occupancy < 0.80 ? 'high' : 'normal',
          triggeredBy: 'rent_roll:imported',
        });
      } catch (err) {
        this.error('Failed to handle rent_roll:imported', err);
      }
    });

    this.log('Registered (rent_roll:imported)');
  }
}
