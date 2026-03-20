import { db } from "../db";
import {
  crmDeals,
  crmProperties,
  crmContacts,
  modelingProjects,
  rentRolls,
  rentRollEntries,
  omTemplates,
  omDocuments,
  salesComps,
  rateComps,
  scProjects,
  scProjectComps,
  rcProjects,
  rcProjectComps,
  demographicsCache,
  insertOmDocumentSchema,
  type InsertOmDocument,
  type OmDocument
} from "@shared/schema";
import { eq, and, desc, sql, inArray } from "drizzle-orm";
import { pdfGeneratorService, type PDFTemplateType, type PDFGeneratorOptions } from "./pdf-generator-service";
import * as fs from 'fs';
import * as path from 'path';

export interface PropertyOverview {
  name: string;
  address: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  totalSlips: number | null;
  wetSlips: number | null;
  drySlips: number | null;
  askingPrice: number | null;
  yearBuilt: number | null;
  waterFrontage: number | null;
  acreage: number | null;
  amenities: string[];
  description: string | null;
}

export interface FinancialSummary {
  purchasePrice: number | null;
  noiEstimate: number | null;
  capRate: number | null;
  revenueProjections: {
    year1: number | null;
    year2: number | null;
    year3: number | null;
  };
  operatingExpenses: number | null;
  debtService: number | null;
  cashOnCash: number | null;
  irr: number | null;
}

export interface RentRollSummary {
  totalUnits: number;
  occupiedUnits: number;
  vacantUnits: number;
  occupancyRate: number;
  totalAnnualRevenue: number;
  avgRentPerSlip: number;
  byType: {
    type: string;
    count: number;
    avgRent: number;
    totalRent: number;
  }[];
}

export interface OperationsSummary {
  fuelSalesAnnual: number | null;
  shipStoreSalesAnnual: number | null;
  serviceRevenue: number | null;
  otherRevenue: number | null;
  seasonalFactors: string | null;
  staffCount: number | null;
  managementNotes: string | null;
}

export interface SalesCompSummary {
  compId: string;
  marina: string;
  salePrice: number | null;
  capRate: number | null;
  pricePerSlip: number | null;
  saleYear: number | null;
  city: string | null;
  state: string | null;
  wetSlips: number | null;
  dryRacks: number | null;
  bodyOfWater: string | null;
}

export interface RateCompSummary {
  compId: string;
  marina: string;
  rateAmount: number | null;
  rateType: string | null;
  wetSlips: number | null;
  dryRacks: number | null;
  seasonality: string | null;
  occupancyRate: number | null;
  city: string | null;
  state: string | null;
  bodyOfWater: string | null;
}

export interface MarketDemographics {
  state: string;
  population: number | null;
  medianIncome: number | null;
  unemploymentRate: number | null;
  populationGrowth: number | null;
  avgSalePrice: number | null;
  avgCapRate: number | null;
  avgPricePerSlip: number | null;
  transactionCount: number | null;
}

export interface CompAnalytics {
  salesComps: SalesCompSummary[];
  rateComps: RateCompSummary[];
  salesCompStats: {
    count: number;
    avgPrice: number | null;
    avgCapRate: number | null;
    avgPricePerSlip: number | null;
    priceRange: { min: number; max: number } | null;
  };
  rateCompStats: {
    count: number;
    avgRate: number | null;
    rateRange: { min: number; max: number } | null;
  };
}

export interface OMData {
  dealId: string;
  dealName: string;
  propertyOverview: PropertyOverview;
  financialSummary: FinancialSummary;
  rentRoll: RentRollSummary;
  operations: OperationsSummary;
  compAnalytics: CompAnalytics;
  demographics: MarketDemographics | null;
  generatedAt: Date;
}

export interface OMTemplate {
  id: string;
  name: string;
  scope: string;
  category: string | null;
  templateData: any;
}

