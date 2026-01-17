import OpenAI from 'openai';
import { db } from '../db';
import { 
  documentIntelligenceJobs,
  documentIntelligenceResults,
  modelingActuals,
  modelingProjects,
  vdrDocuments
} from '@shared/schema';
import { eq, and, desc } from 'drizzle-orm';
import { documentParser, ParsedPage } from '../document-parser';
import fs from 'fs/promises';
import path from 'path';

// Use Replit AI Integrations if available (billed to Replit credits), otherwise fall back to user's OpenAI key
const openai = new OpenAI({ 
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL || undefined,
});

const ALLOWED_STORAGE_ROOTS = [
  '/home/runner/workspace/uploads',
  process.cwd() + '/uploads',
];

function isPathSafe(filePath: string): boolean {
  const normalizedPath = path.resolve(filePath);
  return ALLOWED_STORAGE_ROOTS.some(root => {
    const normalizedRoot = path.resolve(root);
    return normalizedPath.startsWith(normalizedRoot);
  });
}

export interface ExtractedLineItem {
  description: string;
  amount: number;
  category: 'Revenue' | 'COGS' | 'Expenses' | 'Other';
  subcategory: string;
  confidence: number;
  sourceText?: string;
  period?: { year: number; month?: number };
}

export interface PLExtractionResult {
  lineItems: ExtractedLineItem[];
  totals: {
    revenue: number;
    cogs: number;
    expenses: number;
    netIncome: number;
  };
  period: {
    startDate?: string;
    endDate?: string;
    periodType?: 'monthly' | 'quarterly' | 'annual';
  };
  metadata: {
    documentType: 'p&l' | 'income_statement' | 'unknown';
    companyName?: string;
    currency?: string;
  };
}

export interface RentRollUnit {
  unitIdentifier: string;
  unitType: 'wet_slip' | 'dry_storage' | 'rv_spot' | 'commercial' | 'residential' | 'other';
  size?: string;
  monthlyRent: number;
  annualRent?: number;
  tenantName?: string;
  leaseStart?: string;
  leaseEnd?: string;
  status: 'occupied' | 'vacant' | 'reserved' | 'unknown';
  confidence: number;
  sourceText?: string;
}

export interface RentRollExtractionResult {
  units: RentRollUnit[];
  summary: {
    totalUnits: number;
    occupiedUnits: number;
    vacantUnits: number;
    occupancyRate: number;
    totalMonthlyRent: number;
    totalAnnualRent: number;
  };
  metadata: {
    documentType: 'rent_roll' | 'unit_list' | 'unknown';
    propertyName?: string;
    asOfDate?: string;
  };
}

export type DocumentIntelligenceResult = {
  type: 'p&l';
  data: PLExtractionResult;
} | {
  type: 'rent_roll';
  data: RentRollExtractionResult;
};

class DocumentIntelligenceService {
  private marinaCategories = {
    Revenue: [
      'Wet Slips',
      'Dry Storage',
      'Fuel Sales',
      'Ship Store',
      'Service & Repair',
      'Third-Party Leases',
      'RV/Trailer Storage',
      'Boat Launch',
      'Transient/Visitor',
      'Amenities',
      'Other Revenue'
    ],
    COGS: [
      'Fuel Cost',
      'Ship Store Cost',
      'Parts & Inventory',
      'Other COGS'
    ],
    Expenses: [
      'Payroll & Benefits',
      'Utilities',
      'Insurance',
      'Repairs & Maintenance',
      'Dockage Supplies',
      'Marketing',
      'Professional Fees',
      'Property Taxes',
      'Management Fees',
      'Administrative',
      'Security',
      'Environmental',
      'Other Expenses'
    ]
  };

