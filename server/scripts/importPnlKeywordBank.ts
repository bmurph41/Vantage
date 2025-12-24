import { db } from '../db';
import { pnlKeywordRules, pnlCanonicalLineItems } from '@shared/schema';
import { eq, and, isNull } from 'drizzle-orm';
import * as XLSX from 'xlsx';
import path from 'path';

function normalizeKeyword(s: string): string {
  return (s ?? '')
    .trim()
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseColumnHeader(header: string): { department: string; bucket: string } | null {
  const match = header.match(/^(.+?)\s*-\s*(Revenue|COGS|Expense)$/i);
  if (!match) return null;
  return {
    department: match[1].trim(),
    bucket: match[2].trim(),
  };
}

interface KeywordEntry {
  department: string;
  bucket: string;
  keyword: string;
  normalizedKeyword: string;
  matchType: 'exact' | 'phrase' | 'token';
}

export async function importKeywordBankFromExcel(filePath: string, orgId: string | null = null): Promise<{ imported: number; skipped: number }> {
  const absolutePath = path.resolve(filePath);
  const wb = XLSX.readFile(absolutePath);
  
  const keywordSheet = wb.Sheets['Keyword Bank'];
  if (!keywordSheet) {
    throw new Error('No "Keyword Bank" sheet found in Excel file');
  }

  const data = XLSX.utils.sheet_to_json<Record<string, any>>(keywordSheet, { header: 1, defval: '' }) as any[][];
  if (data.length < 2) {
    throw new Error('Keyword Bank sheet has no data rows');
  }

  const headers = data[0] as string[];
  const columnMappings: Array<{ colIndex: number; department: string; bucket: string } | null> = headers.map((h, i) => {
    const parsed = parseColumnHeader(h);
    if (!parsed) return null;
    return { colIndex: i, ...parsed };
  });

  const entries: KeywordEntry[] = [];
  const seen = new Set<string>();

  for (let row = 1; row < data.length; row++) {
    const rowData = data[row] as string[];
    for (const mapping of columnMappings) {
      if (!mapping) continue;
      const cellValue = rowData[mapping.colIndex];
      if (!cellValue || typeof cellValue !== 'string' || cellValue.trim() === '') continue;

      const keyword = cellValue.trim();
      const normalizedKeyword = normalizeKeyword(keyword);
      if (!normalizedKeyword) continue;

      const key = `${mapping.department}|${mapping.bucket}|${normalizedKeyword}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const wordCount = normalizedKeyword.split(' ').length;
      const matchType: 'exact' | 'phrase' | 'token' = 
        wordCount >= 3 ? 'exact' : 
        wordCount === 2 ? 'phrase' : 
        'token';

      entries.push({
        department: mapping.department,
        bucket: mapping.bucket,
        keyword: normalizedKeyword,
        normalizedKeyword,
        matchType,
      });
    }
  }

  console.log(`[Keyword Bank Import] Found ${entries.length} unique keywords to import`);

  let imported = 0;
  let skipped = 0;

  const existingRules = await db.query.pnlKeywordRules.findMany({
    where: orgId ? eq(pnlKeywordRules.orgId, orgId) : isNull(pnlKeywordRules.orgId),
  });
  const existingKeys = new Set(existingRules.map(r => `${r.department}|${r.bucket}|${r.keyword}`));

  const toInsert = entries.filter(e => {
    const key = `${e.department}|${e.bucket}|${e.keyword}`;
    if (existingKeys.has(key)) {
      skipped++;
      return false;
    }
    return true;
  });

  if (toInsert.length > 0) {
    const batchSize = 100;
    for (let i = 0; i < toInsert.length; i += batchSize) {
      const batch = toInsert.slice(i, i + batchSize);
      await db.insert(pnlKeywordRules).values(
        batch.map((e, idx) => ({
          orgId: orgId ?? null,
          department: e.department,
          bucket: e.bucket,
          keyword: e.keyword,
          matchType: e.matchType,
          priority: 100 - Math.min(50, e.keyword.length),
          isActive: true,
          source: 'seed',
          timesMatched: 0,
        }))
      );
      imported += batch.length;
    }
  }

  console.log(`[Keyword Bank Import] Imported: ${imported}, Skipped (duplicates): ${skipped}`);
  return { imported, skipped };
}

export async function importObservedLineItems(filePath: string, orgId: string): Promise<{ imported: number; skipped: number }> {
  const absolutePath = path.resolve(filePath);
  const wb = XLSX.readFile(absolutePath);
  
  const observedSheet = wb.Sheets['Observed Line Items'];
  if (!observedSheet) {
    console.log('[Keyword Bank Import] No "Observed Line Items" sheet found, skipping');
    return { imported: 0, skipped: 0 };
  }

  const data = XLSX.utils.sheet_to_json<Record<string, any>>(observedSheet);
  if (data.length === 0) {
    return { imported: 0, skipped: 0 };
  }

  const entries: Array<{
    rawLineItem: string;
    normalizedLineItem: string;
    department: string;
    bucket: string;
  }> = [];

  const seen = new Set<string>();

  for (const row of data) {
    const rawLineItem = String(row['rawLineItem'] || row['Raw Line Item'] || '').trim();
    const department = String(row['department'] || row['Department'] || '').trim();
    const bucket = String(row['bucket'] || row['Bucket'] || '').trim();

    if (!rawLineItem || !department || !bucket) continue;

    const normalized = normalizeKeyword(rawLineItem);
    const key = `${normalized}|${department}|${bucket}`;
    if (seen.has(key)) continue;
    seen.add(key);

    entries.push({
      rawLineItem,
      normalizedLineItem: normalized,
      department,
      bucket,
    });
  }

  console.log(`[Observed Line Items Import] Found ${entries.length} unique observed items`);

  let imported = 0;
  let skipped = 0;

  const existingRules = await db.query.pnlKeywordRules.findMany({
    where: eq(pnlKeywordRules.orgId, orgId),
  });
  const existingKeys = new Set(existingRules.map(r => `${r.keyword}|${r.department}|${r.bucket}`));

  const toInsert = entries.filter(e => {
    const key = `${e.normalizedLineItem}|${e.department}|${e.bucket}`;
    if (existingKeys.has(key)) {
      skipped++;
      return false;
    }
    return true;
  });

  if (toInsert.length > 0) {
    const batchSize = 100;
    for (let i = 0; i < toInsert.length; i += batchSize) {
      const batch = toInsert.slice(i, i + batchSize);
      await db.insert(pnlKeywordRules).values(
        batch.map(e => ({
          orgId,
          department: e.department,
          bucket: e.bucket,
          keyword: e.normalizedLineItem,
          matchType: 'exact' as const,
          priority: 50,
          isActive: true,
          source: 'observed',
          timesMatched: 0,
        }))
      );
      imported += batch.length;
    }
  }

  console.log(`[Observed Line Items Import] Imported: ${imported}, Skipped: ${skipped}`);
  return { imported, skipped };
}
