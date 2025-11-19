import { IStorage } from "../../storage";
import { ParserService } from "./parser";
import { ImportAnalysisService } from "./importAnalysisService";
import type { InsertSalesComp, UpdateSalesComp, SalesComp, Project } from "@shared/schema";
import type { AnalyticsReportData, ProjectReportData } from "../openai";

export class CompService {
  private importAnalysis: ImportAnalysisService;

  constructor(
    private storage: IStorage,
    private parser: ParserService = new ParserService()
  ) {
    this.importAnalysis = new ImportAnalysisService(storage);
  }

  async createComp(compData: InsertSalesComp, userId: string): Promise<SalesComp> {
    // Try to auto-match property by name/city/state before creating
    let propertyId = compData.propertyId;
    let pendingPropertyId: string | undefined;
    
    if (!propertyId && compData.marina) {
      try {
        const matchedProperty = await this.storage.findPropertyByLocation(
          compData.orgId,
          compData.marina,
          compData.city,
          compData.state
        );
        
        if (matchedProperty) {
          propertyId = matchedProperty.id;
        } else {
          // Don't auto-create property - this will be done after creating the comp
          // so we have a compId to reference in pending_properties
          pendingPropertyId = 'pending';
        }
      } catch (error) {
        console.error('Error matching property during comp creation:', error);
      }
    }

    // Auto-assign to portfolio based on buyer/seller company match
    let parentPortfolioId = compData.parentPortfolioId;
    if (!parentPortfolioId && !compData.isPortfolio && (compData.buyerCompanyId || compData.sellerCompanyId)) {
      try {
        const matchingPortfolio = await this.findMatchingPortfolio(
          compData.orgId,
          compData.buyerCompanyId,
          compData.sellerCompanyId
        );
        if (matchingPortfolio) {
          parentPortfolioId = matchingPortfolio.id;
          console.log(`✨ Auto-assigned comp "${compData.marina}" to portfolio "${matchingPortfolio.marina}" (owner: ${matchingPortfolio.ownerCompanyId})`);
        }
      } catch (error) {
        console.error('Error auto-assigning to portfolio:', error);
      }
    }

    const comp = await this.storage.createComp({
      ...compData,
      propertyId,
      parentPortfolioId,
    });
    
    // Create pending property if no match was found
    // This applies to ALL comps, including individual comps within a portfolio
    if (pendingPropertyId === 'pending' && compData.marina) {
      try {
        const address = [
          compData.address,
          compData.city && compData.state ? `${compData.city}, ${compData.state}` : compData.city || compData.state
        ].filter(Boolean).join(', ');

        // Find similar properties for suggested duplicates
        const similarProperties = await this.storage.findSimilarProperties(
          compData.orgId,
          compData.marina,
          compData.city,
          compData.state
        );

        const pendingProperty = await this.storage.createPendingProperty({
          orgId: compData.orgId,
          compId: comp.id,
          marinaName: compData.marina,
          city: compData.city || null,
          state: compData.state || null,
          address: address || null,
          salePrice: compData.salePrice || null,
          status: 'pending',
          compMetadata: {
            saleYear: compData.saleYear,
            saleMonth: compData.saleMonth,
            wetSlips: compData.wetSlips,
            dryRacks: compData.dryRacks,
            bodyOfWater: compData.bodyOfWater,
          },
          suggestedDuplicates: similarProperties.map(p => p.id),
          createdBy: userId,
          reviewedBy: null,
        });
        
        // Log pending property creation (useful for portfolio child comps)
        const compType = compData.isChild ? 'portfolio child comp' : compData.isPortfolio ? 'portfolio parent' : 'individual comp';
        console.log(`📝 Created pending property for ${compType}: "${compData.marina}" (comp ID: ${comp.id}, pending property ID: ${pendingProperty.id})`);
      } catch (error) {
        console.error('Error creating pending property:', error);
      }
    }
    
    // Log audit trail
    await this.storage.createAuditLog({
      orgId: compData.orgId,
      userId,
      entityType: 'sales_comp',
      entityId: comp.id,
      action: 'create',
      after: comp,
    });

    return comp;
  }

