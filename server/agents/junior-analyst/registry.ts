import { DocumentIntakeAgent } from './agents/document-intake';
import { UnderwritingAgent } from './agents/underwriting';
import { DealScoutAgent } from './agents/deal-scout';
import { DdCoordinatorAgent } from './agents/dd-coordinator';
import { RentRollAgent } from './agents/rent-roll';
import { MarketPulseAgent } from './agents/market-pulse';
import { OutreachAgent } from './agents/outreach';
import type { BaseAgent } from './base-agent';

const agents: BaseAgent[] = [
  new DocumentIntakeAgent(),
  new UnderwritingAgent(),
  new DealScoutAgent(),
  new DdCoordinatorAgent(),
  new RentRollAgent(),
  new MarketPulseAgent(),
  new OutreachAgent(),
];

export function startJuniorAnalyst(): void {
  console.log('[JuniorAnalyst] Starting agent registry...');
  for (const agent of agents) {
    try {
      agent.register();
    } catch (err: any) {
      console.error(`[JuniorAnalyst] Failed to register agent ${agent.name}:`, err?.message);
    }
  }
  console.log(`[JuniorAnalyst] ${agents.length} agents registered and listening.`);
}