class OMBuilderService {
  async getTemplates(orgId?: string): Promise<OMTemplate[]> {
    const templates = await db
      .select({
        id: omTemplates.id,
        name: omTemplates.name,
        scope: omTemplates.scope,
        category: omTemplates.category,
        templateData: omTemplates.templateData,
      })
      .from(omTemplates)
      .where(
        orgId 
          ? sql`${omTemplates.ownerType} = 'global' OR (${omTemplates.ownerType} = 'org' AND ${omTemplates.ownerId} = ${orgId})`
          : eq(omTemplates.ownerType, 'global')
      )
      .orderBy(omTemplates.name);
    
    return templates;
  }

  async aggregateOMData(dealId: string): Promise<OMData | null> {
    const [deal] = await db
      .select()
      .from(crmDeals)
      .where(eq(crmDeals.id, dealId))
      .limit(1);
    
    if (!deal) {
      return null;
    }

    let property: any = null;
    if (deal.propertyId) {
      const [prop] = await db
        .select()
        .from(crmProperties)
        .where(eq(crmProperties.id, deal.propertyId))
        .limit(1);
      property = prop;
    }

    let modelingData: any = null;
    if (deal.propertyId) {
      const [mp] = await db
        .select()
        .from(modelingProjects)
        .where(eq(modelingProjects.linkedPropertyId, deal.propertyId))
        .orderBy(desc(modelingProjects.createdAt))
        .limit(1);
      modelingData = mp;
    }

    let rentRollData: RentRollSummary = {
      totalUnits: 0,
      occupiedUnits: 0,
      vacantUnits: 0,
      occupancyRate: 0,
      totalAnnualRevenue: 0,
      avgRentPerSlip: 0,
      byType: [],
    };

    if (deal.propertyId) {
      const [rentRoll] = await db
        .select()
        .from(rentRolls)
        .where(eq(rentRolls.propertyId, deal.propertyId))
        .orderBy(desc(rentRolls.createdAt))
        .limit(1);

      if (rentRoll) {
        const entries = await db
          .select()
          .from(rentRollEntries)
          .where(eq(rentRollEntries.rentRollId, rentRoll.id));

        const occupiedEntries = entries.filter(e => e.occupancyStatus === 'occupied');
        const totalRent = entries.reduce((sum, e) => sum + (Number(e.currentRent) || 0), 0);
        
        const byTypeMap = new Map<string, { count: number; totalRent: number }>();
        entries.forEach(e => {
          const type = e.unitType || 'unknown';
          const current = byTypeMap.get(type) || { count: 0, totalRent: 0 };
          current.count++;
          current.totalRent += Number(e.currentRent) || 0;
          byTypeMap.set(type, current);
        });

        rentRollData = {
          totalUnits: entries.length,
          occupiedUnits: occupiedEntries.length,
          vacantUnits: entries.length - occupiedEntries.length,
          occupancyRate: entries.length > 0 
            ? Math.round((occupiedEntries.length / entries.length) * 100) 
            : 0,
          totalAnnualRevenue: totalRent * 12,
          avgRentPerSlip: entries.length > 0 ? totalRent / entries.length : 0,
          byType: Array.from(byTypeMap.entries()).map(([type, data]) => ({
            type,
            count: data.count,
            avgRent: data.count > 0 ? data.totalRent / data.count : 0,
            totalRent: data.totalRent,
          })),
        };
      }
    }

    const propertyOverview: PropertyOverview = {
      name: property?.name || deal.marinaName || deal.dealName || 'Untitled Property',
      address: property?.address || deal.city || null,
      city: property?.city || deal.city || null,
      state: property?.state || deal.state || null,
      zipCode: property?.zip || null,
      totalSlips: property?.totalSlips || null,
      wetSlips: property?.wetSlips || null,
      drySlips: property?.drySlips || null,
      askingPrice: property?.askingPrice ? Number(property.askingPrice) : null,
      yearBuilt: property?.yearBuilt || null,
      waterFrontage: property?.waterFrontage ? Number(property.waterFrontage) : null,
      acreage: property?.acreage ? Number(property.acreage) : null,
      amenities: property?.amenities || [],
      description: property?.description || null,
    };

    const financialSummary: FinancialSummary = {
      purchasePrice: modelingData?.purchasePrice ? Number(modelingData.purchasePrice) : (deal.value ? Number(deal.value) : null),
      noiEstimate: modelingData?.noi ? Number(modelingData.noi) : null,
      capRate: modelingData?.capRate ? Number(modelingData.capRate) : null,
      revenueProjections: {
        year1: modelingData?.year1Revenue ? Number(modelingData.year1Revenue) : null,
        year2: modelingData?.year2Revenue ? Number(modelingData.year2Revenue) : null,
        year3: modelingData?.year3Revenue ? Number(modelingData.year3Revenue) : null,
      },
      operatingExpenses: modelingData?.operatingExpenses ? Number(modelingData.operatingExpenses) : null,
      debtService: modelingData?.annualDebtService ? Number(modelingData.annualDebtService) : null,
      cashOnCash: modelingData?.cashOnCash ? Number(modelingData.cashOnCash) : null,
      irr: modelingData?.irr ? Number(modelingData.irr) : null,
    };

    const operations: OperationsSummary = {
      fuelSalesAnnual: null,
      shipStoreSalesAnnual: null,
      serviceRevenue: null,
      otherRevenue: null,
      seasonalFactors: null,
      staffCount: null,
      managementNotes: null,
    };

    // === Fetch Sales Comps linked to org projects ===
    let salesCompData: SalesCompSummary[] = [];
    let rateCompData: RateCompSummary[] = [];

    try {
      const allScProjects = await db
        .select({ id: scProjects.id })
        .from(scProjects)
        .where(eq(scProjects.orgId, deal.orgId));

      if (allScProjects.length > 0) {
        const scProjectIds = allScProjects.map(p => p.id);
        const linkedScComps = await db
          .select({
            compId: salesComps.id,
            marina: salesComps.marina,
            salePrice: salesComps.salePrice,
            capRate: salesComps.capRate,
            pricePerSlip: salesComps.pricePerSlip,
            saleYear: salesComps.saleYear,
            city: salesComps.city,
            state: salesComps.state,
            wetSlips: salesComps.wetSlips,
            dryRacks: salesComps.dryRacks,
            bodyOfWater: salesComps.bodyOfWater,
          })
          .from(scProjectComps)
          .innerJoin(salesComps, eq(scProjectComps.salesCompId, salesComps.id))
          .where(inArray(scProjectComps.scProjectId, scProjectIds))
          .limit(50);

        salesCompData = linkedScComps.map(c => ({
          compId: c.compId,
          marina: c.marina,
          salePrice: c.salePrice,
          capRate: c.capRate ? Number(c.capRate) / 100 : null,
          pricePerSlip: c.pricePerSlip,
          saleYear: c.saleYear,
          city: c.city,
          state: c.state,
          wetSlips: c.wetSlips,
          dryRacks: c.dryRacks,
          bodyOfWater: c.bodyOfWater,
        }));
      }

      // Rate Comps
      const allRcProjects = await db
        .select({ id: rcProjects.id })
        .from(rcProjects)
        .where(eq(rcProjects.orgId, deal.orgId));

      if (allRcProjects.length > 0) {
        const rcProjectIds = allRcProjects.map(p => p.id);
        const linkedRcComps = await db
          .select({
            compId: rateComps.id,
            marina: rateComps.marina,
            rateAmount: rateComps.rateAmount,
            rateType: rateComps.rateType,
            wetSlips: rateComps.wetSlips,
            dryRacks: rateComps.dryRacks,
            seasonality: rateComps.seasonality,
            city: rateComps.city,
            state: rateComps.state,
            bodyOfWater: rateComps.bodyOfWater,
          })
          .from(rcProjectComps)
          .innerJoin(rateComps, eq(rcProjectComps.rateCompId, rateComps.id))
          .where(inArray(rcProjectComps.rcProjectId, rcProjectIds))
          .limit(50);

        rateCompData = linkedRcComps.map(c => ({
          compId: c.compId,
          marina: c.marina,
          rateAmount: c.rateAmount,
          rateType: c.rateType,
          wetSlips: c.wetSlips,
          dryRacks: c.dryRacks,
          seasonality: c.seasonality,
          occupancyRate: null,
          city: c.city,
          state: c.state,
          bodyOfWater: c.bodyOfWater,
        }));
      }
    } catch (err) {
      console.warn('[OMBuilder] Comp aggregation error (non-fatal):', err);
    }

    // Compute comp statistics
    const salesPrices = salesCompData.filter(c => c.salePrice != null).map(c => c.salePrice!);
    const salesCapRates = salesCompData.filter(c => c.capRate != null).map(c => c.capRate!);
    const salesPPS = salesCompData.filter(c => c.pricePerSlip != null).map(c => c.pricePerSlip!);
    const rateAmounts = rateCompData.filter(c => c.rateAmount != null).map(c => c.rateAmount!);

    const avg = (arr: number[]) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : null;

    const compAnalytics: CompAnalytics = {
      salesComps: salesCompData,
      rateComps: rateCompData,
      salesCompStats: {
        count: salesCompData.length,
        avgPrice: avg(salesPrices),
        avgCapRate: avg(salesCapRates),
        avgPricePerSlip: avg(salesPPS),
        priceRange: salesPrices.length > 0 ? { min: Math.min(...salesPrices), max: Math.max(...salesPrices) } : null,
      },
      rateCompStats: {
        count: rateCompData.length,
        avgRate: avg(rateAmounts),
        rateRange: rateAmounts.length > 0 ? { min: Math.min(...rateAmounts), max: Math.max(...rateAmounts) } : null,
      },
    };

    // === Fetch Demographics for the property's state ===
    let demographics: MarketDemographics | null = null;
    const propertyState = property?.state || deal.state;
    if (propertyState) {
      try {
        const [cached] = await db
          .select()
          .from(demographicsCache)
          .where(eq(demographicsCache.stateCode, propertyState.toUpperCase()))
          .orderBy(desc(demographicsCache.fetchedAt))
          .limit(1);

        if (cached && cached.data) {
          const d = cached.data as any;
          demographics = {
            state: propertyState,
            population: d.population ?? null,
            medianIncome: d.medianIncome ?? null,
            unemploymentRate: d.unemploymentRate ?? null,
            populationGrowth: d.populationGrowth ?? null,
            avgSalePrice: d.avgSalePrice ?? null,
            avgCapRate: d.avgCapRate ?? null,
            avgPricePerSlip: d.avgPricePerSlip ?? null,
            transactionCount: d.transactionCount ?? null,
          };
        }
      } catch (err) {
        console.warn('[OMBuilder] Demographics fetch error (non-fatal):', err);
      }
    }

    return {
      dealId,
      dealName: deal.dealName || 'Untitled Deal',
      propertyOverview,
      financialSummary,
      rentRoll: rentRollData,
      operations,
      compAnalytics,
      demographics,
      generatedAt: new Date(),
    };
  }

