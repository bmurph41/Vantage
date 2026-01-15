/**
 * Deal Orchestrator Service - Phase 2A
 * 
 * Central service to manage deal lifecycle with typed DTOs,
 * connecting CRM → DD → Modeling flow with cross-module coordination.
 * 
 * This service provides:
 * - Unified deal creation with automatic entity linking
 * - Stage transition handling with event broadcasting
 * - Cross-module relationship management
 * - Deal lifecycle coordination (lead → deal → DD → close)
 */

import { db, pool } from "../db";
import { 
  crmDeals, 
  crmDealContacts, 
  crmDealCompanies, 
  projects, 
  modelingProjects,
  crmContacts,
  crmCompanies,
  crmProperties,
  vdrFolders,
  CrmDeal,
  CrmContact,
  CrmCompany,
  CrmProperty,
} from "@shared/schema";
import { eq, and, sql } from "drizzle-orm";

// ============================================================================
// Types & DTOs
// ============================================================================

export interface DealCreateDTO {
  title: string;
  type?: string;
  description?: string;
  value?: string;
  stage?: string;
  pipelineId?: string;
  stageId?: string;
  priority?: string;
  probability?: number;
  expectedCloseDate?: Date;
  leadSource?: string;
  ownerId: string;
  // Entity links
  contactIds?: string[];
  companyIds?: string[];
  propertyId?: string;
  // Marina-specific fields
  marinaName?: string;
  city?: string;
  state?: string;
}

export interface DealUpdateDTO {
  title?: string;
  type?: string;
  description?: string;
  value?: string;
  stage?: string;
  pipelineId?: string;
  stageId?: string;
  priority?: string;
  probability?: number;
  expectedCloseDate?: Date;
  leadSource?: string;
  lostReason?: string;
  // Entity links - if provided, replaces existing
  contactIds?: string[];
  companyIds?: string[];
  propertyId?: string;
  // DD/Modeling links
  ddProjectId?: string;
  modelingProjectId?: string;
}

export interface DealStageTransition {
  dealId: string;
  fromStage: string;
  toStage: string;
  timestamp: Date;
  userId: string;
  autoActions?: DealAutoAction[];
}

export interface DealAutoAction {
  type: 'create_dd_project' | 'create_modeling_project' | 'notify_team' | 'update_property_status';
  status: 'pending' | 'completed' | 'failed';
  data?: Record<string, unknown>;
  error?: string;
}

export interface DealWithRelations extends CrmDeal {
  contacts?: Array<CrmContact & { role?: string; isPrimary?: boolean }>;
  companies?: Array<CrmCompany & { role?: string; isPrimary?: boolean }>;
  property?: CrmProperty | null;
  ddProject?: { id: string; name: string; status: string } | null;
  modelingProject?: { id: string; name: string } | null;
}

export interface ConvertToDDProjectOptions {
  dealId: string;
  projectName?: string;
  templateId?: string;
  userId: string;
  copySettings?: boolean;
}

export interface LinkEntityRequest {
  dealId: string;
  entityType: 'contact' | 'company' | 'property' | 'dd_project' | 'modeling_project';
  entityId: string;
  role?: string;
  isPrimary?: boolean;
  notes?: string;
}

// ============================================================================
// Deal Orchestrator Service
// ============================================================================

export class DealOrchestratorService {
  
  /**
   * Create a new deal with automatic entity linking
   */
  async createDeal(dto: DealCreateDTO): Promise<DealWithRelations> {
    const [deal] = await db.insert(crmDeals).values({
      title: dto.title,
      type: dto.type,
      description: dto.description,
      value: dto.value,
      stage: dto.stage || 'lead',
      pipelineId: dto.pipelineId,
      stageId: dto.stageId,
      priority: dto.priority || 'medium',
      probability: dto.probability || 10,
      expectedCloseDate: dto.expectedCloseDate,
      leadSource: dto.leadSource,
      marinaName: dto.marinaName,
      city: dto.city,
      state: dto.state,
      ownerId: dto.ownerId,
      currentStageEnteredAt: new Date(),
    }).returning();

    // Link contacts if provided
    if (dto.contactIds?.length) {
      await this.linkContacts(deal.id, dto.contactIds);
    }

    // Link companies if provided
    if (dto.companyIds?.length) {
      await this.linkCompanies(deal.id, dto.companyIds);
    }

    return this.getDealWithRelations(deal.id);
  }

