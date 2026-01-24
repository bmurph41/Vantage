import { Router, Request, Response } from 'express';
import { db } from '../db';
import { 
  crmDeals, 
  projects, 
  modelingProjects, 
  crmProperties,
  crmContacts,
  crmCompanies,
  tasks,
  vdrFolders,
  vdrDocuments,
  users,
  organizations
} from '@shared/schema';
import { eq, and, desc, sql, inArray } from 'drizzle-orm';

export const dealWorkspaceRouter = Router();

function getUserId(req: Request): string | null {
  const user = (req as any).user;
  return user?.id || user?.claims?.sub || null;
}

function getOrgId(req: Request): string | null {
  return (req as any).orgId || (req as any).user?.orgId || null;
}

function requireAuth(req: Request, res: Response): { userId: string; orgId: string } | null {
  const userId = getUserId(req);
  const orgId = getOrgId(req);
  if (!userId) {
    res.status(401).json({ error: 'Authentication required' });
    return null;
  }
  if (!orgId) {
    res.status(400).json({ error: 'Organization required' });
    return null;
  }
  return { userId, orgId };
}

interface DealWorkspaceResponse {
  deal: {
    id: string;
    name: string;
    stage: string;
    value: number | null;
    probability: number | null;
    expectedCloseDate: Date | null;
    status: string | null;
    createdAt: Date;
    updatedAt: Date | null;
  } | null;
  property: {
    id: string;
    name: string;
    address: string | null;
    city: string | null;
    state: string | null;
    totalSlips: number | null;
    askingPrice: number | null;
  } | null;
  contacts: Array<{
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    role: string | null;
  }>;
  ddProject: {
    id: string;
    name: string;
    status: string;
    progress: number;
    tasksTotal: number;
    tasksCompleted: number;
    ddExpiration: Date | null;
    closingDate: Date | null;
  } | null;
  modelingProject: {
    id: string;
    name: string;
    purchasePrice: number | null;
    noiEstimate: number | null;
    capRateEstimate: number | null;
    scenariosCount: number;
    lastUpdated: Date | null;
  } | null;
  vdr: {
    projectId: string | null;
    foldersCount: number;
    documentsCount: number;
    externalUsersCount: number;
    recentDocuments: Array<{
      id: string;
      name: string;
      uploadedAt: Date;
    }>;
  } | null;
  crossLinks: {
    dealId: string | null;
    ddProjectId: string | null;
    modelingProjectId: string | null;
    vdrProjectId: string | null;
    propertyId: string | null;
  };
}

