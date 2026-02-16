import { IStorage } from "../../storage";
import { ParserService } from "./parser";
import type { InsertRateComp, UpdateRateComp, RateComp, Project } from "@shared/schema";
import type { AnalyticsReportData, ProjectReportData } from "../openai";

export class CompService {
  constructor(
    private storage: IStorage,
    private parser: ParserService = new ParserService()
  ) {}

  async createComp(compData: InsertRateComp, userId: string): Promise<RateComp> {
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

    const comp = await this.storage.createRateComp({
      ...compData,
      propertyId,
    });
    
    // Create pending property if no match was found
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

        await this.storage.createPendingProperty({
          orgId: compData.orgId,
          sourceType: 'rate_comp',
          rateCompId: comp.id,
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
      } catch (error) {
        console.error('Error creating pending property:', error);
      }
    }
    
    // Log audit trail
    await this.storage.createAuditLog({
      orgId: compData.orgId,
      userId,
      entityType: 'rate_comp',
      entityId: comp.id,
      action: 'create',
      after: comp,
    });

    return comp;
  }

  async updateComp(id: string, updates: UpdateRateComp, orgId: string, userId: string): Promise<RateComp | undefined> {
    // Get current state for audit
    const before = await this.storage.getRateComp(id, orgId);
    if (!before) return undefined;

    const comp = await this.storage.updateRateComp(id, updates, orgId);
    if (!comp) return undefined;

    // Log audit trail
    await this.storage.createAuditLog({
      orgId,
      userId,
      entityType: 'rate_comp',
      entityId: id,
      action: 'update',
      before,
      after: comp,
    });

    return comp;
  }

  async deleteComp(id: string, orgId: string, userId: string): Promise<boolean> {
    // Get current state for audit
    const before = await this.storage.getRateComp(id, orgId);
    if (!before) return false;

    const success = await this.storage.deleteRateComp(id, orgId, userId);
    if (success) {
      // Log audit trail
      await this.storage.createAuditLog({
        orgId,
        userId,
        entityType: 'rate_comp',
        entityId: id,
        action: 'delete',
        before,
      });
    }

    return success;
  }

