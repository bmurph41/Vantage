import { db } from '../db';
import { 
  pnlCategories, 
  docIntelUploads, 
  docIntelExtractedItems, 
  docIntelCategoryMappings,
  docIntelLearningRules,
  docIntelTrainingExamples,
  pnlLines,
  modelingActuals,
  rentRolls,
  rentRollEntries,
  marinaCustomers,
  crmContacts,
  type PnlCategory,
  type InsertPnlCategory,
  type DocIntelUpload,
  type InsertDocIntelUpload,
  type UpdateDocIntelUpload,
  type DocIntelExtractedItem,
  type InsertDocIntelExtractedItem,
  type UpdateDocIntelExtractedItem,
  type DocIntelCategoryMapping,
  type InsertDocIntelCategoryMapping,
  type DocIntelLearningRule,
  type InsertDocIntelLearningRule,
  type PnlLine,
  type InsertPnlLine,
  type ModelingActuals,
  type RentRoll,
  type RentRollEntry,
  type MarinaCustomer
} from '@shared/schema';
import { eq, and, sql, desc, asc } from 'drizzle-orm';
import * as fs from 'fs';
import * as crypto from 'crypto';
import path from 'path';
import * as XLSX from 'xlsx';
import { extractDocument } from '../utils/ocr';
import { findAliasMatch, getMatchResult, learnAlias, buildCoaCode } from "./pnl-alias-matcher";
import { onLineItemConfirmed, applyLearningRulesOnRetrieval } from './learning-rules.integration';

interface ParsedLineItem {
  rawText: string;
  amount: number | null;
  extractedDate?: string;
  sourcePage?: number;
  sourceRow: number;
  periodKey?: string;
  columnIndex?: number;
  isZeroValueSubtotal?: boolean;
}

interface MonthHeader {
  columnIndex: number;
  month: number;
  year: number;
  periodKey: string;
  rawLabel: string;
}

const MONTH_PATTERNS: Record<string, number> = {
  'jan': 1, 'january': 1,
  'feb': 2, 'february': 2,
  'mar': 3, 'march': 3,
  'apr': 4, 'april': 4,
  'may': 5,
  'jun': 6, 'june': 6,
  'jul': 7, 'july': 7,
  'aug': 8, 'august': 8,
  'sep': 9, 'sept': 9, 'september': 9,
  'oct': 10, 'october': 10,
  'nov': 11, 'november': 11,
  'dec': 12, 'december': 12,
};

const TOTAL_COLUMN_PATTERNS = /^(total|ytd|year[\s-]?to[\s-]?date|annual|full[\s-]?year|fy|grand[\s-]?total)$/i;

interface ParsedRentRollEntry {
  unitNumber: string;
  tenantName?: string;
  monthlyRate: number;
  entryType: 'wet_slip' | 'dry_storage' | 'rack' | 'mooring' | 'other';
  status: 'active' | 'vacant' | 'reserved' | 'pending';
  startDate?: string;
  endDate?: string;
  sourceRow: number;
  boatInfo?: {
    name?: string;
    length?: number;
    make?: string;
    model?: string;
  };
  contactInfo?: {
    email?: string;
    phone?: string;
  };
  rawData: Record<string, any>;
}

interface CategoryMatch {
  categoryId: string;
  categoryName: string;
  confidenceScore: number;
  matchedRuleId?: string;
  ruleType: 'pattern' | 'learning' | 'ai';
  categoryTier?: 'revenue' | 'cogs' | 'expense';
  revenueCogsDept?: string;
  expenseDept?: string;
}

