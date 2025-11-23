import { db } from '../db';
import {
  dashboardWidgets,
  userDashboardLayouts,
} from '@shared/schema';
import { eq, and, inArray } from 'drizzle-orm';
import type {
  DashboardWidget,
  InsertDashboardWidget,
  UpdateDashboardWidget,
  UserDashboardLayout,
  InsertUserDashboardLayout,
  UpdateUserDashboardLayout,
} from '@shared/schema';

export class DashboardService {
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
  async getAggregatedDashboardData(orgId: string): Promise<any> {
    const { crmDeals } = await import('@shared/schema');
    const { projects } = await import('@shared/schema');
    const { vdrProjects, vdrDocuments, vdrDataRequests } = await import('@shared/schema');
    const { salesComps } = await import('@shared/schema');
    const { docktalkArticles, docktalkDeals } = await import('@shared/docktalk-schema');
    const { fuelSalesTransactions, shipStoreTransactions, shipStoreProducts, rentRollUnits, modelingProjects } = await import('@shared/schema');
    const { eq, and, gte, sql, desc, count } = await import('drizzle-orm');
    const { subDays } = await import('date-fns');

    const thirtyDaysAgo = subDays(new Date(), 30);

    // Execute all queries in parallel for maximum performance
    const [
      crmStats,
      ddStats,
      vdrStats,
      salesCompsData,
      docktalkData,
      fuelData,
      shipStoreData,
      rentRollData,
      modelingData,
    ] = await Promise.all([
      // CRM aggregated stats
      db.select({
        pipelineValue: sql<number>`COALESCE(SUM(CASE WHEN outcome = 'active' THEN deal_value ELSE 0 END), 0)`,
        activeDeals: sql<number>`COUNT(CASE WHEN outcome = 'active' THEN 1 END)`,
        wonDeals: sql<number>`COUNT(CASE WHEN outcome = 'won' THEN 1 END)`,
        totalDeals: count(),
      })
      .from(crmDeals)
      .where(eq(crmDeals.orgId, orgId)),

      // Due Diligence aggregated stats
      db.select({
        activeProjects: sql<number>`COUNT(CASE WHEN status = 'active' THEN 1 END)`,
        completedProjects: sql<number>`COUNT(CASE WHEN status = 'completed' THEN 1 END)`,
        totalProjects: count(),
      })
      .from(projects)
      .where(eq(projects.orgId, orgId)),

      // VDR aggregated stats
      Promise.all([
        db.select({
          activeDataRooms: sql<number>`COUNT(CASE WHEN status = 'active' THEN 1 END)`,
        })
        .from(vdrProjects)
        .where(eq(vdrProjects.orgId, orgId)),
        db.select({ count: count() })
        .from(vdrDocuments)
        .where(eq(vdrDocuments.orgId, orgId)),
        db.select({ count: count() })
        .from(vdrDataRequests)
        .where(and(
          eq(vdrDataRequests.orgId, orgId),
          eq(vdrDataRequests.status, 'outstanding')
        )),
      ]),

      // Sales Comps data with aggregation
      Promise.all([
        db.select().from(salesComps)
          .where(eq(salesComps.orgId, orgId))
          .orderBy(desc(salesComps.createdAt))
          .limit(5),
        db.select({
          avgPricePerSlip: sql<number>`AVG(price_per_slip)`,
          totalComps: count(),
        })
        .from(salesComps)
        .where(eq(salesComps.orgId, orgId)),
      ]),

      // DockTalk data
      Promise.all([
        db.select().from(docktalkArticles)
          .where(gte(docktalkArticles.publishedAt, thirtyDaysAgo))
          .orderBy(desc(docktalkArticles.publishedAt))
          .limit(5),
        db.select().from(docktalkDeals)
          .orderBy(desc(docktalkDeals.createdAt))
          .limit(5),
      ]),

      // Fuel data (last 30 days)
      db.select({
        totalRevenue: sql<number>`COALESCE(SUM(total_amount), 0)`,
        totalGallons: sql<number>`COALESCE(SUM(quantity), 0)`,
      })
      .from(fuelSalesTransactions)
      .where(and(
        eq(fuelSalesTransactions.orgId, orgId),
        gte(fuelSalesTransactions.transactionDate, thirtyDaysAgo)
      )),

      // Ship Store data (last 30 days)
      Promise.all([
        db.select({
          totalRevenue: sql<number>`COALESCE(SUM(total_amount), 0)`,
          totalTransactions: count(),
        })
        .from(shipStoreTransactions)
        .where(and(
          eq(shipStoreTransactions.orgId, orgId),
          gte(shipStoreTransactions.transactionDate, thirtyDaysAgo)
        ))
        .then(result => result[0]),
        db.select({
          totalValue: sql<number>`COALESCE(SUM(price * quantity), 0)`,
        })
        .from(shipStoreProducts)
        .where(eq(shipStoreProducts.orgId, orgId))
        .then(result => result[0]),
      ]),

      // Rent Roll data
      db.select({
        totalUnits: count(),
        occupiedUnits: sql<number>`COUNT(CASE WHEN status = 'occupied' THEN 1 END)`,
        monthlyIncome: sql<number>`COALESCE(SUM(CASE WHEN status = 'occupied' THEN monthly_rent ELSE 0 END), 0)`,
      })
      .from(rentRollUnits)
      .where(eq(rentRollUnits.orgId, orgId))
      .then(result => result[0]),

      // Modeling Projects data
      db.select({
        activeProjects: sql<number>`COUNT(CASE WHEN status = 'active' THEN 1 END)`,
        completedProjects: sql<number>`COUNT(CASE WHEN status = 'completed' THEN 1 END)`,
        totalValuation: sql<number>`COALESCE(SUM(valuation_amount), 0)`,
      })
      .from(modelingProjects)
      .where(eq(modelingProjects.orgId, orgId))
      .then(result => result[0]),
    ]);

    // Process results
    const crmData = crmStats[0];
    const ddData = ddStats[0];
    const [vdrProjectsData, vdrDocsData, vdrRequestsData] = vdrStats;
    const [recentComps, compsAggregates] = salesCompsData;
    const [recentArticles, recentDeals] = docktalkData;
    const [shipStoreRevData, shipStoreInvData] = shipStoreData;
    const rentRollStats = rentRollData;
    const modelingStats = modelingData;

    const winRate = crmData.totalDeals > 0 
      ? (Number(crmData.wonDeals) / Number(crmData.totalDeals)) * 100 
      : 0;

    const completionRate = ddData.totalProjects > 0 
      ? (Number(ddData.completedProjects) / Number(ddData.totalProjects)) * 100 
      : 0;

    const occupancyRate = rentRollStats?.totalUnits > 0
      ? (Number(rentRollStats.occupiedUnits) / Number(rentRollStats.totalUnits)) * 100
      : 0;

    const avgTransaction = shipStoreRevData?.totalTransactions > 0
      ? Number(shipStoreRevData?.totalRevenue || 0) / Number(shipStoreRevData?.totalTransactions)
      : 0;

    return {
      crm: {
        pipelineValue: Number(crmData.pipelineValue || 0),
        activeDeals: Number(crmData.activeDeals || 0),
        wonDeals: Number(crmData.wonDeals || 0),
        winRate: Math.round(winRate * 10) / 10,
      },
      dueDiligence: {
        activeProjects: Number(ddData.activeProjects || 0),
        completedProjects: Number(ddData.completedProjects || 0),
        totalProjects: Number(ddData.totalProjects || 0),
        completionRate: Math.round(completionRate),
      },
      vdr: {
        activeDataRooms: Number(vdrProjectsData[0]?.activeDataRooms || 0),
        totalDocuments: Number(vdrDocsData[0]?.count || 0),
        pendingRequests: Number(vdrRequestsData[0]?.count || 0),
      },
      salesComps: {
        totalComps: Number(compsAggregates[0]?.totalComps || 0),
        avgPricePerSlip: Math.round(Number(compsAggregates[0]?.avgPricePerSlip || 0)),
        recentComps: recentComps.map(comp => ({
          propertyName: comp.marina,
          pricePerSlip: comp.pricePerSlip,
        })),
      },
      docktalk: {
        recentArticles: recentArticles.map(a => ({ title: a.title })),
        recentDeals,
      },
      fuel: {
        monthlyRevenue: Math.round(Number(fuelData[0]?.totalRevenue || 0)),
        monthlyGallons: Math.round(Number(fuelData[0]?.totalGallons || 0)),
      },
      shipStore: {
        monthlyRevenue: Math.round(Number(shipStoreRevData?.totalRevenue || 0)),
        monthlyTransactions: Number(shipStoreRevData?.totalTransactions || 0),
        avgTransaction: Math.round(avgTransaction),
        inventoryValue: Math.round(Number(shipStoreInvData?.totalValue || 0)),
      },
      rentRoll: {
        totalUnits: Number(rentRollStats?.totalUnits || 0),
        occupancyRate: Math.round(occupancyRate),
        monthlyIncome: Math.round(Number(rentRollStats?.monthlyIncome || 0)),
        vacantUnits: Number(rentRollStats?.totalUnits || 0) - Number(rentRollStats?.occupiedUnits || 0),
      },
      modeling: {
        activeProjects: Number(modelingStats?.activeProjects || 0),
        completedProjects: Number(modelingStats?.completedProjects || 0),
        totalValuation: Math.round(Number(modelingStats?.totalValuation || 0)),
      },
    };
  }
}

export const dashboardService = new DashboardService();
