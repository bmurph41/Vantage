import { db } from '../db';
import {
  dashboardWidgets,
  userDashboardLayouts,
} from '@shared/schema';
import { eq, and, inArray, gte, sql as drizzleSql } from 'drizzle-orm';
import type {
  DashboardWidget,
  InsertDashboardWidget,
  UpdateDashboardWidget,
  UserDashboardLayout,
  InsertUserDashboardLayout,
  UpdateUserDashboardLayout,
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
    // Check if layout exists for this persona template
    const existing = await this.getUserDashboardLayout(
      userId,
      orgId,
      data.personaTemplate as string
    );

    if (existing) {
      // Update existing layout
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
          eq(userDashboardLayouts.personaTemplate, data.personaTemplate as any)
        ))
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
   * Get aggregated dashboard data for all modules
   * Optimized with parallel queries and SQL aggregations
   */
  async getAggregatedDashboardData(orgId: string, timeRange: TimeRange = 'all'): Promise<any> {
    try {
      const dateFilter = this.getTimeRangeFilter(timeRange);
      
      // Execute all queries in parallel for performance
      const [
        crmData,
        ddData,
        vdrData,
        compsData,
        docktalkData,
        fuelData,
        shipStoreData,
        rentRollData,
        modelingData,
      ] = await Promise.all([
        this.getCRMData(orgId, dateFilter),
        this.getDDData(orgId, dateFilter),
        this.getVDRData(orgId, dateFilter),
        this.getSalesCompsData(orgId, dateFilter),
        this.getDockTalkData(orgId, dateFilter),
        this.getFuelData(orgId, dateFilter),
        this.getShipStoreData(orgId, dateFilter),
        this.getRentRollData(orgId, dateFilter),
        this.getModelingData(orgId, dateFilter),
      ]);

      return {
        crm: crmData,
        dueDiligence: ddData,
        vdr: vdrData,
        salesComps: compsData,
        docktalk: docktalkData,
        fuel: fuelData,
        shipStore: shipStoreData,
        rentRoll: rentRollData,
        modeling: modelingData,
        timeRange,
      };
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
    
    const docConditions = [eq(vdrDocuments.orgId, orgId)];
    if (dateFilter) {
      docConditions.push(gte(vdrDocuments.createdAt, dateFilter.startDate));
    }
    
    const [docsResult, requestsResult] = await Promise.all([
      db.select({ count: count() }).from(vdrDocuments).where(and(...docConditions)),
      db.select({ 
        pending: sql<number>`COUNT(CASE WHEN ${vdrDataRequestItems.status} IN ('outstanding', 'in_progress') THEN 1 END)` 
      }).from(vdrDataRequestItems)
        .innerJoin(projects, eq(vdrDataRequestItems.vdrProjectId, projects.id))
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
    const { sql, count, avg, desc } = await import('drizzle-orm');
    
    const conditions = [eq(salesComps.orgId, orgId)];
    if (dateFilter) {
      conditions.push(gte(salesComps.createdAt, dateFilter.startDate));
    }
    
    const [statsResult, recentResult] = await Promise.all([
      db.select({
        totalComps: count(),
        avgSalePrice: avg(salesComps.salePrice),
      }).from(salesComps).where(and(...conditions)),
      db.select().from(salesComps).where(and(...conditions)).orderBy(desc(salesComps.saleYear), desc(salesComps.saleMonth)).limit(5),
    ]);

    return {
      totalComps: Number(statsResult[0]?.totalComps) || 0,
      avgPricePerSlip: Math.round(Number(statsResult[0]?.avgSalePrice) || 0),
      recentComps: recentResult,
    };
  }

  private async getDockTalkData(orgId: string, dateFilter: TimeRangeFilter | null) {
    const { docktalkDeals } = await import('@shared/schema');
    const { desc } = await import('drizzle-orm');
    
    let dealQuery = db.select().from(docktalkDeals);
    
    if (dateFilter) {
      dealQuery = dealQuery.where(gte(docktalkDeals.announcedDate, dateFilter.startDate));
    }
    
    const deals = await dealQuery.orderBy(desc(docktalkDeals.announcedDate)).limit(5);

    return {
      recentDeals: deals,
      totalDeals: deals.length,
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
        vacantUnits: sql<number>`COUNT(CASE WHEN ${rentRollEntries.status} = 'vacant' THEN 1 END)`,
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
          gallons: sql<number>`SUM(${fuelSales.gallons})`,
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
}

export const dashboardService = new DashboardService();
