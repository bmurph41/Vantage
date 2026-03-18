/**
 * Data Binding Service
 * Resolves data bindings from various sources for document sections
 */

import { db } from '../../db';
import { eq, and, desc } from 'drizzle-orm';
import {
  crmDeals,
  crmProperties,
  modelingProjects,
  rentRolls,
  rentRollEntries,
} from '../../../shared/schema';
import {
  type DataSource,
  type ResolvedBinding,
  type DataBindingRequirement,
} from '../../../shared/document-builder/types';

// =============================================================================
// Binding Resolution
// =============================================================================

export interface BindingContext {
  dealId?: string;
  propertyId?: string;
  modelingProjectId?: string;
  rentRollId?: string;
  organizationId?: string;
  userId?: string;
}

export interface BindingCatalogEntry {
  source: DataSource;
  label: string;
  fields: Array<{
    key: string;
    label: string;
    type: 'string' | 'number' | 'currency' | 'percent' | 'date' | 'array' | 'object';
    path: string;
  }>;
}

class DataBindingService {
  /**
   * Get the bindings catalog showing all available data sources and fields
   */
  getBindingsCatalog(): Record<string, BindingCatalogEntry> {
    return {
      deal: {
        source: 'deal',
        label: 'Deal Information',
        fields: [
          { key: 'dealName', label: 'Deal Name', type: 'string', path: 'dealName' },
          { key: 'marinaName', label: 'Marina Name', type: 'string', path: 'marinaName' },
          { key: 'value', label: 'Deal Value', type: 'currency', path: 'value' },
          { key: 'stage', label: 'Deal Stage', type: 'string', path: 'stage' },
          { key: 'city', label: 'City', type: 'string', path: 'city' },
          { key: 'state', label: 'State', type: 'string', path: 'state' },
          { key: 'notes', label: 'Notes', type: 'string', path: 'notes' },
        ],
      },
      property: {
        source: 'property',
        label: 'Property Details',
        fields: [
          { key: 'name', label: 'Property Name', type: 'string', path: 'name' },
          { key: 'address', label: 'Address', type: 'string', path: 'address' },
          { key: 'city', label: 'City', type: 'string', path: 'city' },
          { key: 'state', label: 'State', type: 'string', path: 'state' },
          { key: 'zip', label: 'ZIP Code', type: 'string', path: 'zip' },
          { key: 'cityState', label: 'City, State', type: 'string', path: 'cityState' },
          { key: 'totalSlips', label: 'Total Slips', type: 'number', path: 'totalSlips' },
          { key: 'wetSlips', label: 'Wet Slips', type: 'number', path: 'wetSlips' },
          { key: 'drySlips', label: 'Dry Slips', type: 'number', path: 'drySlips' },
          { key: 'askingPrice', label: 'Asking Price', type: 'currency', path: 'askingPrice' },
          { key: 'yearBuilt', label: 'Year Built', type: 'number', path: 'yearBuilt' },
          { key: 'waterFrontage', label: 'Water Frontage (ft)', type: 'number', path: 'waterFrontage' },
          { key: 'acreage', label: 'Acreage', type: 'number', path: 'acreage' },
          { key: 'amenities', label: 'Amenities', type: 'array', path: 'amenities' },
          { key: 'description', label: 'Description', type: 'string', path: 'description' },
          { key: 'bodyOfWater', label: 'Body of Water', type: 'string', path: 'bodyOfWater' },
          { key: 'channelDepth', label: 'Channel Depth', type: 'number', path: 'channelDepth' },
          { key: 'groundLeaseTerm', label: 'Ground Lease Term', type: 'string', path: 'groundLeaseTerm' },
          { key: 'groundLeaseLessor', label: 'Ground Lease Lessor', type: 'string', path: 'groundLeaseLessor' },
        ],
      },
      modeling: {
        source: 'modeling',
        label: 'Financial Model',
        fields: [
          { key: 'purchasePrice', label: 'Purchase Price', type: 'currency', path: 'purchasePrice' },
          { key: 'noi', label: 'NOI', type: 'currency', path: 'noi' },
          { key: 'ebitdam', label: 'EBITDAM', type: 'currency', path: 'ebitdam' },
          { key: 'ebitda', label: 'EBITDA', type: 'currency', path: 'ebitda' },
          { key: 'capRate', label: 'Cap Rate', type: 'percent', path: 'capRate' },
          { key: 'irr', label: 'IRR', type: 'percent', path: 'irr' },
          { key: 'equityMultiple', label: 'Equity Multiple', type: 'number', path: 'equityMultiple' },
          { key: 'cashOnCash', label: 'Cash on Cash', type: 'percent', path: 'cashOnCash' },
          { key: 'revenue', label: 'Total Revenue', type: 'currency', path: 'revenue' },
          { key: 'operatingExpenses', label: 'Operating Expenses', type: 'currency', path: 'operatingExpenses' },
          { key: 'debtService', label: 'Annual Debt Service', type: 'currency', path: 'annualDebtService' },
          { key: 'ltv', label: 'LTV', type: 'percent', path: 'ltv' },
          { key: 'interestRate', label: 'Interest Rate', type: 'percent', path: 'interestRate' },
          { key: 'loanAmount', label: 'Loan Amount', type: 'currency', path: 'loanAmount' },
          { key: 'dscr', label: 'DSCR', type: 'number', path: 'dscr' },
          { key: 'year1Revenue', label: 'Year 1 Revenue', type: 'currency', path: 'year1Revenue' },
          { key: 'year2Revenue', label: 'Year 2 Revenue', type: 'currency', path: 'year2Revenue' },
          { key: 'year3Revenue', label: 'Year 3 Revenue', type: 'currency', path: 'year3Revenue' },
        ],
      },
      rent_roll: {
        source: 'rent_roll',
        label: 'Rent Roll',
        fields: [
          { key: 'totalUnits', label: 'Total Units', type: 'number', path: 'totalUnits' },
          { key: 'occupiedUnits', label: 'Occupied Units', type: 'number', path: 'occupiedUnits' },
          { key: 'vacantUnits', label: 'Vacant Units', type: 'number', path: 'vacantUnits' },
          { key: 'occupancyRate', label: 'Occupancy Rate', type: 'percent', path: 'occupancyRate' },
          { key: 'totalAnnualRevenue', label: 'Total Annual Revenue', type: 'currency', path: 'totalAnnualRevenue' },
          { key: 'avgRatePerFoot', label: 'Avg Rate/Foot', type: 'currency', path: 'avgRatePerFoot' },
          { key: 'avgRatePerSlip', label: 'Avg Rate/Slip', type: 'currency', path: 'avgRatePerSlip' },
          { key: 'entries', label: 'Rent Roll Entries', type: 'array', path: 'entries' },
          { key: 'byType', label: 'By Unit Type', type: 'array', path: 'byType' },
        ],
      },
      demographics: {
        source: 'demographics',
        label: 'Demographics',
        fields: [
          { key: 'population', label: 'Population', type: 'number', path: 'population' },
          { key: 'medianHouseholdIncome', label: 'Median Household Income', type: 'currency', path: 'medianHouseholdIncome' },
          { key: 'populationGrowth', label: 'Population Growth', type: 'percent', path: 'populationGrowth' },
          { key: 'employmentRate', label: 'Employment Rate', type: 'percent', path: 'employmentRate' },
          { key: 'boatRegistrations', label: 'Boat Registrations', type: 'number', path: 'boatRegistrations' },
        ],
      },
      sales_comps: {
        source: 'sales_comps',
        label: 'Sales Comparables',
        fields: [
          { key: 'comps', label: 'Sales Comps', type: 'array', path: 'comps' },
          { key: 'avgPricePerSlip', label: 'Avg Price/Slip', type: 'currency', path: 'avgPricePerSlip' },
          { key: 'avgCapRate', label: 'Avg Cap Rate', type: 'percent', path: 'avgCapRate' },
        ],
      },
      rate_comps: {
        source: 'rate_comps',
        label: 'Rate Comparables',
        fields: [
          { key: 'comps', label: 'Rate Comps', type: 'array', path: 'comps' },
          { key: 'avgSummerRate', label: 'Avg Summer Rate', type: 'currency', path: 'avgSummerRate' },
          { key: 'avgWinterRate', label: 'Avg Winter Rate', type: 'currency', path: 'avgWinterRate' },
          { key: 'avgTransientRate', label: 'Avg Transient Rate', type: 'currency', path: 'avgTransientRate' },
        ],
      },
      due_diligence: {
        source: 'due_diligence',
        label: 'Due Diligence',
        fields: [
          { key: 'items', label: 'DD Items', type: 'array', path: 'items' },
          { key: 'completionPercentage', label: 'Completion %', type: 'percent', path: 'completionPercentage' },
          { key: 'openItems', label: 'Open Items', type: 'number', path: 'openItems' },
        ],
      },
      manual: {
        source: 'manual',
        label: 'Manual Entry',
        fields: [
          { key: 'custom', label: 'Custom Value', type: 'string', path: 'custom' },
        ],
      },
    };
  }

