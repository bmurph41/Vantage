import { db } from '../../db';
import {
  pnlDepartmentVerifications,
  pnlKeywordRules,
  type PnlDepartmentVerification,
  type InsertPnlDepartmentVerification,
  type AmbiguousDepartmentOption,
} from '@shared/schema';
import { and, eq, desc, sql } from 'drizzle-orm';

interface AmbiguousKeyword {
  keywords: string[];
  possibleDepartments: AmbiguousDepartmentOption[];
  reason: string;
}

const AMBIGUOUS_LINE_ITEMS: AmbiguousKeyword[] = [
  {
    keywords: ['cleaning labor', 'cleaning wages', 'cleaning staff', 'janitorial labor', 'janitorial wages'],
    possibleDepartments: [
      { department: 'Payroll', bucket: 'Expense', description: 'In-house cleaning staff wages' },
      { department: 'General', bucket: 'Expense', description: 'Contract cleaning service (third-party)' },
    ],
    reason: 'Cleaning labor could be in-house payroll or contracted services depending on your marina\'s arrangement.',
  },
  {
    keywords: ['dock labor', 'dock hand', 'dockhand wages', 'dock attendant'],
    possibleDepartments: [
      { department: 'Payroll', bucket: 'Expense', description: 'Full-time dock employee wages' },
      { department: 'Storage', bucket: 'Expense', description: 'Dock operations labor cost' },
    ],
    reason: 'Dock labor may be classified under payroll or as a direct storage operations cost.',
  },
  {
    keywords: ['maintenance labor', 'repair labor', 'maintenance wages'],
    possibleDepartments: [
      { department: 'Payroll', bucket: 'Expense', description: 'In-house maintenance staff wages' },
      { department: 'General', bucket: 'Expense', description: 'Contract maintenance services' },
      { department: 'Service', bucket: 'Expense', description: 'Service department labor allocation' },
    ],
    reason: 'Maintenance labor could be payroll, contract services, or allocated to the service department.',
  },
  {
    keywords: ['fuel labor', 'fuel attendant', 'fuel dock labor'],
    possibleDepartments: [
      { department: 'Payroll', bucket: 'Expense', description: 'Fuel dock staff wages' },
      { department: 'Fuel', bucket: 'Expense', description: 'Fuel operations labor cost' },
    ],
    reason: 'Fuel labor may be allocated to payroll or directly to fuel operations.',
  },
  {
    keywords: ['security labor', 'security wages', 'guard wages', 'night watch'],
    possibleDepartments: [
      { department: 'Payroll', bucket: 'Expense', description: 'In-house security staff wages' },
      { department: 'General', bucket: 'Expense', description: 'Contract security service' },
    ],
    reason: 'Security costs may be in-house payroll or contracted third-party services.',
  },
  {
    keywords: ['landscaping labor', 'grounds labor', 'groundskeeping'],
    possibleDepartments: [
      { department: 'Payroll', bucket: 'Expense', description: 'In-house grounds crew wages' },
      { department: 'General', bucket: 'Expense', description: 'Contract landscaping service' },
    ],
    reason: 'Landscaping may be performed by employees (payroll) or contracted out.',
  },
  {
    keywords: ['service labor', 'mechanic labor', 'technician labor', 'tech wages'],
    possibleDepartments: [
      { department: 'Payroll', bucket: 'Expense', description: 'Service department payroll' },
      { department: 'Service', bucket: 'COGS', description: 'Direct labor cost of goods sold' },
    ],
    reason: 'Service technician labor could be classified as payroll expense or COGS depending on accounting method.',
  },
  {
    keywords: ['ship store labor', 'retail labor', 'store wages', 'retail wages'],
    possibleDepartments: [
      { department: 'Payroll', bucket: 'Expense', description: 'Retail staff payroll' },
      { department: "Ship's Store", bucket: 'Expense', description: 'Ship store operations labor' },
    ],
    reason: 'Retail staff wages may be under general payroll or allocated to ship store department.',
  },
  {
    keywords: ['office labor', 'admin labor', 'administrative wages', 'office wages', 'clerical wages'],
    possibleDepartments: [
      { department: 'Payroll', bucket: 'Expense', description: 'Administrative payroll' },
      { department: 'General', bucket: 'Expense', description: 'General & administrative expense' },
    ],
    reason: 'Office/admin wages may be classified under payroll or G&A expenses.',
  },
  {
    keywords: ['management fee', 'manager fee', 'management expense'],
    possibleDepartments: [
      { department: 'Payroll', bucket: 'Expense', description: 'Manager salary/compensation' },
      { department: 'General', bucket: 'Expense', description: 'Third-party management fee' },
    ],
    reason: 'Management fees could be internal payroll or external management company fees.',
  },
  {
    keywords: ['contract labor', 'contracted labor', 'temp labor', 'temporary labor'],
    possibleDepartments: [
      { department: 'Payroll', bucket: 'Expense', description: 'Temporary/seasonal employee wages' },
      { department: 'General', bucket: 'Expense', description: 'Third-party contract services' },
      { department: 'Service', bucket: 'Expense', description: 'Contracted service technicians' },
    ],
    reason: 'Contract labor classification depends on whether workers are on payroll or independent contractors.',
  },
  {
    keywords: ['trash removal', 'garbage service', 'waste disposal', 'dumpster service'],
    possibleDepartments: [
      { department: 'General', bucket: 'Expense', description: 'General facility expense' },
      { department: 'Marina & Amenities', bucket: 'Expense', description: 'Marina amenities operating cost' },
    ],
    reason: 'Waste disposal could be a general facility cost or allocated to marina amenities.',
  },
  {
    keywords: ['utilities', 'electric', 'electricity', 'water', 'sewer'],
    possibleDepartments: [
      { department: 'General', bucket: 'Expense', description: 'General facility utilities' },
      { department: 'Marina & Amenities', bucket: 'Expense', description: 'Marina operations utilities' },
      { department: 'Storage', bucket: 'Expense', description: 'Storage area utilities allocation' },
    ],
    reason: 'Utilities may be classified as general overhead or allocated to specific departments.',
  },
  {
    keywords: ['insurance', 'liability insurance', 'property insurance'],
    possibleDepartments: [
      { department: 'General', bucket: 'Expense', description: 'General business insurance' },
      { department: 'Marina & Amenities', bucket: 'Expense', description: 'Marina-specific coverage' },
    ],
    reason: 'Insurance costs may be general overhead or specific to marina operations.',
  },
];

