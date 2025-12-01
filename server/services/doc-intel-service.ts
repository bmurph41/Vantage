import { db } from '../db';
import { 
  pnlCategories, 
  docIntelUploads, 
  docIntelExtractedItems, 
  docIntelCategoryMappings,
  docIntelLearningRules,
  docIntelTrainingExamples,
  pnlLines,
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
  type InsertPnlLine
} from '@shared/schema';
import { eq, and, sql, desc, asc } from 'drizzle-orm';
import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as crypto from 'crypto';
import path from 'path';

interface ParsedLineItem {
  rawText: string;
  amount: number | null;
  extractedDate?: string;
  sourcePage?: number;
  sourceRow: number;
}

interface CategoryMatch {
  categoryId: string;
  categoryName: string;
  confidenceScore: number;
  matchedRuleId?: string;
  ruleType: 'pattern' | 'learning' | 'ai';
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
    const workbook = XLSX.readFile(filePath);
    const items: ParsedLineItem[] = [];
    let globalRow = 0;

    for (let sheetIndex = 0; sheetIndex < workbook.SheetNames.length; sheetIndex++) {
      const sheetName = workbook.SheetNames[sheetIndex];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' }) as any[][];

      for (let rowIndex = 0; rowIndex < jsonData.length; rowIndex++) {
        const row = jsonData[rowIndex];
        globalRow++;

        if (!row || row.length === 0) continue;

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
            const trimmed = cell.trim();
            
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

        const rawText = textColumns.join(' ').trim();
        
        if (rawText.length > 2 || amount !== null) {
          items.push({
            rawText: rawText || '(no description)',
            amount,
            extractedDate: dateValue,
            sourcePage: sheetIndex + 1,
            sourceRow: globalRow,
          });
        }
      }
    }

    return items;
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
      const parsedItems = await this.parseExcelFile(upload.storagePath);
      
      const extractedItems: DocIntelExtractedItem[] = [];

      for (const item of parsedItems) {
        const [extracted] = await db
          .insert(docIntelExtractedItems)
          .values({
            orgId,
            uploadId,
            rawText: item.rawText,
            amount: item.amount?.toString() || null,
            extractedDate: item.extractedDate,
            sourcePage: item.sourcePage,
            sourceRow: item.sourceRow,
            status: 'pending',
          })
          .returning();

        extractedItems.push(extracted);
      }

      await this.updateUpload(orgId, uploadId, { status: 'parsed' });
      
      return extractedItems;
    } catch (error) {
      await this.updateUpload(orgId, uploadId, { 
        status: 'error',
        errorMessage: error instanceof Error ? error.message : 'Unknown parsing error'
      });
      throw error;
    }
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

    const categorizedItems: DocIntelExtractedItem[] = [];

    for (const item of items) {
      const match = this.findBestMatch(item.rawText, mappings, learningRules);
      
      if (match) {
        const [updated] = await db
          .update(docIntelExtractedItems)
          .set({
            categorySuggested: match.categoryId,
            confidenceScore: match.confidenceScore.toString(),
            matchedRuleId: match.matchedRuleId,
            updatedAt: new Date(),
          })
          .where(eq(docIntelExtractedItems.id, item.id))
          .returning();
        
        categorizedItems.push(updated);
      } else {
        categorizedItems.push(item);
      }
    }

    return categorizedItems;
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

    for (const rule of learningRules) {
      const ruleData = rule.ruleJson as any;
      if (!ruleData || !ruleData.keywords) continue;

      const keywords = ruleData.keywords as string[];
      const matchCount = keywords.filter(k => lowerText.includes(k.toLowerCase())).length;
      
      if (matchCount > 0) {
        const keywordConfidence = (matchCount / keywords.length) * parseFloat(rule.confidenceScore || '0.5');
        
        if (!bestMatch || keywordConfidence > bestMatch.confidenceScore) {
          bestMatch = {
            categoryId: rule.categoryId,
            categoryName: rule.name,
            confidenceScore: keywordConfidence,
            matchedRuleId: rule.id,
            ruleType: 'learning',
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

  async confirmItem(
    orgId: string, 
    itemId: string, 
    categoryId: string, 
    userId: string,
    amount?: number
  ): Promise<DocIntelExtractedItem> {
    const [item] = await db
      .update(docIntelExtractedItems)
      .set({
        status: 'confirmed',
        categoryConfirmed: categoryId,
        amountConfirmed: amount?.toString(),
        confirmedBy: userId,
        confirmedAt: new Date(),
        updatedAt: new Date(),
      })
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

  async confirmAllHighConfidence(orgId: string, uploadId: string, userId: string, threshold = 0.9): Promise<number> {
    const items = await this.getExtractedItems(orgId, uploadId);
    let confirmedCount = 0;

    for (const item of items) {
      if (
        item.status === 'pending' && 
        item.categorySuggested && 
        item.confidenceScore && 
        parseFloat(item.confidenceScore) >= threshold
      ) {
        await this.confirmItem(
          orgId, 
          item.id, 
          item.categorySuggested, 
          userId,
          item.amount ? parseFloat(item.amount) : undefined
        );
        confirmedCount++;
      }
    }

    return confirmedCount;
  }

  async importConfirmedItems(orgId: string, uploadId: string, projectId: string, userId: string, fiscalYear?: number): Promise<PnlLine[]> {
    const items = await db
      .select()
      .from(docIntelExtractedItems)
      .where(and(
        eq(docIntelExtractedItems.orgId, orgId),
        eq(docIntelExtractedItems.uploadId, uploadId),
        eq(docIntelExtractedItems.status, 'confirmed')
      ));

    const importedLines: PnlLine[] = [];

    for (const item of items) {
      if (!item.categoryConfirmed) continue;

      const [pnlLine] = await db
        .insert(pnlLines)
        .values({
          orgId,
          modelingProjectId: projectId,
          categoryId: item.categoryConfirmed,
          lineDescription: item.rawText,
          amount: item.amountConfirmed || item.amount || '0',
          fiscalYear,
          sourceUploadId: uploadId,
          sourceItemId: item.id,
          isManualEntry: false,
          createdBy: userId,
        })
        .returning();

      await db
        .update(docIntelExtractedItems)
        .set({
          targetTable: 'pnl_lines',
          targetRecordId: pnlLine.id,
          updatedAt: new Date(),
        })
        .where(eq(docIntelExtractedItems.id, item.id));

      importedLines.push(pnlLine);
    }

    await this.updateUpload(orgId, uploadId, {
      status: 'completed',
      reviewCompletedAt: new Date(),
    });

    return importedLines;
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
}

export const docIntelService = new DocIntelService();