  /**
   * Resolve a single binding from its source
   */
  async resolveBinding(
    requirement: DataBindingRequirement,
    context: BindingContext
  ): Promise<ResolvedBinding> {
    let value: any = null;

    try {
      switch (requirement.source) {
        case 'deal':
          value = await this.resolveDealBinding(requirement, context);
          break;
        case 'property':
          value = await this.resolvePropertyBinding(requirement, context);
          break;
        case 'modeling':
          value = await this.resolveModelingBinding(requirement, context);
          break;
        case 'rent_roll':
          value = await this.resolveRentRollBinding(requirement, context);
          break;
        case 'demographics':
          value = await this.resolveDemographicsBinding(requirement, context);
          break;
        case 'sales_comps':
          value = await this.resolveSalesCompsBinding(requirement, context);
          break;
        case 'rate_comps':
          value = await this.resolveRateCompsBinding(requirement, context);
          break;
        case 'due_diligence':
          value = await this.resolveDueDiligenceBinding(requirement, context);
          break;
        case 'manual':
          value = requirement.fallback ?? null;
          break;
        default:
          value = requirement.fallback ?? null;
      }

      // Apply transform if specified
      if (requirement.transform && value !== null) {
        value = this.applyTransform(value, requirement.transform);
      }
    } catch (error) {
      console.error(`Error resolving binding ${requirement.bindingKey}:`, error);
      value = requirement.fallback ?? null;
    }

    return {
      bindingKey: requirement.bindingKey,
      source: requirement.source,
      field: requirement.field,
      value,
      locked: false,
      overridden: false,
    };
  }

