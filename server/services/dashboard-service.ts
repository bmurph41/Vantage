import { db } from '../db';
import {
  dashboardWidgets,
  userDashboardLayouts,
  dashboardModuleMetrics,
  dashboardCustomWidgets,
  dashboardSavedLayouts,
  dashboardWidgetTemplates,
  salesComps,
} from '@shared/schema';
import { eq, and, inArray, gte, lte, isNull, sql as drizzleSql, desc, asc, between } from 'drizzle-orm';
import type {
  DashboardWidget,
  InsertDashboardWidget,
  UpdateDashboardWidget,
  UserDashboardLayout,
  InsertUserDashboardLayout,
  UpdateUserDashboardLayout,
  DashboardModuleMetric,
  InsertDashboardModuleMetric,
  UpdateDashboardModuleMetric,
  DashboardCustomWidget,
  InsertDashboardCustomWidget,
  UpdateDashboardCustomWidget,
  DashboardSavedLayout,
  InsertDashboardSavedLayout,
  UpdateDashboardSavedLayout,
  DashboardWidgetTemplate,
  InsertDashboardWidgetTemplate,
  UpdateDashboardWidgetTemplate,
  WidgetFilters,
} from '@shared/schema';

export type TimeRange = '7d' | '30d' | '90d' | 'ytd' | 'all';

interface TimeRangeFilter {
  startDate: Date;
  endDate: Date;
}

export class DashboardService {
  // ================================================================================
  // TIME RANGE HELPERS
  // ================================================================================

