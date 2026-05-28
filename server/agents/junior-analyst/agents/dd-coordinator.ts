import { BaseAgent } from '../base-agent';
import { jaBus } from '../event-bus';

const DD_CHECKLIST: Record<string, string[]> = {
  financial: ['Last 3 years P&L', 'YTD financials', 'Tax returns (2 years)', 'Accounts receivable aging'],
  operational: ['Current rent roll', 'Slip/storage lease agreements', 'Fuel supply contracts', 'Insurance policies'],
  legal: ['Title commitment', 'Survey/ALTA', 'Environmental Phase I', 'Any pending litigation'],
  physical: ['Marina condition report', 'Dock inspection', 'Dredging history', 'Fuel system inspection'],
};

export class DdCoordinatorAgent extends BaseAgent {
  readonly id = 'dd_coordinator' as const;
  readonly name = 'DD Coordinator';

  register(): void {
    jaBus.on('deal:stage_changed', async (payload) => {
      try {
        if (!await this.isEnabled(payload.orgId)) return;
        const mode = await this.getMode(payload.orgId);
        if (mode !== 'assisted') return;

        const isDdStage = ['due_diligence', 'dd', 'under_contract', 'loi'].some(s =>
          payload.to?.toLowerCase().includes(s)
        );
        if (!isDdStage) return;

        const allItems = Object.entries(DD_CHECKLIST).flatMap(([category, items]) =>
          items.map(item => `**${this.capitalize(category)}:** ${item}`)
        );

        await this.createSuggestion({
          orgId: payload.orgId,
          dealId: payload.dealId,
          agentId: this.id,
          agentName: this.name,
          type: 'dd_checklist_ready',
          title: `DD checklist ready for ${payload.dealName}`,
          body: `Now that "${payload.dealName}" is in **${payload.to}**, here's a standard marina acquisition checklist to track:\n\n${allItems.map(i => `• ${i}`).join('\n')}`,
          data: { dealId: payload.dealId, stage: payload.to, checklist: DD_CHECKLIST },
          priority: 'high',
          triggeredBy: 'deal:stage_changed',
        });
      } catch (err) {
        this.error('Failed to generate DD checklist', err);
      }
    });

    jaBus.on('dd:item_overdue', async (payload) => {
      try {
        if (!await this.isEnabled(payload.orgId)) return;

        await this.createSuggestion({
          orgId: payload.orgId,
          dealId: payload.dealId,
          agentId: this.id,
          agentName: this.name,
          type: 'dd_item_overdue',
          title: `DD item overdue: ${payload.itemName}`,
          body: `"**${payload.itemName}**" has been outstanding for ${payload.daysOverdue} day${payload.daysOverdue !== 1 ? 's' : ''}. This may block closing if not resolved soon.`,
          data: { itemId: payload.itemId, itemName: payload.itemName, daysOverdue: payload.daysOverdue },
          priority: payload.daysOverdue > 7 ? 'critical' : 'high',
          triggeredBy: 'dd:item_overdue',
        });
      } catch (err) {
        this.error('Failed to handle overdue DD item', err);
      }
    });

    this.log('Registered (deal:stage_changed, dd:item_overdue)');
  }

  private capitalize(s: string): string {
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
}