  /**
   * Resolve multiple bindings at once
   */
  async resolveBindings(
    requirements: DataBindingRequirement[],
    context: BindingContext
  ): Promise<ResolvedBinding[]> {
    const results = await Promise.all(
      requirements.map((req) => this.resolveBinding(req, context))
    );
    return results;
  }

  /**
   * Get binding context from a deal
   */
  async getBindingContext(dealId: string): Promise<BindingContext> {
    const [deal] = await db
      .select()
      .from(crmDeals)
      .where(eq(crmDeals.id, dealId))
      .limit(1);

    if (!deal) {
      return { dealId };
    }

    const context: BindingContext = {
      dealId,
      propertyId: deal.propertyId || undefined,
    };

    // Get linked modeling project
    if (deal.propertyId) {
      const [modelingProject] = await db
        .select({ id: modelingProjects.id })
        .from(modelingProjects)
        .where(eq(modelingProjects.linkedPropertyId, deal.propertyId))
        .orderBy(desc(modelingProjects.createdAt))
        .limit(1);

      if (modelingProject) {
        context.modelingProjectId = modelingProject.id;
      }

      // Get linked rent roll
      const [rentRoll] = await db
        .select({ id: rentRolls.id })
        .from(rentRolls)
        .where(eq(rentRolls.propertyId, deal.propertyId))
        .orderBy(desc(rentRolls.createdAt))
        .limit(1);

      if (rentRoll) {
        context.rentRollId = rentRoll.id;
      }
    }

    return context;
  }