  async updateComp(id: string, updates: UpdateSalesComp, orgId: string, userId: string): Promise<SalesComp | undefined> {
    // Get current state for audit
    const before = await this.storage.getComp(id, orgId);
    if (!before) return undefined;

    const comp = await this.storage.updateComp(id, updates, orgId);
    if (!comp) return undefined;

    // Log audit trail
    await this.storage.createAuditLog({
      orgId,
      userId,
      entityType: 'sales_comp',
      entityId: id,
      action: 'update',
      before,
      after: comp,
    });

    return comp;
  }

  async deleteComp(id: string, orgId: string, userId: string): Promise<boolean> {
    // Get current state for audit
    const before = await this.storage.getComp(id, orgId);
    if (!before) return false;

    const success = await this.storage.deleteComp(id, orgId, userId);
    if (success) {
      // Log audit trail
      await this.storage.createAuditLog({
        orgId,
        userId,
        entityType: 'sales_comp',
        entityId: id,
        action: 'delete',
        before,
      });
    }

    return success;
  }

  /**
   * Find a matching portfolio for auto-assignment based on buyer/seller company
   * Returns the portfolio if exactly one match is found, null otherwise
   */
  private async findMatchingPortfolio(
    orgId: string,
    buyerCompanyId?: string | null,
    sellerCompanyId?: string | null
  ): Promise<SalesComp | null> {
    if (!buyerCompanyId && !sellerCompanyId) {
      return null;
    }

    // Query portfolios owned by buyer company (prioritize buyer)
    const buyerPortfolios = buyerCompanyId
      ? await this.storage.findPortfoliosByOwner(orgId, buyerCompanyId)
      : [];

    // Query portfolios owned by seller company
    const sellerPortfolios = sellerCompanyId
      ? await this.storage.findPortfoliosByOwner(orgId, sellerCompanyId)
      : [];

    // If buyer has exactly one portfolio, use it
    if (buyerPortfolios.length === 1) {
      return buyerPortfolios[0];
    }

    // If buyer has multiple or zero, try seller
    if (sellerPortfolios.length === 1) {
      return sellerPortfolios[0];
    }

    // If both have multiple or neither has any, skip auto-assignment
    if (buyerPortfolios.length > 1 || sellerPortfolios.length > 1) {
      console.log(`⚠️  Multiple portfolios found for buyer/seller companies - skipping auto-assignment`);
    }

    return null;
  }

  async bulkUpdateComps(ids: string[], updates: UpdateSalesComp, orgId: string, userId: string): Promise<number> {
    // Get current states for audit
    const beforeStates = await Promise.all(
      ids.map(id => this.storage.getComp(id, orgId))
    );

    const count = await this.storage.bulkUpdateComps(ids, updates, orgId);

    // Log audit trails for successful updates
    for (let i = 0; i < ids.length; i++) {
      const before = beforeStates[i];
      if (before) {
        const after = await this.storage.getComp(ids[i], orgId);
        if (after) {
          await this.storage.createAuditLog({
            orgId,
            userId,
            entityType: 'sales_comp',
            entityId: ids[i],
            action: 'update',
            before,
            after,
          });
        }
      }
    }

    return count;
  }

  async bulkDeleteComps(ids: string[], orgId: string, userId: string): Promise<number> {
    // Get current states for audit
    const beforeStates = await Promise.all(
      ids.map(id => this.storage.getComp(id, orgId))
    );

    const count = await this.storage.bulkDeleteComps(ids, orgId, userId);

    // Log audit trails for successful deletions
    for (let i = 0; i < ids.length; i++) {
      const before = beforeStates[i];
      if (before) {
        await this.storage.createAuditLog({
          orgId,
          userId,
          entityType: 'sales_comp',
          entityId: ids[i],
          action: 'delete',
          before,
          after: null,
        });
      }
    }

    return count;
  }