function normalizeLabel(label: string): string {
  return label.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
}

export function detectAmbiguousLineItem(label: string): AmbiguousKeyword | null {
  const normalized = normalizeLabel(label);
  
  for (const item of AMBIGUOUS_LINE_ITEMS) {
    for (const keyword of item.keywords) {
      if (normalized.includes(keyword)) {
        return item;
      }
    }
  }
  
  return null;
}

export async function checkKeywordBankForResolution(
  orgId: string,
  normalizedLabel: string
): Promise<{ department: string; bucket: string } | null> {
  const rule = await db.query.pnlKeywordRules.findFirst({
    where: and(
      eq(pnlKeywordRules.orgId, orgId),
      eq(pnlKeywordRules.isActive, true),
      sql`LOWER(${pnlKeywordRules.keyword}) = ${normalizedLabel.toLowerCase()}`
    ),
    orderBy: [desc(pnlKeywordRules.priority)],
  });
  
  if (rule) {
    await db.update(pnlKeywordRules)
      .set({ timesMatched: sql`${pnlKeywordRules.timesMatched} + 1` })
      .where(eq(pnlKeywordRules.id, rule.id));
    
    return {
      department: rule.department,
      bucket: rule.bucket,
    };
  }
  
  return null;
}

export async function createDepartmentVerification(
  data: InsertPnlDepartmentVerification
): Promise<PnlDepartmentVerification> {
  const [verification] = await db.insert(pnlDepartmentVerifications)
    .values(data)
    .returning();
  
  return verification;
}

export async function getPendingVerifications(
  orgId: string,
  jobId?: string
): Promise<PnlDepartmentVerification[]> {
  const conditions = [
    eq(pnlDepartmentVerifications.orgId, orgId),
    eq(pnlDepartmentVerifications.status, 'pending'),
  ];
  
  if (jobId) {
    conditions.push(eq(pnlDepartmentVerifications.jobId, jobId));
  }
  
  return db.query.pnlDepartmentVerifications.findMany({
    where: and(...conditions),
    orderBy: [desc(pnlDepartmentVerifications.createdAt)],
  });
}