  // =============================================================================
  // Source-Specific Resolution Methods
  // =============================================================================

  private async resolveDealBinding(
    requirement: DataBindingRequirement,
    context: BindingContext
  ): Promise<any> {
    if (!context.dealId) return null;

    const [deal] = await db
      .select()
      .from(crmDeals)
      .where(eq(crmDeals.id, context.dealId))
      .limit(1);

    if (!deal) return null;

    return this.getNestedValue(deal, requirement.field);
  }

  private async resolvePropertyBinding(
    requirement: DataBindingRequirement,
    context: BindingContext
  ): Promise<any> {
    let propertyId = context.propertyId;

    // If no property ID, try to get from deal
    if (!propertyId && context.dealId) {
      const [deal] = await db
        .select({ propertyId: crmDeals.propertyId })
        .from(crmDeals)
        .where(eq(crmDeals.id, context.dealId))
        .limit(1);

      propertyId = deal?.propertyId || undefined;
    }

    if (!propertyId) return null;

    const [property] = await db
      .select()
      .from(crmProperties)
      .where(eq(crmProperties.id, propertyId))
      .limit(1);

    if (!property) return null;

    // Handle computed fields
    if (requirement.field === 'cityState') {
      const city = property.city || '';
      const state = property.state || '';
      return city && state ? `${city}, ${state}` : city || state || null;
    }

    return this.getNestedValue(property, requirement.field);
  }

  private async resolveModelingBinding(
    requirement: DataBindingRequirement,
    context: BindingContext
  ): Promise<any> {
    let projectId = context.modelingProjectId;

    // If no project ID, try to find one linked to the property
    if (!projectId && context.propertyId) {
      const [project] = await db
        .select({ id: modelingProjects.id })
        .from(modelingProjects)
        .where(eq(modelingProjects.linkedPropertyId, context.propertyId))
        .orderBy(desc(modelingProjects.createdAt))
        .limit(1);

      projectId = project?.id;
    }

    if (!projectId) return null;

    const [project] = await db
      .select()
      .from(modelingProjects)
      .where(eq(modelingProjects.id, projectId))
      .limit(1);

    if (!project) return null;

    // Check in main project fields first
    const directValue = this.getNestedValue(project, requirement.field);
    if (directValue !== undefined && directValue !== null) {
      return directValue;
    }

    // Check in modelData JSON field
    const modelData = (project as any).modelData;
    if (modelData) {
      return this.getNestedValue(modelData, requirement.field);
    }

    return null;
  }