  async detectDuplicates(
    importId: string,
    orgId: string,
    mapping: Record<string, string>,
    normalization: any
  ): Promise<any> {
    // Get the import record with parsed data
    const importRecord = await this.storage.getImport(importId, orgId);
    if (!importRecord || !importRecord.parsedData) {
      throw new Error('Import record or parsed data not found');
    }

    const duplicates: Array<{
      rowIndex: number;
      rowData: any;
      existingComps: any[];
    }> = [];

    // Check each row for potential duplicates
    for (let i = 0; i < importRecord.parsedData.length; i++) {
      const row = importRecord.parsedData[i];
      const transformedData = this.transformRow(row, mapping, normalization);
      
      if (transformedData.marina) {
        const existingComps = await this.storage.findPotentialDuplicates(
          orgId,
          transformedData.marina,
          transformedData.state,
          transformedData.saleYear
        );

        if (existingComps.length > 0) {
          duplicates.push({
            rowIndex: i,
            rowData: transformedData,
            existingComps
          });
        }
      }
    }

    return {
      totalRows: importRecord.parsedData.length,
      duplicatesFound: duplicates.length,
      duplicates
    };
  }

  async previewImport(
    importId: string,
    orgId: string,
    mapping: Record<string, string>,
    normalization: any,
    importMode: 'insert' | 'update' | 'upsert' = 'upsert',
    updateBlankValues: boolean = false
  ): Promise<any> {
    const importRecord = await this.storage.getImport(importId, orgId);
    if (!importRecord || !importRecord.parsedData) {
      throw new Error('Import record or parsed data not found');
    }

    const transformedRows = importRecord.parsedData.map((row: any) => 
      this.transformRow(row, mapping, normalization)
    );

    const plan = await this.importAnalysis.analyzeImport(
      orgId,
      transformedRows,
      importMode,
      updateBlankValues
    );

    const duplicateMatches = plan.rows
      .filter(r => r.matchedComp)
      .slice(0, 20)
      .map(r => ({
        row: r.rowData,
        match: r.matchedComp,
        confidence: r.confidence,
        action: r.action,
        rowIndex: r.rowIndex
      }));

    return {
      toInsert: plan.summary.toInsert,
      toUpdate: plan.summary.toUpdate,
      toSkip: plan.summary.toSkip,
      duplicateMatches,
      plan
    };
  }