  /**
   * Calculate date range based on time range filter
   */
  private getTimeRangeFilter(timeRange: TimeRange = 'all'): TimeRangeFilter | null {
    if (timeRange === 'all') return null;

    const endDate = new Date();
    const startDate = new Date();

    switch (timeRange) {
      case '7d':
        startDate.setDate(endDate.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(endDate.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(endDate.getDate() - 90);
        break;
      case 'ytd':
        startDate.setMonth(0, 1); // January 1st
        startDate.setHours(0, 0, 0, 0);
        break;
    }

    return { startDate, endDate };
  }

  // ================================================================================
  // WIDGET REGISTRY
  // ================================================================================

  /**
   * Get all dashboard widgets from registry
   */
  async getWidgetRegistry(personaType?: string): Promise<DashboardWidget[]> {
    let widgets = await db
      .select()
      .from(dashboardWidgets);

    // Filter by persona if specified
    if (personaType) {
      widgets = widgets.filter(w => 
        !w.availableToPersonas || 
        w.availableToPersonas.length === 0 || 
        w.availableToPersonas.includes(personaType as any)
      );
    }

    return widgets;
  }

  /**
   * Get widget by key
   */
  async getWidgetByKey(widgetKey: string): Promise<DashboardWidget | null> {
    const [widget] = await db
      .select()
      .from(dashboardWidgets)
      .where(eq(dashboardWidgets.widgetKey, widgetKey))
      .limit(1);

    return widget || null;
  }

  /**
   * Get multiple widgets by keys
   */
  async getWidgetsByKeys(widgetKeys: string[]): Promise<DashboardWidget[]> {
    if (widgetKeys.length === 0) return [];

    const widgets = await db
      .select()
      .from(dashboardWidgets)
      .where(inArray(dashboardWidgets.widgetKey, widgetKeys));

    return widgets;
  }

  /**
   * Create a new widget in registry (admin function)
   */
  async createWidget(data: InsertDashboardWidget): Promise<DashboardWidget> {
    const [widget] = await db
      .insert(dashboardWidgets)
      .values(data)
      .returning();

    return widget;
  }

  /**
   * Update widget in registry (admin function)
   */
  async updateWidget(id: string, data: UpdateDashboardWidget): Promise<DashboardWidget | null> {
    const [widget] = await db
      .update(dashboardWidgets)
      .set(data)
      .where(eq(dashboardWidgets.id, id))
      .returning();

    return widget || null;
  }

  /**
   * Delete widget from registry (admin function)
   */
  async deleteWidget(id: string): Promise<boolean> {
    const result = await db
      .delete(dashboardWidgets)
      .where(eq(dashboardWidgets.id, id));

    return result.rowCount ? result.rowCount > 0 : false;
  }

  // ================================================================================
  // USER DASHBOARD LAYOUTS
  // ================================================================================

  /**
   * Get user's dashboard layout for their persona
   */
  async getUserDashboardLayout(
    userId: string,
    orgId: string,
    personaTemplate?: string
  ): Promise<UserDashboardLayout | null> {
    const conditions = personaTemplate
      ? and(
          eq(userDashboardLayouts.userId, userId),
          eq(userDashboardLayouts.orgId, orgId),
          eq(userDashboardLayouts.personaTemplate, personaTemplate as any)
        )
      : and(
          eq(userDashboardLayouts.userId, userId),
          eq(userDashboardLayouts.orgId, orgId),
          eq(userDashboardLayouts.isDefault, true)
        );

    const [layout] = await db
      .select()
      .from(userDashboardLayouts)
      .where(conditions)
      .limit(1);

    return layout || null;
  }

  /**
   * Get all dashboard layouts for a user
   */
  async getUserDashboardLayouts(userId: string, orgId: string): Promise<UserDashboardLayout[]> {
    const layouts = await db
      .select()
      .from(userDashboardLayouts)
      .where(and(
        eq(userDashboardLayouts.userId, userId),
        eq(userDashboardLayouts.orgId, orgId)
      ));

    return layouts;
  }

  /**
   * Save or update user's dashboard layout
   */
  async saveDashboardLayout(
    userId: string,
    orgId: string,
    data: InsertUserDashboardLayout
  ): Promise<UserDashboardLayout> {
    // Check if layout exists for this persona template (or default layout if personaTemplate is null)
    const existing = await this.getUserDashboardLayout(
      userId,
      orgId,
      data.personaTemplate as string | undefined
    );

    if (existing) {
      // Update existing layout - handle null personaTemplate properly
      const whereCondition = data.personaTemplate
        ? and(
            eq(userDashboardLayouts.userId, userId),
            eq(userDashboardLayouts.orgId, orgId),
            eq(userDashboardLayouts.personaTemplate, data.personaTemplate as any)
          )
        : and(
            eq(userDashboardLayouts.userId, userId),
            eq(userDashboardLayouts.orgId, orgId),
            isNull(userDashboardLayouts.personaTemplate)
          );

      const [updated] = await db
        .update(userDashboardLayouts)
        .set({
          ...data,
          userId,
          orgId,
          lastModified: new Date(),
        })
        .where(whereCondition)
        .returning();

      return updated;
    } else {
      // Create new layout
      const [created] = await db
        .insert(userDashboardLayouts)
        .values({
          ...data,
          userId,
          orgId,
        })
        .returning();

      return created;
    }
  }

  /**
   * Update dashboard layout
   */
  async updateDashboardLayout(
    userId: string,
    orgId: string,
    personaTemplate: string,
    data: UpdateUserDashboardLayout
  ): Promise<UserDashboardLayout | null> {
    const [updated] = await db
      .update(userDashboardLayouts)
      .set({
        ...data,
        userId,
        orgId,
        lastModified: new Date(),
      })
      .where(and(
        eq(userDashboardLayouts.userId, userId),
        eq(userDashboardLayouts.orgId, orgId),
        eq(userDashboardLayouts.personaTemplate, personaTemplate as any)
      ))
      .returning();

    return updated || null;
  }

  /**
   * Delete dashboard layout
   */
  async deleteDashboardLayout(
    userId: string,
    orgId: string,
    personaTemplate?: string
  ): Promise<boolean> {
    const conditions = personaTemplate
      ? and(
          eq(userDashboardLayouts.userId, userId),
          eq(userDashboardLayouts.orgId, orgId),
          eq(userDashboardLayouts.personaTemplate, personaTemplate as any)
        )
      : and(
          eq(userDashboardLayouts.userId, userId),
          eq(userDashboardLayouts.orgId, orgId)
        );

    const result = await db
      .delete(userDashboardLayouts)
      .where(conditions);

    return result.rowCount ? result.rowCount > 0 : false;
  }

  /**
   * Reset dashboard layout to default template
   */
  async resetToDefault(
    userId: string,
    orgId: string,
    personaType: string
  ): Promise<UserDashboardLayout> {
    const defaultTemplate = this.getDefaultTemplate(personaType);
    
    return this.saveDashboardLayout(userId, orgId, {
      personaTemplate: personaType as any,
      layout: defaultTemplate,
      isDefault: true,
    });
  }

  // ================================================================================
  // TEMPLATES
  // ================================================================================

  /**
   * Get pre-configured dashboard template for a persona type
   */
  getDefaultTemplate(personaType: string): any[] {
    const templates: Record<string, any[]> = {
      pe_investor: [
        {
          widgetKey: 'portfolio_kpi',
          position: { x: 0, y: 0 },
          size: { width: 4, height: 1 },
          config: {}
        },
        {
          widgetKey: 'pipeline_health',
          position: { x: 0, y: 1 },
          size: { width: 2, height: 2 },
          config: {}
        },
        {
          widgetKey: 'asset_performance',
          position: { x: 2, y: 1 },
          size: { width: 2, height: 2 },
          config: {}
        },
        {
          widgetKey: 'task_list',
          position: { x: 0, y: 3 },
          size: { width: 2, height: 2 },
          config: { limit: 10 }
        },
        {
          widgetKey: 'market_trends',
          position: { x: 2, y: 3 },
          size: { width: 2, height: 2 },
          config: { timeRange: '6m' }
        }
      ],
      broker: [
        {
          widgetKey: 'active_mandates',
          position: { x: 0, y: 0 },
          size: { width: 2, height: 2 },
          config: {}
        },
        {
          widgetKey: 'commission_pipeline',
          position: { x: 2, y: 0 },
          size: { width: 2, height: 2 },
          config: {}
        },
        {
          widgetKey: 'pipeline_health',
          position: { x: 0, y: 2 },
          size: { width: 2, height: 2 },
          config: {}
        },
        {
          widgetKey: 'recent_deals',
          position: { x: 2, y: 2 },
          size: { width: 2, height: 2 },
          config: { limit: 10 }
        },
        {
          widgetKey: 'market_trends',
          position: { x: 0, y: 4 },
          size: { width: 4, height: 2 },
          config: {}
        }
      ],
      operator: [
        {
          widgetKey: 'fuel_pnl',
          position: { x: 0, y: 0 },
          size: { width: 2, height: 2 },
          config: {}
        },
        {
          widgetKey: 'rent_roll_occupancy',
          position: { x: 2, y: 0 },
          size: { width: 2, height: 2 },
          config: {}
        },
        {
          widgetKey: 'task_list',
          position: { x: 0, y: 2 },
          size: { width: 4, height: 2 },
          config: { limit: 15 }
        }
      ],
      advisor: [
        {
          widgetKey: 'market_trends',
          position: { x: 0, y: 0 },
          size: { width: 4, height: 2 },
          config: {}
        },
        {
          widgetKey: 'portfolio_kpi',
          position: { x: 0, y: 2 },
          size: { width: 4, height: 1 },
          config: {}
        },
        {
          widgetKey: 'recent_deals',
          position: { x: 0, y: 3 },
          size: { width: 2, height: 2 },
          config: { limit: 10 }
        },
        {
          widgetKey: 'task_list',
          position: { x: 2, y: 3 },
          size: { width: 2, height: 2 },
          config: { limit: 10 }
        }
      ]
    };

    return templates[personaType] || templates.pe_investor;
  }

  /**
   * Get template for a persona type (wrapper for API)
   */
  async getTemplateByPersona(personaType: string): Promise<any[]> {
    return this.getDefaultTemplate(personaType);
  }

  // ================================================================================
  // HELPER METHODS
  // ================================================================================

  /**
   * Validate widget layout structure
   */
  validateLayout(layout: any[]): boolean {
    if (!Array.isArray(layout)) return false;

    return layout.every(widget => 
      widget.widgetKey &&
      widget.position &&
      widget.size &&
      typeof widget.position.x === 'number' &&
      typeof widget.position.y === 'number' &&
      typeof widget.size.width === 'number' &&
      typeof widget.size.height === 'number'
    );
  }

  /**
   * Get widget keys from layout
   */
  getWidgetKeysFromLayout(layout: any[]): string[] {
    return layout.map(w => w.widgetKey);
  }

  /**
   * Enrich layout with widget details
   */
  async enrichLayoutWithWidgetDetails(layout: any[]): Promise<any[]> {
    const widgetKeys = this.getWidgetKeysFromLayout(layout);
    const widgets = await this.getWidgetsByKeys(widgetKeys);
    
    const widgetMap = new Map(widgets.map(w => [w.widgetKey, w]));
    
    return layout.map(layoutWidget => ({
      ...layoutWidget,
      widget: widgetMap.get(layoutWidget.widgetKey) || null
    }));
  }

  /**
   * Get aggregated dashboard data for selected modules only
   * Optimized with parallel queries and SQL aggregations
   */
  async getAggregatedDashboardData(orgId: string, timeRange: TimeRange = 'all', selectedModules: string[] | null = null): Promise<any> {
    try {
      const dateFilter = this.getTimeRangeFilter(timeRange);
      
      // Module ID to data fetcher mapping
      const moduleMap: Record<string, () => Promise<any>> = {
        'crm-pipeline': () => this.getCRMData(orgId, dateFilter),
        'due-diligence': () => this.getDDData(orgId, dateFilter),
        'vdr-activity': () => this.getVDRData(orgId, dateFilter),
        'sales-comps': () => this.getSalesCompsData(orgId, dateFilter),
        'docktalk-feed': () => this.getDockTalkData(orgId, dateFilter),
        'fuel-operations': () => this.getFuelData(orgId, dateFilter),
        'ship-store': () => this.getShipStoreData(orgId, dateFilter),
        'rent-roll': () => this.getRentRollData(orgId, dateFilter),
        'modeling-projects': () => this.getModelingData(orgId, dateFilter),
      };
      
      // If no modules specified, fetch all (for backwards compatibility)
      const modulesToFetch = selectedModules || Object.keys(moduleMap);
      
      // Only execute queries for selected modules
      const dataPromises: Record<string, Promise<any>> = {};
      modulesToFetch.forEach(moduleId => {
        if (moduleMap[moduleId]) {
          dataPromises[moduleId] = moduleMap[moduleId]();
        }
      });
      
      const results = await Promise.all(Object.values(dataPromises));
      const moduleKeys = Object.keys(dataPromises);
      
      // Map results back to their module IDs
      const data: Record<string, any> = { timeRange };
      const moduleKeyMap: Record<string, string> = {
        'crm-pipeline': 'crm',
        'due-diligence': 'dueDiligence',
        'vdr-activity': 'vdr',
        'sales-comps': 'salesComps',
        'docktalk-feed': 'docktalk',
        'fuel-operations': 'fuel',
        'ship-store': 'shipStore',
        'rent-roll': 'rentRoll',
        'modeling-projects': 'modeling',
      };
      
      moduleKeys.forEach((moduleId, index) => {
        const dataKey = moduleKeyMap[moduleId] || moduleId;
        data[dataKey] = results[index];
      });

      return data;
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      // Return empty data on error
      return {
        crm: { pipelineValue: 0, activeDeals: 0, wonDeals: 0, winRate: 0 },
        dueDiligence: { activeProjects: 0, completedProjects: 0, totalProjects: 0, completionRate: 0 },
        vdr: { activeDataRooms: 0, totalDocuments: 0, pendingRequests: 0 },
        salesComps: { totalComps: 0, avgPricePerSlip: 0, recentComps: [] },
        docktalk: { recentDeals: [], totalDeals: 0 },
        fuel: { monthlyRevenue: 0, monthlyGallons: 0 },
        shipStore: { monthlyRevenue: 0, monthlyTransactions: 0, avgTransaction: 0, inventoryValue: 0 },
        rentRoll: { totalUnits: 0, occupancyRate: 0, monthlyIncome: 0, vacantUnits: 0 },
        modeling: { activeProjects: 0, completedProjects: 0, totalValuation: 0 },
        timeRange,
      };
    }
  }

  private async getCRMData(orgId: string, dateFilter: TimeRangeFilter | null) {
    const { crmDeals, users } = await import('@shared/schema');
    const { sql, count, sum } = await import('drizzle-orm');
    
    // Build where conditions
    const conditions = [eq(users.orgId, orgId)];
    if (dateFilter) {
      conditions.push(gte(crmDeals.createdAt, dateFilter.startDate));
    }
    
    // Join with users to filter by organization
    const result = await db
      .select({
        totalDeals: count(),
        pipelineValue: sum(crmDeals.value),
        wonDeals: sql<number>`COUNT(CASE WHEN ${crmDeals.stage} = 'closed_won' THEN 1 END)`,
        activeDeals: sql<number>`COUNT(CASE WHEN ${crmDeals.stage} NOT IN ('closed_won', 'closed_lost') THEN 1 END)`,
      })
      .from(crmDeals)
      .innerJoin(users, eq(crmDeals.ownerId, users.id))
      .where(and(...conditions));

    const data = result[0];
    const wonDeals = Number(data.wonDeals) || 0;
    const totalDeals = Number(data.totalDeals) || 0;
    
    return {
      pipelineValue: Number(data.pipelineValue) || 0,
      activeDeals: Number(data.activeDeals) || 0,
      wonDeals,
      winRate: totalDeals > 0 ? Math.round((wonDeals / totalDeals) * 100) : 0,
    };
  }

  private async getDDData(orgId: string, dateFilter: TimeRangeFilter | null) {
    const { projects } = await import('@shared/schema');
    const { sql, count } = await import('drizzle-orm');
    
    const conditions = [eq(projects.orgId, orgId)];
    if (dateFilter) {
      conditions.push(gte(projects.createdAt, dateFilter.startDate));
    }
    
    const result = await db
      .select({
        totalProjects: count(),
        completedProjects: sql<number>`COUNT(CASE WHEN ${projects.status} = 'completed' THEN 1 END)`,
        activeProjects: sql<number>`COUNT(CASE WHEN ${projects.status} = 'active' THEN 1 END)`,
      })
      .from(projects)
      .where(and(...conditions));

    const data = result[0];
    const totalProjects = Number(data.totalProjects) || 0;
    const completedProjects = Number(data.completedProjects) || 0;
    
    return {
      activeProjects: Number(data.activeProjects) || 0,
      completedProjects,
      totalProjects,
      completionRate: totalProjects > 0 ? Math.round((completedProjects / totalProjects) * 100) : 0,
    };
  }

  private async getVDRData(orgId: string, dateFilter: TimeRangeFilter | null) {
    const { vdrDocuments, vdrDataRequestItems, projects } = await import('@shared/schema');
    const { sql, count } = await import('drizzle-orm');
    
    // Filter out soft-deleted documents
    const docConditions = [eq(vdrDocuments.orgId, orgId), isNull(vdrDocuments.deletedAt)];
    if (dateFilter) {
      docConditions.push(gte(vdrDocuments.createdAt, dateFilter.startDate));
    }
    
    const [docsResult, requestsResult] = await Promise.all([
      db.select({ count: count() }).from(vdrDocuments).where(and(...docConditions)),
      db.select({ 
        pending: sql<number>`COUNT(CASE WHEN ${vdrDataRequestItems.status} IN ('outstanding', 'in_progress') THEN 1 END)` 
      }).from(vdrDataRequestItems)
        .innerJoin(projects, eq(vdrDataRequestItems.projectId, projects.id))
        .where(eq(projects.orgId, orgId)),
    ]);

    // Count active DD projects as active data rooms
    const projectsResult = await db.select({ count: count() })
      .from(projects)
      .where(and(eq(projects.orgId, orgId), eq(projects.status, 'active')));

    return {
      activeDataRooms: Number(projectsResult[0]?.count) || 0,
      totalDocuments: Number(docsResult[0]?.count) || 0,
      pendingRequests: Number(requestsResult[0]?.pending) || 0,
    };
  }

  private async getSalesCompsData(orgId: string, dateFilter: TimeRangeFilter | null) {
    const { salesComps } = await import('@shared/schema');
    const { sql, count, desc } = await import('drizzle-orm');
    
    // Filter out soft-deleted records
    const conditions = [eq(salesComps.orgId, orgId), isNull(salesComps.deletedAt)];
    if (dateFilter) {
      conditions.push(gte(salesComps.createdAt, dateFilter.startDate));
    }
    
    // Calculate average using salePrice OR estimatedPurchasePrice, only for deals that have at least one
    const [statsResult, recentResult] = await Promise.all([
      db.select({
        totalComps: count(),
        sumPrice: sql<number>`SUM(COALESCE(${salesComps.salePrice}, ${salesComps.estimatedPurchasePrice}))`,
        countWithPrice: sql<number>`COUNT(CASE WHEN ${salesComps.salePrice} IS NOT NULL OR ${salesComps.estimatedPurchasePrice} IS NOT NULL THEN 1 END)`,
      }).from(salesComps).where(and(...conditions)),
      db.select().from(salesComps).where(and(...conditions)).orderBy(desc(salesComps.createdAt)).limit(5),
    ]);

    const sumPrice = Number(statsResult[0]?.sumPrice) || 0;
    const countWithPrice = Number(statsResult[0]?.countWithPrice) || 0;
    const avgSalePrice = countWithPrice > 0 ? sumPrice / countWithPrice : 0;

    return {
      totalComps: Number(statsResult[0]?.totalComps) || 0,
      avgPricePerSlip: Math.round(avgSalePrice),
      recentComps: recentResult,
    };
  }

  private async getDockTalkData(orgId: string, dateFilter: TimeRangeFilter | null) {
    const { docktalkDeals } = await import('@shared/schema');
    const { desc, count } = await import('drizzle-orm');
    
    // Filter out soft-deleted deals
    const conditions: any[] = [isNull(docktalkDeals.deletedAt)];
    if (dateFilter) {
      conditions.push(gte(docktalkDeals.announcedDate, dateFilter.startDate));
    }
    
    const [deals, totalResult] = await Promise.all([
      db.select().from(docktalkDeals).where(and(...conditions)).orderBy(desc(docktalkDeals.announcedDate)).limit(5),
      db.select({ count: count() }).from(docktalkDeals).where(and(...conditions)),
    ]);

    return {
      recentDeals: deals,
      totalDeals: Number(totalResult[0]?.count) || 0,
    };
  }

  private async getFuelData(orgId: string, dateFilter: TimeRangeFilter | null) {
    const { fuelSales } = await import('@shared/schema');
    const { sql, sum } = await import('drizzle-orm');
    
    const startDate = dateFilter ? dateFilter.startDate : (() => {
      const d = new Date();
      d.setDate(d.getDate() - 30);
      return d;
    })();
    
    const result = await db
      .select({
        revenue: sum(fuelSales.totalAmount),
        gallons: sum(fuelSales.quantityGallons),
      })
      .from(fuelSales)
      .where(
        and(
          eq(fuelSales.orgId, orgId),
          gte(fuelSales.transactionDate, startDate)
        )
      );

    return {
      monthlyRevenue: Number(result[0]?.revenue) || 0,
      monthlyGallons: Number(result[0]?.gallons) || 0,
    };
  }

  private async getShipStoreData(orgId: string, dateFilter: TimeRangeFilter | null) {
    const { shipStoreTransactions, shipStoreProducts } = await import('@shared/schema');
    const { sql, sum, count, avg } = await import('drizzle-orm');
    
    const startDate = dateFilter ? dateFilter.startDate : (() => {
      const d = new Date();
      d.setDate(d.getDate() - 30);
      return d;
    })();
    
    // Ship store doesn't have orgId filtering - returns global data
    // TODO: Add orgId field to ship store tables for multi-tenant support
    const [transResult, inventoryResult] = await Promise.all([
      db.select({
        revenue: sum(shipStoreTransactions.total),
        transactions: count(),
        avgTransaction: avg(shipStoreTransactions.total),
      }).from(shipStoreTransactions)
        .where(gte(shipStoreTransactions.createdAt, startDate)),
      db.select({
        inventoryValue: sql<number>`SUM(${shipStoreProducts.stock} * ${shipStoreProducts.price})`,
      }).from(shipStoreProducts),
    ]);

    return {
      monthlyRevenue: Number(transResult[0]?.revenue) || 0,
      monthlyTransactions: Number(transResult[0]?.transactions) || 0,
      avgTransaction: Number(transResult[0]?.avgTransaction) || 0,
      inventoryValue: Number(inventoryResult[0]?.inventoryValue) || 0,
    };
  }

  private async getRentRollData(orgId: string, dateFilter: TimeRangeFilter | null) {
    const { rentRollEntries } = await import('@shared/schema');
    const { sql, count, sum } = await import('drizzle-orm');
    
    // Rent roll is generally current state, but we can filter by creation date for time-based analysis
    const conditions = [eq(rentRollEntries.orgId, orgId)];
    if (dateFilter) {
      conditions.push(gte(rentRollEntries.createdAt, dateFilter.startDate));
    }
    
    const result = await db
      .select({
        totalUnits: count(),
        occupiedUnits: sql<number>`COUNT(CASE WHEN ${rentRollEntries.status} = 'active' THEN 1 END)`,
        vacantUnits: sql<number>`COUNT(CASE WHEN ${rentRollEntries.status} IN ('expired', 'terminated') THEN 1 END)`,
        monthlyIncome: sum(rentRollEntries.monthlyRate),
      })
      .from(rentRollEntries)
      .where(and(...conditions));

    const data = result[0];
    const totalUnits = Number(data.totalUnits) || 0;
    const occupiedUnits = Number(data.occupiedUnits) || 0;
    
    return {
      totalUnits,
      occupancyRate: totalUnits > 0 ? Math.round((occupiedUnits / totalUnits) * 100) : 0,
      monthlyIncome: Number(data.monthlyIncome) || 0,
      vacantUnits: Number(data.vacantUnits) || 0,
    };
  }

  private async getModelingData(orgId: string, dateFilter: TimeRangeFilter | null) {
    const { modelingProjects } = await import('@shared/schema');
    const { sql, count, sum } = await import('drizzle-orm');
    
    const conditions = [eq(modelingProjects.orgId, orgId)];
    if (dateFilter) {
      conditions.push(gte(modelingProjects.createdAt, dateFilter.startDate));
    }
    
    const result = await db
      .select({
        totalProjects: count(),
        completedProjects: sql<number>`COUNT(CASE WHEN ${modelingProjects.dealOutcome} = 'won' THEN 1 END)`,
        activeProjects: sql<number>`COUNT(CASE WHEN ${modelingProjects.dealOutcome} = 'active' THEN 1 END)`,
        totalValuation: sum(modelingProjects.purchasePrice),
      })
      .from(modelingProjects)
      .where(and(...conditions));

    return {
      activeProjects: Number(result[0]?.activeProjects) || 0,
      completedProjects: Number(result[0]?.completedProjects) || 0,
      totalValuation: Number(result[0]?.totalValuation) || 0,
    };
  }

  // ================================================================================
  // TREND DATA FOR CHARTS
  // ================================================================================

  /**
   * Get CRM pipeline trend data (daily aggregates)
   */
  async getCRMTrendData(orgId: string, timeRange: TimeRange = '30d') {
    const { crmDeals, users } = await import('@shared/schema');
    const { sql } = await import('drizzle-orm');
    
    const dateFilter = this.getTimeRangeFilter(timeRange);
    if (!dateFilter) {
      return [];
    }

    const conditions = [eq(users.orgId, orgId), gte(crmDeals.createdAt, dateFilter.startDate)];
    
    const result = await db
      .select({
        date: sql<string>`DATE(${crmDeals.createdAt})`,
        pipelineValue: sql<number>`SUM(${crmDeals.value})`,
        dealCount: sql<number>`COUNT(*)`,
      })
      .from(crmDeals)
      .innerJoin(users, eq(crmDeals.ownerId, users.id))
      .where(and(...conditions))
      .groupBy(sql`DATE(${crmDeals.createdAt})`)
      .orderBy(sql`DATE(${crmDeals.createdAt})`);

    return result.map(row => ({
      date: row.date,
      value: Number(row.pipelineValue) || 0,
      count: Number(row.dealCount) || 0,
    }));
  }

  /**
   * Get deal stage distribution for pie chart
   */
  async getCRMStageDistribution(orgId: string, timeRange: TimeRange = '30d') {
    const { crmDeals, users } = await import('@shared/schema');
    const { sql } = await import('drizzle-orm');
    
    const dateFilter = this.getTimeRangeFilter(timeRange);
    const conditions = [eq(users.orgId, orgId)];
    if (dateFilter) {
      conditions.push(gte(crmDeals.createdAt, dateFilter.startDate));
    }
    
    const result = await db
      .select({
        stage: crmDeals.stage,
        count: sql<number>`COUNT(*)`,
      })
      .from(crmDeals)
      .innerJoin(users, eq(crmDeals.ownerId, users.id))
      .where(and(...conditions))
      .groupBy(crmDeals.stage);

    return result.map(row => ({
      name: row.stage || 'Unknown',
      value: Number(row.count) || 0,
    }));
  }

  /**
   * Get revenue trend data for financial modules
   */
  async getRevenueTrendData(orgId: string, module: 'fuel' | 'shipStore', timeRange: TimeRange = '30d') {
    const dateFilter = this.getTimeRangeFilter(timeRange);
    if (!dateFilter) {
      return [];
    }

    if (module === 'fuel') {
      const { fuelSales } = await import('@shared/schema');
      const { sql } = await import('drizzle-orm');
      
      const result = await db
        .select({
          date: sql<string>`DATE(${fuelSales.transactionDate})`,
          revenue: sql<number>`SUM(${fuelSales.totalAmount})`,
          gallons: sql<number>`SUM(${fuelSales.quantityGallons})`,
        })
        .from(fuelSales)
        .where(and(
          eq(fuelSales.orgId, orgId),
          gte(fuelSales.transactionDate, dateFilter.startDate)
        ))
        .groupBy(sql`DATE(${fuelSales.transactionDate})`)
        .orderBy(sql`DATE(${fuelSales.transactionDate})`);

      return result.map(row => ({
        date: row.date,
        revenue: Number(row.revenue) || 0,
        volume: Number(row.gallons) || 0,
      }));
    } else {
      const { shipStoreTransactions } = await import('@shared/schema');
      const { sql } = await import('drizzle-orm');
      
      const result = await db
        .select({
          date: sql<string>`DATE(${shipStoreTransactions.createdAt})`,
          revenue: sql<number>`SUM(${shipStoreTransactions.total})`,
          transactions: sql<number>`COUNT(*)`,
        })
        .from(shipStoreTransactions)
        .where(gte(shipStoreTransactions.createdAt, dateFilter.startDate))
        .groupBy(sql`DATE(${shipStoreTransactions.createdAt})`)
        .orderBy(sql`DATE(${shipStoreTransactions.createdAt})`);

      return result.map(row => ({
        date: row.date,
        revenue: Number(row.revenue) || 0,
        count: Number(row.transactions) || 0,
      }));
    }
  }

  /**
   * Generate preview data for custom module based on configuration
   */
  async generateModulePreview(
    orgId: string,
    visualizationType: string,
    moduleType: string,
    config: any
  ) {
    const timeRange = config.timeframe?.start?.replace('-', '') || '30d';
    const dateFilter = this.getTimeRangeFilter(timeRange as TimeRange);

    switch (moduleType) {
      case 'crm': {
        const { deals } = await import('@shared/schema');
        const { sql } = await import('drizzle-orm');

        if (visualizationType === 'kpi_card') {
          const [result] = await db
            .select({ total: sql<number>`SUM(COALESCE(${deals.value}, 0))` })
            .from(deals)
            .where(eq(deals.orgId, orgId));
          
          return {
            kpiValue: Number(result?.total) || 0,
            trend: { value: 12.5, label: 'vs last period' },
          };
        }

        if (visualizationType === 'pie_chart') {
          const statusData = await db
            .select({
              name: deals.stage,
              value: sql<number>`COUNT(*)`,
            })
            .from(deals)
            .where(eq(deals.orgId, orgId))
            .groupBy(deals.stage);

          return {
            pieData: statusData.map(row => ({
              name: row.name || 'Unknown',
              value: Number(row.value) || 0,
            })),
          };
        }

        if (['line_chart', 'area_chart', 'bar_chart'].includes(visualizationType)) {
          if (!dateFilter) {
            return { chartData: [] };
          }

          const trendData = await db
            .select({
              date: sql<string>`DATE(${deals.createdAt})`,
              value: sql<number>`SUM(COALESCE(${deals.value}, 0))`,
            })
            .from(deals)
            .where(and(
              eq(deals.orgId, orgId),
              gte(deals.createdAt, dateFilter.startDate)
            ))
            .groupBy(sql`DATE(${deals.createdAt})`)
            .orderBy(sql`DATE(${deals.createdAt})`);

          return {
            chartData: trendData.map(row => ({
              name: row.date,
              value: Number(row.value) || 0,
            })),
          };
        }

        break;
      }

      case 'fuel': {
        const { fuelSales } = await import('@shared/schema');
        const { sql } = await import('drizzle-orm');

        if (visualizationType === 'kpi_card') {
          const [result] = await db
            .select({ total: sql<number>`SUM(${fuelSales.totalAmount})` })
            .from(fuelSales)
            .where(eq(fuelSales.orgId, orgId));
          
          return {
            kpiValue: Number(result?.total) || 0,
          };
        }

        if (['line_chart', 'area_chart', 'bar_chart', 'combo_chart'].includes(visualizationType)) {
          if (!dateFilter) {
            return { chartData: [] };
          }

          const trendData = await db
            .select({
              date: sql<string>`DATE(${fuelSales.transactionDate})`,
              revenue: sql<number>`SUM(${fuelSales.totalAmount})`,
              gallons: sql<number>`SUM(${fuelSales.quantityGallons})`,
            })
            .from(fuelSales)
            .where(and(
              eq(fuelSales.orgId, orgId),
              gte(fuelSales.transactionDate, dateFilter.startDate)
            ))
            .groupBy(sql`DATE(${fuelSales.transactionDate})`)
            .orderBy(sql`DATE(${fuelSales.transactionDate})`);

          return {
            chartData: trendData.map(row => ({
              name: row.date,
              revenue: Number(row.revenue) || 0,
              gallons: Number(row.gallons) || 0,
            })),
          };
        }

        break;
      }

      case 'shipStore': {
        const { shipStoreTransactions } = await import('@shared/schema');
        const { sql } = await import('drizzle-orm');

        if (visualizationType === 'kpi_card') {
          const [result] = await db
            .select({ total: sql<number>`SUM(${shipStoreTransactions.total})` })
            .from(shipStoreTransactions)
            .where(eq(shipStoreTransactions.orgId, orgId));
          
          return {
            kpiValue: Number(result?.total) || 0,
          };
        }

        if (visualizationType === 'goal_tracker') {
          const [result] = await db
            .select({ total: sql<number>`SUM(${shipStoreTransactions.total})` })
            .from(shipStoreTransactions)
            .where(dateFilter ? and(
              eq(shipStoreTransactions.orgId, orgId),
              gte(shipStoreTransactions.createdAt, dateFilter.startDate)
            ) : eq(shipStoreTransactions.orgId, orgId));
          
          return {
            currentValue: Number(result?.total) || 0,
          };
        }

        break;
      }

      case 'dueDiligence': {
        const { tasks } = await import('@shared/schema');
        const { sql } = await import('drizzle-orm');

        if (visualizationType === 'stat_grid') {
          const [total] = await db
            .select({ count: sql<number>`COUNT(*)` })
            .from(tasks)
            .where(eq(tasks.orgId, orgId));

          const [completed] = await db
            .select({ count: sql<number>`COUNT(*)` })
            .from(tasks)
            .where(and(
              eq(tasks.orgId, orgId),
              eq(tasks.status, 'completed')
            ));

          const [inProgress] = await db
            .select({ count: sql<number>`COUNT(*)` })
            .from(tasks)
            .where(and(
              eq(tasks.orgId, orgId),
              eq(tasks.status, 'in_progress')
            ));

          return {
            stats: [
              { label: 'Total Tasks', value: Number(total?.count) || 0, format: 'number' },
              { label: 'Completed', value: Number(completed?.count) || 0, format: 'number' },
              { label: 'In Progress', value: Number(inProgress?.count) || 0, format: 'number' },
            ],
          };
        }

        break;
      }

      case 'rentRoll': {
        const { rentRollEntries } = await import('@shared/schema');
        const { sql } = await import('drizzle-orm');

        if (visualizationType === 'kpi_card') {
          const [occupied] = await db
            .select({ count: sql<number>`COUNT(*)` })
            .from(rentRollEntries)
            .where(and(
              eq(rentRollEntries.orgId, orgId),
              eq(rentRollEntries.status, 'occupied')
            ));

          const [total] = await db
            .select({ count: sql<number>`COUNT(*)` })
            .from(rentRollEntries)
            .where(eq(rentRollEntries.orgId, orgId));

          const occupancyRate = total?.count ? ((Number(occupied?.count) || 0) / Number(total.count)) * 100 : 0;
          
          return {
            kpiValue: occupancyRate,
          };
        }

        break;
      }
    }

    return {
      chartData: [],
      kpiValue: 0,
      message: 'Preview data generation for this combination is not yet available',
    };
  }

  // ================================================================================
  // WIDGET CUSTOMIZATION SYSTEM - Institutional-Grade Dashboard Framework
  // ================================================================================

  // --------------------------------------------------------------------------------
  // Module Metrics Registry
  // --------------------------------------------------------------------------------

  /**
   * Get all available metrics for a module
   */
  async getModuleMetrics(moduleKey?: string): Promise<DashboardModuleMetric[]> {
    const conditions = moduleKey
      ? and(
          eq(dashboardModuleMetrics.moduleKey, moduleKey),
          eq(dashboardModuleMetrics.isActive, true)
        )
      : eq(dashboardModuleMetrics.isActive, true);

    const metrics = await db
      .select()
      .from(dashboardModuleMetrics)
      .where(conditions)
      .orderBy(asc(dashboardModuleMetrics.displayOrder));

    return metrics;
  }

  /**
   * Get metric by module and key
   */
  async getMetricByKey(moduleKey: string, metricKey: string): Promise<DashboardModuleMetric | null> {
    const [metric] = await db
      .select()
      .from(dashboardModuleMetrics)
      .where(and(
        eq(dashboardModuleMetrics.moduleKey, moduleKey),
        eq(dashboardModuleMetrics.metricKey, metricKey)
      ))
      .limit(1);

    return metric || null;
  }

  /**
   * Initialize metric registry with default metrics for all modules
   */
  async initializeMetricRegistry(): Promise<void> {
    const defaultMetrics: InsertDashboardModuleMetric[] = [
      // Sales Comps metrics
      {
        moduleKey: 'sales_comps',
        metricKey: 'total_count',
        title: 'Total Comparables',
        description: 'Total number of sales comparables in the database',
        aggregationType: 'count',
        valueType: 'number',
        icon: 'BarChart3',
        filterDimensions: ['year', 'state', 'region', 'water_type', 'profit_center'],
        groupableDimensions: ['year', 'quarter', 'state', 'region'],
        comparisonOptions: ['yoy', 'prior_period'],
        metricGroup: 'volume',
        displayOrder: 1,
      },
      {
        moduleKey: 'sales_comps',
        metricKey: 'avg_price',
        title: 'Average Sale Price',
        description: 'Average sale price across all comparables',
        aggregationType: 'avg',
        valueType: 'currency',
        icon: 'DollarSign',
        filterDimensions: ['year', 'state', 'region', 'water_type', 'profit_center'],
        groupableDimensions: ['year', 'quarter', 'state', 'region'],
        comparisonOptions: ['yoy', 'mom', 'prior_period'],
        metricGroup: 'pricing',
        displayOrder: 2,
      },
      {
        moduleKey: 'sales_comps',
        metricKey: 'median_price',
        title: 'Median Sale Price',
        description: 'Median sale price across all comparables',
        aggregationType: 'median',
        valueType: 'currency',
        icon: 'DollarSign',
        filterDimensions: ['year', 'state', 'region', 'water_type', 'profit_center'],
        groupableDimensions: ['year', 'quarter', 'state', 'region'],
        comparisonOptions: ['yoy', 'prior_period'],
        metricGroup: 'pricing',
        displayOrder: 3,
      },
      {
        moduleKey: 'sales_comps',
        metricKey: 'avg_price_per_slip',
        title: 'Avg. Price Per Slip',
        description: 'Average sale price per slip',
        aggregationType: 'avg',
        valueType: 'currency',
        icon: 'Anchor',
        filterDimensions: ['year', 'state', 'region', 'water_type'],
        groupableDimensions: ['year', 'quarter', 'state', 'region'],
        comparisonOptions: ['yoy', 'prior_period'],
        metricGroup: 'pricing',
        displayOrder: 4,
      },
      {
        moduleKey: 'sales_comps',
        metricKey: 'avg_cap_rate',
        title: 'Average Cap Rate',
        description: 'Average capitalization rate',
        aggregationType: 'avg',
        valueType: 'percentage',
        icon: 'Percent',
        filterDimensions: ['year', 'state', 'region', 'water_type'],
        groupableDimensions: ['year', 'quarter', 'state', 'region'],
        comparisonOptions: ['yoy', 'prior_period'],
        metricGroup: 'performance',
        displayOrder: 5,
      },
      {
        moduleKey: 'sales_comps',
        metricKey: 'total_volume',
        title: 'Total Transaction Volume',
        description: 'Sum of all sale prices',
        aggregationType: 'sum',
        valueType: 'currency',
        icon: 'TrendingUp',
        filterDimensions: ['year', 'state', 'region', 'water_type'],
        groupableDimensions: ['year', 'quarter', 'state', 'region'],
        comparisonOptions: ['yoy', 'prior_period'],
        metricGroup: 'volume',
        displayOrder: 6,
      },
      // Rate Comps metrics
      {
        moduleKey: 'rate_comps',
        metricKey: 'total_count',
        title: 'Total Rate Comparables',
        description: 'Number of rate comparables in database',
        aggregationType: 'count',
        valueType: 'number',
        icon: 'BarChart3',
        filterDimensions: ['year', 'state', 'region', 'slip_size'],
        groupableDimensions: ['year', 'state', 'region'],
        comparisonOptions: ['yoy', 'prior_period'],
        metricGroup: 'volume',
        displayOrder: 1,
      },
      {
        moduleKey: 'rate_comps',
        metricKey: 'avg_rate_per_foot',
        title: 'Avg. Rate Per Foot',
        description: 'Average rate per linear foot',
        aggregationType: 'avg',
        valueType: 'currency',
        icon: 'Ruler',
        filterDimensions: ['year', 'state', 'region', 'slip_size'],
        groupableDimensions: ['year', 'quarter', 'state'],
        comparisonOptions: ['yoy', 'prior_period'],
        metricGroup: 'pricing',
        displayOrder: 2,
      },
      // Demographics metrics
      {
        moduleKey: 'demographics',
        metricKey: 'locations_analyzed',
        title: 'Locations Analyzed',
        description: 'Number of locations with demographic data',
        aggregationType: 'count',
        valueType: 'number',
        icon: 'MapPin',
        filterDimensions: ['state', 'region'],
        groupableDimensions: ['state', 'region'],
        comparisonOptions: [],
        metricGroup: 'activity',
        displayOrder: 1,
      },
      {
        moduleKey: 'demographics',
        metricKey: 'avg_population',
        title: 'Avg. Trade Area Population',
        description: 'Average population in trade areas',
        aggregationType: 'avg',
        valueType: 'number',
        icon: 'Users',
        filterDimensions: ['state', 'region', 'trade_area_miles'],
        groupableDimensions: ['state', 'region'],
        comparisonOptions: [],
        metricGroup: 'market',
        displayOrder: 2,
      },
      {
        moduleKey: 'demographics',
        metricKey: 'avg_median_income',
        title: 'Avg. Median Income',
        description: 'Average median household income in trade areas',
        aggregationType: 'avg',
        valueType: 'currency',
        icon: 'DollarSign',
        filterDimensions: ['state', 'region', 'trade_area_miles'],
        groupableDimensions: ['state', 'region'],
        comparisonOptions: [],
        metricGroup: 'market',
        displayOrder: 3,
      },
      // DockTalk metrics
      {
        moduleKey: 'docktalk',
        metricKey: 'total_deals',
        title: 'Tracked Deals',
        description: 'Number of M&A deals being tracked',
        aggregationType: 'count',
        valueType: 'number',
        icon: 'FileText',
        filterDimensions: ['year', 'status'],
        groupableDimensions: ['year', 'quarter', 'status'],
        comparisonOptions: ['yoy', 'prior_period'],
        metricGroup: 'activity',
        displayOrder: 1,
      },
      {
        moduleKey: 'docktalk',
        metricKey: 'articles_today',
        title: 'Articles Today',
        description: 'Number of articles processed today',
        aggregationType: 'count',
        valueType: 'number',
        icon: 'Newspaper',
        filterDimensions: [],
        groupableDimensions: [],
        comparisonOptions: ['prior_period'],
        metricGroup: 'activity',
        displayOrder: 2,
      },
      // VDR metrics
      {
        moduleKey: 'vdr',
        metricKey: 'active_rooms',
        title: 'Active Data Rooms',
        description: 'Number of active virtual data rooms',
        aggregationType: 'count',
        valueType: 'number',
        icon: 'Database',
        filterDimensions: ['status'],
        groupableDimensions: ['status'],
        comparisonOptions: ['prior_period'],
        metricGroup: 'activity',
        displayOrder: 1,
      },
      {
        moduleKey: 'vdr',
        metricKey: 'total_documents',
        title: 'Total Documents',
        description: 'Number of documents in all data rooms',
        aggregationType: 'count',
        valueType: 'number',
        icon: 'File',
        filterDimensions: ['status', 'category'],
        groupableDimensions: ['category'],
        comparisonOptions: ['yoy', 'prior_period'],
        metricGroup: 'volume',
        displayOrder: 2,
      },
      // Fuel metrics
      {
        moduleKey: 'fuel',
        metricKey: 'total_gallons',
        title: 'Total Gallons Sold',
        description: 'Total gallons of fuel sold',
        aggregationType: 'sum',
        valueType: 'number',
        icon: 'Fuel',
        filterDimensions: ['year', 'month', 'fuel_type', 'marina'],
        groupableDimensions: ['year', 'quarter', 'month', 'fuel_type', 'marina'],
        comparisonOptions: ['yoy', 'mom', 'prior_period'],
        metricGroup: 'volume',
        displayOrder: 1,
      },
      {
        moduleKey: 'fuel',
        metricKey: 'total_revenue',
        title: 'Fuel Revenue',
        description: 'Total revenue from fuel sales',
        aggregationType: 'sum',
        valueType: 'currency',
        icon: 'DollarSign',
        filterDimensions: ['year', 'month', 'fuel_type', 'marina'],
        groupableDimensions: ['year', 'quarter', 'month', 'fuel_type', 'marina'],
        comparisonOptions: ['yoy', 'mom', 'prior_period'],
        metricGroup: 'revenue',
        displayOrder: 2,
      },
      // Ship Store metrics
      {
        moduleKey: 'ship_store',
        metricKey: 'total_transactions',
        title: 'Total Transactions',
        description: 'Number of store transactions',
        aggregationType: 'count',
        valueType: 'number',
        icon: 'ShoppingCart',
        filterDimensions: ['year', 'month', 'category', 'marina'],
        groupableDimensions: ['year', 'quarter', 'month', 'category'],
        comparisonOptions: ['yoy', 'mom', 'prior_period'],
        metricGroup: 'volume',
        displayOrder: 1,
      },
      {
        moduleKey: 'ship_store',
        metricKey: 'total_revenue',
        title: 'Store Revenue',
        description: 'Total revenue from store sales',
        aggregationType: 'sum',
        valueType: 'currency',
        icon: 'DollarSign',
        filterDimensions: ['year', 'month', 'category', 'marina'],
        groupableDimensions: ['year', 'quarter', 'month', 'category'],
        comparisonOptions: ['yoy', 'mom', 'prior_period'],
        metricGroup: 'revenue',
        displayOrder: 2,
      },
      // Rent Roll metrics
      {
        moduleKey: 'rent_roll',
        metricKey: 'occupancy_rate',
        title: 'Occupancy Rate',
        description: 'Percentage of occupied slips',
        aggregationType: 'avg',
        valueType: 'percentage',
        icon: 'Percent',
        filterDimensions: ['marina', 'slip_type'],
        groupableDimensions: ['marina', 'slip_type'],
        comparisonOptions: ['prior_period'],
        metricGroup: 'performance',
        displayOrder: 1,
      },
      {
        moduleKey: 'rent_roll',
        metricKey: 'monthly_revenue',
        title: 'Monthly Revenue',
        description: 'Total monthly rental revenue',
        aggregationType: 'sum',
        valueType: 'currency',
        icon: 'DollarSign',
        filterDimensions: ['marina', 'slip_type'],
        groupableDimensions: ['marina', 'slip_type', 'month'],
        comparisonOptions: ['yoy', 'mom', 'prior_period'],
        metricGroup: 'revenue',
        displayOrder: 2,
      },
      // Modeling metrics
      {
        moduleKey: 'modeling',
        metricKey: 'active_projects',
        title: 'Active Projects',
        description: 'Number of active modeling projects',
        aggregationType: 'count',
        valueType: 'number',
        icon: 'Briefcase',
        filterDimensions: ['status', 'year'],
        groupableDimensions: ['status', 'year'],
        comparisonOptions: ['prior_period'],
        metricGroup: 'activity',
        displayOrder: 1,
      },
      {
        moduleKey: 'modeling',
        metricKey: 'total_aum',
        title: 'Total AUM',
        description: 'Total assets under management across projects',
        aggregationType: 'sum',
        valueType: 'currency',
        icon: 'Building2',
        filterDimensions: ['status', 'year'],
        groupableDimensions: ['status', 'year', 'state'],
        comparisonOptions: ['yoy', 'prior_period'],
        metricGroup: 'portfolio',
        displayOrder: 2,
      },
      // Due Diligence metrics
      {
        moduleKey: 'due_diligence',
        metricKey: 'total_tasks',
        title: 'Total Tasks',
        description: 'Number of DD tasks',
        aggregationType: 'count',
        valueType: 'number',
        icon: 'CheckSquare',
        filterDimensions: ['status', 'project', 'category'],
        groupableDimensions: ['status', 'project', 'category'],
        comparisonOptions: ['prior_period'],
        metricGroup: 'activity',
        displayOrder: 1,
      },
      {
        moduleKey: 'due_diligence',
        metricKey: 'completion_rate',
        title: 'Completion Rate',
        description: 'Percentage of completed tasks',
        aggregationType: 'avg',
        valueType: 'percentage',
        icon: 'Percent',
        filterDimensions: ['project', 'category'],
        groupableDimensions: ['project', 'category'],
        comparisonOptions: ['prior_period'],
        metricGroup: 'performance',
        displayOrder: 2,
      },
      // CRM metrics
      {
        moduleKey: 'crm',
        metricKey: 'active_deals',
        title: 'Active Deals',
        description: 'Number of active deals in pipeline',
        aggregationType: 'count',
        valueType: 'number',
        icon: 'Target',
        filterDimensions: ['stage', 'year'],
        groupableDimensions: ['stage', 'year', 'quarter'],
        comparisonOptions: ['yoy', 'prior_period'],
        metricGroup: 'pipeline',
        displayOrder: 1,
      },
      {
        moduleKey: 'crm',
        metricKey: 'pipeline_value',
        title: 'Pipeline Value',
        description: 'Total value of active deals',
        aggregationType: 'sum',
        valueType: 'currency',
        icon: 'DollarSign',
        filterDimensions: ['stage', 'year'],
        groupableDimensions: ['stage', 'year', 'quarter'],
        comparisonOptions: ['yoy', 'prior_period'],
        metricGroup: 'pipeline',
        displayOrder: 2,
      },
    ];

    // Insert metrics, ignoring duplicates
    for (const metric of defaultMetrics) {
      try {
        await db
          .insert(dashboardModuleMetrics)
          .values(metric)
          .onConflictDoNothing();
      } catch (err) {
        // Ignore duplicate key errors
      }
    }
  }

  // --------------------------------------------------------------------------------
  // Custom Widgets CRUD
  // --------------------------------------------------------------------------------

  /**
   * Get all custom widgets for a user
   */
  async getUserCustomWidgets(userId: string, orgId: string): Promise<DashboardCustomWidget[]> {
    const widgets = await db
      .select()
      .from(dashboardCustomWidgets)
      .where(and(
        eq(dashboardCustomWidgets.userId, userId),
        eq(dashboardCustomWidgets.orgId, orgId),
        eq(dashboardCustomWidgets.isVisible, true)
      ))
      .orderBy(asc(dashboardCustomWidgets.sortOrder));

    return widgets;
  }

  /**
   * Get custom widget by ID
   */
  async getCustomWidget(id: string): Promise<DashboardCustomWidget | null> {
    const [widget] = await db
      .select()
      .from(dashboardCustomWidgets)
      .where(eq(dashboardCustomWidgets.id, id))
      .limit(1);

    return widget || null;
  }

  /**
   * Create a custom widget
   */
  async createCustomWidget(
    userId: string,
    orgId: string,
    data: InsertDashboardCustomWidget
  ): Promise<DashboardCustomWidget> {
    const [widget] = await db
      .insert(dashboardCustomWidgets)
      .values({
        ...data,
        userId,
        orgId,
      })
      .returning();

    return widget;
  }

  /**
   * Update a custom widget
   */
  async updateCustomWidget(
    id: string,
    userId: string,
    orgId: string,
    data: UpdateDashboardCustomWidget
  ): Promise<DashboardCustomWidget | null> {
    const [widget] = await db
      .update(dashboardCustomWidgets)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(and(
        eq(dashboardCustomWidgets.id, id),
        eq(dashboardCustomWidgets.userId, userId),
        eq(dashboardCustomWidgets.orgId, orgId)
      ))
      .returning();

    return widget || null;
  }

  /**
   * Delete a custom widget
   */
  async deleteCustomWidget(id: string, userId: string, orgId: string): Promise<boolean> {
    const result = await db
      .delete(dashboardCustomWidgets)
      .where(and(
        eq(dashboardCustomWidgets.id, id),
        eq(dashboardCustomWidgets.userId, userId),
        eq(dashboardCustomWidgets.orgId, orgId)
      ));

    return result.rowCount ? result.rowCount > 0 : false;
  }

  /**
   * Update widget order
   */
  async updateWidgetOrder(
    userId: string,
    orgId: string,
    widgetOrder: Array<{ id: string; sortOrder: number }>
  ): Promise<void> {
    for (const { id, sortOrder } of widgetOrder) {
      await db
        .update(dashboardCustomWidgets)
        .set({ sortOrder, updatedAt: new Date() })
        .where(and(
          eq(dashboardCustomWidgets.id, id),
          eq(dashboardCustomWidgets.userId, userId),
          eq(dashboardCustomWidgets.orgId, orgId)
        ));
    }
  }

  // --------------------------------------------------------------------------------
  // Saved Layouts CRUD
  // --------------------------------------------------------------------------------

  /**
   * Get all saved layouts for a user
   */
  async getUserSavedLayouts(userId: string, orgId: string): Promise<DashboardSavedLayout[]> {
    const layouts = await db
      .select()
      .from(dashboardSavedLayouts)
      .where(and(
        eq(dashboardSavedLayouts.userId, userId),
        eq(dashboardSavedLayouts.orgId, orgId),
        eq(dashboardSavedLayouts.isActive, true)
      ))
      .orderBy(desc(dashboardSavedLayouts.isDefault), asc(dashboardSavedLayouts.layoutName));

    return layouts;
  }

  /**
   * Get a saved layout by ID
   */
  async getSavedLayout(id: string): Promise<DashboardSavedLayout | null> {
    const [layout] = await db
      .select()
      .from(dashboardSavedLayouts)
      .where(eq(dashboardSavedLayouts.id, id))
      .limit(1);

    return layout || null;
  }

  /**
   * Get default saved layout for a user
   */
  async getDefaultSavedLayout(userId: string, orgId: string): Promise<DashboardSavedLayout | null> {
    const [layout] = await db
      .select()
      .from(dashboardSavedLayouts)
      .where(and(
        eq(dashboardSavedLayouts.userId, userId),
        eq(dashboardSavedLayouts.orgId, orgId),
        eq(dashboardSavedLayouts.isDefault, true)
      ))
      .limit(1);

    return layout || null;
  }

  /**
   * Create a saved layout
   */
  async createSavedLayout(
    userId: string,
    orgId: string,
    data: InsertDashboardSavedLayout
  ): Promise<DashboardSavedLayout> {
    // If this is marked as default, unset other defaults
    if (data.isDefault) {
      await db
        .update(dashboardSavedLayouts)
        .set({ isDefault: false })
        .where(and(
          eq(dashboardSavedLayouts.userId, userId),
          eq(dashboardSavedLayouts.orgId, orgId)
        ));
    }

    const [layout] = await db
      .insert(dashboardSavedLayouts)
      .values({
        ...data,
        userId,
        orgId,
      })
      .returning();

    return layout;
  }

  /**
   * Update a saved layout
   */
  async updateSavedLayout(
    id: string,
    userId: string,
    orgId: string,
    data: UpdateDashboardSavedLayout
  ): Promise<DashboardSavedLayout | null> {
    // If setting as default, unset other defaults
    if (data.isDefault) {
      await db
        .update(dashboardSavedLayouts)
        .set({ isDefault: false })
        .where(and(
          eq(dashboardSavedLayouts.userId, userId),
          eq(dashboardSavedLayouts.orgId, orgId)
        ));
    }

    const [layout] = await db
      .update(dashboardSavedLayouts)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(and(
        eq(dashboardSavedLayouts.id, id),
        eq(dashboardSavedLayouts.userId, userId),
        eq(dashboardSavedLayouts.orgId, orgId)
      ))
      .returning();

    return layout || null;
  }

  /**
   * Delete a saved layout
   */
  async deleteSavedLayout(id: string, userId: string, orgId: string): Promise<boolean> {
    const result = await db
      .delete(dashboardSavedLayouts)
      .where(and(
        eq(dashboardSavedLayouts.id, id),
        eq(dashboardSavedLayouts.userId, userId),
        eq(dashboardSavedLayouts.orgId, orgId)
      ));

    return result.rowCount ? result.rowCount > 0 : false;
  }

  // --------------------------------------------------------------------------------
  // Widget Templates
  // --------------------------------------------------------------------------------

  /**
   * Get available widget templates
   */
  async getWidgetTemplates(
    moduleKey?: string,
    category?: string
  ): Promise<DashboardWidgetTemplate[]> {
    let conditions = eq(dashboardWidgetTemplates.isActive, true);
    
    if (moduleKey) {
      conditions = and(conditions, eq(dashboardWidgetTemplates.moduleKey, moduleKey)) as any;
    }
    
    if (category) {
      conditions = and(conditions, eq(dashboardWidgetTemplates.category, category)) as any;
    }

    const templates = await db
      .select()
      .from(dashboardWidgetTemplates)
      .where(conditions)
      .orderBy(desc(dashboardWidgetTemplates.popularityScore));

    return templates;
  }

  /**
   * Create widget from template
   */
  async createWidgetFromTemplate(
    userId: string,
    orgId: string,
    templateId: string,
    customName?: string
  ): Promise<DashboardCustomWidget | null> {
    const [template] = await db
      .select()
      .from(dashboardWidgetTemplates)
      .where(eq(dashboardWidgetTemplates.id, templateId))
      .limit(1);

    if (!template) return null;

    // Increment template popularity
    await db
      .update(dashboardWidgetTemplates)
      .set({ popularityScore: (template.popularityScore || 0) + 1 })
      .where(eq(dashboardWidgetTemplates.id, templateId));

    // Create widget from template
    const widget = await this.createCustomWidget(userId, orgId, {
      widgetName: customName || template.templateName,
      moduleKey: template.moduleKey,
      metricKey: template.metricKey,
      filters: template.filters as any,
      timeRangeType: template.timeRangeType || 'current_year',
      timeRangeValue: template.timeRangeValue as any,
      enableComparison: template.enableComparison || false,
      comparisonType: template.comparisonType,
      groupBy: template.groupBy,
      displaySize: template.displaySize as any,
      displayStyle: template.displayStyle || 'card',
      chartType: template.chartType,
      showTrend: template.showTrend ?? true,
      accentColor: template.accentColor,
      icon: template.icon,
      templateId,
    });

    return widget;
  }

  // --------------------------------------------------------------------------------
  // Widget Query Engine - Fetches actual data for widgets
  // --------------------------------------------------------------------------------

  /**
   * Execute widget query and return aggregated data
   */
  async executeWidgetQuery(
    orgId: string,
    moduleKey: string,
    metricKey: string,
    filters: WidgetFilters = {},
    options: {
      timeRangeType?: string;
      timeRangeValue?: any;
      groupBy?: string;
      enableComparison?: boolean;
      comparisonType?: string;
    } = {}
  ): Promise<{
    value: number;
    previousValue?: number;
    trend?: number;
    groupedData?: Array<{ label: string; value: number }>;
    details?: any[];
  }> {
    const { timeRangeType, timeRangeValue, groupBy, enableComparison, comparisonType } = options;

    // Calculate year filter
    let yearFilter: number | null = null;
    let yearRange: { start: number; end: number } | null = null;
    const currentYear = new Date().getFullYear();

    if (filters.year) {
      yearFilter = filters.year;
    } else if (timeRangeType === 'current_year') {
      yearFilter = currentYear;
    } else if (timeRangeType === 'last_n_years' && timeRangeValue?.years) {
      yearRange = {
        start: currentYear - timeRangeValue.years + 1,
        end: currentYear,
      };
    } else if (timeRangeType === 'custom_range' && timeRangeValue?.startYear && timeRangeValue?.endYear) {
      yearRange = {
        start: timeRangeValue.startYear,
        end: timeRangeValue.endYear,
      };
    }

    // Module-specific query execution
    switch (moduleKey) {
      case 'sales_comps':
        return this.executeSalesCompsQuery(orgId, metricKey, filters, yearFilter, yearRange, groupBy, enableComparison, comparisonType);
      
      // Add more module adapters as needed
      default:
        return { value: 0 };
    }
  }

  /**
   * Sales Comps query adapter
   */
  private async executeSalesCompsQuery(
    orgId: string,
    metricKey: string,
    filters: WidgetFilters,
    yearFilter: number | null,
    yearRange: { start: number; end: number } | null,
    groupBy?: string,
    enableComparison?: boolean,
    comparisonType?: string
  ): Promise<{
    value: number;
    previousValue?: number;
    trend?: number;
    groupedData?: Array<{ label: string; value: number }>;
    details?: any[];
  }> {
    // Build base conditions (without year filter) - exclude soft-deleted records
    const baseConditions: any[] = [eq(salesComps.orgId, orgId), isNull(salesComps.deletedAt)];

    if (filters.states && filters.states.length > 0) {
      baseConditions.push(inArray(salesComps.state, filters.states));
    }

    if (filters.waterType) {
      baseConditions.push(eq(salesComps.waterType, filters.waterType));
    }

    // Build current period conditions
    const conditions = [...baseConditions];
    if (yearFilter) {
      conditions.push(eq(salesComps.saleYear, yearFilter));
    } else if (yearRange) {
      conditions.push(between(salesComps.saleYear, yearRange.start, yearRange.end));
    }

    // Build previous period conditions for YoY comparison
    const prevConditions = [...baseConditions];
    if (yearFilter) {
      prevConditions.push(eq(salesComps.saleYear, yearFilter - 1));
    }

    const whereCondition = conditions.length > 1 ? and(...conditions) : conditions[0];
    const prevWhereCondition = prevConditions.length > 1 ? and(...prevConditions) : prevConditions[0];

    // Execute query based on metric type
    let result: { value: number; previousValue?: number; trend?: number; groupedData?: Array<{ label: string; value: number }>; details?: any[] } = { value: 0 };

    switch (metricKey) {
      case 'total_count': {
        const [countResult] = await db
          .select({ count: drizzleSql<number>`COUNT(*)` })
          .from(salesComps)
          .where(whereCondition);
        result.value = Number(countResult?.count) || 0;

        // Get previous period for comparison
        if (enableComparison && comparisonType === 'yoy' && yearFilter) {
          const [prevResult] = await db
            .select({ count: drizzleSql<number>`COUNT(*)` })
            .from(salesComps)
            .where(prevWhereCondition);
          result.previousValue = Number(prevResult?.count) || 0;
          result.trend = result.previousValue > 0 
            ? ((result.value - result.previousValue) / result.previousValue) * 100 
            : (result.value > 0 ? 100 : 0);
        }
        break;
      }

      case 'avg_price': {
        // Use salePrice OR estimatedPurchasePrice, only for deals that have at least one price value
        const [avgResult] = await db
          .select({ 
            sumPrice: drizzleSql<number>`SUM(COALESCE(NULLIF(${salesComps.salePrice}, 0), ${salesComps.estimatedPurchasePrice}))`,
            countWithPrice: drizzleSql<number>`COUNT(CASE WHEN (${salesComps.salePrice} > 0) OR (${salesComps.estimatedPurchasePrice} > 0) THEN 1 END)`
          })
          .from(salesComps)
          .where(whereCondition);
        const sumPrice = Number(avgResult?.sumPrice) || 0;
        const countWithPrice = Number(avgResult?.countWithPrice) || 0;
        result.value = countWithPrice > 0 ? sumPrice / countWithPrice : 0;

        if (enableComparison && comparisonType === 'yoy' && yearFilter) {
          const [prevResult] = await db
            .select({ 
              sumPrice: drizzleSql<number>`SUM(COALESCE(NULLIF(${salesComps.salePrice}, 0), ${salesComps.estimatedPurchasePrice}))`,
              countWithPrice: drizzleSql<number>`COUNT(CASE WHEN (${salesComps.salePrice} > 0) OR (${salesComps.estimatedPurchasePrice} > 0) THEN 1 END)`
            })
            .from(salesComps)
            .where(prevWhereCondition);
          const prevSum = Number(prevResult?.sumPrice) || 0;
          const prevCount = Number(prevResult?.countWithPrice) || 0;
          result.previousValue = prevCount > 0 ? prevSum / prevCount : 0;
          result.trend = result.previousValue > 0 
            ? ((result.value - result.previousValue) / result.previousValue) * 100 
            : (result.value > 0 ? 100 : 0);
        }
        break;
      }

      case 'median_price': {
        // Exclude undisclosed prices ($0, null, or isPriceDisclosed = false)
        const priceConditions = [...conditions, drizzleSql`${salesComps.salePrice} > 0`, drizzleSql`(${salesComps.isPriceDisclosed} = true OR ${salesComps.isPriceDisclosed} IS NULL)`];
        const priceWhereCondition = priceConditions.length > 1 ? and(...priceConditions) : priceConditions[0];
        const [medianResult] = await db
          .select({ median: drizzleSql<number>`PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ${salesComps.salePrice})` })
          .from(salesComps)
          .where(priceWhereCondition);
        result.value = Number(medianResult?.median) || 0;
        break;
      }

      case 'avg_price_per_slip': {
        // Calculate price per slip as salePrice / wetSlips (only for rows with valid wetSlips > 0 and disclosed prices)
        const [avgResult] = await db
          .select({ 
            avg: drizzleSql<number>`AVG(CASE WHEN ${salesComps.wetSlips} > 0 AND ${salesComps.salePrice} > 0 AND (${salesComps.isPriceDisclosed} = true OR ${salesComps.isPriceDisclosed} IS NULL) THEN ${salesComps.salePrice}::decimal / ${salesComps.wetSlips} ELSE NULL END)` 
          })
          .from(salesComps)
          .where(whereCondition);
        result.value = Number(avgResult?.avg) || 0;

        if (enableComparison && comparisonType === 'yoy' && yearFilter) {
          const [prevResult] = await db
            .select({ 
              avg: drizzleSql<number>`AVG(CASE WHEN ${salesComps.wetSlips} > 0 AND ${salesComps.salePrice} > 0 AND (${salesComps.isPriceDisclosed} = true OR ${salesComps.isPriceDisclosed} IS NULL) THEN ${salesComps.salePrice}::decimal / ${salesComps.wetSlips} ELSE NULL END)` 
            })
            .from(salesComps)
            .where(prevWhereCondition);
          result.previousValue = Number(prevResult?.avg) || 0;
          result.trend = result.previousValue > 0 
            ? ((result.value - result.previousValue) / result.previousValue) * 100 
            : (result.value > 0 ? 100 : 0);
        }
        break;
      }

      case 'avg_cap_rate': {
        const [avgResult] = await db
          .select({ avg: drizzleSql<number>`AVG(${salesComps.capRate})` })
          .from(salesComps)
          .where(whereCondition);
        result.value = Number(avgResult?.avg) || 0;
        break;
      }

      case 'total_volume': {
        // Exclude undisclosed prices ($0, null, or isPriceDisclosed = false)
        const [sumResult] = await db
          .select({ sum: drizzleSql<number>`SUM(CASE WHEN ${salesComps.salePrice} > 0 AND (${salesComps.isPriceDisclosed} = true OR ${salesComps.isPriceDisclosed} IS NULL) THEN ${salesComps.salePrice} ELSE 0 END)` })
          .from(salesComps)
          .where(whereCondition);
        result.value = Number(sumResult?.sum) || 0;

        if (enableComparison && comparisonType === 'yoy' && yearFilter) {
          const [prevResult] = await db
            .select({ sum: drizzleSql<number>`SUM(CASE WHEN ${salesComps.salePrice} > 0 AND (${salesComps.isPriceDisclosed} = true OR ${salesComps.isPriceDisclosed} IS NULL) THEN ${salesComps.salePrice} ELSE 0 END)` })
            .from(salesComps)
            .where(prevWhereCondition);
          result.previousValue = Number(prevResult?.sum) || 0;
          result.trend = result.previousValue > 0 
            ? ((result.value - result.previousValue) / result.previousValue) * 100 
            : (result.value > 0 ? 100 : 0);
        }
        break;
      }
    }

    // Handle grouping if requested
    if (groupBy === 'year') {
      const groupedResult = await db
        .select({
          label: salesComps.saleYear,
          value: drizzleSql<number>`COUNT(*)`,
        })
        .from(salesComps)
        .where(eq(salesComps.orgId, orgId))
        .groupBy(salesComps.saleYear)
        .orderBy(asc(salesComps.saleYear));

      result.groupedData = groupedResult.map(r => ({
        label: String(r.label),
        value: Number(r.value),
      }));
    } else if (groupBy === 'state') {
      const groupedResult = await db
        .select({
          label: salesComps.state,
          value: drizzleSql<number>`COUNT(*)`,
        })
        .from(salesComps)
        .where(eq(salesComps.orgId, orgId))
        .groupBy(salesComps.state)
        .orderBy(desc(drizzleSql<number>`COUNT(*)`));

      result.groupedData = groupedResult
        .filter(r => r.label)
        .map(r => ({
          label: String(r.label),
          value: Number(r.value),
        }));
    }

    return result;
  }

  /**
   * Batch execute multiple widget queries
   */
  async batchExecuteWidgetQueries(
    orgId: string,
    widgets: Array<{
      id: string;
      moduleKey: string;
      metricKey: string;
      filters: WidgetFilters;
      options: any;
    }>
  ): Promise<Map<string, any>> {
    const results = new Map<string, any>();

    // Execute queries in parallel with concurrency limit
    const batchSize = 5;
    for (let i = 0; i < widgets.length; i += batchSize) {
      const batch = widgets.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(async (widget) => {
          try {
            const data = await this.executeWidgetQuery(
              orgId,
              widget.moduleKey,
              widget.metricKey,
              widget.filters,
              widget.options
            );
            return { id: widget.id, data };
          } catch (error) {
            console.error(`Error executing widget query ${widget.id}:`, error);
            return { id: widget.id, data: { value: 0, error: true } };
          }
        })
      );

      for (const { id, data } of batchResults) {
        results.set(id, data);
      }
    }

    return results;
  }
}

export const dashboardService = new DashboardService();