function sanitizeText(value: string | null | undefined): string {
  if (!value) return '';
  
  let cleaned = value
    .replace(/\u0000/g, '')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .replace(/\uFFFD/g, '')
    .replace(/[\u0080-\u009F]/g, '')
    .replace(/[^\x20-\x7E\u00A0-\u00FF\u0100-\u017F\u2000-\u206F\u2070-\u209F]/g, (char) => {
      const code = char.charCodeAt(0);
      if (code >= 0xE000 && code <= 0xF8FF) return '';
      if (code >= 0x2200 && code <= 0x22FF) return '';
      if (char.match(/[\uD800-\uDBFF][\uDC00-\uDFFF]/)) return '';
      return char;
    })
    .replace(/\s+/g, ' ')
    .trim();
  
  const printableRatio = (cleaned.match(/[a-zA-Z0-9\s.,\-$%()/]/g) || []).length / Math.max(cleaned.length, 1);
  if (printableRatio < 0.5 && cleaned.length > 10) {
    cleaned = cleaned.replace(/[^a-zA-Z0-9\s.,\-$%()/&'":;]/g, '');
  }
  
  return cleaned;
}

export const MARINA_DEFAULT_CATEGORIES = [
  { categoryType: 'revenue', name: 'Revenue', sortOrder: 1, isDefault: true, children: [
    { name: 'Wet Slip Revenue', sortOrder: 1 },
    { name: 'Dry Storage Revenue', sortOrder: 2 },
    { name: 'Fuel Sales', sortOrder: 3 },
    { name: 'Ship Store Sales', sortOrder: 4 },
    { name: 'Boat Repairs & Service', sortOrder: 5 },
    { name: 'Boat Sales & Commissions', sortOrder: 6 },
    { name: 'Electric & Water Income', sortOrder: 7 },
    { name: 'Launch & Haul Fees', sortOrder: 8 },
    { name: 'Transient Dockage', sortOrder: 9 },
    { name: 'Winter Storage', sortOrder: 10 },
    { name: 'Other Marina Income', sortOrder: 11 },
  ]},
  { categoryType: 'cogs', name: 'Cost of Goods Sold', sortOrder: 2, isDefault: true, children: [
    { name: 'Fuel Cost', sortOrder: 1 },
    { name: 'Ship Store Cost', sortOrder: 2 },
    { name: 'Parts & Materials Cost', sortOrder: 3 },
    { name: 'Boat Purchase Cost', sortOrder: 4 },
  ]},
  { categoryType: 'opex', name: 'Operating Expenses', sortOrder: 3, isDefault: true, children: [
    { name: 'Insurance', sortOrder: 1 },
    { name: 'Property Taxes', sortOrder: 2 },
    { name: 'Utilities (Electric)', sortOrder: 3 },
    { name: 'Utilities (Water/Sewer)', sortOrder: 4 },
    { name: 'Utilities (Gas/Propane)', sortOrder: 5 },
    { name: 'Repairs & Maintenance', sortOrder: 6 },
    { name: 'Dock & Pier Maintenance', sortOrder: 7 },
    { name: 'Ground Lease / Rent', sortOrder: 8 },
    { name: 'Marketing & Advertising', sortOrder: 9 },
    { name: 'Professional Fees', sortOrder: 10 },
    { name: 'Office & Administrative', sortOrder: 11 },
    { name: 'Technology & Software', sortOrder: 12 },
    { name: 'Environmental Compliance', sortOrder: 13 },
    { name: 'Security', sortOrder: 14 },
    { name: 'Management Fees', sortOrder: 15 },
    { name: 'Other Operating Expenses', sortOrder: 16 },
  ]},
  { categoryType: 'payroll', name: 'Payroll & Benefits', sortOrder: 4, isDefault: true, children: [
    { name: 'Wages & Salaries', sortOrder: 1 },
    { name: 'Payroll Taxes', sortOrder: 2 },
    { name: 'Health Insurance', sortOrder: 3 },
    { name: 'Retirement Benefits', sortOrder: 4 },
    { name: 'Workers Compensation', sortOrder: 5 },
    { name: 'Contract Labor', sortOrder: 6 },
  ]},
  { categoryType: 'other_income', name: 'Other Income', sortOrder: 5, isDefault: true, children: [
    { name: 'Interest Income', sortOrder: 1 },
    { name: 'Late Fees & Penalties', sortOrder: 2 },
    { name: 'Miscellaneous Income', sortOrder: 3 },
  ]},
  { categoryType: 'other_expense', name: 'Other Expenses', sortOrder: 6, isDefault: true, children: [
    { name: 'Interest Expense', sortOrder: 1 },
    { name: 'Depreciation', sortOrder: 2 },
    { name: 'Amortization', sortOrder: 3 },
    { name: 'Capital Expenditures', sortOrder: 4 },
  ]},
] as const;

export const MARINA_DEFAULT_PATTERNS = [
  { pattern: 'wet\\s*slip|slip\\s*rental|dockage\\s*fee|monthly\\s*slip', categoryName: 'Wet Slip Revenue', priority: 10 },
  { pattern: 'dry\\s*storage|rack\\s*storage|boat\\s*storage', categoryName: 'Dry Storage Revenue', priority: 10 },
  { pattern: 'fuel\\s*(sales|revenue|income)|gas\\s*sales|diesel', categoryName: 'Fuel Sales', priority: 10 },
  { pattern: 'ship\\s*store|marine\\s*store|retail\\s*sales|merchandise', categoryName: 'Ship Store Sales', priority: 10 },
  { pattern: 'repair|service\\s*(income|revenue)|mechanic|engine', categoryName: 'Boat Repairs & Service', priority: 10 },
  { pattern: 'boat\\s*sales?|vessel\\s*sales?|broker\\s*commission', categoryName: 'Boat Sales & Commissions', priority: 10 },
  { pattern: 'electric\\s*(income|charge|fee)|power\\s*(fee|charge)|metered', categoryName: 'Electric & Water Income', priority: 10 },
  { pattern: 'launch|haul(\\s*out)?|lift|travel\\s*lift|crane', categoryName: 'Launch & Haul Fees', priority: 10 },
  { pattern: 'transient|guest\\s*dock|nightly|daily\\s*rate', categoryName: 'Transient Dockage', priority: 10 },
  { pattern: 'winter\\s*storage|seasonal\\s*storage|boat\\s*yard', categoryName: 'Winter Storage', priority: 10 },
  { pattern: 'fuel\\s*cost|cost\\s*(of\\s*)?fuel|gasoline\\s*cost|diesel\\s*cost', categoryName: 'Fuel Cost', priority: 10 },
  { pattern: 'ship\\s*store\\s*cost|merchandise\\s*cost|inventory\\s*cost', categoryName: 'Ship Store Cost', priority: 10 },
  { pattern: 'parts?\\s*(cost|expense)|materials?\\s*(cost|expense)', categoryName: 'Parts & Materials Cost', priority: 10 },
  { pattern: 'insurance\\s*(expense|premium)|liability\\s*insurance|property\\s*insurance', categoryName: 'Insurance', priority: 10 },
  { pattern: 'property\\s*tax|real\\s*estate\\s*tax', categoryName: 'Property Taxes', priority: 10 },
  { pattern: 'electric(ity)?\\s*(expense|utility|bill)', categoryName: 'Utilities (Electric)', priority: 10 },
  { pattern: 'water|sewer|wastewater', categoryName: 'Utilities (Water/Sewer)', priority: 10 },
  { pattern: 'gas\\s*(expense|utility)|propane|heating', categoryName: 'Utilities (Gas/Propane)', priority: 10 },
  { pattern: 'repair|maintenance|r&m|r\\s*&\\s*m', categoryName: 'Repairs & Maintenance', priority: 8 },
  { pattern: 'dock\\s*repair|pier\\s*maintenance|piling|float', categoryName: 'Dock & Pier Maintenance', priority: 10 },
  { pattern: 'ground\\s*lease|land\\s*lease|rent\\s*expense', categoryName: 'Ground Lease / Rent', priority: 10 },
  { pattern: 'marketing|advertising|promotion', categoryName: 'Marketing & Advertising', priority: 10 },
  { pattern: 'professional|legal|accounting|audit', categoryName: 'Professional Fees', priority: 10 },
  { pattern: 'office|administrative|supplies', categoryName: 'Office & Administrative', priority: 8 },
  { pattern: 'software|technology|computer|it\\s*expense', categoryName: 'Technology & Software', priority: 10 },
  { pattern: 'environmental|compliance|permit|epa', categoryName: 'Environmental Compliance', priority: 10 },
  { pattern: 'security|surveillance|guard', categoryName: 'Security', priority: 10 },
  { pattern: 'management\\s*fee|property\\s*management', categoryName: 'Management Fees', priority: 10 },
  { pattern: 'wage|salary|salaries|payroll', categoryName: 'Wages & Salaries', priority: 10 },
  { pattern: 'payroll\\s*tax|fica|social\\s*security|medicare', categoryName: 'Payroll Taxes', priority: 10 },
  { pattern: 'health\\s*insurance|medical\\s*insurance|health\\s*benefit', categoryName: 'Health Insurance', priority: 10 },
  { pattern: 'retirement|401k|pension|ira', categoryName: 'Retirement Benefits', priority: 10 },
  { pattern: 'workers?\\s*comp|wc\\s*insurance', categoryName: 'Workers Compensation', priority: 10 },
  { pattern: 'contract\\s*labor|contractor|subcontract', categoryName: 'Contract Labor', priority: 10 },
  { pattern: 'interest\\s*income|investment\\s*income', categoryName: 'Interest Income', priority: 10 },
  { pattern: 'late\\s*fee|penalty|finance\\s*charge', categoryName: 'Late Fees & Penalties', priority: 10 },
  { pattern: 'interest\\s*expense|loan\\s*interest|mortgage\\s*interest', categoryName: 'Interest Expense', priority: 10 },
  { pattern: 'depreciation', categoryName: 'Depreciation', priority: 10 },
  { pattern: 'amortization', categoryName: 'Amortization', priority: 10 },
  { pattern: 'capital\\s*expenditure|capex|capital\\s*improvement', categoryName: 'Capital Expenditures', priority: 10 },
];

class DocIntelService {
  async seedDefaultCategories(orgId: string): Promise<PnlCategory[]> {
    const existingCategories = await db
      .select()
      .from(pnlCategories)
      .where(and(
        eq(pnlCategories.orgId, orgId),
        eq(pnlCategories.isDefault, true)
      ));

    if (existingCategories.length > 0) {
      return existingCategories;
    }

    const createdCategories: PnlCategory[] = [];

    for (const parentDef of MARINA_DEFAULT_CATEGORIES) {
      const [parentCategory] = await db
        .insert(pnlCategories)
        .values({
          orgId,
          categoryType: parentDef.categoryType as any,
          name: parentDef.name,
          sortOrder: parentDef.sortOrder,
          isDefault: true,
          isActive: true,
        })
        .returning();

      createdCategories.push(parentCategory);

      for (const childDef of parentDef.children) {
        const [childCategory] = await db
          .insert(pnlCategories)
          .values({
            orgId,
            parentId: parentCategory.id,
            categoryType: parentDef.categoryType as any,
            name: childDef.name,
            sortOrder: childDef.sortOrder,
            isDefault: true,
            isActive: true,
          })
          .returning();

        createdCategories.push(childCategory);
      }
    }

    return createdCategories;
  }

  async seedDefaultPatterns(orgId: string): Promise<DocIntelCategoryMapping[]> {
    const categories = await this.getCategories(orgId);
    const categoryMap = new Map(categories.map(c => [c.name, c.id]));

    const existingMappings = await db
      .select()
      .from(docIntelCategoryMappings)
      .where(and(
        eq(docIntelCategoryMappings.orgId, orgId),
        sql`${docIntelCategoryMappings.projectId} IS NULL`
      ));

    if (existingMappings.length > 0) {
      return existingMappings;
    }

    const createdMappings: DocIntelCategoryMapping[] = [];

    for (const patternDef of MARINA_DEFAULT_PATTERNS) {
      const categoryId = categoryMap.get(patternDef.categoryName);
      if (!categoryId) continue;

      const [mapping] = await db
        .insert(docIntelCategoryMappings)
        .values({
          orgId,
          name: `${patternDef.categoryName} Pattern`,
          pattern: patternDef.pattern,
          categoryId,
          priority: patternDef.priority,
          confidenceThreshold: '0.85',
          isActive: true,
        })
        .returning();

      createdMappings.push(mapping);
    }

    return createdMappings;
  }

  async initializeOrganization(orgId: string): Promise<{ categories: PnlCategory[], patterns: DocIntelCategoryMapping[] }> {
    const categories = await this.seedDefaultCategories(orgId);
    const patterns = await this.seedDefaultPatterns(orgId);
    return { categories, patterns };
  }

  async getCategories(orgId: string, includeInactive = false): Promise<PnlCategory[]> {
    const conditions = [eq(pnlCategories.orgId, orgId)];
    if (!includeInactive) {
      conditions.push(eq(pnlCategories.isActive, true));
    }

    return db
      .select()
      .from(pnlCategories)
      .where(and(...conditions))
      .orderBy(asc(pnlCategories.sortOrder), asc(pnlCategories.name));
  }

  async getCategoriesHierarchical(orgId: string): Promise<(PnlCategory & { children: PnlCategory[] })[]> {
    const allCategories = await this.getCategories(orgId);
    const parentCategories = allCategories.filter(c => !c.parentId);
    
    return parentCategories.map(parent => ({
      ...parent,
      children: allCategories.filter(c => c.parentId === parent.id)
    }));
  }

  async createCategory(orgId: string, data: InsertPnlCategory): Promise<PnlCategory> {
    const [category] = await db
      .insert(pnlCategories)
      .values({ ...data, orgId })
      .returning();
    return category;
  }

  async updateCategory(orgId: string, id: string, data: Partial<InsertPnlCategory>): Promise<PnlCategory | null> {
    const [category] = await db
      .update(pnlCategories)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(pnlCategories.id, id), eq(pnlCategories.orgId, orgId)))
      .returning();
    return category || null;
  }

  async deleteCategory(orgId: string, id: string): Promise<boolean> {
    const result = await db
      .update(pnlCategories)
      .set({ isActive: false, updatedAt: new Date() })
      .where(and(eq(pnlCategories.id, id), eq(pnlCategories.orgId, orgId)));
    return true;
  }

  async computeFileHash(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('sha256');
      const stream = fs.createReadStream(filePath);
      stream.on('data', (data) => hash.update(data));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', reject);
    });
  }

  async findDuplicateByHash(orgId: string, hash: string, projectId?: string): Promise<DocIntelUpload | null> {
    const conditions = [
      eq(docIntelUploads.orgId, orgId),
      eq(docIntelUploads.hashSha256, hash)
    ];
    
    if (projectId) {
      conditions.push(eq(docIntelUploads.modelingProjectId, projectId));
    }

    const [existing] = await db
      .select()
      .from(docIntelUploads)
      .where(and(...conditions))
      .limit(1);
    
    return existing || null;
  }

  async createUpload(orgId: string, data: InsertDocIntelUpload): Promise<DocIntelUpload> {
    const [upload] = await db
      .insert(docIntelUploads)
      .values({ ...data, orgId })
      .returning();
    return upload;
  }

  async createUploadWithDuplicateCheck(
    orgId: string, 
    data: InsertDocIntelUpload & { storagePath: string },
    checkProjectOnly: boolean = false
  ): Promise<{ upload: DocIntelUpload; isDuplicate: boolean; originalUpload?: DocIntelUpload }> {
    const hash = await this.computeFileHash(data.storagePath);
    const existingUpload = await this.findDuplicateByHash(
      orgId, 
      hash, 
      checkProjectOnly ? data.modelingProjectId : undefined
    );

    if (existingUpload) {
      const [upload] = await db
        .insert(docIntelUploads)
        .values({ 
          ...data, 
          orgId,
          hashSha256: hash,
          isDuplicate: true,
          duplicateOfId: existingUpload.id,
          holdingStatus: 'staging',
        })
        .returning();
      
      return { upload, isDuplicate: true, originalUpload: existingUpload };
    }

    const [upload] = await db
      .insert(docIntelUploads)
      .values({ ...data, orgId, hashSha256: hash })
      .returning();
    
    return { upload, isDuplicate: false };
  }

  async getUpload(orgId: string, uploadId: string): Promise<DocIntelUpload | null> {
    const [upload] = await db
      .select()
      .from(docIntelUploads)
      .where(and(
        eq(docIntelUploads.id, uploadId),
        eq(docIntelUploads.orgId, orgId)
      ));
    return upload || null;
  }

  async getProjectUploads(orgId: string, projectId: string): Promise<DocIntelUpload[]> {
    return db
      .select()
      .from(docIntelUploads)
      .where(and(
        eq(docIntelUploads.orgId, orgId),
        eq(docIntelUploads.modelingProjectId, projectId)
      ))
      .orderBy(desc(docIntelUploads.createdAt));
  }

  async updateUpload(orgId: string, uploadId: string, data: UpdateDocIntelUpload): Promise<DocIntelUpload | null> {
    const [upload] = await db
      .update(docIntelUploads)
      .set({ ...data, updatedAt: new Date() })
      .where(and(
        eq(docIntelUploads.id, uploadId),
        eq(docIntelUploads.orgId, orgId)
      ))
      .returning();
    return upload || null;
  }

  async deleteUpload(orgId: string, uploadId: string): Promise<boolean> {
    await db
      .delete(docIntelUploads)
      .where(and(
        eq(docIntelUploads.id, uploadId),
        eq(docIntelUploads.orgId, orgId)
      ));
    return true;
  }

  async parseExcelFile(filePath: string): Promise<ParsedLineItem[]> {
    const buffer = fs.readFileSync(filePath);
    const workbook = XLSX.read(buffer);
    const items: ParsedLineItem[] = [];
    let globalRow = 0;

    for (let sheetIndex = 0; sheetIndex < workbook.SheetNames.length; sheetIndex++) {
      const sheetName = workbook.SheetNames[sheetIndex];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' }) as any[][];

      if (jsonData.length === 0) continue;

      const monthHeaders = this.detectMonthHeaders(jsonData);
      const isMultiColumnPnl = monthHeaders.length >= 3;
      let headerRowIndex = -1;

      if (isMultiColumnPnl) {
        headerRowIndex = this.findHeaderRowIndex(jsonData, monthHeaders);
        console.log(`[DocIntelService] Detected multi-column P&L with ${monthHeaders.length} month columns, header at row ${headerRowIndex + 1}`);
      } else {
        // Log first few rows for debugging when month headers aren't detected
        console.log(`[DocIntelService] Single-column mode - no month headers found. First row samples:`);
        const firstRow = jsonData[0];
        if (firstRow) {
          console.log(`[DocIntelService] Row 1:`, firstRow.slice(0, 15).map((c: any) => `${typeof c === 'number' ? 'NUM:' : ''}${String(c).substring(0, 20)}`).join(' | '));
        }
      }

      for (let rowIndex = 0; rowIndex < jsonData.length; rowIndex++) {
        const row = jsonData[rowIndex];
        globalRow++;

        if (!row || row.length === 0) continue;

        if (isMultiColumnPnl && rowIndex === headerRowIndex) {
          console.log(`[DocIntelService] Skipping header row ${rowIndex + 1}`);
          continue;
        }

        if (isMultiColumnPnl) {
          const lineItemName = this.extractLineItemName(row);
          
          if (!lineItemName || this.isHeaderOrSubtotalRow(lineItemName)) {
            continue;
          }

          for (const header of monthHeaders) {
            const cellValue = row[header.columnIndex];
            const amount = this.extractCellAmount(cellValue);
            
            if (amount !== null && amount !== 0) {
              items.push({
                rawText: lineItemName,
                amount,
                sourcePage: sheetIndex + 1,
                sourceRow: globalRow,
                periodKey: header.periodKey,
                columnIndex: header.columnIndex,
              });
            }
          }
        } else {
          const textColumns: string[] = [];
          let amount: number | null = null;
          let dateValue: string | undefined;

          for (const cell of row) {
            if (cell === null || cell === undefined || cell === '') continue;

            if (typeof cell === 'number') {
              if (amount === null) {
                amount = cell;
              }
            } else if (typeof cell === 'string') {
              const trimmed = sanitizeText(cell);
              
              const numericValue = this.parseNumericString(trimmed);
              if (numericValue !== null && amount === null) {
                amount = numericValue;
              } else if (this.isDateString(trimmed)) {
                dateValue = trimmed;
              } else if (trimmed.length > 0 && !this.isNumericOnly(trimmed)) {
                textColumns.push(trimmed);
              }
            }
          }

          const rawText = sanitizeText(textColumns.join(' '));
          
          if (rawText.length > 2 || amount !== null) {
            const isZeroValueSubtotal = amount === null || amount === 0;
            items.push({
              rawText: rawText || '(no description)',
              amount,
              extractedDate: dateValue,
              sourcePage: sheetIndex + 1,
              sourceRow: globalRow,
              isZeroValueSubtotal,
            });
          }
        }
      }
    }

    return items;
  }

  private detectMonthHeaders(jsonData: any[][]): MonthHeader[] {
    const headers: MonthHeader[] = [];
    
    // Scan entire document for month headers (up to first 100 rows to handle any header position)
    const maxRowsToScan = Math.min(100, jsonData.length);
    console.log(`[DocIntelService] Scanning ${maxRowsToScan} rows for month headers...`);
    
    for (let rowIdx = 0; rowIdx < maxRowsToScan; rowIdx++) {
      const row = jsonData[rowIdx];
      if (!row) continue;
      
      const rowHeaders: MonthHeader[] = [];
      let defaultYear = new Date().getFullYear();
      
      // Log first few rows for debugging
      if (rowIdx < 5) {
        const cellSamples = row.slice(0, 15).map((c: any, i: number) => `[${i}]=${c}`).join(', ');
        console.log(`[DocIntelService] Row ${rowIdx + 1} cells: ${cellSamples}`);
      }
      
      for (let colIdx = 0; colIdx < row.length; colIdx++) {
        const cell = row[colIdx];
        if (cell === null || cell === undefined || cell === '') continue;
        
        // Handle Excel date serial numbers (e.g., 45292 = Jan 1, 2024)
        if (typeof cell === 'number' && cell > 25569 && cell < 60000) {
          const excelDate = this.excelSerialToDate(cell);
          if (excelDate) {
            const month = excelDate.getMonth() + 1;
            const year = excelDate.getFullYear();
            const periodKey = `${year}-${String(month).padStart(2, '0')}`;
            rowHeaders.push({
              columnIndex: colIdx,
              month,
              year,
              periodKey,
              rawLabel: String(cell),
            });
            defaultYear = year;
            continue;
          }
        }
        
        const cellStr = String(cell).trim().toLowerCase();
        
        if (TOTAL_COLUMN_PATTERNS.test(cellStr)) {
          continue;
        }
        
        const monthHeader = this.parseMonthHeader(cellStr, colIdx, defaultYear);
        if (monthHeader) {
          rowHeaders.push(monthHeader);
          if (monthHeader.year !== defaultYear) {
            defaultYear = monthHeader.year;
          }
        }
      }
      
      // Accept if we found at least 3 consecutive month-like headers
      if (rowHeaders.length >= 3) {
        console.log(`[DocIntelService] Found ${rowHeaders.length} month headers in row ${rowIdx + 1}:`, 
          rowHeaders.map(h => `${h.periodKey} (col ${h.columnIndex})`).join(', '));
        return rowHeaders;
      }
    }
    
    console.log(`[DocIntelService] No month headers detected after scanning ${maxRowsToScan} rows`);
    return headers;
  }
  
  private excelSerialToDate(serial: number): Date | null {
    // Excel serial date: days since Dec 30, 1899
    // Subtract 25569 to convert to Unix timestamp (days since Jan 1, 1970)
    try {
      const unixTime = (serial - 25569) * 86400 * 1000;
      const date = new Date(unixTime);
      if (date.getFullYear() >= 2000 && date.getFullYear() <= 2100) {
        return date;
      }
      return null;
    } catch {
      return null;
    }
  }

  private parseMonthHeader(cellStr: string, colIdx: number, defaultYear: number): MonthHeader | null {
    // Patterns for month column headers (not full dates like MM/DD/YYYY)
    // Order matters - more specific patterns first
    const patterns = [
      // "Jan 24", "Feb 24" - abbreviated month with space and 2-digit year
      /^(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)\s+(\d{2})$/i,
      // "Jan-24", "Feb-24" - abbreviated month with hyphen and 2-digit year
      /^(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)-(\d{2})$/i,
      // "Jan '24", "Feb'24" - abbreviated month with quote and 2-digit year
      /^(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*[\s\-.,]*'(\d{2})$/i,
      // General pattern for abbreviated months with optional year
      /^(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*[\s\-'.,]*(\d{2}|\d{4})?$/i,
      // M/YY or M/YYYY (month/year only)
      /^(\d{1,2})[\/-](\d{2}|\d{4})$/,
      // Full month names with optional year
      /^(january|february|march|april|may|june|july|august|september|october|november|december)[\s\-'.,]*(\d{2}|\d{4})?$/i,
      // ISO format: 2025-01, 2025/01
      /^(\d{4})[\/-](\d{1,2})$/,
    ];
    
    for (let i = 0; i < patterns.length; i++) {
      const pattern = patterns[i];
      const match = cellStr.match(pattern);
      if (match) {
        let month: number | undefined;
        let year = defaultYear;
        
        // Handle ISO format (YYYY-MM) at index 6
        if (i === 6) {
          year = parseInt(match[1], 10);
          month = parseInt(match[2], 10);
          if (month < 1 || month > 12) continue;
        }
        // Handle M/YY or M/YYYY at index 4
        else if (i === 4) {
          month = parseInt(match[1], 10);
          if (month < 1 || month > 12) continue;
          const yearPart = match[2];
          year = parseInt(yearPart, 10);
          if (year < 100) {
            year += year > 50 ? 1900 : 2000;
          }
        }
        else {
          // Month name patterns (indices 0-3, 5)
          const monthPart = match[1].toLowerCase();
          month = MONTH_PATTERNS[monthPart];
          
          if (month === undefined) {
            const monthNum = parseInt(monthPart, 10);
            if (monthNum >= 1 && monthNum <= 12) {
              month = monthNum;
            }
          }
          
          if (month === undefined) continue;
          
          if (match[2]) {
            const yearPart = match[2].replace(/'/g, '');
            year = parseInt(yearPart, 10);
            if (year < 100) {
              year += year > 50 ? 1900 : 2000;
            }
          }
        }
        
        const periodKey = `${year}-${String(month).padStart(2, '0')}`;
        
        console.log(`[DocIntelService] Parsed month header "${cellStr}" -> ${periodKey} (pattern ${i})`);
        
        return {
          columnIndex: colIdx,
          month,
          year,
          periodKey,
          rawLabel: cellStr,
        };
      }
    }
    
    return null;
  }

  private findHeaderRowIndex(jsonData: any[][], monthHeaders: MonthHeader[]): number {
    if (monthHeaders.length === 0) return -1;
    
    const firstHeaderCol = monthHeaders[0].columnIndex;
    const firstHeaderLabel = monthHeaders[0].rawLabel.toLowerCase();
    
    // Scan up to 100 rows to find the header row that matches our detected headers
    for (let rowIdx = 0; rowIdx < Math.min(100, jsonData.length); rowIdx++) {
      const row = jsonData[rowIdx];
      if (!row || !row[firstHeaderCol]) continue;
      
      const cellStr = String(row[firstHeaderCol]).trim().toLowerCase();
      // Match either by parseMonthHeader or by raw label comparison
      if (this.parseMonthHeader(cellStr, firstHeaderCol, 2000) || cellStr === firstHeaderLabel) {
        console.log(`[DocIntelService] Header row found at index ${rowIdx}`);
        return rowIdx;
      }
    }
    
    return 0;
  }

  private extractLineItemName(row: any[]): string {
    for (let i = 0; i < Math.min(6, row.length); i++) {
      const cell = row[i];
      if (cell === null || cell === undefined || cell === '') continue;
      
      if (typeof cell === 'string') {
        const trimmed = sanitizeText(cell);
        if (trimmed.length > 1 && !this.isNumericOnly(trimmed)) {
          return trimmed;
        }
      }
    }
    return '';
  }

  private extractCellAmount(cell: any): number | null {
    if (cell === null || cell === undefined || cell === '') return null;
    
    if (typeof cell === 'number') {
      return cell;
    }
    
    if (typeof cell === 'string') {
      return this.parseNumericString(cell);
    }
    
    return null;
  }

  private isHeaderOrSubtotalRow(text: string): boolean {
    const lowerText = text.toLowerCase().trim();
    
    // Skip empty
    if (!lowerText || /^\s*$/.test(lowerText)) return true;
    
    // Skip rows that are clearly subtotals/totals (MUST filter these out)
    const subtotalPatterns = [
      /^total\s/i,                    // "Total Income", "Total COGS"
      /\stotal$/i,                    // "Gross Profit Total" 
      /^gross\s*profit/i,             // "Gross Profit"
      /^net\s*(ordinary\s*)?(income|profit|loss)/i,  // "Net Ordinary Income", "Net Income"
      /^operating\s*(income|expense|profit)/i,
      /^ebitda/i,
      /^ebit\b/i,
      /^noi\b/i,                      // Net Operating Income
      /^total\s*cogs/i,
      /^total\s*cost/i,
      /^cost\s*of\s*(goods\s*)?sold$/i,  // Just the header "Cost of Goods Sold"
      /^other\s*(income|expense)s?\s*(net)?$/i,
    ];
    
    if (subtotalPatterns.some(p => p.test(lowerText))) {
      return true;
    }
    
    // Skip section headers (single words that are category names)
    const sectionHeaders = [
      /^income$/i,
      /^expenses?$/i,
      /^revenue$/i,
      /^cogs$/i,
      /^ordinary\s*income\/expense/i,
    ];
    
    if (sectionHeaders.some(p => p.test(lowerText))) {
      return true;
    }
    
    return false;
  }

  private parseNumericString(str: string): number | null {
    const cleaned = str.replace(/[$,\s]/g, '').replace(/\(([0-9.]+)\)/, '-$1');
    const num = parseFloat(cleaned);
    return isNaN(num) ? null : num;
  }

  private isNumericOnly(str: string): boolean {
    return /^[\d,.$\-()%\s]+$/.test(str.trim());
  }

  private isDateString(str: string): boolean {
    const datePatterns = [
      /^\d{1,2}\/\d{1,2}\/\d{2,4}$/,
      /^\d{4}-\d{2}-\d{2}$/,
      /^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{1,2},?\s+\d{4}$/i,
      /^\d{1,2}\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{4}$/i,
    ];
    return datePatterns.some(p => p.test(str.trim()));
  }

  async parseAndExtract(orgId: string, uploadId: string): Promise<DocIntelExtractedItem[]> {
    const upload = await this.getUpload(orgId, uploadId);
    if (!upload) {
      throw new Error('Upload not found');
    }

    await this.updateUpload(orgId, uploadId, { status: 'processing' });

    try {
      let parsedItems: ParsedLineItem[] = [];
      let usedOcrFallback = false;
      
      const isPdf = upload.mimeType === 'application/pdf';
      
      if (isPdf) {
        console.log(`[DocIntelService] Processing PDF file: ${upload.originalName}`);
        const ocrResult = await extractDocument(upload.storagePath, upload.mimeType);
        usedOcrFallback = ocrResult.meta?.usedOcrFallback === true;
        
        if (usedOcrFallback) {
          console.log(`[DocIntelService] OCR fallback was used for ${upload.originalName}`);
        }
        
        parsedItems = this.parsePdfOcrResult(ocrResult);
      } else {
        parsedItems = await this.parseExcelFile(upload.storagePath);
      }
      
      const extractedItems: DocIntelExtractedItem[] = [];

      for (const item of parsedItems) {
        const cleanedRawText = sanitizeText(item.rawText);
        const cleanedDate = sanitizeText(item.extractedDate);
        
        if (!cleanedRawText && item.amount === null) {
          continue;
        }

        const isAutoExcluded = item.isZeroValueSubtotal === true;
          
        const [extracted] = await db
          .insert(docIntelExtractedItems)
          .values({
            orgId,
            uploadId,
            rawText: cleanedRawText || '(no description)',
            amount: item.amount?.toString() || null,
            extractedDate: cleanedDate || undefined,
            sourcePage: item.sourcePage,
            sourceRow: item.sourceRow,
            periodKey: item.periodKey || undefined,
            columnIndex: item.columnIndex ?? undefined,
            status: isAutoExcluded ? 'excluded' : 'pending',
            reviewNotes: isAutoExcluded ? 'Auto-excluded: subtotal row with no value' : undefined,
          })
          .returning();

        extractedItems.push(extracted);
      }

      // Auto-categorize items using alias bank
      console.log(`[DocIntelService] Auto-categorizing ${extractedItems.length} items...`);
      let categorizedCount = 0;
      for (const item of extractedItems) {
        if (item.status === 'excluded') continue;
        
        try {
          const match = await findAliasMatch(item.rawText || '');
          if (match && match.confidence >= 0.4) {
            const result = getMatchResult(match);
            await db
              .update(docIntelExtractedItems)
              .set({
                categoryTierSuggested: result.categoryTier,
                revenueCogsDeptSuggested: result.revenueCogsDept,
                expenseDeptSuggested: result.expenseDept,
                confidenceScore: match.confidence.toFixed(2),
                updatedAt: new Date(),
              })
              .where(eq(docIntelExtractedItems.id, item.id));
            categorizedCount++;
          }
        } catch (err) {
          console.error(`[DocIntelService] Error categorizing item ${item.id}:`, err);
        }
      }
      console.log(`[DocIntelService] Auto-categorized ${categorizedCount} of ${extractedItems.length} items`);

      const holdingNotes = usedOcrFallback 
        ? 'OCR was used because the PDF text was unreadable. Some line items may need manual review.'
        : undefined;

      await this.updateUpload(orgId, uploadId, { 
        status: 'parsed',
        holdingNotes 
      });
      
      return extractedItems;
    } catch (error) {
      await this.updateUpload(orgId, uploadId, { 
        status: 'error',
        errorMessage: error instanceof Error ? error.message : 'Unknown parsing error'
      });
      throw error;
    }
  }

  private parsePdfOcrResult(ocrResult: any): ParsedLineItem[] {
    const items: ParsedLineItem[] = [];
    let globalRow = 0;
    
    for (const page of ocrResult.pages || []) {
      const lines = (page.content || '').split('\n').filter((l: string) => l.trim());
      
      for (const line of lines) {
        globalRow++;
        const trimmed = line.trim();
        if (!trimmed || trimmed.length < 3) continue;
        
        const { text, amount } = this.extractAmountFromLine(trimmed);
        
        if (text || amount !== null) {
          items.push({
            rawText: text || '(no description)',
            amount,
            sourcePage: page.pageNumber,
            sourceRow: globalRow,
          });
        }
      }
    }
    
    return items;
  }

  private extractAmountFromLine(line: string): { text: string; amount: number | null } {
    const negativePattern = /\(\$?\s*([\d,]+\.?\d*)\)\s*$/;
    const negativeMatch = line.match(negativePattern);
    if (negativeMatch) {
      const numStr = negativeMatch[1].replace(/,/g, '');
      const parsed = parseFloat(numStr);
      if (!isNaN(parsed)) {
        return {
          text: line.replace(negativeMatch[0], '').trim(),
          amount: -parsed
        };
      }
    }
    
    const positivePattern = /\$?\s*([\d,]+\.?\d{2})\s*$/;
    const positiveMatch = line.match(positivePattern);
    if (positiveMatch) {
      const numStr = positiveMatch[1].replace(/,/g, '');
      const parsed = parseFloat(numStr);
      if (!isNaN(parsed)) {
        return {
          text: line.replace(positiveMatch[0], '').trim(),
          amount: parsed
        };
      }
    }
    
    return { text: line, amount: null };
  }

  async categorizeItems(orgId: string, uploadId: string): Promise<DocIntelExtractedItem[]> {
    const items = await db
      .select()
      .from(docIntelExtractedItems)
      .where(and(
        eq(docIntelExtractedItems.orgId, orgId),
        eq(docIntelExtractedItems.uploadId, uploadId)
      ));

    const mappings = await db
      .select()
      .from(docIntelCategoryMappings)
      .where(and(
        eq(docIntelCategoryMappings.orgId, orgId),
        eq(docIntelCategoryMappings.isActive, true)
      ))
      .orderBy(desc(docIntelCategoryMappings.priority));

    const learningRules = await db
      .select()
      .from(docIntelLearningRules)
      .where(and(
        eq(docIntelLearningRules.orgId, orgId),
        eq(docIntelLearningRules.isActive, true)
      ))
      .orderBy(desc(docIntelLearningRules.confidenceScore));

    // Separate exclusion rules from categorization rules
    const exclusionRules = learningRules.filter(r => r.ruleType === 'learned_exclusion');
    const categorizationRules = learningRules.filter(r => r.ruleType !== 'learned_exclusion');

    const categorizedItems: DocIntelExtractedItem[] = [];

    for (const item of items) {
      const amountNum = parseFloat(item.amount || '0');
      const itemHasValue = !isNaN(amountNum) && amountNum !== 0;
      
      // Check exclusion rules with has_value context
      const exclusionMatch = this.findExclusionMatch(item.rawText, itemHasValue, exclusionRules);
      if (exclusionMatch) {
        const [updated] = await db
          .update(docIntelExtractedItems)
          .set({
            status: 'excluded',
            reviewNotes: `Auto-excluded: ${exclusionMatch.reason}`,
            confidenceScore: exclusionMatch.confidence.toString(),
            updatedAt: new Date(),
          })
          .where(eq(docIntelExtractedItems.id, item.id))
          .returning();
        
        categorizedItems.push(updated);
        continue;
      }
      
      const match = this.findBestMatch(item.rawText, mappings, categorizationRules);
      
      if (match) {
        const updateData: Record<string, any> = {
          categorySuggested: match.categoryId,
          confidenceScore: match.confidenceScore.toString(),
          matchedRuleId: match.matchedRuleId,
          updatedAt: new Date(),
        };

        // Apply tier/department suggestions from learning rules
        if (match.categoryTier) {
          updateData.categoryTierSuggested = match.categoryTier;
        }
        if (match.revenueCogsDept) {
          updateData.revenueCogsDeptSuggested = match.revenueCogsDept;
        }
        if (match.expenseDept) {
          updateData.expenseDeptSuggested = match.expenseDept;
        }

        const [updated] = await db
          .update(docIntelExtractedItems)
          .set(updateData)
          .where(eq(docIntelExtractedItems.id, item.id))
          .returning();
        
        categorizedItems.push(updated);
      } else {
        categorizedItems.push(item);
      }
    }

    return categorizedItems;
  }

  private findExclusionMatch(
    text: string,
    itemHasValue: boolean,
    exclusionRules: DocIntelLearningRule[]
  ): { confidence: number; reason: string } | null {
    const lowerText = text.toLowerCase().trim();
    
    for (const rule of exclusionRules) {
      const ruleData = rule.ruleJson as any;
      if (!ruleData) continue;
      
      // Exact match check with has_value context
      if (ruleData.exactMatch && lowerText === ruleData.exactMatch.toLowerCase()) {
        // If this item was excluded when it had NO value, only apply exclusion to items with NO value
        // If this item was excluded when it HAD value, apply to both (stronger signal)
        if (ruleData.hasValue === false && itemHasValue) {
          // Skip: this was a "no value = subtotal" exclusion, but current item has a value
          continue;
        }
        
        return {
          confidence: parseFloat(rule.confidenceScore || '0.85'),
          reason: ruleData.reason || 'Previously excluded by user',
        };
      }
    }
    
    return null;
  }

  private findBestMatch(
    text: string, 
    patterns: DocIntelCategoryMapping[],
    learningRules: DocIntelLearningRule[]
  ): CategoryMatch | null {
    let bestMatch: CategoryMatch | null = null;
    const lowerText = text.toLowerCase();

    for (const pattern of patterns) {
      try {
        const regex = new RegExp(pattern.pattern, 'i');
        if (regex.test(lowerText)) {
          const confidence = parseFloat(pattern.confidenceThreshold || '0.85');
          
          if (!bestMatch || confidence > bestMatch.confidenceScore) {
            bestMatch = {
              categoryId: pattern.categoryId,
              categoryName: pattern.name.replace(' Pattern', ''),
              confidenceScore: confidence,
              matchedRuleId: pattern.id,
              ruleType: 'pattern',
            };
          }
        }
      } catch (e) {
        continue;
      }
    }

    // Priority 1: Check for exact matches from learning rules (highest confidence)
    for (const rule of learningRules) {
      const ruleData = rule.ruleJson as any;
      if (!ruleData) continue;

      // Exact match check (user confirmed this exact line item before)
      if (ruleData.exactMatch && lowerText === ruleData.exactMatch.toLowerCase()) {
        return {
          categoryId: rule.categoryId || '',
          categoryName: rule.name,
          confidenceScore: 0.99, // Highest confidence for exact match
          matchedRuleId: rule.id,
          ruleType: 'learning',
          categoryTier: ruleData.categoryTier,
          revenueCogsDept: ruleData.revenueCogsDept,
          expenseDept: ruleData.expenseDept,
        };
      }
    }

    // Priority 2: Check keyword matches from learning rules
    for (const rule of learningRules) {
      const ruleData = rule.ruleJson as any;
      if (!ruleData || !ruleData.keywords) continue;

      const keywords = ruleData.keywords as string[];
      const matchCount = keywords.filter(k => lowerText.includes(k.toLowerCase())).length;
      
      if (matchCount > 0) {
        const keywordConfidence = (matchCount / keywords.length) * parseFloat(rule.confidenceScore || '0.5');
        
        if (!bestMatch || keywordConfidence > bestMatch.confidenceScore) {
          bestMatch = {
            categoryId: rule.categoryId || '',
            categoryName: rule.name,
            confidenceScore: keywordConfidence,
            matchedRuleId: rule.id,
            ruleType: 'learning',
            categoryTier: ruleData.categoryTier,
            revenueCogsDept: ruleData.revenueCogsDept,
            expenseDept: ruleData.expenseDept,
          };
        }
      }
    }

    return bestMatch;
  }

  async getExtractedItems(orgId: string, uploadId: string): Promise<DocIntelExtractedItem[]> {
    return db
      .select()
      .from(docIntelExtractedItems)
      .where(and(
        eq(docIntelExtractedItems.orgId, orgId),
        eq(docIntelExtractedItems.uploadId, uploadId)
      ))
      .orderBy(asc(docIntelExtractedItems.sourceRow));
  }

  async getExtractedItemsWithLearningRules(
    orgId: string,
    uploadId: string,
    marinaId?: string | null
  ): Promise<(DocIntelExtractedItem & {
    autoConfirmed?: boolean;
    confidence?: 'high' | 'medium' | 'low';
    ruleId?: string;
    learningRuleApplied?: boolean;
  })[]> {
    const items = await this.getExtractedItems(orgId, uploadId);
    
    const itemsForRules = items
      .filter(item => item.status === 'pending')
      .map(item => ({
        id: item.id,
        name: item.rawText,
        value: parseFloat(item.amount || '0') || undefined,
        status: item.status as 'pending' | 'confirmed' | 'rejected',
        category: item.categoryTierConfirmed || item.categoryTierSuggested || undefined,
        subcategory: item.expenseDeptConfirmed || item.revenueCogsDeptConfirmed || undefined,
        department: item.expenseDeptConfirmed || item.revenueCogsDeptConfirmed || undefined,
      }));

    const enhancedItems = await applyLearningRulesOnRetrieval({
      tenantId: orgId,
      marinaId: marinaId ?? null,
      lineItems: itemsForRules,
    });

    const enhancedMap = new Map(enhancedItems.map(e => [e.id, e]));

    return items.map(item => {
      const enhanced = enhancedMap.get(item.id);
      if (enhanced?.autoConfirmed) {
        return {
          ...item,
          status: 'confirmed' as const,
          categoryTierConfirmed: enhanced.category?.split(':')[0] as any || item.categoryTierConfirmed,
          autoConfirmed: enhanced.autoConfirmed,
          confidence: enhanced.confidence,
          ruleId: enhanced.ruleId,
          learningRuleApplied: enhanced.learningRuleApplied,
        };
      }
      return {
        ...item,
        autoConfirmed: false,
        learningRuleApplied: enhanced?.learningRuleApplied ?? false,
      };
    });
  }

  async getExtractedItemsWithCategories(orgId: string, uploadId: string): Promise<(DocIntelExtractedItem & { suggestedCategory?: PnlCategory; confirmedCategory?: PnlCategory })[]> {
    const items = await this.getExtractedItems(orgId, uploadId);
    const categories = await this.getCategories(orgId);
    const categoryMap = new Map(categories.map(c => [c.id, c]));

    return items.map(item => ({
      ...item,
      suggestedCategory: item.categorySuggested ? categoryMap.get(item.categorySuggested) : undefined,
      confirmedCategory: item.categoryConfirmed ? categoryMap.get(item.categoryConfirmed) : undefined,
    }));
  }

  async getExtractedItemsGrouped(orgId: string, uploadId: string): Promise<{
    lineItems: Array<{
      lineItemName: string;
      sourceRow: number;
      monthlyData: Array<{
        id: string;
        periodKey: string;
        amount: number | null;
        status: string;
        categoryConfirmed?: string | null;
        categorySuggested?: string | null;
        confidenceScore?: string | null;
      }>;
      totalAmount: number;
      status: 'pending' | 'confirmed' | 'excluded' | 'mixed';
      suggestedCategory?: PnlCategory;
      confirmedCategory?: PnlCategory;
    }>;
    periods: string[];
    isMultiColumn: boolean;
  }> {
    const items = await this.getExtractedItemsWithCategories(orgId, uploadId);
    
    const hasMultipleColumns = items.some(item => item.periodKey);
    
    if (!hasMultipleColumns) {
      return {
        lineItems: items.map(item => ({
          lineItemName: item.rawText,
          sourceRow: item.sourceRow,
          monthlyData: [{
            id: item.id,
            periodKey: item.periodKey || 'single',
            amount: item.amountConfirmed ? parseFloat(item.amountConfirmed) : (item.amount ? parseFloat(item.amount) : null),
            status: item.status,
            categoryConfirmed: item.categoryConfirmed,
            categorySuggested: item.categorySuggested,
            confidenceScore: item.confidenceScore,
          }],
          totalAmount: item.amountConfirmed ? parseFloat(item.amountConfirmed) : (item.amount ? parseFloat(item.amount) : 0),
          status: item.status as 'pending' | 'confirmed' | 'excluded',
          suggestedCategory: (item as any).suggestedCategory,
          confirmedCategory: (item as any).confirmedCategory,
        })),
        periods: ['single'],
        isMultiColumn: false,
      };
    }
    
    const periodSet = new Set<string>();
    const lineItemMap = new Map<string, {
      sourceRow: number;
      items: typeof items;
    }>();
    
    for (const item of items) {
      if (item.periodKey) {
        periodSet.add(item.periodKey);
      }
      
      const key = `${item.rawText}__${item.sourceRow}`;
      if (!lineItemMap.has(key)) {
        lineItemMap.set(key, { sourceRow: item.sourceRow, items: [] });
      }
      lineItemMap.get(key)!.items.push(item);
    }
    
    const periods = Array.from(periodSet).sort();
    
    const lineItems = Array.from(lineItemMap.entries()).map(([key, data]) => {
      const lineItemName = key.split('__')[0];
      const monthlyData = data.items.map(item => ({
        id: item.id,
        periodKey: item.periodKey || 'unknown',
        amount: item.amountConfirmed ? parseFloat(item.amountConfirmed) : (item.amount ? parseFloat(item.amount) : null),
        status: item.status,
        categoryConfirmed: item.categoryConfirmed,
        categorySuggested: item.categorySuggested,
        confidenceScore: item.confidenceScore,
      }));
      
      const totalAmount = monthlyData.reduce((sum, m) => sum + (m.amount || 0), 0);
      
      const statuses = new Set(monthlyData.map(m => m.status));
      let status: 'pending' | 'confirmed' | 'excluded' | 'mixed';
      if (statuses.size === 1) {
        status = monthlyData[0].status as 'pending' | 'confirmed' | 'excluded';
      } else {
        status = 'mixed';
      }
      
      const firstItem = data.items[0];
      
      return {
        lineItemName,
        sourceRow: data.sourceRow,
        monthlyData,
        totalAmount,
        status,
        suggestedCategory: (firstItem as any).suggestedCategory,
        confirmedCategory: (firstItem as any).confirmedCategory,
      };
    });
    
    lineItems.sort((a, b) => a.sourceRow - b.sourceRow);
    
    return {
      lineItems,
      periods,
      isMultiColumn: true,
    };
  }

  async confirmItem(
    orgId: string, 
    itemId: string, 
    categoryId: string, 
    userId: string,
    amount?: number,
    department?: string
  ): Promise<DocIntelExtractedItem> {
    const updateData: Record<string, any> = {
      status: 'confirmed',
      categoryConfirmed: categoryId,
      amountConfirmed: amount?.toString(),
      confirmedBy: userId,
      confirmedAt: new Date(),
      updatedAt: new Date(),
    };

    if (department) {
      updateData.departmentConfirmed = department;
    }

    const [item] = await db
      .update(docIntelExtractedItems)
      .set(updateData)
      .where(and(
        eq(docIntelExtractedItems.id, itemId),
        eq(docIntelExtractedItems.orgId, orgId)
      ))
      .returning();

    if (item) {
      await db.insert(docIntelTrainingExamples).values({
        orgId,
        extractedItemId: item.id,
        textSnippet: item.rawText,
        labelCategoryId: categoryId,
        labelTable: 'pnl_lines',
        createdBy: userId,
      });
    }

    return item;
  }

  async rejectItem(orgId: string, itemId: string): Promise<DocIntelExtractedItem> {
    const [item] = await db
      .update(docIntelExtractedItems)
      .set({
        status: 'rejected',
        updatedAt: new Date(),
      })
      .where(and(
        eq(docIntelExtractedItems.id, itemId),
        eq(docIntelExtractedItems.orgId, orgId)
      ))
      .returning();
    return item;
  }

  async excludeItem(orgId: string, itemId: string): Promise<DocIntelExtractedItem> {
    const [item] = await db
      .update(docIntelExtractedItems)
      .set({
        status: 'excluded',
        updatedAt: new Date(),
      })
      .where(and(
        eq(docIntelExtractedItems.id, itemId),
        eq(docIntelExtractedItems.orgId, orgId)
      ))
      .returning();
    return item;
  }

  async approveDocument(orgId: string, uploadId: string, userId: string, notes?: string): Promise<DocIntelUpload> {
    const updateData: Record<string, any> = {
      status: 'approved',
      approvedAt: new Date(),
      approvedBy: userId,
      updatedAt: new Date(),
    };

    if (notes) {
      updateData.approvalNotes = notes;
    }

    const [upload] = await db
      .update(docIntelUploads)
      .set(updateData)
      .where(and(
        eq(docIntelUploads.id, uploadId),
        eq(docIntelUploads.orgId, orgId)
      ))
      .returning();

    return upload;
  }

  async confirmAllHighConfidence(orgId: string, uploadId: string, userId: string, threshold = 0.9): Promise<number> {
    const items = await this.getExtractedItems(orgId, uploadId);
    let confirmedCount = 0;

    for (const item of items) {
      // Check if item has high confidence AND has tier/dept suggestions
      const hasConfidence = item.confidenceScore && parseFloat(item.confidenceScore) >= threshold;
      const hasTierSuggestion = item.categoryTierSuggested;
      const hasDeptSuggestion = item.revenueCogsDeptSuggested || item.expenseDeptSuggested;
      
      if (item.status === 'pending' && hasConfidence && hasTierSuggestion) {
        // Auto-confirm by copying suggested values to confirmed
        await db
          .update(docIntelExtractedItems)
          .set({
            status: 'confirmed',
            categoryTierConfirmed: item.categoryTierSuggested,
            revenueCogsDeptConfirmed: item.revenueCogsDeptSuggested,
            expenseDeptConfirmed: item.expenseDeptSuggested,
            amountConfirmed: item.amount,
            confirmedBy: userId,
            confirmedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(docIntelExtractedItems.id, item.id));
        
        confirmedCount++;
      }
    }

    return confirmedCount;
  }

  async importConfirmedItems(orgId: string, uploadId: string, projectId: string, userId: string, fiscalYear?: number): Promise<ModelingActuals[]> {
    const items = await db
      .select()
      .from(docIntelExtractedItems)
      .where(and(
        eq(docIntelExtractedItems.orgId, orgId),
        eq(docIntelExtractedItems.uploadId, uploadId),
        eq(docIntelExtractedItems.status, 'confirmed')
      ));

    // Fetch all categories for lookups
    const allCategories = await this.getCategories(orgId);
    const categoryMap = new Map(allCategories.map(c => [c.id, c]));

    const importedActuals: ModelingActuals[] = [];

    for (const item of items) {
      if (!item.categoryConfirmed) continue;

      // Look up category details
      const category = categoryMap.get(item.categoryConfirmed);
      if (!category) continue;

      // Determine the P&L tier (Revenue, COGS, Expenses) from category tier
      const tierMapping: Record<string, string> = {
        'revenue': 'Revenue',
        'cogs': 'COGS',
        'cost_of_goods_sold': 'COGS',
        'expenses': 'Expenses',
        'expense': 'Expenses',
        'operating_expenses': 'Expenses'
      };
      const plCategory = tierMapping[category.tier?.toLowerCase() || ''] || 'Expenses';

      // Parse periodKey (YYYY-MM) or use fiscalYear
      let year = fiscalYear || new Date().getFullYear();
      let month = 1;
      
      if (item.periodKey) {
        const parts = item.periodKey.split('-');
        if (parts.length >= 2) {
          year = parseInt(parts[0]) || year;
          month = parseInt(parts[1]) || 1;
        }
      } else if (item.extractedDate) {
        const dateMatch = item.extractedDate.match(/(\d{4})-(\d{2})/);
        if (dateMatch) {
          year = parseInt(dateMatch[1]);
          month = parseInt(dateMatch[2]);
        }
      }

      const amount = parseFloat(item.amountConfirmed || item.amount || '0');

      // Insert into modelingActuals
      const [actualRecord] = await db
        .insert(modelingActuals)
        .values({
          orgId,
          modelingProjectId: projectId,
          year,
          month,
          category: plCategory,
          subcategory: category.name || 'Uncategorized',
          lineItemDescription: item.rawText,
          amount: String(amount),
          dataSource: 'doc_intel',
          sourceRecordId: item.id,
          sourceRecordType: 'doc_intel_extracted_item',
          createdBy: userId,
        })
        .onConflictDoUpdate({
          target: [
            modelingActuals.modelingProjectId,
            modelingActuals.year,
            modelingActuals.month,
            modelingActuals.category,
            modelingActuals.subcategory,
            modelingActuals.lineItemDescription
          ],
          set: {
            amount: String(amount),
            updatedAt: new Date(),
          }
        })
        .returning();

      // Update extracted item with target reference
      await db
        .update(docIntelExtractedItems)
        .set({
          targetTable: 'modeling_actuals',
          targetRecordId: actualRecord.id,
          updatedAt: new Date(),
        })
        .where(eq(docIntelExtractedItems.id, item.id));

      importedActuals.push(actualRecord);
    }

    await this.updateUpload(orgId, uploadId, {
      status: 'completed',
      reviewCompletedAt: new Date(),
    });

    return importedActuals;
  }

  async reprocessUpload(orgId: string, uploadId: string): Promise<{ success: boolean; message: string }> {
    // Reset upload status back to reviewing
    await db.update(docIntelUploads)
      .set({ 
        status: 'reviewing',
        reviewCompletedAt: null,
        reviewNotes: null,
      })
      .where(and(
        eq(docIntelUploads.id, uploadId),
        eq(docIntelUploads.orgId, orgId)
      ));
    
    // Reset all extracted items back to pending (keep their suggested categories)
    await db.update(docIntelExtractedItems)
      .set({ 
        status: 'pending',
        confirmedBy: null,
        confirmedAt: null,
      })
      .where(and(
        eq(docIntelExtractedItems.uploadId, uploadId),
        eq(docIntelExtractedItems.orgId, orgId)
      ));
    
    return { success: true, message: 'Document reset for reprocessing' };
  }

  async getProjectPnlLines(orgId: string, projectId: string): Promise<(PnlLine & { category?: PnlCategory })[]> {
    const lines = await db
      .select()
      .from(pnlLines)
      .where(and(
        eq(pnlLines.orgId, orgId),
        eq(pnlLines.modelingProjectId, projectId)
      ))
      .orderBy(asc(pnlLines.fiscalYear), asc(pnlLines.fiscalMonth));

    const categories = await this.getCategories(orgId);
    const categoryMap = new Map(categories.map(c => [c.id, c]));

    return lines.map(line => ({
      ...line,
      category: line.categoryId ? categoryMap.get(line.categoryId) : undefined,
    }));
  }

  async getPnlSummaryByCategory(orgId: string, projectId: string): Promise<{ categoryId: string; amount: number }[]> {
    const lines = await db
      .select()
      .from(pnlLines)
      .where(and(
        eq(pnlLines.orgId, orgId),
        eq(pnlLines.modelingProjectId, projectId)
      ));

    const categoryTotals = new Map<string, number>();

    for (const line of lines) {
      if (!line.categoryId) continue;
      const existing = categoryTotals.get(line.categoryId) || 0;
      const amount = parseFloat(line.amount || '0');
      categoryTotals.set(line.categoryId, existing + amount);
    }

    return Array.from(categoryTotals.entries()).map(([categoryId, amount]) => ({
      categoryId,
      amount,
    }));
  }

  async createLearningRule(
    orgId: string, 
    name: string, 
    keywords: string[], 
    categoryId: string, 
    userId: string
  ): Promise<DocIntelLearningRule> {
    const [rule] = await db
      .insert(docIntelLearningRules)
      .values({
        orgId,
        name,
        ruleJson: { keywords },
        categoryId,
        targetTable: 'pnl_lines',
        confidenceScore: '0.7',
        createdBy: userId,
        isActive: true,
      })
      .returning();
    return rule;
  }

  async getCategoryMappings(orgId: string, projectId?: string): Promise<DocIntelCategoryMapping[]> {
    const conditions = [
      eq(docIntelCategoryMappings.orgId, orgId),
      eq(docIntelCategoryMappings.isActive, true),
    ];
    
    if (projectId) {
      conditions.push(
        sql`(${docIntelCategoryMappings.projectId} = ${projectId} OR ${docIntelCategoryMappings.projectId} IS NULL)`
      );
    }

    return db
      .select()
      .from(docIntelCategoryMappings)
      .where(and(...conditions))
      .orderBy(desc(docIntelCategoryMappings.priority));
  }

  async getUploadStats(orgId: string, uploadId: string): Promise<{
    total: number;
    pending: number;
    confirmed: number;
    rejected: number;
    needsReview: number;
    highConfidence: number;
    lowConfidence: number;
  }> {
    const items = await this.getExtractedItems(orgId, uploadId);
    
    return {
      total: items.length,
      pending: items.filter(i => i.status === 'pending').length,
      confirmed: items.filter(i => i.status === 'confirmed').length,
      rejected: items.filter(i => i.status === 'rejected').length,
      needsReview: items.filter(i => i.status === 'needs_review').length,
      highConfidence: items.filter(i => i.confidenceScore && parseFloat(i.confidenceScore) >= 0.9).length,
      lowConfidence: items.filter(i => !i.confidenceScore || parseFloat(i.confidenceScore) < 0.7).length,
    };
  }

  // ============================================================================
  // RENT ROLL MODULE SYNC
  // ============================================================================

  async parseRentRollFile(filePath: string): Promise<ParsedRentRollEntry[]> {
    const buffer = fs.readFileSync(filePath);
    const workbook = XLSX.read(buffer);
    const entries: ParsedRentRollEntry[] = [];

    for (const sheetName of workbook.SheetNames) {
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: '' }) as Record<string, any>[];
      
      const headerMapping = this.detectRentRollHeaders(jsonData);
      
      for (let rowIndex = 0; rowIndex < jsonData.length; rowIndex++) {
        const row = jsonData[rowIndex];
        const entry = this.extractRentRollEntry(row, headerMapping, rowIndex + 2);
        if (entry) {
          entries.push(entry);
        }
      }
    }

    return entries;
  }

  private detectRentRollHeaders(data: Record<string, any>[]): Record<string, string> {
    if (data.length === 0) return {};

    const firstRow = data[0];
    const headers = Object.keys(firstRow);
    const mapping: Record<string, string> = {};

    const patterns = {
      unitNumber: /slip|unit|space|dock|berth|rack|number|#|id/i,
      tenantName: /tenant|customer|name|owner|renter|lessee|client/i,
      monthlyRate: /rate|rent|fee|monthly|payment|cost|price|amount/i,
      status: /status|state|active|occupied|vacant/i,
      startDate: /start|begin|commence|lease\s*start|move.*in/i,
      endDate: /end|expire|expiry|lease\s*end|move.*out/i,
      boatName: /boat|vessel|yacht|craft|ship/i,
      boatLength: /length|size|loa|feet|ft/i,
      email: /email|e-mail|mail/i,
      phone: /phone|tel|mobile|cell|contact/i,
      make: /make|manufacturer|brand/i,
      model: /model/i,
    };

    for (const [field, pattern] of Object.entries(patterns)) {
      for (const header of headers) {
        if (pattern.test(header)) {
          mapping[field] = header;
          break;
        }
      }
    }

    return mapping;
  }

  private extractRentRollEntry(
    row: Record<string, any>, 
    headerMapping: Record<string, string>,
    sourceRow: number
  ): ParsedRentRollEntry | null {
    const getValue = (field: string): any => {
      const header = headerMapping[field];
      return header ? row[header] : undefined;
    };

    const unitNumber = sanitizeText(String(getValue('unitNumber') || ''));
    if (!unitNumber) return null;

    const rateValue = getValue('monthlyRate');
    const monthlyRate = typeof rateValue === 'number' 
      ? rateValue 
      : parseFloat(sanitizeText(String(rateValue)).replace(/[$,]/g, '')) || 0;

    const statusRaw = sanitizeText(String(getValue('status') || '')).toLowerCase();
    let status: ParsedRentRollEntry['status'] = 'active';
    if (statusRaw.includes('vacant') || statusRaw.includes('empty') || statusRaw.includes('available')) {
      status = 'vacant';
    } else if (statusRaw.includes('reserved') || statusRaw.includes('pending')) {
      status = 'reserved';
    }

    const entryType = this.inferEntryType(unitNumber, row);

    return {
      unitNumber,
      tenantName: sanitizeText(String(getValue('tenantName') || '')) || undefined,
      monthlyRate,
      entryType,
      status,
      startDate: this.parseDate(getValue('startDate')),
      endDate: this.parseDate(getValue('endDate')),
      sourceRow,
      boatInfo: {
        name: sanitizeText(String(getValue('boatName') || '')) || undefined,
        length: parseFloat(String(getValue('boatLength') || '')) || undefined,
        make: sanitizeText(String(getValue('make') || '')) || undefined,
        model: sanitizeText(String(getValue('model') || '')) || undefined,
      },
      contactInfo: {
        email: sanitizeText(String(getValue('email') || '')) || undefined,
        phone: sanitizeText(String(getValue('phone') || '')) || undefined,
      },
      rawData: row,
    };
  }

  private inferEntryType(unitNumber: string, row: Record<string, any>): ParsedRentRollEntry['entryType'] {
    const allValues = Object.values(row).join(' ').toLowerCase();
    
    if (/rack|dry\s*storage/i.test(allValues)) return 'dry_storage';
    if (/mooring/i.test(allValues)) return 'mooring';
    if (/slip|dock|berth|pier/i.test(allValues)) return 'wet_slip';
    
    if (/^[A-Z]?\d{1,3}[A-Z]?$/i.test(unitNumber)) return 'wet_slip';
    if (/^R?\d{1,4}$/i.test(unitNumber)) return 'dry_storage';
    
    return 'wet_slip';
  }

  private parseDate(value: any): string | undefined {
    if (!value) return undefined;
    
    if (typeof value === 'number') {
      const date = XLSX.SSF.parse_date_code(value);
      if (date) {
        return `${date.y}-${String(date.m).padStart(2, '0')}-${String(date.d).padStart(2, '0')}`;
      }
    }
    
    if (value instanceof Date) {
      return value.toISOString().split('T')[0];
    }
    
    const dateStr = String(value).trim();
    const parsed = new Date(dateStr);
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString().split('T')[0];
    }
    
    return undefined;
  }

  async importRentRollToModule(
    orgId: string,
    uploadId: string,
    options: {
      rentRollId?: string;
      rentRollName?: string;
      effectiveDate?: string;
      createCustomers?: boolean;
      linkToCrm?: boolean;
    }
  ): Promise<{
    rentRoll: RentRoll;
    entries: RentRollEntry[];
    customers: MarinaCustomer[];
    matchedContacts: { customerId: string; contactId: string }[];
    errors: { row: number; message: string }[];
  }> {
    const upload = await this.getUpload(orgId, uploadId);
    if (!upload) {
      throw new Error('Upload not found');
    }
    
    if (upload.docType !== 'rent_roll') {
      throw new Error('Document is not classified as a Rent Roll');
    }

    const parsedEntries = await this.parseRentRollFile(upload.storagePath);
    
    let rentRoll: RentRoll;
    if (options.rentRollId) {
      const [existing] = await db
        .select()
        .from(rentRolls)
        .where(and(
          eq(rentRolls.id, options.rentRollId),
          eq(rentRolls.orgId, orgId)
        ));
      if (!existing) {
        throw new Error('Rent Roll not found');
      }
      rentRoll = existing;
    } else {
      const [newRentRoll] = await db
        .insert(rentRolls)
        .values({
          orgId,
          name: options.rentRollName || `Import - ${upload.originalName}`,
          context: 'valuation',
          effectiveDate: options.effectiveDate || new Date().toISOString().split('T')[0],
        })
        .returning();
      rentRoll = newRentRoll;
    }

    const entries: RentRollEntry[] = [];
    const customers: MarinaCustomer[] = [];
    const matchedContacts: { customerId: string; contactId: string }[] = [];
    const errors: { row: number; message: string }[] = [];

    for (const parsed of parsedEntries) {
      try {
        let customerId: string | null = null;

        if (options.createCustomers && parsed.tenantName && parsed.status !== 'vacant') {
          const existingCustomer = await this.findOrCreateCustomer(
            orgId,
            parsed.tenantName,
            parsed.contactInfo,
            options.linkToCrm
          );
          
          if (existingCustomer) {
            customerId = existingCustomer.customer.id;
            customers.push(existingCustomer.customer);
            
            if (existingCustomer.matchedContactId) {
              matchedContacts.push({
                customerId: existingCustomer.customer.id,
                contactId: existingCustomer.matchedContactId,
              });
            }
          }
        }

        const [entry] = await db
          .insert(rentRollEntries)
          .values({
            orgId,
            rentRollId: rentRoll.id,
            unitNumber: parsed.unitNumber,
            tenantName: parsed.tenantName || null,
            customerId,
            monthlyRate: String(parsed.monthlyRate),
            entryType: parsed.entryType,
            status: parsed.status,
            startDate: parsed.startDate || null,
            endDate: parsed.endDate || null,
          })
          .returning();
        
        entries.push(entry);
      } catch (error) {
        errors.push({
          row: parsed.sourceRow,
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    await this.updateUpload(orgId, uploadId, {
      status: 'completed',
      holdingStatus: 'processed',
    });

    return { rentRoll, entries, customers, matchedContacts, errors };
  }

  private async findOrCreateCustomer(
    orgId: string,
    tenantName: string,
    contactInfo?: { email?: string; phone?: string },
    linkToCrm?: boolean
  ): Promise<{ customer: MarinaCustomer; matchedContactId?: string } | null> {
    if (!tenantName.trim()) return null;

    const nameParts = tenantName.trim().split(/\s+/);
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';

    let matchedContactId: string | undefined;
    
    if (linkToCrm && (contactInfo?.email || tenantName)) {
      const matchConditions = [];
      
      if (contactInfo?.email) {
        matchConditions.push(sql`LOWER(${crmContacts.email}) = LOWER(${contactInfo.email})`);
      }
      
      if (firstName && lastName) {
        matchConditions.push(sql`(
          LOWER(${crmContacts.firstName}) = LOWER(${firstName}) 
          AND LOWER(${crmContacts.lastName}) = LOWER(${lastName})
        )`);
      }

      if (matchConditions.length > 0) {
        const [contact] = await db
          .select()
          .from(crmContacts)
          .where(and(
            eq(crmContacts.orgId, orgId),
            sql`(${sql.join(matchConditions, sql` OR `)})`
          ))
          .limit(1);
        
        if (contact) {
          matchedContactId = contact.id;
        }
      }
    }

    const existingByEmail = contactInfo?.email ? await db
      .select()
      .from(marinaCustomers)
      .where(and(
        eq(marinaCustomers.orgId, orgId),
        sql`LOWER(${marinaCustomers.email}) = LOWER(${contactInfo.email})`
      ))
      .limit(1) : [];

    if (existingByEmail.length > 0) {
      return { 
        customer: existingByEmail[0], 
        matchedContactId 
      };
    }

    const existingByName = await db
      .select()
      .from(marinaCustomers)
      .where(and(
        eq(marinaCustomers.orgId, orgId),
        sql`LOWER(${marinaCustomers.firstName}) = LOWER(${firstName})`,
        sql`LOWER(${marinaCustomers.lastName}) = LOWER(${lastName})`
      ))
      .limit(1);

    if (existingByName.length > 0) {
      if (matchedContactId && !existingByName[0].contactId) {
        await db
          .update(marinaCustomers)
          .set({ contactId: matchedContactId, updatedAt: new Date() })
          .where(eq(marinaCustomers.id, existingByName[0].id));
      }
      return { 
        customer: existingByName[0], 
        matchedContactId 
      };
    }

    const count = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(marinaCustomers)
      .where(eq(marinaCustomers.orgId, orgId));
    
    const customerNumber = `C${String((count[0]?.count || 0) + 1).padStart(5, '0')}`;

    const [newCustomer] = await db
      .insert(marinaCustomers)
      .values({
        orgId,
        customerNumber,
        firstName,
        lastName,
        email: contactInfo?.email || null,
        phone: contactInfo?.phone || null,
        status: 'active',
        accountType: 'monthly',
        joinDate: new Date().toISOString().split('T')[0],
        contactId: matchedContactId || null,
      })
      .returning();

    return { 
      customer: newCustomer, 
      matchedContactId 
    };
  }

  async matchTenantsToCrmContacts(
    orgId: string,
    tenantNames: string[]
  ): Promise<{
    matched: { tenantName: string; contactId: string; contactName: string; confidence: number }[];
    unmatched: string[];
  }> {
    const contacts = await db
      .select()
      .from(crmContacts)
      .where(eq(crmContacts.orgId, orgId));

    const matched: { tenantName: string; contactId: string; contactName: string; confidence: number }[] = [];
    const unmatched: string[] = [];

    for (const tenantName of tenantNames) {
      if (!tenantName.trim()) {
        unmatched.push(tenantName);
        continue;
      }

      const normalizedTenant = tenantName.toLowerCase().trim();
      let bestMatch: { contact: typeof contacts[0]; confidence: number } | null = null;

      for (const contact of contacts) {
        const fullName = `${contact.firstName || ''} ${contact.lastName || ''}`.toLowerCase().trim();
        
        if (fullName === normalizedTenant) {
          bestMatch = { contact, confidence: 1.0 };
          break;
        }

        if (contact.email && normalizedTenant.includes(contact.email.toLowerCase())) {
          bestMatch = { contact, confidence: 0.95 };
          break;
        }

        const nameParts = normalizedTenant.split(/\s+/);
        const firstName = (contact.firstName || '').toLowerCase();
        const lastName = (contact.lastName || '').toLowerCase();
        
        if (nameParts.includes(firstName) && nameParts.includes(lastName)) {
          if (!bestMatch || bestMatch.confidence < 0.85) {
            bestMatch = { contact, confidence: 0.85 };
          }
        }

        if (lastName && normalizedTenant.includes(lastName) && lastName.length > 3) {
          if (!bestMatch || bestMatch.confidence < 0.6) {
            bestMatch = { contact, confidence: 0.6 };
          }
        }
      }

      if (bestMatch && bestMatch.confidence >= 0.6) {
        matched.push({
          tenantName,
          contactId: bestMatch.contact.id,
          contactName: `${bestMatch.contact.firstName || ''} ${bestMatch.contact.lastName || ''}`.trim(),
          confidence: bestMatch.confidence,
        });
      } else {
        unmatched.push(tenantName);
      }
    }

    return { matched, unmatched };
  }
  
  async updateExtractedItem(
    orgId: string,
    itemId: string,
    updates: Record<string, any>,
    userId: string
  ): Promise<DocIntelExtractedItem | null> {
    const [item] = await db
      .select()
      .from(docIntelExtractedItems)
      .where(and(
        eq(docIntelExtractedItems.id, itemId),
        eq(docIntelExtractedItems.orgId, orgId)
      ));
    
    if (!item) return null;
    
    const updateData: Record<string, any> = { updatedAt: new Date() };
    
    if (updates.rawText !== undefined) updateData.rawText = updates.rawText;
    if (updates.amountConfirmed !== undefined) updateData.amountConfirmed = updates.amountConfirmed;
    if (updates.status !== undefined) updateData.status = updates.status;
    if (updates.categoryTierConfirmed !== undefined) updateData.categoryTierConfirmed = updates.categoryTierConfirmed;
    if (updates.revenueCogsDeptConfirmed !== undefined) updateData.revenueCogsDeptConfirmed = updates.revenueCogsDeptConfirmed;
    if (updates.expenseDeptConfirmed !== undefined) updateData.expenseDeptConfirmed = updates.expenseDeptConfirmed;
    if (updates.reviewNotes !== undefined) updateData.reviewNotes = updates.reviewNotes;
    
    if (updates.status === 'confirmed') {
      updateData.confirmedBy = userId;
      updateData.confirmedAt = new Date();
    }
    
    const [updated] = await db
      .update(docIntelExtractedItems)
      .set(updateData)
      .where(eq(docIntelExtractedItems.id, itemId))
      .returning();
    
    // Create learning rule from user confirmation
    // Check both updates AND existing confirmed values on the item
    if (updates.status === 'confirmed') {
      const categoryTier = updates.categoryTierConfirmed || updated.categoryTierConfirmed;
      const revenueCogsDept = updates.revenueCogsDeptConfirmed || updated.revenueCogsDeptConfirmed;
      const expenseDept = updates.expenseDeptConfirmed || updated.expenseDeptConfirmed;
      
      if (categoryTier || revenueCogsDept || expenseDept) {
        await this.createLearningRuleFromConfirmation(orgId, item.rawText, {
          categoryTierConfirmed: categoryTier,
          revenueCogsDeptConfirmed: revenueCogsDept,
          expenseDeptConfirmed: expenseDept,
        }, userId);
      }
    }
    
    // Create learning rule from user exclusion (with has_value context)
    if (updates.status === 'excluded' && updates.reviewNotes) {
      const amountNum = parseFloat(item.amount || item.amountConfirmed || '0');
      const hasValue = !isNaN(amountNum) && amountNum !== 0;
      await this.createLearningRuleFromExclusion(orgId, item.rawText, updates.reviewNotes, hasValue, userId);
    }
    
    return updated;
  }
  
  async bulkUpdateExtractedItems(
    orgId: string,
    itemIds: string[],
    updates: Record<string, any>,
    userId: string
  ): Promise<DocIntelExtractedItem[]> {
    const results: DocIntelExtractedItem[] = [];
    
    for (const itemId of itemIds) {
      const updated = await this.updateExtractedItem(orgId, itemId, updates, userId);
      if (updated) results.push(updated);
    }
    
    return results;
  }
  
  async createLearningRuleFromConfirmation(
    orgId: string,
    rawText: string,
    updates: Record<string, any>,
    userId: string
  ): Promise<void> {
    try {
      const normalizedText = rawText.toLowerCase().trim();
      
      // Check if a similar rule already exists
      const existingRules = await db
        .select()
        .from(docIntelLearningRules)
        .where(and(
          eq(docIntelLearningRules.orgId, orgId),
          eq(docIntelLearningRules.isActive, true)
        ));
      
      const hasSimilar = existingRules.some(rule => {
        const ruleData = rule.ruleJson as any;
        if (ruleData?.exactMatch === normalizedText) return true;
        if (ruleData?.keywords?.some((k: string) => normalizedText.includes(k))) return true;
        return false;
      });
      
      if (hasSimilar) return;
      
      // Create new learning rule
      const ruleJson = {
        exactMatch: normalizedText,
        keywords: normalizedText.split(/\s+/).filter(w => w.length > 3),
        categoryTier: updates.categoryTierConfirmed,
        revenueCogsDept: updates.revenueCogsDeptConfirmed,
        expenseDept: updates.expenseDeptConfirmed,
        sourceText: rawText,
        learnedAt: new Date().toISOString(),
      };
      
      await db.insert(docIntelLearningRules).values({
        orgId,
        name: `Learned: ${rawText.substring(0, 50)}...`,
        ruleJson,
        ruleType: 'learned_confirmation',
        confidenceScore: '0.95',
        createdBy: userId,
        isActive: true,
      });
      
      // Also add to pnlLineItemAliases for matcher system
      const tier = updates.categoryTierConfirmed as 'revenue' | 'cogs' | 'expense' | undefined;
      const dept = tier === 'expense' 
        ? updates.expenseDeptConfirmed 
        : updates.revenueCogsDeptConfirmed;
      
      if (tier) {
        const coaCode = await buildCoaCode(tier, dept);
        const aliasResult = await learnAlias(rawText, coaCode, orgId);
        console.log(`[DocIntel Learning] Alias ${aliasResult.created ? 'created' : 'updated'}: "${rawText.substring(0, 30)}..." -> ${coaCode}`);
      }
      
      // Also add to normalized learning rules for auto-confirmation
      const categoryStr = tier 
        ? `${tier}${dept ? `:${dept}` : ''}` 
        : updates.categoryTierConfirmed || 'unknown';
      await onLineItemConfirmed({
        tenantId: orgId,
        marinaId: null,
        userId,
        lineItem: {
          id: '',
          name: rawText,
          category: categoryStr,
          subcategory: dept || null,
          department: dept || null,
        },
      });
      
      console.log(`[DocIntel Learning] Created rule from confirmation: "${rawText.substring(0, 30)}..."`);
    } catch (error) {
      console.error('[DocIntel Learning] Failed to create learning rule:', error);
    }
  }

  async createLearningRuleFromExclusion(
    orgId: string,
    rawText: string,
    reason: string,
    hasValue: boolean,
    userId: string
  ): Promise<void> {
    try {
      const normalizedText = rawText.toLowerCase().trim();
      
      // Check if a similar exclusion rule already exists
      const existingRules = await db
        .select()
        .from(docIntelLearningRules)
        .where(and(
          eq(docIntelLearningRules.orgId, orgId),
          eq(docIntelLearningRules.isActive, true),
          eq(docIntelLearningRules.ruleType, 'learned_exclusion')
        ));
      
      const hasSimilar = existingRules.some(rule => {
        const ruleData = rule.ruleJson as any;
        // Only consider it similar if both the text AND hasValue context match
        if (ruleData?.exactMatch === normalizedText && ruleData?.hasValue === hasValue) return true;
        return false;
      });
      
      if (hasSimilar) return;
      
      // Create new exclusion learning rule with has_value context
      const ruleJson = {
        exactMatch: normalizedText,
        keywords: normalizedText.split(/\s+/).filter(w => w.length > 3),
        action: 'exclude',
        hasValue,  // Context: true = this was excluded WITH a value, false = excluded because no value
        reason,
        sourceText: rawText,
        learnedAt: new Date().toISOString(),
      };
      
      await db.insert(docIntelLearningRules).values({
        orgId,
        name: `Exclusion: ${rawText.substring(0, 50)}${hasValue ? ' (with value)' : ' (no value)'}`,
        ruleJson,
        ruleType: 'learned_exclusion',
        confidenceScore: hasValue ? '0.80' : '0.95',  // Higher confidence for no-value exclusions
        createdBy: userId,
        isActive: true,
      });
      
      console.log(`[DocIntel Learning] Created exclusion rule: "${rawText.substring(0, 30)}..." hasValue=${hasValue}`);
    } catch (error) {
      console.error('[DocIntel Learning] Failed to create exclusion rule:', error);
    }
  }
}

export const docIntelService = new DocIntelService();