  async processImport(
    importId: string,
    orgId: string,
    userId: string,
    mapping: Record<string, string>,
    normalization: any,
    excludedRows: number[] = [],
    parentPortfolioId?: string,
    importMode: 'insert' | 'update' | 'upsert' = 'upsert',
    updateBlankValues: boolean = false
  ): Promise<any> {
    try {
      // Update import status
      await this.storage.updateImport(importId, {
        status: 'processing',
        columnMapping: mapping,
      }, orgId);

      // Get the import record with parsed data
      const importRecord = await this.storage.getImport(importId, orgId);
      if (!importRecord || !importRecord.parsedData) {
        throw new Error('Import record or parsed data not found');
      }

      // Transform rows
      const transformedRows = importRecord.parsedData.map((row: any) => 
        this.transformRow(row, mapping, normalization)
      );

      // Generate import plan
      const plan = await this.importAnalysis.analyzeImport(
        orgId,
        transformedRows,
        importMode,
        updateBlankValues
      );

      const results = {
        totalRows: importRecord.parsedData.length,
        successCount: 0,
        errorCount: 0,
        warningCount: 0,
        errors: [] as Array<{ row: number; message: string; }>,
        insertedCount: 0,
        updatedCount: 0,
        skippedCount: 0,
      };

      // Process each row according to the plan
      for (const planRow of plan.rows) {
        const rowNumber = planRow.rowIndex + 1;

        // Skip excluded rows (user decided to exclude)
        if (excludedRows.includes(planRow.rowIndex)) {
          results.skippedCount++;
          continue;
        }

        try {
          const transformedData = planRow.rowData;
          
          // Validate required fields
          if (!transformedData.marina) {
            results.errors.push({ row: rowNumber, message: 'Marina name is required' });
            results.errorCount++;
            continue;
          }

          // Handle based on import plan action
          if (planRow.action === 'skip') {
            results.skippedCount++;
            continue;
          }

          // Try to match existing property by name, city, and state (for both insert and update)
          let propertyId: string | undefined = undefined;
          let needsPropertyProfile = false;
          
          try {
            const matchedProperty = await this.storage.findPropertyByLocation(
              orgId,
              transformedData.marina,
              transformedData.city,
              transformedData.state
            );
            
            if (matchedProperty) {
              propertyId = matchedProperty.id;
            } else {
              needsPropertyProfile = true;
            }
          } catch (error) {
            console.error('Error matching property:', error);
          }

          // Prepare comp data
          const compData: any = {
            marina: transformedData.marina,
            salePrice: transformedData.salePrice || undefined,
            isPriceDisclosed: transformedData.isPriceDisclosed !== undefined ? transformedData.isPriceDisclosed : Boolean(transformedData.salePrice),
            capRate: transformedData.capRate || undefined,
            isCapRateDisclosed: transformedData.isCapRateDisclosed !== undefined ? transformedData.isCapRateDisclosed : Boolean(transformedData.capRate),
            noi: transformedData.noi || undefined,
            isNoiDisclosed: transformedData.isNoiDisclosed !== undefined ? transformedData.isNoiDisclosed : Boolean(transformedData.noi),
            saleMonth: transformedData.saleMonth || undefined,
            saleYear: transformedData.saleYear || undefined,
            state: transformedData.state || undefined,
            city: transformedData.city || undefined,
            region: transformedData.region || undefined,
            wetSlips: transformedData.wetSlips || undefined,
            dryRacks: transformedData.dryRacks || undefined,
            ioBoth: transformedData.ioBoth || undefined,
            bodyOfWater: transformedData.bodyOfWater || undefined,
            waterfront: transformedData.waterfront || undefined,
            saleCondition: transformedData.saleCondition || undefined,
            daysOnMarket: transformedData.daysOnMarket || undefined,
            broker: transformedData.broker || undefined,
            address: transformedData.address || undefined,
            zip: transformedData.zip || undefined,
            seller: transformedData.seller || undefined,
            company: transformedData.company || undefined,
            owner: transformedData.owner || undefined,
            listPrice: transformedData.listPrice || undefined,
            acres: transformedData.acres || undefined,
            occupancy: transformedData.occupancy || undefined,
            yearBuilt: transformedData.yearBuilt || undefined,
            notes: transformedData.notes || undefined,
            articleUrls: transformedData.articleUrls || [],
            custom: transformedData.custom || {},
            propertyId: propertyId,
          };

          if (planRow.action === 'insert') {
            // Insert new comp
            const insertData = {
              ...compData,
              orgId,
              createdBy: userId,
              updatedBy: userId,
              parentPortfolioId: parentPortfolioId || undefined,
            };

            const createdComp = await this.storage.createComp(insertData);
            results.insertedCount++;
            results.successCount++;

            // Create pending property profile if needed
            if (needsPropertyProfile && createdComp) {
              try {
                await this.storage.createPendingPropertyProfile({
                  compId: createdComp.id,
                  orgId,
                  status: 'pending',
                });
              } catch (error) {
                console.error('Error creating pending property profile:', error);
              }
            }

            // Create pending contacts for broker and seller if present
            if (createdComp) {
              const contactNames: Array<{ name: string; role: 'broker' | 'seller' }> = [];
              if (transformedData.broker && transformedData.broker.trim()) {
                contactNames.push({ name: transformedData.broker.trim(), role: 'broker' });
              }
              if (transformedData.seller && transformedData.seller.trim()) {
                contactNames.push({ name: transformedData.seller.trim(), role: 'seller' });
              }

              for (const { name, role } of contactNames) {
                try {
                  await this.storage.createPendingContact({
                    orgId,
                    sourceType: 'sales_comp',
                    sourceId: createdComp.id,
                    fullName: name,
                    status: 'pending',
                    createdBy: userId,
                    sourceMetadata: {
                      compId: createdComp.id,
                      marina: transformedData.marina,
                      city: transformedData.city,
                      state: transformedData.state,
                      role: role,
                    },
                  });
                } catch (error) {
                  console.error(`Error creating pending contact for ${role}:`, error);
                }
              }
            }

          } else if (planRow.action === 'update' && planRow.matchedCompId) {
            // Update existing comp
            const updateData: any = { ...compData, updatedBy: userId };
            
            await this.storage.updateComp(planRow.matchedCompId, updateData, orgId);
            results.updatedCount++;
            results.successCount++;
          }

        } catch (error) {
          results.errors.push({ 
            row: rowNumber, 
            message: `Failed to process row: ${(error as Error).message}` 
          });
          results.errorCount++;
        }
      }

      // Update final import status
      await this.storage.updateImport(importId, {
        status: 'completed',
        summary: results,
      }, orgId);

      // Log audit trail for import
      await this.storage.createAuditLog({
        orgId,
        userId,
        entityType: 'sales_comp',
        entityId: importId,
        action: 'import',
        after: results,
      });

      return results;
    } catch (error) {
      // Update import status on error
      await this.storage.updateImport(importId, {
        status: 'failed',
        summary: {
          totalRows: 0,
          successCount: 0,
          errorCount: 1,
          warningCount: 0,
          errors: [{ row: 0, message: (error as Error).message }],
        },
      }, orgId);

      throw error;
    }
  }