export async function resolveDepartmentVerification(
  verificationId: string,
  orgId: string,
  userId: string,
  resolution: {
    department: string;
    bucket: string;
    saveToKeywordBank: boolean;
  }
): Promise<{ verification: PnlDepartmentVerification; keywordRuleId?: string }> {
  const [verification] = await db.select()
    .from(pnlDepartmentVerifications)
    .where(and(
      eq(pnlDepartmentVerifications.id, verificationId),
      eq(pnlDepartmentVerifications.orgId, orgId)
    ))
    .limit(1);
  
  if (!verification) {
    throw new Error('Verification not found');
  }
  
  if (verification.status !== 'pending') {
    throw new Error('Verification already resolved');
  }
  
  let keywordRuleId: string | undefined;
  
  if (resolution.saveToKeywordBank) {
    const [existingRule] = await db.select()
      .from(pnlKeywordRules)
      .where(and(
        eq(pnlKeywordRules.orgId, orgId),
        sql`LOWER(${pnlKeywordRules.keyword}) = ${verification.normalizedLabel.toLowerCase()}`
      ))
      .limit(1);
    
    if (existingRule) {
      await db.update(pnlKeywordRules)
        .set({
          department: resolution.department,
          bucket: resolution.bucket,
          priority: existingRule.priority + 10,
          source: 'user_verified',
          updatedAt: new Date(),
        })
        .where(eq(pnlKeywordRules.id, existingRule.id));
      keywordRuleId = existingRule.id;
    } else {
      const [newRule] = await db.insert(pnlKeywordRules)
        .values({
          orgId,
          keyword: verification.normalizedLabel,
          department: resolution.department,
          bucket: resolution.bucket,
          matchType: 'phrase',
          priority: 150,
          source: 'user_verified',
          isActive: true,
        })
        .returning();
      keywordRuleId = newRule.id;
    }
  }
  
  const [updated] = await db.update(pnlDepartmentVerifications)
    .set({
      selectedDepartment: resolution.department,
      selectedBucket: resolution.bucket,
      status: 'verified',
      resolvedByUserId: userId,
      saveToKeywordBank: resolution.saveToKeywordBank,
      keywordRuleId: keywordRuleId ?? null,
      resolvedAt: new Date(),
    })
    .where(eq(pnlDepartmentVerifications.id, verificationId))
    .returning();
  
  return { verification: updated, keywordRuleId };
}

export async function skipDepartmentVerification(
  verificationId: string,
  orgId: string,
  userId: string
): Promise<PnlDepartmentVerification> {
  const [updated] = await db.update(pnlDepartmentVerifications)
    .set({
      status: 'skipped',
      resolvedByUserId: userId,
      resolvedAt: new Date(),
    })
    .where(and(
      eq(pnlDepartmentVerifications.id, verificationId),
      eq(pnlDepartmentVerifications.orgId, orgId)
    ))
    .returning();
  
  if (!updated) {
    throw new Error('Verification not found');
  }
  
  return updated;
}

export async function getKeywordBankRules(
  orgId: string,
  source?: string
): Promise<typeof pnlKeywordRules.$inferSelect[]> {
  const conditions = [eq(pnlKeywordRules.orgId, orgId)];
  
  if (source) {
    conditions.push(eq(pnlKeywordRules.source, source));
  }
  
  return db.query.pnlKeywordRules.findMany({
    where: and(...conditions),
    orderBy: [desc(pnlKeywordRules.priority), desc(pnlKeywordRules.timesMatched)],
  });
}

export async function deleteKeywordRule(
  ruleId: string,
  orgId: string
): Promise<void> {
  await db.delete(pnlKeywordRules)
    .where(and(
      eq(pnlKeywordRules.id, ruleId),
      eq(pnlKeywordRules.orgId, orgId)
    ));
}

export async function updateKeywordRule(
  ruleId: string,
  orgId: string,
  updates: {
    department?: string;
    bucket?: string;
    priority?: number;
    isActive?: boolean;
  }
): Promise<typeof pnlKeywordRules.$inferSelect> {
  const [updated] = await db.update(pnlKeywordRules)
    .set({
      ...updates,
      updatedAt: new Date(),
    })
    .where(and(
      eq(pnlKeywordRules.id, ruleId),
      eq(pnlKeywordRules.orgId, orgId)
    ))
    .returning();
  
  if (!updated) {
    throw new Error('Keyword rule not found');
  }
  
  return updated;
}

export { AMBIGUOUS_LINE_ITEMS };