  async generateOM(dealId: string, templateId: string | null, title: string): Promise<OmDocument> {
    const omData = await this.aggregateOMData(dealId);
    if (!omData) {
      throw new Error('Deal not found or no data available');
    }

    const insertData: InsertOmDocument = {
      dealId,
      templateId: templateId || null,
      title,
      generatedAt: new Date(),
      status: 'generating',
      metadata: {
        propertyOverview: omData.propertyOverview,
        financialSummary: omData.financialSummary,
        rentRoll: omData.rentRoll,
        operations: omData.operations,
        generationOptions: { templateId },
      },
    };

    const [document] = await db
      .insert(omDocuments)
      .values(insertData)
      .returning();

    await db
      .update(omDocuments)
      .set({ 
        status: 'completed',
        updatedAt: new Date(),
      })
      .where(eq(omDocuments.id, document.id));

    const [updated] = await db
      .select()
      .from(omDocuments)
      .where(eq(omDocuments.id, document.id))
      .limit(1);

    return updated;
  }

  async exportToPDF(documentId: string, options?: { templateType?: PDFTemplateType; companyName?: string }): Promise<string> {
    const [document] = await db
      .select()
      .from(omDocuments)
      .where(eq(omDocuments.id, documentId))
      .limit(1);

    if (!document) {
      throw new Error('Document not found');
    }

    const omData = await this.aggregateOMData(document.dealId);
    if (!omData) {
      throw new Error('Failed to aggregate deal data for PDF generation');
    }

    const templateType = options?.templateType || this.getTemplateTypeFromId(document.templateId);
    
    const pdfOptions: Partial<PDFGeneratorOptions> = {
      templateType,
      companyName: options?.companyName || 'MarinaMatch',
    };

    const pdfBytes = await pdfGeneratorService.generatePDF(omData, pdfOptions);

    const uploadsDir = path.join(process.cwd(), 'server', 'uploads', 'om-pdfs');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const fileName = `om_${documentId}_${Date.now()}.pdf`;
    const filePath = path.join(uploadsDir, fileName);
    fs.writeFileSync(filePath, pdfBytes);

    const pdfUrl = `/api/om-builder/documents/${documentId}/pdf`;
    
    await db
      .update(omDocuments)
      .set({ 
        pdfUrl,
        metadata: {
          ...(document.metadata as object || {}),
          pdfFileName: fileName,
          pdfGeneratedAt: new Date().toISOString(),
          templateType,
        },
        updatedAt: new Date(),
      })
      .where(eq(omDocuments.id, documentId));

    return pdfUrl;
  }