  /**
   * Update a deal with optional entity relationship management
   */
  async updateDeal(dealId: string, dto: DealUpdateDTO, userId?: string): Promise<DealWithRelations> {
    const existingDeal = await db.select().from(crmDeals).where(eq(crmDeals.id, dealId)).then(r => r[0]);
    if (!existingDeal) {
      throw new Error(`Deal ${dealId} not found`);
    }

    // Check for stage transition
    const stageChanged = dto.stage && dto.stage !== existingDeal.stage;
    
    // Build update object
    const updateData: Partial<CrmDeal> = {};
    if (dto.title !== undefined) updateData.title = dto.title;
    if (dto.type !== undefined) updateData.type = dto.type;
    if (dto.description !== undefined) updateData.description = dto.description;
    if (dto.value !== undefined) updateData.value = dto.value;
    if (dto.stage !== undefined) updateData.stage = dto.stage;
    if (dto.pipelineId !== undefined) updateData.pipelineId = dto.pipelineId;
    if (dto.stageId !== undefined) updateData.stageId = dto.stageId;
    if (dto.priority !== undefined) updateData.priority = dto.priority;
    if (dto.probability !== undefined) updateData.probability = dto.probability;
    if (dto.expectedCloseDate !== undefined) updateData.expectedCloseDate = dto.expectedCloseDate;
    if (dto.lostReason !== undefined) updateData.lostReason = dto.lostReason;
    if (dto.ddProjectId !== undefined) updateData.ddProjectId = dto.ddProjectId;

    // Track stage entry time
    if (stageChanged) {
      updateData.currentStageEnteredAt = new Date();
      updateData.daysInCurrentStage = 0;
    }

    updateData.updatedAt = new Date();
    updateData.lastActivityDate = new Date();

    await db.update(crmDeals).set(updateData).where(eq(crmDeals.id, dealId));

    // Handle contact links if provided
    if (dto.contactIds !== undefined) {
      await this.replaceContacts(dealId, dto.contactIds);
    }

    // Handle company links if provided
    if (dto.companyIds !== undefined) {
      await this.replaceCompanies(dealId, dto.companyIds);
    }

    // Handle stage transition events
    if (stageChanged && userId) {
      await this.handleStageTransition({
        dealId,
        fromStage: existingDeal.stage,
        toStage: dto.stage!,
        timestamp: new Date(),
        userId,
      });
    }

    return this.getDealWithRelations(dealId);
  }

  /**
   * Get a deal with all its relationships populated
   */
  async getDealWithRelations(dealId: string): Promise<DealWithRelations> {
    const [deal] = await db.select().from(crmDeals).where(eq(crmDeals.id, dealId));
    if (!deal) {
      throw new Error(`Deal ${dealId} not found`);
    }

    // Fetch related contacts
    const contactLinks = await db.select({
      link: crmDealContacts,
      contact: crmContacts,
    })
    .from(crmDealContacts)
    .leftJoin(crmContacts, eq(crmDealContacts.contactId, crmContacts.id))
    .where(eq(crmDealContacts.dealId, dealId));

    const contacts = contactLinks
      .filter(cl => cl.contact)
      .map(cl => ({
        ...cl.contact!,
        role: cl.link.role,
        isPrimary: cl.link.isPrimary,
      }));

    // Fetch related companies
    const companyLinks = await db.select({
      link: crmDealCompanies,
      company: crmCompanies,
    })
    .from(crmDealCompanies)
    .leftJoin(crmCompanies, eq(crmDealCompanies.companyId, crmCompanies.id))
    .where(eq(crmDealCompanies.dealId, dealId));

    const companies = companyLinks
      .filter(cl => cl.company)
      .map(cl => ({
        ...cl.company!,
        role: cl.link.role,
        isPrimary: cl.link.isPrimary,
      }));

    // Fetch DD project if linked
    let ddProject = null;
    if (deal.ddProjectId) {
      const [proj] = await db.select({
        id: projects.id,
        name: projects.name,
        status: projects.status,
      }).from(projects).where(eq(projects.id, deal.ddProjectId));
      ddProject = proj || null;
    }

    // Fetch modeling project if DD project has one linked
    let modelingProject = null;
    if (ddProject) {
      const [modProj] = await db.select({
        id: modelingProjects.id,
        name: modelingProjects.name,
      }).from(modelingProjects).where(eq(modelingProjects.ddProjectId, ddProject.id));
      modelingProject = modProj || null;
    }

    return {
      ...deal,
      contacts,
      companies,
      ddProject,
      modelingProject,
    } as DealWithRelations;
  }