  async createJob(
    orgId: string,
    userId: string,
    modelingProjectId: string,
    documentPath: string,
    documentType: 'p&l' | 'rent_roll',
    fileName: string
  ): Promise<string> {
    const [project] = await db.select()
      .from(modelingProjects)
      .where(and(
        eq(modelingProjects.id, modelingProjectId),
        eq(modelingProjects.orgId, orgId)
      ))
      .limit(1);

    if (!project) {
      throw new Error('Project not found or access denied');
    }

    if (!isPathSafe(documentPath)) {
      throw new Error('Invalid document path');
    }

    try {
      await fs.access(documentPath);
    } catch {
      throw new Error('Document file not found');
    }

    const [job] = await db.insert(documentIntelligenceJobs).values({
      orgId,
      modelingProjectId,
      documentPath,
      documentType,
      fileName,
      status: 'pending',
      createdBy: userId
    }).returning();

    this.processJobAsync(job.id, orgId);
    
    return job.id;
  }

  async createJobFromVdrDocument(
    orgId: string,
    userId: string,
    modelingProjectId: string,
    vdrDocumentId: string,
    documentType: 'p&l' | 'rent_roll'
  ): Promise<string> {
    const [project] = await db.select()
      .from(modelingProjects)
      .where(and(
        eq(modelingProjects.id, modelingProjectId),
        eq(modelingProjects.orgId, orgId)
      ))
      .limit(1);

    if (!project) {
      throw new Error('Project not found or access denied');
    }

    const [vdrDoc] = await db.select()
      .from(vdrDocuments)
      .where(and(
        eq(vdrDocuments.id, vdrDocumentId),
        eq(vdrDocuments.orgId, orgId)
      ))
      .limit(1);

    if (!vdrDoc) {
      throw new Error('VDR document not found or access denied');
    }

    const documentPath = vdrDoc.storagePath;
    
    if (!isPathSafe(documentPath)) {
      throw new Error('Invalid document path');
    }

    const [job] = await db.insert(documentIntelligenceJobs).values({
      orgId,
      modelingProjectId,
      documentPath,
      documentType,
      fileName: vdrDoc.filename,
      status: 'pending',
      createdBy: userId
    }).returning();

    this.processJobAsync(job.id, orgId);
    
    return job.id;
  }

  private async processJobAsync(jobId: string, orgId: string): Promise<void> {
    try {
      await db.update(documentIntelligenceJobs)
        .set({ status: 'processing', startedAt: new Date() })
        .where(eq(documentIntelligenceJobs.id, jobId));

      const [job] = await db.select()
        .from(documentIntelligenceJobs)
        .where(eq(documentIntelligenceJobs.id, jobId))
        .limit(1);

      if (!job) throw new Error('Job not found');

      const fileBuffer = await fs.readFile(job.documentPath);
      const mimeType = job.documentPath.endsWith('.pdf') 
        ? 'application/pdf' 
        : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

      const mockDocument = {
        id: 'temp',
        mimeType,
        storagePath: job.documentPath,
        filename: job.fileName || 'document',
        size: fileBuffer.length,
        uploadedBy: job.createdBy,
        orgId,
        projectId: job.modelingProjectId || '',
        createdAt: new Date()
      };

      const pages = await documentParser.parseDocument(mockDocument as any);
      const documentText = pages.map(p => p.content).join('\n\n');

      let result: DocumentIntelligenceResult;
      if (job.documentType === 'p&l') {
        result = { 
          type: 'p&l', 
          data: await this.extractPLData(documentText) 
        };
      } else {
        result = { 
          type: 'rent_roll', 
          data: await this.extractRentRollData(documentText) 
        };
      }

      await db.insert(documentIntelligenceResults).values({
        jobId,
        orgId,
        resultType: job.documentType,
        extractedData: result.data,
        confidence: this.calculateOverallConfidence(result),
        reviewStatus: 'pending'
      });

      await db.update(documentIntelligenceJobs)
        .set({ 
          status: 'completed', 
          completedAt: new Date(),
          itemsExtracted: result.type === 'p&l' 
            ? result.data.lineItems.length 
            : result.data.units.length
        })
        .where(eq(documentIntelligenceJobs.id, jobId));

    } catch (error: any) {
      console.error('Document intelligence job failed:', error);
      await db.update(documentIntelligenceJobs)
        .set({ 
          status: 'failed', 
          completedAt: new Date(),
          errorMessage: error.message
        })
        .where(eq(documentIntelligenceJobs.id, jobId));
    }
  }

