import { db } from '../db';
import {
  dashboardWidgets,
  userDashboardLayouts,
  dashboardModuleMetrics,
  dashboardCustomWidgets,
  dashboardSavedLayouts,
  dashboardWidgetTemplates,
  salesComps,
  rateComps,
  demographicsCache,
  docketDeals,
  vdrDocuments,
  vdrFolders,
  fuelSales,
  shipStoreTransactions,
  rentRolls,
  rentRollEntries,
  modelingProjects,
  projects,
  crmContacts,
  crmCompanies,
  crmDeals,
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

export type TimeRange = '7d' | '30d' | '90d' | 'ytd' | 'all'
  | 'q1' | 'q2' | 'q3' | 'q4'
  | 'jan' | 'feb' | 'mar' | 'apr' | 'may' | 'jun'
  | 'jul' | 'aug' | 'sep' | 'oct' | 'nov' | 'dec'
  | 'last_year' | 'this_year';

interface TimeRangeFilter {
  startDate: Date;
  endDate: Date;
}

const MONTH_MAP: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

export class DashboardService {
  // ================================================================================
  // TIME RANGE HELPERS
  // ================================================================================

  private getTimeRangeFilter(timeRange: TimeRange = 'all'): TimeRangeFilter | null {
    if (timeRange === 'all') return null;

    const now = new Date();
    const currentYear = now.getFullYear();
    let startDate: Date;
    let endDate: Date;

    switch (timeRange) {
      case '7d':
        startDate = new Date(now); startDate.setDate(now.getDate() - 7);
        endDate = now;
        break;
      case '30d':
        startDate = new Date(now); startDate.setDate(now.getDate() - 30);
        endDate = now;
        break;
      case '90d':
        startDate = new Date(now); startDate.setDate(now.getDate() - 90);
        endDate = now;
        break;
      case 'ytd':
        startDate = new Date(currentYear, 0, 1);
        endDate = now;
        break;
      case 'this_year':
        startDate = new Date(currentYear, 0, 1);
        endDate = new Date(currentYear, 11, 31, 23, 59, 59, 999);
        break;
      case 'last_year':
        startDate = new Date(currentYear - 1, 0, 1);
        endDate = new Date(currentYear - 1, 11, 31, 23, 59, 59, 999);
        break;
      case 'q1':
        startDate = new Date(currentYear, 0, 1);
        endDate = new Date(currentYear, 2, 31, 23, 59, 59, 999);
        break;
      case 'q2':
        startDate = new Date(currentYear, 3, 1);
        endDate = new Date(currentYear, 5, 30, 23, 59, 59, 999);
        break;
      case 'q3':
        startDate = new Date(currentYear, 6, 1);
        endDate = new Date(currentYear, 8, 30, 23, 59, 59, 999);
        break;
      case 'q4':
        startDate = new Date(currentYear, 9, 1);
        endDate = new Date(currentYear, 11, 31, 23, 59, 59, 999);
        break;
      default: {
        const monthIdx = MONTH_MAP[timeRange];
        if (monthIdx !== undefined) {
          startDate = new Date(currentYear, monthIdx, 1);
          const nextMonth = monthIdx + 1;
          endDate = new Date(currentYear, nextMonth, 0, 23, 59, 59, 999);
        } else {
          return null;
        }
        break;
      }
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
        'docket-feed': () => this.getDocketData(orgId, dateFilter),
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
        'docket-feed': 'docket',
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
        docket: { recentDeals: [], totalDeals: 0 },
        fuel: { monthlyRevenue: 0, monthlyGallons: 0 },
        shipStore: { monthlyRevenue: 0, monthlyTransactions: 0, avgTransaction: 0, inventoryValue: 0 },
        rentRoll: { totalUnits: 0, occupancyRate: 0, monthlyIncome: 0, vacantUnits: 0 },
        modeling: { activeProjects: 0, completedProjects: 0, totalValuation: 0 },
        timeRange,
      };
    }
  }

  private async getCRMData(orgId: string, dateFilter: TimeRangeFilter | null) {
    const { crmDeals, modelingProjects } = await import('@shared/schema');
    const { sql, count, sum } = await import('drizzle-orm');
    
    const conditions: any[] = [eq(crmDeals.orgId, orgId)];

    const result = await db
      .select({
        totalDeals: count(),
        pipelineValue: sql<string>`COALESCE(SUM(CASE WHEN LOWER(${crmDeals.stage}) IN ('active', 'under review', 'under_review') THEN COALESCE(${crmDeals.value}, 0) + COALESCE(${crmDeals.amount}, 0) END), 0)`,
        activeDeals: sql<number>`COUNT(CASE WHEN LOWER(${crmDeals.stage}) IN ('active', 'under review', 'under_review') THEN 1 END)`,
        wonDeals: sql<number>`COUNT(CASE WHEN LOWER(${crmDeals.stage}) = 'closed_won' THEN 1 END)`,
        wonValue: sql<string>`COALESCE(SUM(CASE WHEN LOWER(${crmDeals.stage}) = 'closed_won' THEN COALESCE(${crmDeals.value}, 0) + COALESCE(${crmDeals.amount}, 0) END), 0)`,
        lostDeals: sql<number>`COUNT(CASE WHEN LOWER(${crmDeals.stage}) = 'closed_lost' THEN 1 END)`,
      })
      .from(crmDeals)
      .where(and(...conditions));

    const modelingResult = await db
      .select({
        pipelineValue: sql<string>`COALESCE(SUM(CASE WHEN LOWER(${modelingProjects.dealOutcome}::text) IN ('active', 'under_review', 'under review') THEN COALESCE(${modelingProjects.purchasePrice}, 0) END), 0)`,
        activeDeals: sql<number>`COUNT(CASE WHEN LOWER(${modelingProjects.dealOutcome}::text) IN ('active', 'under_review', 'under review') THEN 1 END)`,
      })
      .from(modelingProjects)
      .where(eq(modelingProjects.orgId, orgId));

    const data = result[0];
    const crmPipelineValue = Number(data.pipelineValue) || 0;
    const modelingPipelineValue = Number(modelingResult[0]?.pipelineValue) || 0;
    const crmActiveDeals = Number(data.activeDeals) || 0;
    const modelingActiveDeals = Number(modelingResult[0]?.activeDeals) || 0;

    const wonDeals = Number(data.wonDeals) || 0;
    const lostDeals = Number(data.lostDeals) || 0;

    let filteredWonDeals = wonDeals;
    let filteredWonValue = Number(data.wonValue) || 0;
    let filteredLostDeals = lostDeals;
    if (dateFilter) {
      const filteredResult = await db
        .select({
          wonDeals: sql<number>`COUNT(CASE WHEN LOWER(${crmDeals.stage}) = 'closed_won' THEN 1 END)`,
          wonValue: sql<string>`COALESCE(SUM(CASE WHEN LOWER(${crmDeals.stage}) = 'closed_won' THEN COALESCE(${crmDeals.value}, 0) + COALESCE(${crmDeals.amount}, 0) END), 0)`,
          lostDeals: sql<number>`COUNT(CASE WHEN LOWER(${crmDeals.stage}) = 'closed_lost' THEN 1 END)`,
        })
        .from(crmDeals)
        .where(and(
          eq(crmDeals.orgId, orgId),
          gte(crmDeals.closedAt, dateFilter.startDate),
          lte(crmDeals.closedAt, dateFilter.endDate)
        ));
      filteredWonDeals = Number(filteredResult[0]?.wonDeals) || 0;
      filteredWonValue = Number(filteredResult[0]?.wonValue) || 0;
      filteredLostDeals = Number(filteredResult[0]?.lostDeals) || 0;
    }

    let pipelineValueTrend: number | undefined;
    let activeDealsTrend: number | undefined;
    let newDeals = 0;
    if (dateFilter) {
      const periodMs = dateFilter.endDate.getTime() - dateFilter.startDate.getTime();
      const priorStart = new Date(dateFilter.startDate.getTime() - periodMs);
      const priorEnd = dateFilter.startDate;

      const priorResult = await db
        .select({
          pipelineValue: sql<string>`COALESCE(SUM(CASE WHEN LOWER(${crmDeals.stage}) IN ('active', 'under review', 'under_review') THEN COALESCE(${crmDeals.value}, 0) + COALESCE(${crmDeals.amount}, 0) END), 0)`,
          activeDeals: sql<number>`COUNT(CASE WHEN LOWER(${crmDeals.stage}) IN ('active', 'under review', 'under_review') THEN 1 END)`,
        })
        .from(crmDeals)
        .where(and(
          eq(crmDeals.orgId, orgId),
          lte(crmDeals.createdAt, priorEnd)
        ));

      const priorPipeline = Number(priorResult[0]?.pipelineValue) || 0;
      const priorActive = Number(priorResult[0]?.activeDeals) || 0;
      const currentPipeline = crmPipelineValue + modelingPipelineValue;
      const currentActive = crmActiveDeals + modelingActiveDeals;

      if (priorPipeline > 0) {
        pipelineValueTrend = ((currentPipeline - priorPipeline) / priorPipeline) * 100;
      } else if (currentPipeline > 0) {
        pipelineValueTrend = 100;
      }

      if (priorActive > 0) {
        activeDealsTrend = ((currentActive - priorActive) / priorActive) * 100;
      } else if (currentActive > 0) {
        activeDealsTrend = 100;
      }

      const newResult = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(crmDeals)
        .where(and(
          eq(crmDeals.orgId, orgId),
          gte(crmDeals.createdAt, dateFilter.startDate),
          lte(crmDeals.createdAt, dateFilter.endDate)
        ));
      newDeals = Number(newResult[0]?.count) || 0;
    }

    const filteredClosed2 = filteredWonDeals + filteredLostDeals;
    
    return {
      pipelineValue: crmPipelineValue + modelingPipelineValue,
      pipelineValueTrend,
      activeDeals: crmActiveDeals + modelingActiveDeals,
      activeDealsTrend,
      newDeals,
      wonDeals: filteredWonDeals,
      wonValue: filteredWonValue,
      winRate: filteredClosed2 > 0 ? Math.round((filteredWonDeals / filteredClosed2) * 100) : 0,
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
      // Order by actual sale date (year, month) for chronological order, NULLS LAST to push records without dates to the end
      db.select().from(salesComps).where(and(...conditions)).orderBy(sql`${salesComps.saleYear} DESC NULLS LAST`, sql`${salesComps.saleMonth} DESC NULLS LAST`, desc(salesComps.createdAt)).limit(5),
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

  private async getDocketData(orgId: string, dateFilter: TimeRangeFilter | null) {
    const { docketDeals } = await import('@shared/schema');
    const { desc, count } = await import('drizzle-orm');
    
    // Filter out soft-deleted deals
    const conditions: any[] = [isNull(docketDeals.deletedAt)];
    if (dateFilter) {
      conditions.push(gte(docketDeals.announcedDate, dateFilter.startDate));
    }
    
    const [deals, totalResult] = await Promise.all([
      db.select().from(docketDeals).where(and(...conditions)).orderBy(desc(docketDeals.announcedDate)).limit(5),
      db.select({ count: count() }).from(docketDeals).where(and(...conditions)),
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
        completedProjects: sql<number>`COUNT(CASE WHEN LOWER(${modelingProjects.dealOutcome}::text) = 'won' THEN 1 END)`,
        activeProjects: sql<number>`COUNT(CASE WHEN LOWER(${modelingProjects.dealOutcome}::text) IN ('active', 'under_review', 'under review') THEN 1 END)`,
        totalValuation: sql<string>`COALESCE(SUM(CASE WHEN LOWER(${modelingProjects.dealOutcome}::text) NOT IN ('lost', 'closed_lost') OR ${modelingProjects.dealOutcome} IS NULL THEN COALESCE(${modelingProjects.purchasePrice}, 0) END), 0)`,
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
      // Docket metrics
      {
        moduleKey: 'docket',
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
        moduleKey: 'docket',
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

      case 'rate_comps':
        return this.executeRateCompsQuery(orgId, metricKey, filters, yearFilter, yearRange, enableComparison, comparisonType);

      case 'demographics':
        return this.executeDemographicsQuery(orgId, metricKey, filters, yearFilter, yearRange, enableComparison, comparisonType);

      case 'docket':
        return this.executeDocketQuery(orgId, metricKey, filters, yearFilter, yearRange, enableComparison, comparisonType);

      case 'vdr':
        return this.executeVdrQuery(orgId, metricKey, filters, yearFilter, yearRange, enableComparison, comparisonType);

      case 'fuel':
        return this.executeFuelQuery(orgId, metricKey, filters, yearFilter, yearRange, enableComparison, comparisonType);

      case 'ship_store':
        return this.executeShipStoreQuery(orgId, metricKey, filters, yearFilter, yearRange, enableComparison, comparisonType);

      case 'rent_roll':
        return this.executeRentRollQuery(orgId, metricKey, filters, yearFilter, yearRange, enableComparison, comparisonType);

      case 'modeling':
        return this.executeModelingQuery(orgId, metricKey, filters, yearFilter, yearRange, enableComparison, comparisonType);

      case 'due_diligence':
        return this.executeDueDiligenceQuery(orgId, metricKey, filters, yearFilter, yearRange, enableComparison, comparisonType);

      case 'crm':
        return this.executeCrmQuery(orgId, metricKey, filters, yearFilter, yearRange, enableComparison, comparisonType);

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
            countWithPrice: drizzleSql<number>`COUNT(CASE WHEN (${salesComps.salePrice} > 0) OR (${salesComps.estimatedPurchasePrice} > 0) THEN 1 END)`,
            totalCount: drizzleSql<number>`COUNT(*)`
          })
          .from(salesComps)
          .where(whereCondition);
        const sumPrice = Number(avgResult?.sumPrice) || 0;
        const countWithPrice = Number(avgResult?.countWithPrice) || 0;
        const totalCount = Number(avgResult?.totalCount) || 0;
        result.value = countWithPrice > 0 ? sumPrice / countWithPrice : 0;
        result.details = [{ dataCount: countWithPrice, totalCount }];

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
            avg: drizzleSql<number>`AVG(CASE WHEN ${salesComps.wetSlips} > 0 AND ${salesComps.salePrice} > 0 AND (${salesComps.isPriceDisclosed} = true OR ${salesComps.isPriceDisclosed} IS NULL) THEN ${salesComps.salePrice}::decimal / ${salesComps.wetSlips} ELSE NULL END)`,
            countWithData: drizzleSql<number>`COUNT(CASE WHEN ${salesComps.wetSlips} > 0 AND ${salesComps.salePrice} > 0 AND (${salesComps.isPriceDisclosed} = true OR ${salesComps.isPriceDisclosed} IS NULL) THEN 1 END)`,
            totalCount: drizzleSql<number>`COUNT(*)`
          })
          .from(salesComps)
          .where(whereCondition);
        result.value = Number(avgResult?.avg) || 0;
        const countWithData = Number(avgResult?.countWithData) || 0;
        const totalCount = Number(avgResult?.totalCount) || 0;
        result.details = [{ dataCount: countWithData, totalCount }];

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
   * Builds a YoY trend value from current and previous results.
   */
  private calcTrend(current: number, previous: number): number {
    return previous > 0 ? ((current - previous) / previous) * 100 : (current > 0 ? 100 : 0);
  }

  /**
   * Rate Comps query adapter
   * Mirrors the sales_comps pattern: org-scoped, state-filtered, year/year-range filtered, YoY comparison.
   */
  private async executeRateCompsQuery(
    orgId: string,
    metricKey: string,
    filters: WidgetFilters,
    yearFilter: number | null,
    yearRange: { start: number; end: number } | null,
    enableComparison?: boolean,
    comparisonType?: string
  ): Promise<{ value: number; previousValue?: number; trend?: number }> {
    const baseConditions: any[] = [
      eq(rateComps.orgId, orgId),
      isNull(rateComps.deletedAt),
    ];

    if (filters.states && filters.states.length > 0) {
      baseConditions.push(inArray(rateComps.state, filters.states));
    }

    const conditions: any[] = [...baseConditions];
    if (yearFilter) {
      conditions.push(eq(rateComps.saleYear, yearFilter));
    } else if (yearRange) {
      conditions.push(between(rateComps.saleYear, yearRange.start, yearRange.end));
    }

    const prevConditions = [...baseConditions];
    if (yearFilter) {
      prevConditions.push(eq(rateComps.saleYear, yearFilter - 1));
    }

    const whereCondition = and(...conditions);
    const prevWhereCondition = and(...prevConditions);

    const result: { value: number; previousValue?: number; trend?: number } = { value: 0 };

    switch (metricKey) {
      case 'total_count': {
        const [row] = await db.select({ count: drizzleSql<number>`COUNT(*)` }).from(rateComps).where(whereCondition);
        result.value = Number(row?.count) || 0;
        if (enableComparison && comparisonType === 'yoy' && yearFilter) {
          const [prev] = await db.select({ count: drizzleSql<number>`COUNT(*)` }).from(rateComps).where(prevWhereCondition);
          result.previousValue = Number(prev?.count) || 0;
          result.trend = this.calcTrend(result.value, result.previousValue);
        }
        break;
      }
      case 'avg_rate_per_foot': {
        // Average of rateAmount ($/linear foot) across records that have a valid rateAmount
        const [row] = await db
          .select({ avg: drizzleSql<number>`AVG(NULLIF(${rateComps.rateAmount}, 0))` })
          .from(rateComps)
          .where(whereCondition);
        result.value = Number(row?.avg) || 0;
        if (enableComparison && comparisonType === 'yoy' && yearFilter) {
          const [prev] = await db
            .select({ avg: drizzleSql<number>`AVG(NULLIF(${rateComps.rateAmount}, 0))` })
            .from(rateComps)
            .where(prevWhereCondition);
          result.previousValue = Number(prev?.avg) || 0;
          result.trend = this.calcTrend(result.value, result.previousValue);
        }
        break;
      }
    }

    return result;
  }

  /**
   * Demographics query adapter
   * Org-scoped; optional year filter applied to latestDate (year of latest data point).
   * locations_analyzed counts distinct (stateCode, county) pairs. YoY comparison supported.
   */
  private async executeDemographicsQuery(
    orgId: string,
    metricKey: string,
    filters: WidgetFilters,
    yearFilter: number | null,
    yearRange: { start: number; end: number } | null,
    enableComparison?: boolean,
    comparisonType?: string
  ): Promise<{ value: number; previousValue?: number; trend?: number }> {
    const buildConds = (yf: number | null, yr: { start: number; end: number } | null): any[] => {
      const conds: any[] = [eq(demographicsCache.orgId, orgId)];
      if (yf) conds.push(drizzleSql`EXTRACT(YEAR FROM ${demographicsCache.latestDate}) = ${yf}`);
      else if (yr) conds.push(drizzleSql`EXTRACT(YEAR FROM ${demographicsCache.latestDate}) BETWEEN ${yr.start} AND ${yr.end}`);
      return conds;
    };

    const baseConds = buildConds(yearFilter, yearRange);
    const prevConds = yearFilter ? buildConds(yearFilter - 1, null) : null;

    const result: { value: number; previousValue?: number; trend?: number } = { value: 0 };

    switch (metricKey) {
      case 'locations_analyzed': {
        // Count distinct geographic locations identified by (stateCode, county) pairs
        const [row] = await db
          .select({ count: drizzleSql<number>`COUNT(DISTINCT (${demographicsCache.stateCode}, COALESCE(${demographicsCache.county}, '')))` })
          .from(demographicsCache)
          .where(and(...baseConds));
        result.value = Number(row?.count) || 0;
        if (enableComparison && comparisonType === 'yoy' && prevConds) {
          const [prev] = await db
            .select({ count: drizzleSql<number>`COUNT(DISTINCT (${demographicsCache.stateCode}, COALESCE(${demographicsCache.county}, '')))` })
            .from(demographicsCache)
            .where(and(...prevConds));
          result.previousValue = Number(prev?.count) || 0;
          result.trend = this.calcTrend(result.value, result.previousValue);
        }
        break;
      }
      case 'avg_population': {
        const [row] = await db
          .select({ avg: drizzleSql<number>`AVG(${demographicsCache.latestValue})` })
          .from(demographicsCache)
          .where(and(...baseConds, eq(demographicsCache.category, 'population')));
        result.value = Number(row?.avg) || 0;
        if (enableComparison && comparisonType === 'yoy' && prevConds) {
          const [prev] = await db
            .select({ avg: drizzleSql<number>`AVG(${demographicsCache.latestValue})` })
            .from(demographicsCache)
            .where(and(...prevConds, eq(demographicsCache.category, 'population')));
          result.previousValue = Number(prev?.avg) || 0;
          result.trend = this.calcTrend(result.value, result.previousValue);
        }
        break;
      }
      case 'avg_median_income': {
        const [row] = await db
          .select({ avg: drizzleSql<number>`AVG(${demographicsCache.latestValue})` })
          .from(demographicsCache)
          .where(and(...baseConds, eq(demographicsCache.category, 'income')));
        result.value = Number(row?.avg) || 0;
        if (enableComparison && comparisonType === 'yoy' && prevConds) {
          const [prev] = await db
            .select({ avg: drizzleSql<number>`AVG(${demographicsCache.latestValue})` })
            .from(demographicsCache)
            .where(and(...prevConds, eq(demographicsCache.category, 'income')));
          result.previousValue = Number(prev?.avg) || 0;
          result.trend = this.calcTrend(result.value, result.previousValue);
        }
        break;
      }
    }

    return result;
  }

  /**
   * Docket query adapter
   * total_deals counts ACTIVE deals only: dealStatus IN ('Announced', 'Pending'). These are
   * in-progress deals that have not yet closed or terminated. Year filter applied via dealDate.
   * articles_today counts deals announced today using announcedDate = CURRENT_DATE.
   */
  private async executeDocketQuery(
    orgId: string,
    metricKey: string,
    filters: WidgetFilters,
    yearFilter: number | null,
    yearRange: { start: number; end: number } | null,
    enableComparison?: boolean,
    comparisonType?: string
  ): Promise<{ value: number; previousValue?: number; trend?: number }> {
    // Active-deal filter: Announced + Pending represent in-progress deals (Closed/Terminated are historical)
    const activeDealStatus = drizzleSql`${docketDeals.dealStatus} IN ('Announced', 'Pending')`;
    const baseConditions: any[] = [eq(docketDeals.orgId, orgId), isNull(docketDeals.deletedAt)];
    const result: { value: number; previousValue?: number; trend?: number } = { value: 0 };

    switch (metricKey) {
      case 'total_deals': {
        const conditions = [...baseConditions, activeDealStatus];
        if (yearFilter) {
          conditions.push(drizzleSql`EXTRACT(YEAR FROM ${docketDeals.dealDate}) = ${yearFilter}`);
        } else if (yearRange) {
          conditions.push(drizzleSql`EXTRACT(YEAR FROM ${docketDeals.dealDate}) BETWEEN ${yearRange.start} AND ${yearRange.end}`);
        }
        const prevConditions = [...baseConditions, activeDealStatus];
        if (yearFilter) {
          prevConditions.push(drizzleSql`EXTRACT(YEAR FROM ${docketDeals.dealDate}) = ${yearFilter - 1}`);
        }
        const [row] = await db.select({ count: drizzleSql<number>`COUNT(*)` }).from(docketDeals).where(and(...conditions));
        result.value = Number(row?.count) || 0;
        if (enableComparison && comparisonType === 'yoy' && yearFilter) {
          const [prev] = await db.select({ count: drizzleSql<number>`COUNT(*)` }).from(docketDeals).where(and(...prevConditions));
          result.previousValue = Number(prev?.count) || 0;
          result.trend = this.calcTrend(result.value, result.previousValue);
        }
        break;
      }
      case 'articles_today': {
        // Count deals announced today using the announcedDate date column
        const [row] = await db
          .select({ count: drizzleSql<number>`COUNT(*)` })
          .from(docketDeals)
          .where(and(...baseConditions, drizzleSql`${docketDeals.announcedDate} = CURRENT_DATE`));
        result.value = Number(row?.count) || 0;
        break;
      }
    }

    return result;
  }

  /**
   * VDR query adapter
   * active_rooms = non-deleted root-level folders (parentFolderId IS NULL), optionally year-filtered by createdAt.
   * total_documents = current non-deleted documents, optionally year-filtered by createdAt. YoY supported.
   */
  private async executeVdrQuery(
    orgId: string,
    metricKey: string,
    filters: WidgetFilters,
    yearFilter: number | null,
    yearRange: { start: number; end: number } | null,
    enableComparison?: boolean,
    comparisonType?: string
  ): Promise<{ value: number; previousValue?: number; trend?: number }> {
    const result: { value: number; previousValue?: number; trend?: number } = { value: 0 };

    switch (metricKey) {
      case 'total_documents': {
        const baseDocConds: any[] = [eq(vdrDocuments.orgId, orgId), isNull(vdrDocuments.deletedAt), eq(vdrDocuments.isCurrentVersion, true)];
        const docConds = [...baseDocConds];
        const prevDocConds = [...baseDocConds];
        if (yearFilter) {
          docConds.push(drizzleSql`EXTRACT(YEAR FROM ${vdrDocuments.createdAt}) = ${yearFilter}`);
          prevDocConds.push(drizzleSql`EXTRACT(YEAR FROM ${vdrDocuments.createdAt}) = ${yearFilter - 1}`);
        } else if (yearRange) {
          docConds.push(drizzleSql`EXTRACT(YEAR FROM ${vdrDocuments.createdAt}) BETWEEN ${yearRange.start} AND ${yearRange.end}`);
        }
        const [row] = await db.select({ count: drizzleSql<number>`COUNT(*)` }).from(vdrDocuments).where(and(...docConds));
        result.value = Number(row?.count) || 0;
        if (enableComparison && comparisonType === 'yoy' && yearFilter) {
          const [prev] = await db.select({ count: drizzleSql<number>`COUNT(*)` }).from(vdrDocuments).where(and(...prevDocConds));
          result.previousValue = Number(prev?.count) || 0;
          result.trend = this.calcTrend(result.value, result.previousValue);
        }
        break;
      }
      case 'active_rooms': {
        // Root-level folders (parentFolderId IS NULL) represent top-level data rooms; optionally year-filtered
        const roomConds: any[] = [eq(vdrFolders.orgId, orgId), isNull(vdrFolders.deletedAt), drizzleSql`${vdrFolders.parentFolderId} IS NULL`];
        if (yearFilter) {
          roomConds.push(drizzleSql`EXTRACT(YEAR FROM ${vdrFolders.createdAt}) = ${yearFilter}`);
        } else if (yearRange) {
          roomConds.push(drizzleSql`EXTRACT(YEAR FROM ${vdrFolders.createdAt}) BETWEEN ${yearRange.start} AND ${yearRange.end}`);
        }
        const [row] = await db.select({ count: drizzleSql<number>`COUNT(*)` }).from(vdrFolders).where(and(...roomConds));
        result.value = Number(row?.count) || 0;
        break;
      }
    }

    return result;
  }

  /**
   * Fuel query adapter
   * Filters applied: fuelType/fuel_type (validated enum), year/year-range, month (all via transactionDate).
   * marina filter is not applicable — fuelSales has no marinaId column in the current schema.
   * YoY comparison applied to total_gallons and total_revenue.
   */
  private async executeFuelQuery(
    orgId: string,
    metricKey: string,
    filters: WidgetFilters,
    yearFilter: number | null,
    yearRange: { start: number; end: number } | null,
    enableComparison?: boolean,
    comparisonType?: string
  ): Promise<{ value: number; previousValue?: number; trend?: number }> {
    const validFuelTypes = ['diesel', 'regular_gas', 'premium_gas', 'ethanol_free'] as const;
    type FuelType = typeof validFuelTypes[number];

    const baseConditions: any[] = [eq(fuelSales.orgId, orgId)];

    // Handle both camelCase (fuelType) and snake_case (fuel_type) filter keys
    const rawFilters = filters as Record<string, unknown>;
    const fuelTypeValue = (
      typeof rawFilters.fuelType === 'string' ? rawFilters.fuelType :
      typeof rawFilters.fuel_type === 'string' ? rawFilters.fuel_type : null
    );
    if (fuelTypeValue && (validFuelTypes as readonly string[]).includes(fuelTypeValue)) {
      baseConditions.push(eq(fuelSales.fuelType, fuelTypeValue as FuelType));
    }

    // Optional month filter (1–12); handle both key variants
    const monthValue = (
      typeof rawFilters.month === 'number' ? rawFilters.month :
      typeof rawFilters.month === 'string' ? parseInt(rawFilters.month, 10) : null
    );
    if (monthValue && monthValue >= 1 && monthValue <= 12) {
      baseConditions.push(drizzleSql`EXTRACT(MONTH FROM ${fuelSales.transactionDate}) = ${monthValue}`);
    }

    const buildYearCond = (conditions: any[], yf: number | null, yr: { start: number; end: number } | null) => {
      if (yf) {
        conditions.push(drizzleSql`EXTRACT(YEAR FROM ${fuelSales.transactionDate}) = ${yf}`);
      } else if (yr) {
        conditions.push(drizzleSql`EXTRACT(YEAR FROM ${fuelSales.transactionDate}) BETWEEN ${yr.start} AND ${yr.end}`);
      }
    };

    const conditions = [...baseConditions];
    buildYearCond(conditions, yearFilter, yearRange);

    const prevConditions = [...baseConditions];
    if (yearFilter) buildYearCond(prevConditions, yearFilter - 1, null);

    const result: { value: number; previousValue?: number; trend?: number } = { value: 0 };

    switch (metricKey) {
      case 'total_gallons': {
        const [row] = await db.select({ sum: drizzleSql<number>`SUM(${fuelSales.quantityGallons})` }).from(fuelSales).where(and(...conditions));
        result.value = Number(row?.sum) || 0;
        if (enableComparison && comparisonType === 'yoy' && yearFilter) {
          const [prev] = await db.select({ sum: drizzleSql<number>`SUM(${fuelSales.quantityGallons})` }).from(fuelSales).where(and(...prevConditions));
          result.previousValue = Number(prev?.sum) || 0;
          result.trend = this.calcTrend(result.value, result.previousValue);
        }
        break;
      }
      case 'total_revenue': {
        const [row] = await db.select({ sum: drizzleSql<number>`SUM(${fuelSales.totalAmount})` }).from(fuelSales).where(and(...conditions));
        result.value = Number(row?.sum) || 0;
        if (enableComparison && comparisonType === 'yoy' && yearFilter) {
          const [prev] = await db.select({ sum: drizzleSql<number>`SUM(${fuelSales.totalAmount})` }).from(fuelSales).where(and(...prevConditions));
          result.previousValue = Number(prev?.sum) || 0;
          result.trend = this.calcTrend(result.value, result.previousValue);
        }
        break;
      }
    }

    return result;
  }

  /**
   * Ship Store query adapter
   * Filters: year/year-range and optional month (via createdAt).
   * category and marina filters are not applicable — shipStoreTransactions has no such columns in the schema.
   * YoY comparison applied to both metrics.
   */
  private async executeShipStoreQuery(
    orgId: string,
    metricKey: string,
    filters: WidgetFilters,
    yearFilter: number | null,
    yearRange: { start: number; end: number } | null,
    enableComparison?: boolean,
    comparisonType?: string
  ): Promise<{ value: number; previousValue?: number; trend?: number }> {
    const baseConditions: any[] = [eq(shipStoreTransactions.orgId, orgId)];

    const rawFilters = filters as Record<string, unknown>;
    const monthValue = (
      typeof rawFilters.month === 'number' ? rawFilters.month :
      typeof rawFilters.month === 'string' ? parseInt(rawFilters.month, 10) : null
    );
    if (monthValue && monthValue >= 1 && monthValue <= 12) {
      baseConditions.push(drizzleSql`EXTRACT(MONTH FROM ${shipStoreTransactions.createdAt}) = ${monthValue}`);
    }

    const buildYearCond = (conditions: any[], yf: number | null, yr: { start: number; end: number } | null) => {
      if (yf) {
        conditions.push(drizzleSql`EXTRACT(YEAR FROM ${shipStoreTransactions.createdAt}) = ${yf}`);
      } else if (yr) {
        conditions.push(drizzleSql`EXTRACT(YEAR FROM ${shipStoreTransactions.createdAt}) BETWEEN ${yr.start} AND ${yr.end}`);
      }
    };

    const conditions = [...baseConditions];
    buildYearCond(conditions, yearFilter, yearRange);

    const prevConditions = [...baseConditions];
    if (yearFilter) buildYearCond(prevConditions, yearFilter - 1, null);

    const result: { value: number; previousValue?: number; trend?: number } = { value: 0 };

    switch (metricKey) {
      case 'total_transactions': {
        const [row] = await db.select({ count: drizzleSql<number>`COUNT(*)` }).from(shipStoreTransactions).where(and(...conditions));
        result.value = Number(row?.count) || 0;
        if (enableComparison && comparisonType === 'yoy' && yearFilter) {
          const [prev] = await db.select({ count: drizzleSql<number>`COUNT(*)` }).from(shipStoreTransactions).where(and(...prevConditions));
          result.previousValue = Number(prev?.count) || 0;
          result.trend = this.calcTrend(result.value, result.previousValue);
        }
        break;
      }
      case 'total_revenue': {
        const [row] = await db.select({ sum: drizzleSql<number>`SUM(${shipStoreTransactions.total})` }).from(shipStoreTransactions).where(and(...conditions));
        result.value = Number(row?.sum) || 0;
        if (enableComparison && comparisonType === 'yoy' && yearFilter) {
          const [prev] = await db.select({ sum: drizzleSql<number>`SUM(${shipStoreTransactions.total})` }).from(shipStoreTransactions).where(and(...prevConditions));
          result.previousValue = Number(prev?.sum) || 0;
          result.trend = this.calcTrend(result.value, result.previousValue);
        }
        break;
      }
    }

    return result;
  }

  /**
   * Rent Roll query adapter
   * active_count = count of rent_rolls filtered by effectiveDate year. The rentRolls table has no deletedAt.
   * occupancy_rate = active entries / total entries as a percentage, filtered by startDate year.
   * monthly_revenue = sum of monthlyRate for active entries, filtered by startDate year. YoY supported.
   */
  private async executeRentRollQuery(
    orgId: string,
    metricKey: string,
    filters: WidgetFilters,
    yearFilter: number | null,
    yearRange: { start: number; end: number } | null,
    enableComparison?: boolean,
    comparisonType?: string
  ): Promise<{ value: number; previousValue?: number; trend?: number }> {
    const result: { value: number; previousValue?: number; trend?: number } = { value: 0 };

    switch (metricKey) {
      case 'active_count': {
        // rent_rolls filtered by effectiveDate year
        const rollConds: any[] = [eq(rentRolls.orgId, orgId)];
        const prevRollConds: any[] = [eq(rentRolls.orgId, orgId)];
        if (yearFilter) {
          rollConds.push(drizzleSql`EXTRACT(YEAR FROM ${rentRolls.effectiveDate}) = ${yearFilter}`);
          prevRollConds.push(drizzleSql`EXTRACT(YEAR FROM ${rentRolls.effectiveDate}) = ${yearFilter - 1}`);
        } else if (yearRange) {
          rollConds.push(drizzleSql`EXTRACT(YEAR FROM ${rentRolls.effectiveDate}) BETWEEN ${yearRange.start} AND ${yearRange.end}`);
        }
        const [row] = await db.select({ count: drizzleSql<number>`COUNT(*)` }).from(rentRolls).where(and(...rollConds));
        result.value = Number(row?.count) || 0;
        if (enableComparison && comparisonType === 'yoy' && yearFilter) {
          const [prev] = await db.select({ count: drizzleSql<number>`COUNT(*)` }).from(rentRolls).where(and(...prevRollConds));
          result.previousValue = Number(prev?.count) || 0;
          result.trend = this.calcTrend(result.value, result.previousValue);
        }
        break;
      }
      case 'occupancy_rate': {
        // Occupancy from entry-level status, optionally filtered by startDate year
        const entryConds: any[] = [eq(rentRollEntries.orgId, orgId)];
        if (yearFilter) {
          entryConds.push(drizzleSql`EXTRACT(YEAR FROM ${rentRollEntries.startDate}) = ${yearFilter}`);
        } else if (yearRange) {
          entryConds.push(drizzleSql`EXTRACT(YEAR FROM ${rentRollEntries.startDate}) BETWEEN ${yearRange.start} AND ${yearRange.end}`);
        }
        const [agg] = await db
          .select({
            total: drizzleSql<number>`COUNT(*)`,
            active: drizzleSql<number>`COUNT(*) FILTER (WHERE ${rentRollEntries.status} = 'active')`,
          })
          .from(rentRollEntries)
          .where(and(...entryConds));
        const totalCount = Number(agg?.total) || 0;
        const activeCount = Number(agg?.active) || 0;
        result.value = totalCount > 0 ? (activeCount / totalCount) * 100 : 0;
        break;
      }
      case 'monthly_revenue': {
        const entryConds: any[] = [eq(rentRollEntries.orgId, orgId), eq(rentRollEntries.status, 'active')];
        const prevEntryConds: any[] = [eq(rentRollEntries.orgId, orgId), eq(rentRollEntries.status, 'active')];
        if (yearFilter) {
          entryConds.push(drizzleSql`EXTRACT(YEAR FROM ${rentRollEntries.startDate}) = ${yearFilter}`);
          prevEntryConds.push(drizzleSql`EXTRACT(YEAR FROM ${rentRollEntries.startDate}) = ${yearFilter - 1}`);
        } else if (yearRange) {
          entryConds.push(drizzleSql`EXTRACT(YEAR FROM ${rentRollEntries.startDate}) BETWEEN ${yearRange.start} AND ${yearRange.end}`);
        }
        const [row] = await db.select({ sum: drizzleSql<number>`SUM(${rentRollEntries.monthlyRate})` }).from(rentRollEntries).where(and(...entryConds));
        result.value = Number(row?.sum) || 0;
        if (enableComparison && comparisonType === 'yoy' && yearFilter) {
          const [prev] = await db.select({ sum: drizzleSql<number>`SUM(${rentRollEntries.monthlyRate})` }).from(rentRollEntries).where(and(...prevEntryConds));
          result.previousValue = Number(prev?.sum) || 0;
          result.trend = this.calcTrend(result.value, result.previousValue);
        }
        break;
      }
    }

    return result;
  }

  /**
   * Modeling query adapter
   * active_projects = dealOutcome='active', optionally year-filtered by createdAt. YoY supported.
   * total_projects = all projects, year-filtered. total_aum = SUM(purchasePrice) for active projects.
   */
  private async executeModelingQuery(
    orgId: string,
    metricKey: string,
    filters: WidgetFilters,
    yearFilter: number | null,
    yearRange: { start: number; end: number } | null,
    enableComparison?: boolean,
    comparisonType?: string
  ): Promise<{ value: number; previousValue?: number; trend?: number }> {
    const result: { value: number; previousValue?: number; trend?: number } = { value: 0 };

    const buildYearCond = (conds: any[], yf: number | null, yr: { start: number; end: number } | null) => {
      if (yf) conds.push(drizzleSql`EXTRACT(YEAR FROM ${modelingProjects.createdAt}) = ${yf}`);
      else if (yr) conds.push(drizzleSql`EXTRACT(YEAR FROM ${modelingProjects.createdAt}) BETWEEN ${yr.start} AND ${yr.end}`);
    };

    switch (metricKey) {
      case 'active_projects': {
        // Include 'active' and 'under_review' outcomes — both represent in-progress deals
        // (dealOutcomeEnum: 'won','lost','passed','under_review','active'; no 'in_progress' value)
        const activeOutcomeSql = drizzleSql`${modelingProjects.dealOutcome} IN ('active', 'under_review')`;
        const conds: any[] = [eq(modelingProjects.orgId, orgId), activeOutcomeSql];
        const prevConds: any[] = [eq(modelingProjects.orgId, orgId), activeOutcomeSql];
        buildYearCond(conds, yearFilter, yearRange);
        if (yearFilter) buildYearCond(prevConds, yearFilter - 1, null);
        const [row] = await db.select({ count: drizzleSql<number>`COUNT(*)` }).from(modelingProjects).where(and(...conds));
        result.value = Number(row?.count) || 0;
        if (enableComparison && comparisonType === 'yoy' && yearFilter) {
          const [prev] = await db.select({ count: drizzleSql<number>`COUNT(*)` }).from(modelingProjects).where(and(...prevConds));
          result.previousValue = Number(prev?.count) || 0;
          result.trend = this.calcTrend(result.value, result.previousValue);
        }
        break;
      }
      case 'total_projects': {
        const conds: any[] = [eq(modelingProjects.orgId, orgId)];
        const prevConds: any[] = [eq(modelingProjects.orgId, orgId)];
        buildYearCond(conds, yearFilter, yearRange);
        if (yearFilter) buildYearCond(prevConds, yearFilter - 1, null);
        const [row] = await db.select({ count: drizzleSql<number>`COUNT(*)` }).from(modelingProjects).where(and(...conds));
        result.value = Number(row?.count) || 0;
        if (enableComparison && comparisonType === 'yoy' && yearFilter) {
          const [prev] = await db.select({ count: drizzleSql<number>`COUNT(*)` }).from(modelingProjects).where(and(...prevConds));
          result.previousValue = Number(prev?.count) || 0;
          result.trend = this.calcTrend(result.value, result.previousValue);
        }
        break;
      }
      case 'total_aum': {
        const conds: any[] = [eq(modelingProjects.orgId, orgId), eq(modelingProjects.dealOutcome, 'active')];
        buildYearCond(conds, yearFilter, yearRange);
        const [row] = await db.select({ sum: drizzleSql<number>`SUM(${modelingProjects.purchasePrice})` }).from(modelingProjects).where(and(...conds));
        result.value = Number(row?.sum) || 0;
        break;
      }
    }

    return result;
  }

  /**
   * Due Diligence query adapter
   * The `projects` table backs the DD module. projectTypeEnum has only 'single' | 'portfolio';
   * there is no 'due_diligence' enum value in the schema. 'single' projects ARE the individual
   * DD deals — 'portfolio' projects are container records that group single projects.
   * Scoping to projectType='single' is the canonical DD discriminator per the schema definition.
   * Year filter applied to createdAt. YoY comparison supported.
   */
  private async executeDueDiligenceQuery(
    orgId: string,
    metricKey: string,
    filters: WidgetFilters,
    yearFilter: number | null,
    yearRange: { start: number; end: number } | null,
    enableComparison?: boolean,
    comparisonType?: string
  ): Promise<{ value: number; previousValue?: number; trend?: number }> {
    const result: { value: number; previousValue?: number; trend?: number } = { value: 0 };

    // projectType='single' IS the due-diligence discriminator (schema has only 'single'|'portfolio')
    const ddBase: any[] = [eq(projects.orgId, orgId), eq(projects.projectType, 'single')];

    const buildYearCond = (conds: any[], yf: number | null, yr: { start: number; end: number } | null) => {
      if (yf) conds.push(drizzleSql`EXTRACT(YEAR FROM ${projects.createdAt}) = ${yf}`);
      else if (yr) conds.push(drizzleSql`EXTRACT(YEAR FROM ${projects.createdAt}) BETWEEN ${yr.start} AND ${yr.end}`);
    };

    switch (metricKey) {
      case 'active_projects':
      case 'total_tasks': {
        const conds = [...ddBase, eq(projects.status, 'active')];
        const prevConds = [...ddBase, eq(projects.status, 'active')];
        buildYearCond(conds, yearFilter, yearRange);
        if (yearFilter) buildYearCond(prevConds, yearFilter - 1, null);
        const [row] = await db.select({ count: drizzleSql<number>`COUNT(*)` }).from(projects).where(and(...conds));
        result.value = Number(row?.count) || 0;
        if (enableComparison && comparisonType === 'yoy' && yearFilter) {
          const [prev] = await db.select({ count: drizzleSql<number>`COUNT(*)` }).from(projects).where(and(...prevConds));
          result.previousValue = Number(prev?.count) || 0;
          result.trend = this.calcTrend(result.value, result.previousValue);
        }
        break;
      }
      case 'total_projects': {
        const conds = [...ddBase];
        const prevConds = [...ddBase];
        buildYearCond(conds, yearFilter, yearRange);
        if (yearFilter) buildYearCond(prevConds, yearFilter - 1, null);
        const [row] = await db.select({ count: drizzleSql<number>`COUNT(*)` }).from(projects).where(and(...conds));
        result.value = Number(row?.count) || 0;
        if (enableComparison && comparisonType === 'yoy' && yearFilter) {
          const [prev] = await db.select({ count: drizzleSql<number>`COUNT(*)` }).from(projects).where(and(...prevConds));
          result.previousValue = Number(prev?.count) || 0;
          result.trend = this.calcTrend(result.value, result.previousValue);
        }
        break;
      }
      case 'completion_rate': {
        const conds = [...ddBase];
        buildYearCond(conds, yearFilter, yearRange);
        const [agg] = await db
          .select({
            total: drizzleSql<number>`COUNT(*)`,
            completed: drizzleSql<number>`COUNT(*) FILTER (WHERE ${projects.status} = 'completed')`,
          })
          .from(projects)
          .where(and(...conds));
        const totalCount = Number(agg?.total) || 0;
        const completedCount = Number(agg?.completed) || 0;
        result.value = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;
        break;
      }
    }

    return result;
  }

  /**
   * CRM query adapter
   * active_deals / open_deals = isClosed=false, year-filtered by createdAt. YoY supported.
   * total_contacts and total_companies are year-filtered by createdAt.
   * pipeline_value sums deal value for open deals.
   */
  private async executeCrmQuery(
    orgId: string,
    metricKey: string,
    filters: WidgetFilters,
    yearFilter: number | null,
    yearRange: { start: number; end: number } | null,
    enableComparison?: boolean,
    comparisonType?: string
  ): Promise<{ value: number; previousValue?: number; trend?: number }> {
    const result: { value: number; previousValue?: number; trend?: number } = { value: 0 };

    switch (metricKey) {
      case 'total_contacts': {
        const conds: any[] = [eq(crmContacts.orgId, orgId)];
        const prevConds: any[] = [eq(crmContacts.orgId, orgId)];
        if (yearFilter) {
          conds.push(drizzleSql`EXTRACT(YEAR FROM ${crmContacts.createdAt}) = ${yearFilter}`);
          prevConds.push(drizzleSql`EXTRACT(YEAR FROM ${crmContacts.createdAt}) = ${yearFilter - 1}`);
        } else if (yearRange) {
          conds.push(drizzleSql`EXTRACT(YEAR FROM ${crmContacts.createdAt}) BETWEEN ${yearRange.start} AND ${yearRange.end}`);
        }
        const [row] = await db.select({ count: drizzleSql<number>`COUNT(*)` }).from(crmContacts).where(and(...conds));
        result.value = Number(row?.count) || 0;
        if (enableComparison && comparisonType === 'yoy' && yearFilter) {
          const [prev] = await db.select({ count: drizzleSql<number>`COUNT(*)` }).from(crmContacts).where(and(...prevConds));
          result.previousValue = Number(prev?.count) || 0;
          result.trend = this.calcTrend(result.value, result.previousValue);
        }
        break;
      }
      case 'total_companies': {
        const conds: any[] = [eq(crmCompanies.orgId, orgId)];
        const prevConds: any[] = [eq(crmCompanies.orgId, orgId)];
        if (yearFilter) {
          conds.push(drizzleSql`EXTRACT(YEAR FROM ${crmCompanies.createdAt}) = ${yearFilter}`);
          prevConds.push(drizzleSql`EXTRACT(YEAR FROM ${crmCompanies.createdAt}) = ${yearFilter - 1}`);
        } else if (yearRange) {
          conds.push(drizzleSql`EXTRACT(YEAR FROM ${crmCompanies.createdAt}) BETWEEN ${yearRange.start} AND ${yearRange.end}`);
        }
        const [row] = await db.select({ count: drizzleSql<number>`COUNT(*)` }).from(crmCompanies).where(and(...conds));
        result.value = Number(row?.count) || 0;
        if (enableComparison && comparisonType === 'yoy' && yearFilter) {
          const [prev] = await db.select({ count: drizzleSql<number>`COUNT(*)` }).from(crmCompanies).where(and(...prevConds));
          result.previousValue = Number(prev?.count) || 0;
          result.trend = this.calcTrend(result.value, result.previousValue);
        }
        break;
      }
      case 'active_deals':
      case 'open_deals': {
        const conds: any[] = [eq(crmDeals.orgId, orgId), eq(crmDeals.isClosed, false)];
        const prevConds: any[] = [eq(crmDeals.orgId, orgId), eq(crmDeals.isClosed, false)];
        if (yearFilter) {
          conds.push(drizzleSql`EXTRACT(YEAR FROM ${crmDeals.createdAt}) = ${yearFilter}`);
          prevConds.push(drizzleSql`EXTRACT(YEAR FROM ${crmDeals.createdAt}) = ${yearFilter - 1}`);
        } else if (yearRange) {
          conds.push(drizzleSql`EXTRACT(YEAR FROM ${crmDeals.createdAt}) BETWEEN ${yearRange.start} AND ${yearRange.end}`);
        }
        const [row] = await db.select({ count: drizzleSql<number>`COUNT(*)` }).from(crmDeals).where(and(...conds));
        result.value = Number(row?.count) || 0;
        if (enableComparison && comparisonType === 'yoy' && yearFilter) {
          const [prev] = await db.select({ count: drizzleSql<number>`COUNT(*)` }).from(crmDeals).where(and(...prevConds));
          result.previousValue = Number(prev?.count) || 0;
          result.trend = this.calcTrend(result.value, result.previousValue);
        }
        break;
      }
      case 'pipeline_value': {
        const conds: any[] = [eq(crmDeals.orgId, orgId), eq(crmDeals.isClosed, false)];
        if (yearFilter) {
          conds.push(drizzleSql`EXTRACT(YEAR FROM ${crmDeals.createdAt}) = ${yearFilter}`);
        } else if (yearRange) {
          conds.push(drizzleSql`EXTRACT(YEAR FROM ${crmDeals.createdAt}) BETWEEN ${yearRange.start} AND ${yearRange.end}`);
        }
        const [row] = await db
          .select({ sum: drizzleSql<number>`SUM(COALESCE(${crmDeals.value}::numeric, ${crmDeals.amount}::numeric, 0))` })
          .from(crmDeals)
          .where(and(...conds));
        result.value = Number(row?.sum) || 0;
        break;
      }
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