  private async resolveRentRollBinding(
    requirement: DataBindingRequirement,
    context: BindingContext
  ): Promise<any> {
    let rentRollId = context.rentRollId;

    // If no rent roll ID, try to find one linked to the property
    if (!rentRollId && context.propertyId) {
      const [rentRoll] = await db
        .select({ id: rentRolls.id })
        .from(rentRolls)
        .where(eq(rentRolls.propertyId, context.propertyId))
        .orderBy(desc(rentRolls.createdAt))
        .limit(1);

      rentRollId = rentRoll?.id;
    }

    if (!rentRollId) return null;

    // Get rent roll entries
    const entries = await db
      .select()
      .from(rentRollEntries)
      .where(eq(rentRollEntries.rentRollId, rentRollId));

    if (!entries.length) return null;

    // Compute summary values
    const totalUnits = entries.length;
    const occupiedUnits = entries.filter((e) => e.occupancyStatus === 'occupied').length;
    const vacantUnits = totalUnits - occupiedUnits;
    const occupancyRate = totalUnits > 0 ? (occupiedUnits / totalUnits) * 100 : 0;
    const totalRent = entries.reduce((sum, e) => sum + (Number(e.currentRent) || 0), 0);
    const totalAnnualRevenue = totalRent * 12;
    const avgRatePerSlip = totalUnits > 0 ? totalRent / totalUnits : 0;

    // Group by type
    const byTypeMap = new Map<string, { count: number; totalRent: number }>();
    entries.forEach((e) => {
      const type = e.unitType || 'unknown';
      const current = byTypeMap.get(type) || { count: 0, totalRent: 0 };
      current.count++;
      current.totalRent += Number(e.currentRent) || 0;
      byTypeMap.set(type, current);
    });

    const byType = Array.from(byTypeMap.entries()).map(([type, data]) => ({
      type,
      count: data.count,
      avgRent: data.count > 0 ? data.totalRent / data.count : 0,
      totalRent: data.totalRent,
    }));

    const summary = {
      totalUnits,
      occupiedUnits,
      vacantUnits,
      occupancyRate,
      totalAnnualRevenue,
      avgRatePerSlip,
      avgRatePerFoot: avgRatePerSlip, // Simplified - would need LOA data
      entries,
      byType,
    };

    return this.getNestedValue(summary, requirement.field);
  }

  private async resolveDemographicsBinding(
    requirement: DataBindingRequirement,
    context: BindingContext
  ): Promise<any> {
    // Demographics would typically come from a separate demographics service/table
    // For now, return placeholder data that could be populated manually
    return null;
  }

  private async resolveSalesCompsBinding(
    requirement: DataBindingRequirement,
    context: BindingContext
  ): Promise<any> {
    if (!context.dealId) return requirement.fallback ?? [];
    try {
      const { pool } = await import('../../db');
      const result = await pool.query(
        `SELECT sc.id, sc.marina, sc.city, sc.state, sc.sale_price, sc.cap_rate,
                sc.sale_year, sc.wet_slips, sc.total_slips, sc.price_per_slip,
                dsc.is_primary, dsc.notes, dsc.comparison_type, dsc.relevance_score
         FROM deal_sales_comps dsc
         JOIN sales_comps sc ON sc.id = dsc.sales_comp_id
         WHERE dsc.deal_id = $1
         ORDER BY dsc.is_primary DESC, dsc.relevance_score DESC NULLS LAST
         LIMIT 20`,
        [context.dealId]
      );
      const comps = result.rows.map((r: any) => ({
        id: r.id, marinaName: r.marina, city: r.city, state: r.state,
        salePrice: r.sale_price ? Number(r.sale_price) : null,
        capRate: r.cap_rate ? Number(r.cap_rate) : null,
        saleYear: r.sale_year, wetSlips: r.wet_slips, totalSlips: r.total_slips,
        pricePerSlip: r.price_per_slip ? Number(r.price_per_slip) : null,
        isPrimary: r.is_primary, notes: r.notes, comparisonType: r.comparison_type,
        relevanceScore: r.relevance_score,
      }));
      if (requirement.field === 'comps') return comps;
      if (requirement.field === 'primaryComp') return comps.find((c: any) => c.isPrimary) || comps[0] || null;
      if (requirement.field === 'avgSalePrice') {
        const prices = comps.filter((c: any) => c.salePrice).map((c: any) => c.salePrice);
        return prices.length ? prices.reduce((a: number, b: number) => a + b, 0) / prices.length : null;
      }
      if (requirement.field === 'avgCapRate') {
        const rates = comps.filter((c: any) => c.capRate).map((c: any) => c.capRate);
        return rates.length ? rates.reduce((a: number, b: number) => a + b, 0) / rates.length : null;
      }
      return comps;
    } catch (e) {
      console.error('resolveSalesCompsBinding error:', e);
      return requirement.fallback ?? [];
    }
  }