  private async extractPLData(documentText: string): Promise<PLExtractionResult> {
    const categoriesJson = JSON.stringify(this.marinaCategories, null, 2);
    
    const prompt = `Analyze this financial document (P&L or Income Statement) and extract all line items with amounts.

Categories to use for classification:
${categoriesJson}

Document text:
${documentText.slice(0, 15000)}

Respond with JSON only in this exact format:
{
  "lineItems": [
    {
      "description": "Line item description from document",
      "amount": 12345.67,
      "category": "Revenue" | "COGS" | "Expenses" | "Other",
      "subcategory": "Best matching subcategory from the list above",
      "confidence": 0.0 to 1.0,
      "sourceText": "Original text from document"
    }
  ],
  "totals": {
    "revenue": total revenue amount,
    "cogs": total cost of goods sold,
    "expenses": total operating expenses,
    "netIncome": calculated net income
  },
  "period": {
    "startDate": "YYYY-MM-DD" or null,
    "endDate": "YYYY-MM-DD" or null,
    "periodType": "monthly" | "quarterly" | "annual" or null
  },
  "metadata": {
    "documentType": "p&l" | "income_statement",
    "companyName": "extracted company name" or null,
    "currency": "USD" or detected currency
  }
}`;

    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'You are a financial document analyst specializing in marina and boat storage facilities. Extract and categorize financial data accurately. Always respond with valid JSON only.'
          },
          { role: 'user', content: prompt }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.1
      });

      const content = response.choices[0]?.message?.content;
      if (!content) throw new Error('No response from AI');

      return JSON.parse(content) as PLExtractionResult;
    } catch (error: any) {
      console.error('AI P&L extraction error:', error);
      return {
        lineItems: [],
        totals: { revenue: 0, cogs: 0, expenses: 0, netIncome: 0 },
        period: {},
        metadata: { documentType: 'unknown' }
      };
    }
  }

  private async extractRentRollData(documentText: string): Promise<RentRollExtractionResult> {
    const prompt = `Analyze this rent roll or unit listing document from a marina/boat storage facility.

Extract all units with their rental information. Marina unit types include:
- wet_slip: boat slips in water
- dry_storage: indoor or covered boat storage
- rv_spot: RV or trailer parking
- commercial: retail, restaurant, office spaces
- residential: apartments, condos
- other: any other rentable space

Document text:
${documentText.slice(0, 15000)}

Respond with JSON only in this exact format:
{
  "units": [
    {
      "unitIdentifier": "Unit ID or slip number",
      "unitType": "wet_slip" | "dry_storage" | "rv_spot" | "commercial" | "residential" | "other",
      "size": "Length x Width or square footage",
      "monthlyRent": 123.45,
      "annualRent": 1481.40,
      "tenantName": "Tenant name" or null,
      "leaseStart": "YYYY-MM-DD" or null,
      "leaseEnd": "YYYY-MM-DD" or null,
      "status": "occupied" | "vacant" | "reserved" | "unknown",
      "confidence": 0.0 to 1.0,
      "sourceText": "Original text from document"
    }
  ],
  "summary": {
    "totalUnits": number,
    "occupiedUnits": number,
    "vacantUnits": number,
    "occupancyRate": 0.0 to 1.0,
    "totalMonthlyRent": sum of all monthly rents,
    "totalAnnualRent": sum of all annual rents
  },
  "metadata": {
    "documentType": "rent_roll" | "unit_list",
    "propertyName": "Marina name" or null,
    "asOfDate": "YYYY-MM-DD" or null
  }
}`;

    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'You are a marina operations analyst specializing in rent rolls and unit management. Extract unit and rental data accurately. Always respond with valid JSON only.'
          },
          { role: 'user', content: prompt }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.1
      });

      const content = response.choices[0]?.message?.content;
      if (!content) throw new Error('No response from AI');

      return JSON.parse(content) as RentRollExtractionResult;
    } catch (error: any) {
      console.error('AI Rent Roll extraction error:', error);
      return {
        units: [],
        summary: {
          totalUnits: 0,
          occupiedUnits: 0,
          vacantUnits: 0,
          occupancyRate: 0,
          totalMonthlyRent: 0,
          totalAnnualRent: 0
        },
        metadata: { documentType: 'unknown' }
      };
    }
  }

  private calculateOverallConfidence(result: DocumentIntelligenceResult): number {
    if (result.type === 'p&l') {
      const items = result.data.lineItems;
      if (items.length === 0) return 0;
      return items.reduce((sum, item) => sum + (item.confidence || 0), 0) / items.length;
    } else {
      const units = result.data.units;
      if (units.length === 0) return 0;
      return units.reduce((sum, unit) => sum + (unit.confidence || 0), 0) / units.length;
    }
  }

  async getJob(jobId: string, orgId: string): Promise<any> {
    const [job] = await db.select()
      .from(documentIntelligenceJobs)
      .where(and(
        eq(documentIntelligenceJobs.id, jobId),
        eq(documentIntelligenceJobs.orgId, orgId)
      ))
      .limit(1);
    
    return job;
  }

  async getJobResult(jobId: string, orgId: string): Promise<any> {
    const [result] = await db.select()
      .from(documentIntelligenceResults)
      .where(and(
        eq(documentIntelligenceResults.jobId, jobId),
        eq(documentIntelligenceResults.orgId, orgId)
      ))
      .limit(1);
    
    return result;
  }

  async getProjectJobs(projectId: string, orgId: string): Promise<any[]> {
    const [project] = await db.select()
      .from(modelingProjects)
      .where(and(
        eq(modelingProjects.id, projectId),
        eq(modelingProjects.orgId, orgId)
      ))
      .limit(1);

    if (!project) {
      throw new Error('Project not found or access denied');
    }

    return db.select()
      .from(documentIntelligenceJobs)
      .where(and(
        eq(documentIntelligenceJobs.modelingProjectId, projectId),
        eq(documentIntelligenceJobs.orgId, orgId)
      ))
      .orderBy(desc(documentIntelligenceJobs.createdAt));
  }

  async approveResult(
    resultId: string, 
    orgId: string, 
    userId: string,
    modifications?: any
  ): Promise<void> {
    await db.update(documentIntelligenceResults)
      .set({
        reviewStatus: 'approved',
        reviewedBy: userId,
        reviewedAt: new Date(),
        modifications: modifications || null
      })
      .where(and(
        eq(documentIntelligenceResults.id, resultId),
        eq(documentIntelligenceResults.orgId, orgId)
      ));
  }

  async rejectResult(
    resultId: string,
    orgId: string,
    userId: string,
    reason: string
  ): Promise<void> {
    await db.update(documentIntelligenceResults)
      .set({
        reviewStatus: 'rejected',
        reviewedBy: userId,
        reviewedAt: new Date(),
        modifications: { rejectionReason: reason }
      })
      .where(and(
        eq(documentIntelligenceResults.id, resultId),
        eq(documentIntelligenceResults.orgId, orgId)
      ));
  }

  async getStructuredPLData(resultId: string, orgId: string): Promise<{
    categories: Array<{
      name: string;
      type: 'Revenue' | 'COGS' | 'Expenses' | 'Other';
      items: Array<{
        id: string;
        description: string;
        subcategory: string;
        amount: number;
        confidence: number;
        period?: { year: number; month?: number };
        sourceText?: string;
      }>;
      subtotal: number;
    }>;
    periods: Array<{ label: string; year: number; month?: number }>;
    totals: { revenue: number; cogs: number; expenses: number; netIncome: number };
    metadata: { documentType: string; companyName?: string; currency?: string };
  }> {
    const [result] = await db.select()
      .from(documentIntelligenceResults)
      .where(and(
        eq(documentIntelligenceResults.id, resultId),
        eq(documentIntelligenceResults.orgId, orgId)
      ))
      .limit(1);

    if (!result) throw new Error('Result not found');

    const extractedData = result.extractedData as any;
    if (!extractedData || result.resultType !== 'p&l') {
      throw new Error('Only P&L results are supported');
    }

    const plData = extractedData as PLExtractionResult;
    
    const categoryGroups: Record<string, typeof plData.lineItems> = {
      'Revenue': [],
      'COGS': [],
      'Expenses': [],
      'Other': []
    };
    
    plData.lineItems.forEach((item, index) => {
      const category = item.category || 'Other';
      if (!categoryGroups[category]) {
        categoryGroups[category] = [];
      }
      categoryGroups[category].push({ ...item, id: `item-${index}` } as any);
    });

    const categories = Object.entries(categoryGroups)
      .filter(([_, items]) => items.length > 0)
      .map(([name, items]) => ({
        name,
        type: name as 'Revenue' | 'COGS' | 'Expenses' | 'Other',
        items: items.map((item: any, idx: number) => ({
          id: item.id || `item-${idx}`,
          description: item.description,
          subcategory: item.subcategory,
          amount: item.amount,
          confidence: item.confidence,
          period: item.period,
          sourceText: item.sourceText
        })),
        subtotal: items.reduce((sum, item) => sum + (item.amount || 0), 0)
      }));

    const periods: Array<{ label: string; year: number; month?: number }> = [];
    if (plData.period?.periodType === 'annual') {
      const year = plData.period.startDate ? parseInt(plData.period.startDate.split('-')[0]) : new Date().getFullYear();
      periods.push({ label: `FY ${year}`, year });
    } else if (plData.period?.periodType === 'monthly' && plData.period.startDate) {
      const [year, month] = plData.period.startDate.split('-').map(Number);
      periods.push({ label: `${month}/${year}`, year, month });
    } else {
      periods.push({ label: 'Period 1', year: new Date().getFullYear() });
    }

    return {
      categories,
      periods,
      totals: plData.totals,
      metadata: plData.metadata
    };
  }

  async importToModelingActuals(
    resultId: string,
    orgId: string,
    userId: string,
    options: {
      year: number;
      month?: number;
      overwriteExisting?: boolean;
    }
  ): Promise<{ imported: number; skipped: number }> {
    const [result] = await db.select()
      .from(documentIntelligenceResults)
      .where(and(
        eq(documentIntelligenceResults.id, resultId),
        eq(documentIntelligenceResults.orgId, orgId)
      ))
      .limit(1);

    if (!result) throw new Error('Result not found');
    if (result.reviewStatus !== 'approved') {
      throw new Error('Result must be approved before importing');
    }

    const [job] = await db.select()
      .from(documentIntelligenceJobs)
      .where(eq(documentIntelligenceJobs.id, result.jobId))
      .limit(1);

    if (!job?.modelingProjectId) throw new Error('No project associated with this result');

    const extractedData = result.extractedData as any;
    if (!extractedData || extractedData.type !== 'p&l') {
      throw new Error('Only P&L results can be imported to modeling actuals');
    }

    const plData = extractedData.data as PLExtractionResult;
    let imported = 0;
    let skipped = 0;

    if (options.overwriteExisting) {
      await db.delete(modelingActuals)
        .where(and(
          eq(modelingActuals.modelingProjectId, job.modelingProjectId),
          eq(modelingActuals.year, options.year),
          eq(modelingActuals.month, options.month || 0),
          eq(modelingActuals.dataSource, 'document_intelligence')
        ));
    }

    for (const item of plData.lineItems) {
      try {
        await db.insert(modelingActuals).values({
          orgId,
          modelingProjectId: job.modelingProjectId,
          year: options.year,
          month: options.month || 0,
          category: item.category,
          subcategory: item.subcategory,
          description: item.description,
          amount: item.amount.toString(),
          dataSource: 'document_intelligence',
          sourceReference: resultId,
          confidence: Math.round(item.confidence * 100),
          isVerified: false,
          notes: `Extracted from ${job.fileName || 'document'}`
        });
        imported++;
      } catch (error) {
        console.error('Failed to import line item:', error);
        skipped++;
      }
    }

    return { imported, skipped };
  }

  /**
   * Public method for direct rent roll extraction from text
   * Used by the Rent Roll V2 module for PDF/document imports
   */
  async extractRentRollFromText(documentText: string): Promise<RentRollExtractionResult> {
    return this.extractRentRollData(documentText);
  }
}

export const documentIntelligenceService = new DocumentIntelligenceService();