  private transformRow(row: Record<string, any>, mapping: Record<string, string>, normalization: any): any {
    const transformed: any = {};

    // Apply column mapping
    for (const [sourceColumn, targetField] of Object.entries(mapping)) {
      let value = row[sourceColumn];

      // Skip empty values
      if (value === null || value === undefined || value === '') {
        continue;
      }

      // Apply normalization based on field type
      switch (targetField) {
        case 'salePrice':
        case 'listPrice':
        case 'noi':
          if (normalization.currency) {
            value = this.parseCurrency(value);
          }
          break;
        case 'capRate':
        case 'occupancy':
          // Always parse percentages regardless of normalization settings
          value = this.parsePercent(value);
          break;
        case 'saleMonth':
          if (normalization.months) {
            value = this.parseMonth(value);
          }
          break;
        case 'state':
          if (normalization.states) {
            value = this.parseState(value);
          }
          break;
        case 'wetSlips':
        case 'dryRacks':
        case 'daysOnMarket':
        case 'saleYear':
        case 'yearBuilt':
          // More careful integer parsing - only parse if it's actually a string
          if (typeof value === 'string' && value.trim()) {
            value = this.parseInteger(value);
          }
          break;
        case 'acres':
          value = this.parseFloat(value);
          break;
      }

      // Handle undisclosed values
      if (normalization.undisclosed) {
        const undisclosedResult = this.handleUndisclosedValue(value, targetField);
        transformed[targetField] = undisclosedResult.value;
        
        // Set disclosure flags
        if (targetField === 'salePrice') {
          transformed.isPriceDisclosed = undisclosedResult.isDisclosed;
        } else if (targetField === 'capRate') {
          transformed.isCapRateDisclosed = undisclosedResult.isDisclosed;
        } else if (targetField === 'noi') {
          transformed.isNoiDisclosed = undisclosedResult.isDisclosed;
        }
      } else {
        transformed[targetField] = value;
      }
    }

    // Extract article URLs if present
    transformed.articleUrls = this.extractArticleUrls(row);

    return transformed;
  }

  private parseCurrency(value: any): string | null {
    if (typeof value === 'number') return value.toString();
    if (typeof value !== 'string') return null;
    
    // Remove currency symbols and commas
    const cleaned = value.replace(/[$,\s]/g, '');
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? null : parsed.toString();
  }