  private async resolveRateCompsBinding(
    requirement: DataBindingRequirement,
    context: BindingContext
  ): Promise<any> {
    if (!context.dealId) return requirement.fallback ?? [];
    try {
      const { pool } = await import('../../db');
      const result = await pool.query(
        `SELECT rc.id, rc.marina, rc.city, rc.state, rc.wet_slip_rate_avg,
                rc.dry_slip_rate_avg, rc.total_slips, rc.occupancy_rate, rc.quality_tier,
                drc.is_primary, drc.notes, drc.comparison_type, drc.relevance_score, drc.rate_variance_percent
         FROM deal_rate_comps drc
         JOIN rate_comps rc ON rc.id = drc.rate_comp_id
         WHERE drc.deal_id = $1
         ORDER BY drc.is_primary DESC, drc.relevance_score DESC NULLS LAST
         LIMIT 20`,
        [context.dealId]
      );
      const comps = result.rows.map((r: any) => ({
        id: r.id, marinaName: r.marina, city: r.city, state: r.state,
        wetSlipRateAvg: r.wet_slip_rate_avg ? Number(r.wet_slip_rate_avg) : null,
        drySlipRateAvg: r.dry_slip_rate_avg ? Number(r.dry_slip_rate_avg) : null,
        totalSlips: r.total_slips, occupancyRate: r.occupancy_rate, qualityTier: r.quality_tier,
        isPrimary: r.is_primary, notes: r.notes, comparisonType: r.comparison_type,
        relevanceScore: r.relevance_score, rateVariancePercent: r.rate_variance_percent,
      }));
      if (requirement.field === 'comps') return comps;
      if (requirement.field === 'primaryComp') return comps.find((c: any) => c.isPrimary) || comps[0] || null;
      if (requirement.field === 'avgWetRate') {
        const rates = comps.filter((c: any) => c.wetSlipRateAvg).map((c: any) => c.wetSlipRateAvg);
        return rates.length ? rates.reduce((a: number, b: number) => a + b, 0) / rates.length : null;
      }
      if (requirement.field === 'avgDryRate') {
        const rates = comps.filter((c: any) => c.drySlipRateAvg).map((c: any) => c.drySlipRateAvg);
        return rates.length ? rates.reduce((a: number, b: number) => a + b, 0) / rates.length : null;
      }
      return comps;
    } catch (e) {
      console.error('resolveRateCompsBinding error:', e);
      return requirement.fallback ?? [];
    }
  }

  
  private async resolveDueDiligenceBinding(
    requirement: DataBindingRequirement,
    context: BindingContext
  ): Promise<any> {
    // DD items would come from a due diligence service/table
    return null;
  }

  // =============================================================================
  // Utility Methods
  // =============================================================================

  private getNestedValue(obj: any, path: string): any {
    if (!obj || !path) return undefined;

    const parts = path.split('.');
    let current = obj;

    for (const part of parts) {
      if (current === null || current === undefined) {
        return undefined;
      }

      // Handle array indexing like "items[0]"
      const arrayMatch = part.match(/^(\w+)\[(\d+)\]$/);
      if (arrayMatch) {
        current = current[arrayMatch[1]];
        if (Array.isArray(current)) {
          current = current[parseInt(arrayMatch[2], 10)];
        } else {
          return undefined;
        }
      } else {
        current = current[part];
      }
    }

    return current;
  }

  private applyTransform(value: any, transform: string): any {
    // Simple transforms - could be expanded with lodash or custom functions
    switch (transform) {
      case 'uppercase':
        return typeof value === 'string' ? value.toUpperCase() : value;
      case 'lowercase':
        return typeof value === 'string' ? value.toLowerCase() : value;
      case 'round':
        return typeof value === 'number' ? Math.round(value) : value;
      case 'floor':
        return typeof value === 'number' ? Math.floor(value) : value;
      case 'ceil':
        return typeof value === 'number' ? Math.ceil(value) : value;
      case 'percent':
        return typeof value === 'number' ? value * 100 : value;
      default:
        return value;
    }
  }
}

export const dataBindingService = new DataBindingService();