dealWorkspaceRouter.get('/api/deals/:dealId/workspace', async (req: Request, res: Response) => {
  const auth = requireAuth(req, res);
  if (!auth) return;
  const { orgId } = auth;
  const { dealId } = req.params;

  try {
    const [dealData] = await db
      .select()
      .from(crmDeals)
      .where(eq(crmDeals.id, dealId))
      .limit(1);

    if (!dealData) {
      return res.status(404).json({ error: 'Deal not found' });
    }

    let propertyData = null;
    if (dealData.propertyId) {
      const [prop] = await db
        .select()
        .from(crmProperties)
        .where(eq(crmProperties.id, dealData.propertyId))
        .limit(1);
      if (prop) {
        propertyData = {
          id: prop.id,
          name: prop.name,
          address: prop.address,
          city: prop.city,
          state: prop.state,
          totalSlips: prop.totalSlips,
          askingPrice: prop.askingPrice,
        };
      }
    }

    let ddProject = null;
    const ddProjectSearch = dealData.dealName 
      ? await db
          .select()
          .from(projects)
          .where(and(
            eq(projects.orgId, orgId),
            sql`LOWER(${projects.name}) LIKE LOWER(${'%' + dealData.dealName + '%'})`
          ))
          .limit(1)
      : [];
    
    if (ddProjectSearch.length > 0) {
      const proj = ddProjectSearch[0];
      const tasksList = await db
        .select({ status: tasks.status })
        .from(tasks)
        .where(eq(tasks.projectId, proj.id));
      
      const tasksTotal = tasksList.length;
      const tasksCompleted = tasksList.filter(t => t.status === 'completed').length;
      const progress = tasksTotal > 0 ? Math.round((tasksCompleted / tasksTotal) * 100) : 0;

      ddProject = {
        id: proj.id,
        name: proj.name,
        status: proj.status,
        progress,
        tasksTotal,
        tasksCompleted,
        ddExpiration: proj.ddExpiration,
        closingDate: proj.closingDate,
      };
    }

    let modelingProject = null;
    const modelingSearch = await db
      .select()
      .from(modelingProjects)
      .where(and(
        eq(modelingProjects.orgId, orgId),
        dealData.propertyId 
          ? eq(modelingProjects.linkedPropertyId, dealData.propertyId)
          : sql`false`
      ))
      .limit(1);
    
    if (modelingSearch.length === 0 && dealData.dealName) {
      const altSearch = await db
        .select()
        .from(modelingProjects)
        .where(and(
          eq(modelingProjects.orgId, orgId),
          sql`LOWER(${modelingProjects.marinaName}) LIKE LOWER(${'%' + dealData.dealName + '%'})`
        ))
        .limit(1);
      if (altSearch.length > 0) {
        modelingSearch.push(altSearch[0]);
      }
    }

    if (modelingSearch.length > 0) {
      const mp = modelingSearch[0];
      modelingProject = {
        id: mp.id,
        name: mp.marinaName || mp.id,
        purchasePrice: mp.purchasePrice ? Number(mp.purchasePrice) : null,
        noiEstimate: null,
        capRateEstimate: mp.capRate ? Number(mp.capRate) : null,
        scenariosCount: 0,
        lastUpdated: mp.updatedAt,
      };
    }

    let vdrData = null;
    const vdrProjectId = ddProject?.id || null;
    if (vdrProjectId) {
      const [foldersCount, documentsCount, recentDocs] = await Promise.all([
        db.select({ count: sql<number>`count(*)` })
          .from(vdrFolders)
          .where(eq(vdrFolders.projectId, vdrProjectId)),
        db.select({ count: sql<number>`count(*)` })
          .from(vdrDocuments)
          .where(eq(vdrDocuments.projectId, vdrProjectId)),
        db.select({ id: vdrDocuments.id, name: vdrDocuments.name, uploadedAt: vdrDocuments.createdAt })
          .from(vdrDocuments)
          .where(eq(vdrDocuments.projectId, vdrProjectId))
          .orderBy(desc(vdrDocuments.createdAt))
          .limit(5),
      ]);

      vdrData = {
        projectId: vdrProjectId,
        foldersCount: Number(foldersCount[0]?.count || 0),
        documentsCount: Number(documentsCount[0]?.count || 0),
        externalUsersCount: 0,
        recentDocuments: recentDocs.map(d => ({
          id: d.id,
          name: d.name,
          uploadedAt: d.uploadedAt,
        })),
      };
    }

    const contactIds = [dealData.contactId].filter(Boolean) as string[];
    const contacts = contactIds.length > 0
      ? await db
          .select({ id: crmContacts.id, name: crmContacts.name, email: crmContacts.email, phone: crmContacts.phone })
          .from(crmContacts)
          .where(inArray(crmContacts.id, contactIds))
      : [];

    const response: DealWorkspaceResponse = {
      deal: {
        id: dealData.id,
        name: dealData.dealName || 'Untitled Deal',
        stage: dealData.stage || 'unknown',
        value: dealData.value ? Number(dealData.value) : null,
        probability: dealData.probability,
        expectedCloseDate: dealData.expectedClose,
        status: dealData.outcome,
        createdAt: dealData.createdAt,
        updatedAt: dealData.updatedAt,
      },
      property: propertyData,
      contacts: contacts.map(c => ({
        id: c.id,
        name: c.name,
        email: c.email,
        phone: c.phone,
        role: null,
      })),
      ddProject,
      modelingProject,
      vdr: vdrData,
      crossLinks: {
        dealId: dealData.id,
        ddProjectId: ddProject?.id || null,
        modelingProjectId: modelingProject?.id || null,
        vdrProjectId: vdrData?.projectId || null,
        propertyId: dealData.propertyId,
      },
    };

    res.json(response);
  } catch (error) {
    console.error('Error fetching deal workspace:', error);
    res.status(500).json({ error: 'Failed to fetch deal workspace' });
  }
});