  private parsePercent(value: any): string | null {
    if (typeof value === 'number') return value.toString();
    if (typeof value !== 'string') return null;
    
    // Remove % symbol and convert
    const cleaned = value.replace(/%/g, '');
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? null : parsed.toString();
  }

  private parseInteger(value: any): number | null {
    if (typeof value === 'number') return Math.floor(value);
    if (typeof value !== 'string') return null;
    
    const parsed = parseInt(value.replace(/[^\d]/g, ''), 10);
    return isNaN(parsed) ? null : parsed;
  }

  private parseFloat(value: any): string | null {
    if (typeof value === 'number') return value.toString();
    if (typeof value !== 'string') return null;
    
    const parsed = parseFloat(value.replace(/[^\d.]/g, ''));
    return isNaN(parsed) ? null : parsed.toString();
  }

  private parseMonth(value: any): number | null {
    if (typeof value === 'number') return value;
    if (typeof value !== 'string') return null;
    
    const monthMap: Record<string, number> = {
      'january': 1, 'jan': 1,
      'february': 2, 'feb': 2,
      'march': 3, 'mar': 3,
      'april': 4, 'apr': 4,
      'may': 5,
      'june': 6, 'jun': 6,
      'july': 7, 'jul': 7,
      'august': 8, 'aug': 8,
      'september': 9, 'sep': 9, 'sept': 9,
      'october': 10, 'oct': 10,
      'november': 11, 'nov': 11,
      'december': 12, 'dec': 12
    };
    
    const lower = value.toLowerCase().trim();
    return monthMap[lower] || parseInt(value, 10) || null;
  }

  private parseState(value: any): string | null {
    if (typeof value !== 'string') return null;
    
    // Just return the state as-is for now
    // Could add state abbreviation expansion here
    return value.trim().toUpperCase();
  }

  private handleUndisclosedValue(value: any, field: string): { value: any; isDisclosed: boolean } {
    const undisclosedValues = ['undisclosed', 'n/a', 'na', 'not available', ''];
    const strValue = value?.toString()?.toLowerCase()?.trim();
    
    if (undisclosedValues.includes(strValue)) {
      return { value: null, isDisclosed: false };
    }
    
    return { value, isDisclosed: true };
  }

  private extractArticleUrls(row: Record<string, any>): string[] {
    const urls: string[] = [];
    
    // Check for Article and Article.1 columns
    if (row.article && this.isValidUrl(row.article)) {
      urls.push(row.article);
    }
    if (row['article.1'] && this.isValidUrl(row['article.1'])) {
      urls.push(row['article.1']);
    }

    return urls;
  }