  private getTemplateTypeFromId(templateId: string | null): PDFTemplateType {
    if (!templateId) return 'standard';
    
    const lowerTemplateId = templateId.toLowerCase();
    if (lowerTemplateId.includes('executive')) return 'executive';
    if (lowerTemplateId.includes('premium')) return 'premium';
    return 'standard';
  }

  async generatePDFBytes(documentId: string, templateType?: PDFTemplateType): Promise<Uint8Array> {
    const [document] = await db
      .select()
      .from(omDocuments)
      .where(eq(omDocuments.id, documentId))
      .limit(1);

    if (!document) {
      throw new Error('Document not found');
    }

    const omData = await this.aggregateOMData(document.dealId);
    if (!omData) {
      throw new Error('Failed to aggregate deal data');
    }

    const type = templateType || this.getTemplateTypeFromId(document.templateId);
    
    return pdfGeneratorService.generatePDF(omData, { templateType: type });
  }

  async getPDFFilePath(documentId: string): Promise<string | null> {
    const [document] = await db
      .select()
      .from(omDocuments)
      .where(eq(omDocuments.id, documentId))
      .limit(1);

    if (!document || !document.metadata) {
      return null;
    }

    const metadata = document.metadata as { pdfFileName?: string };
    if (!metadata.pdfFileName) {
      return null;
    }

    const filePath = path.join(process.cwd(), 'server', 'uploads', 'om-pdfs', metadata.pdfFileName);
    if (fs.existsSync(filePath)) {
      return filePath;
    }

    return null;
  }

  async getDocumentsByDeal(dealId: string): Promise<OmDocument[]> {
    return db
      .select()
      .from(omDocuments)
      .where(eq(omDocuments.dealId, dealId))
      .orderBy(desc(omDocuments.generatedAt));
  }

  async getDocument(documentId: string): Promise<OmDocument | null> {
    const [document] = await db
      .select()
      .from(omDocuments)
      .where(eq(omDocuments.id, documentId))
      .limit(1);
    return document || null;
  }

  async deleteDocument(documentId: string): Promise<void> {
    await db
      .delete(omDocuments)
      .where(eq(omDocuments.id, documentId));
  }
}

export const omBuilderService = new OMBuilderService();
