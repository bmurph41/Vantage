import { db } from './db';
import { vdrDiligenceCategories, users } from '@shared/schema';
import { eq, and } from 'drizzle-orm';

const DEFAULT_CATEGORIES = [
  { slug: 'financial', name: 'Financial', description: 'Financial statements, tax returns, and financial records', displayOrder: 1 },
  { slug: 'legal', name: 'Legal', description: 'Contracts, permits, licenses, and legal documents', displayOrder: 2 },
  { slug: 'operational', name: 'Operational', description: 'Operating procedures, maintenance records, and operational data', displayOrder: 3 },
  { slug: 'environmental', name: 'Environmental', description: 'Environmental assessments, compliance reports, and permits', displayOrder: 4 },
  { slug: 'insurance', name: 'Insurance', description: 'Insurance policies, claims history, and coverage documents', displayOrder: 5 },
  { slug: 'title_and_survey', name: 'Title & Survey', description: 'Title documents, surveys, and property records', displayOrder: 6 },
  { slug: 'permits_and_zoning', name: 'Permits & Zoning', description: 'Permits, zoning compliance, and regulatory approvals', displayOrder: 7 },
  { slug: 'hr_and_employment', name: 'HR & Employment', description: 'Employee records, contracts, and benefits information', displayOrder: 8 },
  { slug: 'lease_and_tenancy', name: 'Lease & Tenancy', description: 'Lease agreements, tenant information, and rental records', displayOrder: 9 },
  { slug: 'technical', name: 'Technical', description: 'Technical specifications, systems documentation, and infrastructure', displayOrder: 10 },
];

export async function ensureDefaultCategories(orgId: string, fallbackUserId?: string): Promise<void> {
  try {
    let createdBy = fallbackUserId;
    
    if (!createdBy) {
      const firstUser = await db.select({ id: users.id })
        .from(users)
        .where(eq(users.orgId, orgId))
        .limit(1);

      if (!firstUser.length) {
        return;
      }
      
      createdBy = firstUser[0].id;
    }

    const categoriesToInsert = DEFAULT_CATEGORIES.map(cat => ({
      orgId,
      slug: cat.slug,
      name: cat.name,
      description: cat.description,
      displayOrder: cat.displayOrder,
      isActive: true,
      createdBy,
    }));

    await db.insert(vdrDiligenceCategories)
      .values(categoriesToInsert)
      .onConflictDoNothing({ target: [vdrDiligenceCategories.slug, vdrDiligenceCategories.orgId] });
  } catch (error) {
    console.error(`Error seeding default categories for org ${orgId}:`, error);
  }
}