dealWorkspaceRouter.post('/api/deals/:dealId/link', async (req: Request, res: Response) => {
  const auth = requireAuth(req, res);
  if (!auth) return;
  const { orgId } = auth;
  const { dealId } = req.params;
  const { ddProjectId, modelingProjectId, propertyId } = req.body;

  try {
    const updates: any = {};
    if (propertyId !== undefined) {
      updates.propertyId = propertyId;
    }

    if (Object.keys(updates).length > 0) {
      await db.update(crmDeals)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(crmDeals.id, dealId));
    }

    if (modelingProjectId) {
      const [deal] = await db.select({ propertyId: crmDeals.propertyId }).from(crmDeals).where(eq(crmDeals.id, dealId)).limit(1);
      if (deal?.propertyId) {
        await db.update(modelingProjects)
          .set({ linkedPropertyId: deal.propertyId, updatedAt: new Date() })
          .where(eq(modelingProjects.id, modelingProjectId));
      }
    }

    res.json({ success: true, message: 'Cross-module links updated' });
  } catch (error) {
    console.error('Error linking deal:', error);
    res.status(500).json({ error: 'Failed to link deal' });
  }
});

dealWorkspaceRouter.get('/api/workspace/cross-module-summary', async (req: Request, res: Response) => {
  const auth = requireAuth(req, res);
  if (!auth) return;
  const { orgId } = auth;

  try {
    const [dealsCount, ddProjectsCount, modelingCount, vdrProjectsCount] = await Promise.all([
      db.select({ count: sql<number>`count(*)` }).from(crmDeals),
      db.select({ count: sql<number>`count(*)` }).from(projects).where(eq(projects.orgId, orgId)),
      db.select({ count: sql<number>`count(*)` }).from(modelingProjects).where(eq(modelingProjects.orgId, orgId)),
      db.select({ count: sql<number>`count(distinct ${vdrFolders.projectId})` }).from(vdrFolders),
    ]);

    const linkedDeals = await db
      .select({ count: sql<number>`count(*)` })
      .from(crmDeals)
      .where(sql`${crmDeals.propertyId} IS NOT NULL`);

    res.json({
      totalDeals: Number(dealsCount[0]?.count || 0),
      totalDDProjects: Number(ddProjectsCount[0]?.count || 0),
      totalModelingProjects: Number(modelingCount[0]?.count || 0),
      totalVDRProjects: Number(vdrProjectsCount[0]?.count || 0),
      linkedDeals: Number(linkedDeals[0]?.count || 0),
      connectivityScore: 0,
    });
  } catch (error) {
    console.error('Error fetching cross-module summary:', error);
    res.status(500).json({ error: 'Failed to fetch summary' });
  }
});

dealWorkspaceRouter.get('/api/deals', async (req: Request, res: Response) => {
  const auth = requireAuth(req, res);
  if (!auth) return;

  try {
    const deals = await db
      .select({
        id: crmDeals.id,
        name: crmDeals.dealName,
        stage: crmDeals.stage,
        value: crmDeals.value,
        probability: crmDeals.probability,
        expectedClose: crmDeals.expectedClose,
        outcome: crmDeals.outcome,
        propertyId: crmDeals.propertyId,
        createdAt: crmDeals.createdAt,
      })
      .from(crmDeals)
      .orderBy(desc(crmDeals.createdAt))
      .limit(100);

    res.json(deals);
  } catch (error) {
    console.error('Error fetching deals:', error);
    res.status(500).json({ error: 'Failed to fetch deals' });
  }
});