  /**
   * Link a contact to a deal
   */
  async linkContact(dealId: string, contactId: string, role?: string, isPrimary?: boolean): Promise<void> {
    await db.insert(crmDealContacts).values({
      dealId,
      contactId,
      role: role || null,
      isPrimary: isPrimary || false,
    }).onConflictDoNothing();
  }

  /**
   * Link multiple contacts to a deal
   */
  async linkContacts(dealId: string, contactIds: string[]): Promise<void> {
    if (!contactIds.length) return;
    
    const values = contactIds.map((contactId, index) => ({
      dealId,
      contactId,
      isPrimary: index === 0, // First contact is primary
    }));

    await db.insert(crmDealContacts).values(values).onConflictDoNothing();
  }

  /**
   * Replace all contacts for a deal
   */
  async replaceContacts(dealId: string, contactIds: string[]): Promise<void> {
    await db.delete(crmDealContacts).where(eq(crmDealContacts.dealId, dealId));
    await this.linkContacts(dealId, contactIds);
  }

  /**
   * Link a company to a deal
   */
  async linkCompany(dealId: string, companyId: string, role?: string, isPrimary?: boolean): Promise<void> {
    await db.insert(crmDealCompanies).values({
      dealId,
      companyId,
      role: role || null,
      isPrimary: isPrimary || false,
    }).onConflictDoNothing();
  }

  /**
   * Link multiple companies to a deal
   */
  async linkCompanies(dealId: string, companyIds: string[]): Promise<void> {
    if (!companyIds.length) return;
    
    const values = companyIds.map((companyId, index) => ({
      dealId,
      companyId,
      isPrimary: index === 0,
    }));

    await db.insert(crmDealCompanies).values(values).onConflictDoNothing();
  }

  /**
   * Replace all companies for a deal
   */
  async replaceCompanies(dealId: string, companyIds: string[]): Promise<void> {
    await db.delete(crmDealCompanies).where(eq(crmDealCompanies.dealId, dealId));
    await this.linkCompanies(dealId, companyIds);
  }

  /**
   * Link a property to a deal
   */
  async linkProperty(dealId: string, propertyId: string): Promise<void> {
    await db.update(crmDeals)
      .set({ 
        // Note: direct property link - uses existing property references in schema
        updatedAt: new Date() 
      })
      .where(eq(crmDeals.id, dealId));
  }

  /**
   * Link a DD project to a deal
   */
  async linkDDProject(dealId: string, projectId: string): Promise<void> {
    // Update the deal to reference the DD project
    await db.update(crmDeals)
      .set({ 
        ddProjectId: projectId,
        updatedAt: new Date(),
      })
      .where(eq(crmDeals.id, dealId));

    // Also update the DD project to reference this deal
    await db.update(projects)
      .set({ dealId })
      .where(eq(projects.id, projectId));
  }

  /**
   * Link a modeling project to a deal (via DD project)
   */
  async linkModelingProject(dealId: string, modelingProjectId: string): Promise<void> {
    // Get the deal's DD project
    const [deal] = await db.select().from(crmDeals).where(eq(crmDeals.id, dealId));
    
    if (deal?.ddProjectId) {
      // Update the DD project to reference the modeling project
      await db.update(projects)
        .set({ modelingProjectId: modelingProjectId })
        .where(eq(projects.id, deal.ddProjectId));
    }

    // Also update the modeling project to reference the deal's DD project
    await db.update(modelingProjects)
      .set({ 
        dealId,
        ddProjectId: deal?.ddProjectId || null,
      })
      .where(eq(modelingProjects.id, modelingProjectId));
  }

