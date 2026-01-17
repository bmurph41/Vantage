import { db } from '../db';
import { integrations } from '@shared/schema';
import { INTEGRATION_REGISTRY } from './registry';
import { eq } from 'drizzle-orm';

export async function seedIntegrations(): Promise<void> {
  console.log('[Integrations] Seeding integration catalog...');

  for (const item of INTEGRATION_REGISTRY) {
    try {
      const existing = await db.select().from(integrations).where(eq(integrations.key, item.key)).limit(1);

      if (existing.length > 0) {
        await db.update(integrations)
          .set({
            name: item.name,
            description: item.description,
            category: item.category,
            contexts: item.contexts,
            uiPlacements: item.uiPlacements,
            authType: item.authType as any,
            websiteUrl: item.websiteUrl,
            iconUrl: item.iconUrl,
            logoColor: item.logoColor,
            capabilities: item.capabilities,
            settingsSchema: item.settingsSchema,
            connectionGuide: item.connectionGuide,
            dataMappings: item.dataMappings,
            migrationSupport: item.migrationSupport,
            updatedAt: new Date(),
          })
          .where(eq(integrations.key, item.key));
      } else {
        await db.insert(integrations).values({
          key: item.key,
          name: item.name,
          description: item.description,
          category: item.category,
          contexts: item.contexts,
          uiPlacements: item.uiPlacements,
          authType: item.authType as any,
          websiteUrl: item.websiteUrl,
          iconUrl: item.iconUrl,
          logoColor: item.logoColor,
          capabilities: item.capabilities,
          settingsSchema: item.settingsSchema,
          connectionGuide: item.connectionGuide,
          dataMappings: item.dataMappings,
          migrationSupport: item.migrationSupport,
        });
      }
    } catch (error) {
      console.error(`[Integrations] Error seeding ${item.key}:`, error);
    }
  }

  console.log(`[Integrations] Seeded ${INTEGRATION_REGISTRY.length} integrations`);
}
