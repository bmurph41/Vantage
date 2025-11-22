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
   */
  async getAggregatedDashboardData(orgId: string): Promise<any> {
    const { deals } = await import('../db');
    const { projects } = await import('@shared/schema');
    const { vdrProjects, vdrDocuments, vdrDataRequests } = await import('@shared/schema');
    const { salesComps } = await import('@shared/schema');
    const { docktalkArticles, docktalkDeals } = await import('@shared/docktalk-schema');
    const { fuelSalesTransactions } = await import('@shared/schema');
    const { eq, and, gte, sql, desc } = await import('drizzle-orm');
    const { subDays } = await import('date-fns');

    // Fetch CRM data
    const allDeals = await db.select().from(deals).where(eq(deals.orgId, orgId));
    const pipelineValue = allDeals.reduce((sum, deal) => sum + (deal.dealValue || 0), 0);
    const activeDeals = allDeals.filter(d => d.outcome === 'active').length;
    const wonDeals = allDeals.filter(d => d.outcome === 'won').length;
    const totalDeals = allDeals.length;
    const winRate = totalDeals > 0 ? (wonDeals / totalDeals) * 100 : 0;

    // Fetch DD data
    const allProjects = await db.select().from(projects).where(eq(projects.orgId, orgId));
    const activeProjects = allProjects.filter(p => p.status === 'active').length;
    const completedProjects = allProjects.filter(p => p.status === 'completed').length;

    // Fetch VDR data
    const allVdrProjects = await db.select().from(vdrProjects).where(eq(vdrProjects.orgId, orgId));
    const activeDataRooms = allVdrProjects.filter(p => p.status === 'active').length;
    const totalDocuments = await db.select({ count: sql<number>`count(*)` })
      .from(vdrDocuments)
      .where(eq(vdrDocuments.orgId, orgId));
    const pendingRequests = await db.select({ count: sql<number>`count(*)` })
      .from(vdrDataRequests)
      .where(and(
        eq(vdrDataRequests.orgId, orgId),
        eq(vdrDataRequests.status, 'outstanding')
      ));

    // Fetch Sales Comps data
    const recentComps = await db.select().from(salesComps)
      .where(eq(salesComps.orgId, orgId))
      .orderBy(desc(salesComps.createdAt))
      .limit(10);
    const avgPricePerSlip = recentComps.length > 0
      ? recentComps.reduce((sum, comp) => sum + (comp.pricePerSlip || 0), 0) / recentComps.length
      : 0;

    // Fetch DockTalk data
    const thirtyDaysAgo = subDays(new Date(), 30);
    const recentArticles = await db.select().from(docktalkArticles)
      .where(gte(docktalkArticles.publishedAt, thirtyDaysAgo))
      .orderBy(desc(docktalkArticles.publishedAt))
      .limit(5);
    const recentDeals = await db.select().from(docktalkDeals)
      .orderBy(desc(docktalkDeals.createdAt))
      .limit(5);

    // Fetch Fuel data (last 30 days)
    const fuelRevenue = await db.select({
      totalRevenue: sql<number>`SUM(total_amount)`,
      totalGallons: sql<number>`SUM(quantity)`
    })
    .from(fuelSalesTransactions)
    .where(and(
      eq(fuelSalesTransactions.orgId, orgId),
      gte(fuelSalesTransactions.transactionDate, thirtyDaysAgo)
    ));

    return {
      crm: {
        pipelineValue,
        activeDeals,
        wonDeals,
        winRate: Math.round(winRate * 10) / 10,
        recentDeals: allDeals.slice(0, 5),
      },
      dueDiligence: {
        activeProjects,
        completedProjects,
        totalProjects: allProjects.length,
        completionRate: allProjects.length > 0 ? Math.round((completedProjects / allProjects.length) * 100) : 0,
      },
      vdr: {
        activeDataRooms,
        totalDocuments: totalDocuments[0]?.count || 0,
        pendingRequests: pendingRequests[0]?.count || 0,
      },
      salesComps: {
        totalComps: recentComps.length,
        avgPricePerSlip: Math.round(avgPricePerSlip),
        recentComps: recentComps.slice(0, 5),
      },
      docktalk: {
        recentArticles,
        recentDeals,
      },
      fuel: {
        monthlyRevenue: Math.round(fuelRevenue[0]?.totalRevenue || 0),
        monthlyGallons: Math.round(fuelRevenue[0]?.totalGallons || 0),
      },
    };
  }
}

export const dashboardService = new DashboardService();