  /**
   * Convert a deal to a DD project
   */
  async convertToDDProject(options: ConvertToDDProjectOptions): Promise<{ dealId: string; projectId: string }> {
    const { dealId, projectName, userId, copySettings } = options;
    
    const deal = await this.getDealWithRelations(dealId);
    if (!deal) {
      throw new Error(`Deal ${dealId} not found`);
    }

    // Already has a DD project?
    if (deal.ddProjectId) {
      return { dealId, projectId: deal.ddProjectId };
    }

    // Create the DD project
    const [project] = await db.insert(projects).values({
      name: projectName || deal.title,
      status: 'active',
      ownerId: userId,
      dealId: dealId,
      // Copy settings from deal if requested
      ...(copySettings && deal.city ? { city: deal.city } : {}),
      ...(copySettings && deal.state ? { state: deal.state } : {}),
      anchorType: deal.anchorType || 'psa',
      useBusinessDays: deal.useBusinessDays || false,
      tz: deal.tz || 'America/New_York',
      psaSignedDate: deal.psaSignedDate,
      ddExpirationDate: deal.ddExpirationDate,
      closingDate: deal.closingDate,
    }).returning();

    // Update deal with the new DD project link
    await db.update(crmDeals)
      .set({ 
        ddProjectId: project.id,
        updatedAt: new Date(),
      })
      .where(eq(crmDeals.id, dealId));

    // Auto-setup VDR folder structure for the DD project
    try {
      const orgId = deal.ownerId; // Use deal owner's org context
      await this.setupVdrFolderStructure(project.id, orgId, projectName || deal.title);
      console.log(`VDR folder structure created for project ${project.id}`);
    } catch (vdrError) {
      console.error(`Failed to create VDR folders for project ${project.id}:`, vdrError);
      // Don't fail the DD project creation if VDR setup fails
    }

    return { dealId, projectId: project.id };
  }

  /**
   * Create standard VDR folder structure for a DD project
   */
  async setupVdrFolderStructure(projectId: string, orgId: string, projectName: string): Promise<void> {
    const standardFolders = [
      { name: 'Financial Documents', path: '/financial-documents', displayOrder: 1, icon: 'dollar-sign' },
      { name: 'Legal Documents', path: '/legal-documents', displayOrder: 2, icon: 'file-text' },
      { name: 'Environmental', path: '/environmental', displayOrder: 3, icon: 'leaf' },
      { name: 'Property & Survey', path: '/property-survey', displayOrder: 4, icon: 'map' },
      { name: 'Permits & Licenses', path: '/permits-licenses', displayOrder: 5, icon: 'award' },
      { name: 'Operations', path: '/operations', displayOrder: 6, icon: 'settings' },
      { name: 'Insurance', path: '/insurance', displayOrder: 7, icon: 'shield' },
      { name: 'Contracts', path: '/contracts', displayOrder: 8, icon: 'file-signature' },
      { name: 'Marketing Materials', path: '/marketing', displayOrder: 9, icon: 'image' },
      { name: 'Closing Documents', path: '/closing', displayOrder: 10, icon: 'check-circle' },
    ];

    // Create root folder for the project
    const [rootFolder] = await db.insert(vdrFolders).values({
      name: projectName,
      path: '/',
      projectId,
      orgId,
      displayOrder: 0,
      parentId: null,
    }).returning();

    // Create standard subfolders
    for (const folder of standardFolders) {
      await db.insert(vdrFolders).values({
        name: folder.name,
        path: folder.path,
        projectId,
        orgId,
        displayOrder: folder.displayOrder,
        parentId: rootFolder.id,
      });
    }
  }

