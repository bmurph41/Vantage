import { db } from './db';
import { vdrDueDatePresets, users } from '@shared/schema';
import { eq, and } from 'drizzle-orm';

const DEFAULT_PRESETS = [
  { slug: 'one_week', name: 'One Week', days: 7, displayOrder: 1 },
  { slug: 'two_weeks', name: 'Two Weeks', days: 14, displayOrder: 2 },
  { slug: 'one_month', name: 'One Month', days: 30, displayOrder: 3 },
];

export async function ensureDefaultDueDatePresets(orgId: string, fallbackUserId?: string): Promise<void> {
  try {
    let createdBy = fallbackUserId;
    
    if (!createdBy) {
      const firstUser = await db.select({ id: users.id })
        .from(users)
        .where(eq(users.orgId, orgId))
        .limit(1);

      if (!firstUser.length) {
        console.warn(`No users found for org ${orgId}, skipping due date preset seeding for now`);
        return;
      }
      
      createdBy = firstUser[0].id;
    }

    const presetsToInsert = DEFAULT_PRESETS.map(preset => ({
      orgId,
      slug: preset.slug,
      name: preset.name,
      days: preset.days,
      displayOrder: preset.displayOrder,
      isActive: true,
      createdBy,
    }));

    await db.insert(vdrDueDatePresets)
      .values(presetsToInsert)
      .onConflictDoNothing({ target: [vdrDueDatePresets.slug, vdrDueDatePresets.orgId] });
  } catch (error) {
    console.error(`Error seeding default due date presets for org ${orgId}:`, error);
  }
}