  private isValidUrl(string: string): boolean {
    try {
      new URL(string);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Process analytics data for comprehensive reporting
   */
  async processAnalyticsData(comps: SalesComp[]): Promise<AnalyticsReportData> {
    // Filter valid disclosed price comps
    const pricedComps = comps.filter(comp => 
      comp.isPriceDisclosed && 
      comp.salePrice && 
      parseFloat(comp.salePrice.toString()) > 0
    );

    // Calculate basic metrics
    const totalComps = comps.length;
    const salePrices = pricedComps.map(comp => parseFloat(comp.salePrice!.toString()));
    const totalVolume = salePrices.reduce((sum, price) => sum + price, 0);
    const averagePrice = salePrices.length > 0 ? totalVolume / salePrices.length : 0;

    // Calculate cap rates
    const capRateComps = comps.filter(comp => 
      comp.capRate && 
      parseFloat(comp.capRate.toString()) > 0
    );
    const capRates = capRateComps.map(comp => parseFloat(comp.capRate!.toString()));
    const averageCapRate = capRates.length > 0 ? 
      capRates.reduce((sum, rate) => sum + rate, 0) / capRates.length : 0;

    // Time series analysis by year
    const yearlyData = new Map<number, { count: number; totalVolume: number; prices: number[]; capRates: number[] }>();
    
    pricedComps.forEach(comp => {
      const year = comp.saleYear || new Date().getFullYear();
      const price = parseFloat(comp.salePrice!.toString());
      
      if (!yearlyData.has(year)) {
        yearlyData.set(year, { count: 0, totalVolume: 0, prices: [], capRates: [] });
      }
      
      const yearData = yearlyData.get(year)!;
      yearData.count++;
      yearData.totalVolume += price;
      yearData.prices.push(price);
      
      if (comp.capRate && parseFloat(comp.capRate.toString()) > 0) {
        yearData.capRates.push(parseFloat(comp.capRate.toString()));
      }
    });

    const timeSeries = Array.from(yearlyData.entries())
      .map(([year, data]) => ({
        year,
        count: data.count,
        totalVolume: data.totalVolume,
        avgPrice: data.prices.length > 0 ? data.totalVolume / data.count : 0,
      }))
      .sort((a, b) => a.year - b.year);

    // Price distribution (bins)
    const minPrice = Math.min(...salePrices);
    const maxPrice = Math.max(...salePrices);
    const priceRange = maxPrice - minPrice;
    const binCount = 8;
    const binSize = priceRange / binCount;

    const priceDistribution = Array.from({ length: binCount }, (_, i) => {
      const binMin = minPrice + i * binSize;
      const binMax = minPrice + (i + 1) * binSize;
      const count = salePrices.filter(price => price >= binMin && price < binMax).length;
      
      return {
        bin: `$${(binMin / 1000000).toFixed(1)}M - $${(binMax / 1000000).toFixed(1)}M`,
        count
      };
    });

    // State breakdown
    const stateData = new Map<string, { count: number; totalVolume: number; prices: number[] }>();
    
    pricedComps.forEach(comp => {
      const state = comp.state || "Unknown";
      const price = parseFloat(comp.salePrice!.toString());
      
      if (!stateData.has(state)) {
        stateData.set(state, { count: 0, totalVolume: 0, prices: [] });
      }
      
      const data = stateData.get(state)!;
      data.count++;
      data.totalVolume += price;
      data.prices.push(price);
    });

    const stateBreakdown = Array.from(stateData.entries())
      .map(([state, data]) => ({
        state,
        count: data.count,
        totalVolume: data.totalVolume,
        avgPrice: data.totalVolume / data.count,
      }))
      .sort((a, b) => b.totalVolume - a.totalVolume)
      .slice(0, 10); // Top 10 states

    // Top cities (by city field)
    const cityData = new Map<string, { count: number; totalVolume: number; prices: number[] }>();
    
    pricedComps.forEach(comp => {
      const city = comp.city || comp.state || "Unknown";
      const price = parseFloat(comp.salePrice!.toString());
      
      if (!cityData.has(city)) {
        cityData.set(city, { count: 0, totalVolume: 0, prices: [] });
      }
      
      const data = cityData.get(city)!;
      data.count++;
      data.totalVolume += price;
      data.prices.push(price);
    });

    const topCities = Array.from(cityData.entries())
      .map(([city, data]) => ({
        city,
        count: data.count,
        totalVolume: data.totalVolume,
        avgPrice: data.totalVolume / data.count,
      }))
      .sort((a, b) => b.totalVolume - a.totalVolume)
      .slice(0, 10); // Top 10 cities

    return {
      totalComps,
      totalVolume,
      averagePrice,
      averageCapRate,
      timeSeries,
      priceDistribution,
      stateBreakdown,
      topCities,
    };
  }

  /**
   * Process project data for comprehensive reporting
   */
  async processProjectData(project: Project, comps: SalesComp[]): Promise<ProjectReportData> {
    // Filter valid disclosed price comps
    const pricedComps = comps.filter(comp => 
      comp.isPriceDisclosed && 
      comp.salePrice && 
      parseFloat(comp.salePrice.toString()) > 0
    );

    // Calculate basic project metrics
    const totalVolume = pricedComps.reduce((sum, comp) => 
      sum + parseFloat(comp.salePrice!.toString()), 0);
    const averagePrice = pricedComps.length > 0 ? totalVolume / pricedComps.length : 0;

    // Calculate cap rates
    const capRateComps = comps.filter(comp => 
      comp.capRate && 
      parseFloat(comp.capRate.toString()) > 0
    );
    const capRates = capRateComps.map(comp => parseFloat(comp.capRate!.toString()));
    const averageCapRate = capRates.length > 0 ? 
      capRates.reduce((sum, rate) => sum + rate, 0) / capRates.length : 0;

    // Market trends analysis by year
    const yearlyTrends = new Map<number, { count: number; totalVolume: number; prices: number[] }>();
    
    pricedComps.forEach(comp => {
      const year = comp.saleYear || new Date().getFullYear();
      const price = parseFloat(comp.salePrice!.toString());
      
      if (!yearlyTrends.has(year)) {
        yearlyTrends.set(year, { count: 0, totalVolume: 0, prices: [] });
      }
      
      const yearData = yearlyTrends.get(year)!;
      yearData.count++;
      yearData.totalVolume += price;
      yearData.prices.push(price);
    });

    const marketTrends = Array.from(yearlyTrends.entries())
      .map(([year, data]) => ({
        year,
        avgPrice: data.totalVolume / data.count,
        count: data.count,
      }))
      .sort((a, b) => a.year - b.year);

    // Price ranges distribution
    const salePrices = pricedComps.map(comp => parseFloat(comp.salePrice!.toString()));
    const minPrice = Math.min(...salePrices);
    const maxPrice = Math.max(...salePrices);
    const priceRange = maxPrice - minPrice;
    const binCount = 5;
    const binSize = priceRange / binCount;

    const priceRanges = Array.from({ length: binCount }, (_, i) => {
      const binMin = minPrice + i * binSize;
      const binMax = minPrice + (i + 1) * binSize;
      const count = salePrices.filter(price => price >= binMin && price < binMax).length;
      const percentage = (count / salePrices.length) * 100;
      
      return {
        range: `$${(binMin / 1000000).toFixed(1)}M - $${(binMax / 1000000).toFixed(1)}M`,
        count,
        percentage: Math.round(percentage),
      };
    });

    // Geographic distribution
    const stateData = new Map<string, { count: number; totalVolume: number }>();
    
    pricedComps.forEach(comp => {
      const state = comp.state || "Unknown";
      const price = parseFloat(comp.salePrice!.toString());
      
      if (!stateData.has(state)) {
        stateData.set(state, { count: 0, totalVolume: 0 });
      }
      
      const data = stateData.get(state)!;
      data.count++;
      data.totalVolume += price;
    });

    const geographicDistribution = Array.from(stateData.entries())
      .map(([state, data]) => ({
        state,
        count: data.count,
        avgPrice: data.totalVolume / data.count,
      }))
      .sort((a, b) => b.count - a.count);

    // Format comps for detailed analysis
    const formattedComps = comps.map(comp => ({
      id: comp.id,
      marina: comp.marina,
      state: comp.state || null,
      city: comp.city || null,
      salePrice: comp.salePrice ? parseFloat(comp.salePrice.toString()) : null,
      capRate: comp.capRate ? parseFloat(comp.capRate.toString()) : null,
      saleYear: comp.saleYear || null,
      saleMonth: comp.saleMonth ? this.getMonthName(comp.saleMonth) : null,
    }));

    return {
      project: {
        id: project.id,
        name: project.name,
        description: project.description,
        color: project.color,
        compsCount: comps.length,
        totalVolume,
        averagePrice,
        averageCapRate,
      },
      comps: formattedComps,
      insights: {
        marketTrends,
        priceRanges,
        geographicDistribution,
      },
    };
  }

  private getMonthName(monthNumber: number): string {
    const months = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
    ];
    return months[monthNumber - 1] || "Unknown";
  }
}