  async bulkUpdateComps(ids: string[], updates: UpdateRateComp, orgId: string, userId: string): Promise<number> {
    // Get current states for audit
    const beforeStates = await Promise.all(
      ids.map(id => this.storage.getRateComp(id, orgId))
    );

    const count = await this.storage.bulkUpdateRateComps(ids, updates, orgId);

    // Log audit trails for successful updates
    for (let i = 0; i < ids.length; i++) {
      const before = beforeStates[i];
      if (before) {
        const after = await this.storage.getRateComp(ids[i], orgId);
        if (after) {
          await this.storage.createAuditLog({
            orgId,
            userId,
            entityType: 'rate_comp',
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
      ids.map(id => this.storage.getRateComp(id, orgId))
    );

    const count = await this.storage.bulkDeleteRateComps(ids, orgId, userId);

    // Log audit trails for successful deletions
    for (let i = 0; i < ids.length; i++) {
      const before = beforeStates[i];
      if (before) {
        await this.storage.createAuditLog({
          orgId,
          userId,
          entityType: 'rate_comp',
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
    const importRecord = await this.storage.getRateCompImport(importId, orgId);
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
        const existingComps = await this.storage.findPotentialRateCompDuplicates(
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

  async processImport(
    importId: string,
    orgId: string,
    userId: string,
    mapping: Record<string, string>,
    normalization: any,
    excludedRows: number[] = [],
    parentPortfolioId?: string
  ): Promise<any> {
    try {
      // Update import status
      await this.storage.updateRateCompImport(importId, {
        status: 'processing',
        columnMapping: mapping,
      }, orgId);

      // Get the import record with parsed data
      const importRecord = await this.storage.getRateCompImport(importId, orgId);
      if (!importRecord || !importRecord.parsedData) {
        throw new Error('Import record or parsed data not found');
      }

      const results = {
        totalRows: importRecord.parsedData.length,
        successCount: 0,
        errorCount: 0,
        warningCount: 0,
        errors: [] as Array<{ row: number; message: string; }>,
      };

      // Process each row
      for (let i = 0; i < importRecord.parsedData.length; i++) {
        const row = importRecord.parsedData[i];
        const rowNumber = i + 1;

        // Skip excluded rows (user decided to exclude due to duplicates)
        if (excludedRows.includes(i)) {
          continue;
        }

        try {
          const transformedData = this.transformRow(row, mapping, normalization);
          
          const hasAnyData = Object.values(transformedData).some(v => 
            v !== null && v !== undefined && v !== '' && 
            !(Array.isArray(v) && v.length === 0) &&
            !(typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 0)
          );
          if (!hasAnyData) {
            continue;
          }

          // Try to match existing property by name, city, and state
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
              // No matching property found - will need to create profile later
              needsPropertyProfile = true;
            }
          } catch (error) {
            console.error('Error matching property:', error);
            // Continue without property link
          }

          // Create comp record
          const compData = {
            orgId,
            createdBy: userId,
            updatedBy: userId,
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
            parentPortfolioId: parentPortfolioId || undefined,
            propertyId: propertyId,
          };

          const createdComp = await this.storage.createRateComp(compData);
          results.successCount++;

          // Create pending property profile if needed
          if (needsPropertyProfile && createdComp) {
            try {
              await this.storage.createPendingPropertyProfile({
                rateCompId: createdComp.id,
                orgId,
                status: 'pending',
              });
            } catch (error) {
              console.error('Error creating pending property profile:', error);
              // Don't fail the whole import if this fails
            }
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
      await this.storage.updateRateCompImport(importId, {
        status: 'completed',
        summary: results,
      }, orgId);

      // Log audit trail for import
      await this.storage.createAuditLog({
        orgId,
        userId,
        entityType: 'rate_comp',
        entityId: importId,
        action: 'import',
        after: results,
      });

      return results;
    } catch (error) {
      // Update import status on error
      await this.storage.updateRateCompImport(importId, {
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

    transformed.articleUrls = this.extractArticleUrls(row);

    const mappedSourceColumns = new Set(Object.keys(mapping));
    const custom: Record<string, any> = transformed.custom || {};
    for (const [col, val] of Object.entries(row)) {
      if (mappedSourceColumns.has(col)) continue;
      if (col.toLowerCase().startsWith('unnamed') || col.startsWith('__col_')) continue;
      if (val === null || val === undefined || String(val).trim() === '') continue;
      custom[col] = val;
    }
    if (Object.keys(custom).length > 0) {
      transformed.custom = custom;
    }

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
  async processAnalyticsData(comps: RateComp[]): Promise<AnalyticsReportData> {
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

    const byState = Array.from(stateData.entries())
      .map(([state, data]) => ({
        state,
        count: data.count,
        totalVolume: data.totalVolume,
        avgPrice: data.totalVolume / data.count,
      }))
      .sort((a, b) => b.count - a.count);

    return {
      totalComps,
      totalVolume,
      averagePrice,
      averageCapRate,
      timeSeries,
      priceDistribution,
      byState,
    };
  }

  /**
   * Process project-specific analytics for a given project
   */
  async processProjectAnalyticsData(
    projectId: string,
    orgId: string
  ): Promise<ProjectReportData> {
    const projectComps = await this.storage.getProjectRateComps(projectId, orgId);
    
    if (projectComps.length === 0) {
      return {
        projectId,
        totalComps: 0,
        pricedComps: 0,
        averagePrice: 0,
        medianPrice: 0,
        priceRange: { min: 0, max: 0 },
        averageCapRate: 0,
        medianCapRate: 0,
        topStates: [],
        recentActivity: []
      };
    }

    // Filter for disclosed prices
    const pricedComps = projectComps.filter(comp => 
      comp.isPriceDisclosed && 
      comp.salePrice && 
      parseFloat(comp.salePrice.toString()) > 0
    );

    const prices = pricedComps.map(comp => parseFloat(comp.salePrice!.toString())).sort((a, b) => a - b);
    const averagePrice = prices.length > 0 ? prices.reduce((sum, p) => sum + p, 0) / prices.length : 0;
    const medianPrice = prices.length > 0 ? prices[Math.floor(prices.length / 2)] : 0;
    const priceRange = prices.length > 0 ? { min: prices[0], max: prices[prices.length - 1] } : { min: 0, max: 0 };

    // Cap rates
    const capRateComps = projectComps.filter(comp => 
      comp.capRate && 
      parseFloat(comp.capRate.toString()) > 0
    );
    const capRates = capRateComps.map(comp => parseFloat(comp.capRate!.toString())).sort((a, b) => a - b);
    const averageCapRate = capRates.length > 0 ? capRates.reduce((sum, r) => sum + r, 0) / capRates.length : 0;
    const medianCapRate = capRates.length > 0 ? capRates[Math.floor(capRates.length / 2)] : 0;

    // Top states
    const stateCounts = new Map<string, number>();
    projectComps.forEach(comp => {
      if (comp.state) {
        stateCounts.set(comp.state, (stateCounts.get(comp.state) || 0) + 1);
      }
    });
    const topStates = Array.from(stateCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([state, count]) => ({ state, count }));

    // Recent activity
    const recentActivity = projectComps
      .filter(comp => comp.createdAt)
      .sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime())
      .slice(0, 10)
      .map(comp => ({
        compId: comp.id,
        marina: comp.marina,
        state: comp.state || 'Unknown',
        salePrice: comp.salePrice ? parseFloat(comp.salePrice.toString()) : null,
        createdAt: comp.createdAt!
      }));

    return {
      projectId,
      totalComps: projectComps.length,
      pricedComps: pricedComps.length,
      averagePrice,
      medianPrice,
      priceRange,
      averageCapRate,
      medianCapRate,
      topStates,
      recentActivity
    };
  }
}
