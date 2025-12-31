import * as xlsx from 'xlsx';
import { db } from '../db';
import { coaCategories, segments, coaAliases } from '@shared/financial-coa-schema';
import { normalizeLineItemLabel } from '../utils/normalizeLineItemLabel';
import { eq, and, isNull } from 'drizzle-orm';

const FILE_PATH = 'data/Model Set Up.xlsx';

interface CoaMasterRow {
  coa_code?: string;
  display_name?: string;
  major_group?: string;
  subcategory_group?: string;
  description?: string;
  sort_order?: number;
}

interface SegmentMasterRow {
  segment_code?: string;
  segment_name?: string;
  segment_type?: string;
  sort_order?: number;
  notes?: string;
}

interface AliasSeedRow {
  raw_label?: string;
  suggested_coa_code?: string;
  suggested_segment_code?: string;
  notes?: string;
}

function normalizeMajorGroup(group: string | undefined): string {
  if (!group) return 'EXPENSE';
  const upper = group.toUpperCase().trim();
  if (upper.includes('REVENUE') || upper.includes('INCOME')) return 'REVENUE';
  if (upper.includes('COGS') || upper.includes('COST OF GOODS') || upper.includes('COST OF SALES')) return 'COGS';
  return 'EXPENSE';
}

function normalizeSegmentType(type: string | undefined): string {
  if (!type) return 'CORE';
  const upper = type.toUpperCase().trim();
  if (upper.includes('ANCILLARY')) return 'ANCILLARY';
  if (upper.includes('NON') && upper.includes('OPER')) return 'NON-OPERATING';
  return 'CORE';
}

async function seedCoa(rows: CoaMasterRow[]): Promise<void> {
  console.log(`[COA] Processing ${rows.length} COA rows...`);
  let inserted = 0;
  let updated = 0;

  for (const row of rows) {
    if (!row.coa_code || !row.display_name) {
      continue;
    }

    const coaCode = row.coa_code.toString().trim();
    const displayName = row.display_name.toString().trim();
    const majorGroup = normalizeMajorGroup(row.major_group);
    const subcategoryGroup = row.subcategory_group?.toString().trim() || null;
    const description = row.description?.toString().trim() || null;
    const sortOrder = typeof row.sort_order === 'number' ? row.sort_order : 0;

    const existing = await db.query.coaCategories.findFirst({
      where: and(isNull(coaCategories.orgId), eq(coaCategories.coaCode, coaCode)),
    });

    if (existing) {
      await db.update(coaCategories)
        .set({ displayName, majorGroup, subcategoryGroup, description, sortOrder, updatedAt: new Date() })
        .where(eq(coaCategories.id, existing.id));
      updated++;
    } else {
      await db.insert(coaCategories).values({
        orgId: null,
        coaCode,
        displayName,
        majorGroup,
        subcategoryGroup,
        description,
        sortOrder,
      });
      inserted++;
    }
  }

  console.log(`[COA] Inserted ${inserted}, Updated ${updated}`);
}

async function seedSegments(rows: SegmentMasterRow[]): Promise<void> {
  console.log(`[Segments] Processing ${rows.length} segment rows...`);
  let inserted = 0;
  let updated = 0;

  for (const row of rows) {
    if (!row.segment_code || !row.segment_name) {
      continue;
    }

    const segmentCode = row.segment_code.toString().trim();
    const segmentName = row.segment_name.toString().trim();
    const segmentType = normalizeSegmentType(row.segment_type);
    const sortOrder = typeof row.sort_order === 'number' ? row.sort_order : 0;
    const notes = row.notes?.toString().trim() || null;

    const existing = await db.query.segments.findFirst({
      where: and(isNull(segments.orgId), eq(segments.segmentCode, segmentCode)),
    });

    if (existing) {
      await db.update(segments)
        .set({ segmentName, segmentType, sortOrder, notes, updatedAt: new Date() })
        .where(eq(segments.id, existing.id));
      updated++;
    } else {
      await db.insert(segments).values({
        orgId: null,
        segmentCode,
        segmentName,
        segmentType,
        sortOrder,
        notes,
      });
      inserted++;
    }
  }

  console.log(`[Segments] Inserted ${inserted}, Updated ${updated}`);
}

async function seedAliases(rows: AliasSeedRow[]): Promise<void> {
  console.log(`[Aliases] Processing ${rows.length} alias rows...`);
  let inserted = 0;
  let skipped = 0;

  for (const row of rows) {
    if (!row.raw_label || !row.suggested_coa_code) {
      skipped++;
      continue;
    }

    const rawLabel = row.raw_label.toString().trim();
    const suggestedCoaCode = row.suggested_coa_code.toString().trim();
    const suggestedSegmentCode = row.suggested_segment_code?.toString().trim() || null;
    const notes = row.notes?.toString().trim() || null;
    const normalizedLabel = normalizeLineItemLabel(rawLabel);

    const coa = await db.query.coaCategories.findFirst({
      where: and(isNull(coaCategories.orgId), eq(coaCategories.coaCode, suggestedCoaCode)),
    });

    if (!coa) {
      console.warn(`[Aliases] COA not found for code: ${suggestedCoaCode}`);
      skipped++;
      continue;
    }

    let segmentId: string | null = null;
    if (suggestedSegmentCode) {
      const segment = await db.query.segments.findFirst({
        where: and(isNull(segments.orgId), eq(segments.segmentCode, suggestedSegmentCode)),
      });
      if (segment) {
        segmentId = segment.id;
      } else {
        console.warn(`[Aliases] Segment not found for code: ${suggestedSegmentCode}`);
      }
    }

    const existing = await db.query.coaAliases.findFirst({
      where: and(
        isNull(coaAliases.orgId),
        eq(coaAliases.normalizedLabel, normalizedLabel),
        eq(coaAliases.coaId, coa.id)
      ),
    });

    if (!existing) {
      await db.insert(coaAliases).values({
        orgId: null,
        coaId: coa.id,
        segmentId,
        aliasLabel: rawLabel,
        normalizedLabel,
        createdFrom: 'seed',
        confidence: '1.000',
        timesMatched: 0,
        notes,
      });
      inserted++;
    }
  }

  console.log(`[Aliases] Inserted ${inserted}, Skipped ${skipped}`);
}

async function main() {
  console.log('='.repeat(60));
  console.log('Financial COA Seed Script');
  console.log('='.repeat(60));

  console.log(`Reading workbook from: ${FILE_PATH}`);
  const workbook = xlsx.readFile(FILE_PATH);

  const coaSheet = workbook.Sheets['COA_Master'];
  const segmentSheet = workbook.Sheets['Segments_Master'];
  const aliasSheet = workbook.Sheets['Alias_Seed'];

  if (coaSheet) {
    const coaRows = xlsx.utils.sheet_to_json<CoaMasterRow>(coaSheet, { defval: null });
    await seedCoa(coaRows);
  } else {
    console.log('[COA] Sheet "COA_Master" not found');
  }

  if (segmentSheet) {
    const segmentRows = xlsx.utils.sheet_to_json<SegmentMasterRow>(segmentSheet, { defval: null });
    await seedSegments(segmentRows);
  } else {
    console.log('[Segments] Sheet "Segments_Master" not found');
  }

  if (aliasSheet) {
    const aliasRows = xlsx.utils.sheet_to_json<AliasSeedRow>(aliasSheet, { defval: null });
    await seedAliases(aliasRows);
  } else {
    console.log('[Aliases] Sheet "Alias_Seed" not found');
  }

  console.log('='.repeat(60));
  console.log('Seed complete!');
  console.log('='.repeat(60));
  
  process.exit(0);
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