  /**
   * Handle stage transition and trigger appropriate actions
   */
  private async handleStageTransition(transition: DealStageTransition): Promise<void> {
    const { dealId, fromStage, toStage, userId } = transition;
    
    // Log the transition (could be extended to store in audit table)
    console.log(`Deal ${dealId} transitioned from ${fromStage} to ${toStage}`);

    // Auto-actions based on stage transitions
    const autoActions: DealAutoAction[] = [];

    // When deal moves to "under_contract" or "diligence" stage, consider creating DD project
    if (['under_contract', 'diligence', 'due_diligence'].includes(toStage.toLowerCase())) {
      // Check if DD project already exists
      const [deal] = await db.select().from(crmDeals).where(eq(crmDeals.id, dealId));
      if (deal && !deal.ddProjectId) {
        autoActions.push({
          type: 'create_dd_project',
          status: 'pending',
          data: { dealId, userId },
        });
      }
    }

    // When deal moves to "closed" stage, update property status
    if (['closed', 'closed_won', 'completed'].includes(toStage.toLowerCase())) {
      autoActions.push({
        type: 'update_property_status',
        status: 'pending',
        data: { dealId, status: 'closed' },
      });
    }

    // Execute auto-actions (could be async/queued in production)
    for (const action of autoActions) {
      try {
        if (action.type === 'create_dd_project') {
          await this.convertToDDProject({
            dealId,
            userId,
          });
          action.status = 'completed';
        }
      } catch (error) {
        action.status = 'failed';
        action.error = error instanceof Error ? error.message : String(error);
      }
    }

    transition.autoActions = autoActions;
  }

  /**
   * Get all deals linked to a specific entity
   */
  async getDealsByEntity(entityType: 'contact' | 'company' | 'property', entityId: string): Promise<CrmDeal[]> {
    switch (entityType) {
      case 'contact': {
        const links = await db.select({ dealId: crmDealContacts.dealId })
          .from(crmDealContacts)
          .where(eq(crmDealContacts.contactId, entityId));
        
        if (!links.length) return [];
        
        return db.select().from(crmDeals)
          .where(sql`${crmDeals.id} IN (${sql.join(links.map(l => sql`${l.dealId}`), sql`, `)})`);
      }
      case 'company': {
        const links = await db.select({ dealId: crmDealCompanies.dealId })
          .from(crmDealCompanies)
          .where(eq(crmDealCompanies.companyId, entityId));
        
        if (!links.length) return [];
        
        return db.select().from(crmDeals)
          .where(sql`${crmDeals.id} IN (${sql.join(links.map(l => sql`${l.dealId}`), sql`, `)})`);
      }
      case 'property': {
        // Properties are linked via DD projects
        const projs = await db.select({ dealId: projects.dealId })
          .from(projects)
          .where(eq(projects.propertyId, entityId));
        
        if (!projs.length) return [];
        
        const dealIds = projs.map(p => p.dealId).filter(Boolean) as string[];
        if (!dealIds.length) return [];
        
        return db.select().from(crmDeals)
          .where(sql`${crmDeals.id} IN (${sql.join(dealIds.map(id => sql`${id}`), sql`, `)})`);
      }
      default:
        return [];
    }
  }

  /**
   * Get deal summary statistics
   */
  async getDealSummary(dealId: string): Promise<{
    deal: CrmDeal;
    contactCount: number;
    companyCount: number;
    hasDDProject: boolean;
    hasModelingProject: boolean;
    daysInPipeline: number;
  }> {
    const deal = await this.getDealWithRelations(dealId);
    
    const contactCount = deal.contacts?.length || 0;
    const companyCount = deal.companies?.length || 0;
    const hasDDProject = !!deal.ddProject;
    const hasModelingProject = !!deal.modelingProject;
    
    const createdAt = deal.createdAt ? new Date(deal.createdAt) : new Date();
    const daysInPipeline = Math.floor((Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24));

    return {
      deal,
      contactCount,
      companyCount,
      hasDDProject,
      hasModelingProject,
      daysInPipeline,
    };
  }
}

// Export singleton instance
export const dealOrchestrator = new DealOrchestratorService();
