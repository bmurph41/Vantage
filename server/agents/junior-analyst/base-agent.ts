import { db } from '../../db';
import { juniorAnalystSuggestions, juniorAnalystSettings } from '@shared/schema';
import { eq, and, isNull } from 'drizzle-orm';
import type { AgentId, CreateSuggestionInput, JaMode } from './types';

export abstract class BaseAgent {
  abstract readonly id: AgentId;
  abstract readonly name: string;
  abstract register(): void;

  protected async getMode(orgId: string, projectId?: string): Promise<JaMode> {
    if (projectId) {
      const [ps] = await db.select().from(juniorAnalystSettings)
        .where(and(eq(juniorAnalystSettings.orgId, orgId), eq(juniorAnalystSettings.projectId, projectId)));
      if (ps) return ps.mode as JaMode;
    }
    const [os] = await db.select().from(juniorAnalystSettings)
      .where(and(eq(juniorAnalystSettings.orgId, orgId), isNull(juniorAnalystSettings.projectId)));
    return (os?.mode as JaMode) ?? 'manual';
  }

  protected async isEnabled(orgId: string, projectId?: string): Promise<boolean> {
    if (projectId) {
      const [ps] = await db.select().from(juniorAnalystSettings)
        .where(and(eq(juniorAnalystSettings.orgId, orgId), eq(juniorAnalystSettings.projectId, projectId)));
      if (ps) {
        const enabled = ps.enabledAgents as string[];
        return Array.isArray(enabled) ? enabled.includes(this.id) : true;
      }
    }
    const [os] = await db.select().from(juniorAnalystSettings)
      .where(and(eq(juniorAnalystSettings.orgId, orgId), isNull(juniorAnalystSettings.projectId)));
    if (!os) return true;
    const enabled = os.enabledAgents as string[];
    return Array.isArray(enabled) ? enabled.includes(this.id) : true;
  }

  protected async createSuggestion(input: CreateSuggestionInput): Promise<void> {
    await db.insert(juniorAnalystSuggestions).values({
      orgId: input.orgId,
      projectId: input.projectId ?? null,
      dealId: input.dealId ?? null,
      agentId: input.agentId,
      agentName: input.agentName,
      type: input.type,
      title: input.title,
      body: input.body,
      data: input.data ?? {},
      priority: input.priority ?? 'normal',
      triggeredBy: input.triggeredBy ?? null,
      status: 'pending',
    });
    this.log(`Suggestion created: "${input.title}"`);
  }

  protected log(msg: string): void {
    console.log(`[JuniorAnalyst:${this.name}] ${msg}`);
  }

  protected error(msg: string, err?: any): void {
    console.error(`[JuniorAnalyst:${this.name}] ERROR: ${msg}`, err?.message ?? err ?? '');
  }
}
