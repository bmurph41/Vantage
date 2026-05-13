import { Router, Request, Response } from 'express';
import { omBuilderService } from '../services/om-builder-service';
import { z } from 'zod';
import { fromZodError } from 'zod-validation-error';
import * as fs from 'fs';
import { omTemplateRegistry, getOMTemplateById, getOMTemplatesByAssetClass } from '../templates/om-templates';

const router = Router();

function getUserId(req: Request): string | null {
  const user = (req as any).user;
  return user?.id || user?.claims?.sub || null;
}

function getOrgId(req: Request): string | null {
  return (req as any).user?.orgId || (req as any).tenantId || null;
}

const generateOMSchema = z.object({
  templateId: z.string().nullable().optional(),
  title: z.string().min(1, 'Title is required'),
});

// Asset-class-specific OM templates from the registry
router.get('/asset-templates', async (req: Request, res: Response) => {
  try {
    const assetClass = req.query.assetClass as string | undefined;
    const templates = assetClass
      ? getOMTemplatesByAssetClass(assetClass)
      : omTemplateRegistry;
    res.json(templates);
  } catch (error) {
    console.error('Error fetching asset OM templates:', error);
    res.status(500).json({ error: 'Failed to fetch asset templates' });
  }
});

router.get('/asset-templates/:id', async (req: Request, res: Response) => {
  try {
    const template = getOMTemplateById(req.params.id);
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }
    res.json(template);
  } catch (error) {
    console.error('Error fetching asset OM template:', error);
    res.status(500).json({ error: 'Failed to fetch asset template' });
  }
});

router.get('/templates', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const templates = await omBuilderService.getTemplates(orgId || undefined);
    res.json(templates);
  } catch (error) {
    console.error('Error fetching OM templates:', error);
    res.status(500).json({ error: 'Failed to fetch templates' });
  }
});

// Get enriched OM data by modeling project ID (includes comps, demographics)
router.get('/project/:projectId/data', async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;

    const { db } = await import('../db');
    const { modelingProjects, crmDeals } = await import('@shared/schema');
    const { eq } = await import('drizzle-orm');

    const [project] = await db
      .select()
      .from(modelingProjects)
      .where(eq(modelingProjects.id, projectId))
      .limit(1);

    if (!project) {
      return res.status(404).json({ error: 'Modeling project not found' });
    }

    // Find associated deal
    let dealId: string | null = null;
    if ((project as any).linkedDealId) {
      dealId = (project as any).linkedDealId;
    } else if ((project as any).linkedPropertyId) {
      const [deal] = await db
        .select({ id: crmDeals.id })
        .from(crmDeals)
        .where(eq(crmDeals.propertyId, (project as any).linkedPropertyId))
        .limit(1);
      dealId = deal?.id || null;
    }

    if (!dealId) {
      return res.json({
        projectId,
        dealId: null,
        propertyOverview: {
          name: (project as any).marinaName || (project as any).propertyName || 'Unnamed Project',
          city: (project as any).city || null,
          state: (project as any).state || null,
        },
        financialSummary: {
          purchasePrice: (project as any).purchasePrice ? Number((project as any).purchasePrice) : null,
          noiEstimate: (project as any).noi ? Number((project as any).noi) : null,
          capRate: (project as any).capRate ? Number((project as any).capRate) : null,
        },
        compAnalytics: { salesComps: [], rateComps: [], salesCompStats: { count: 0 }, rateCompStats: { count: 0 } },
        demographics: null,
        generatedAt: new Date(),
      });
    }

    const data = await omBuilderService.aggregateOMData(dealId);
    if (!data) {
      return res.status(404).json({ error: 'Could not aggregate data' });
    }

    res.json({ ...data, projectId });
  } catch (error) {
    console.error('Error aggregating project OM data:', error);
    res.status(500).json({ error: 'Failed to aggregate project data' });
  }
});

router.get('/:dealId/data', async (req: Request, res: Response) => {
  try {
    const { dealId } = req.params;
    const data = await omBuilderService.aggregateOMData(dealId);
    
    if (!data) {
      return res.status(404).json({ error: 'Deal not found' });
    }
    
    res.json(data);
  } catch (error) {
    console.error('Error aggregating OM data:', error);
    res.status(500).json({ error: 'Failed to aggregate deal data' });
  }
});

router.post('/:dealId/generate', async (req: Request, res: Response) => {
  try {
    const { dealId } = req.params;
    
    const parsed = generateOMSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ 
        error: fromZodError(parsed.error).toString() 
      });
    }
    
    const { templateId, title } = parsed.data;
    const document = await omBuilderService.generateOM(
      dealId, 
      templateId || null, 
      title
    );
    
    res.status(201).json(document);
  } catch (error) {
    console.error('Error generating OM:', error);
    res.status(500).json({ error: 'Failed to generate OM document' });
  }
});

router.get('/:dealId/documents', async (req: Request, res: Response) => {
  try {
    const { dealId } = req.params;
    const documents = await omBuilderService.getDocumentsByDeal(dealId);
    res.json(documents);
  } catch (error) {
    console.error('Error fetching OM documents:', error);
    res.status(500).json({ error: 'Failed to fetch documents' });
  }
});

router.get('/documents/:documentId', async (req: Request, res: Response) => {
  try {
    const { documentId } = req.params;
    const document = await omBuilderService.getDocument(documentId);
    
    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }
    
    res.json(document);
  } catch (error) {
    console.error('Error fetching OM document:', error);
    res.status(500).json({ error: 'Failed to fetch document' });
  }
});

const exportPdfSchema = z.object({
  templateType: z.enum(['standard', 'premium', 'executive']).optional(),
  companyName: z.string().optional(),
});

router.post('/documents/:documentId/export-pdf', async (req: Request, res: Response) => {
  try {
    const { documentId } = req.params;
    
    const parsed = exportPdfSchema.safeParse(req.body);
    const options = parsed.success ? parsed.data : {};
    
    const pdfUrl = await omBuilderService.exportToPDF(documentId, options as any);
    res.json({ pdfUrl });
  } catch (error) {
    console.error('Error exporting OM to PDF:', error);
    res.status(500).json({ error: 'Failed to export PDF' });
  }
});

router.get('/documents/:documentId/pdf', async (req: Request, res: Response) => {
  try {
    const { documentId } = req.params;
    const templateType = req.query.templateType as string | undefined;
    
    const filePath = await omBuilderService.getPDFFilePath(documentId);
    
    if (filePath && fs.existsSync(filePath)) {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="offering-memorandum-${documentId}.pdf"`);
      return res.sendFile(filePath);
    }
    
    const pdfBytes = await omBuilderService.generatePDFBytes(
      documentId, 
      templateType as 'standard' | 'premium' | 'executive' | undefined
    );
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="offering-memorandum-${documentId}.pdf"`);
    res.send(Buffer.from(pdfBytes));
  } catch (error) {
    console.error('Error serving PDF:', error);
    res.status(500).json({ error: 'Failed to generate PDF' });
  }
});

router.get('/documents/:documentId/download-pdf', async (req: Request, res: Response) => {
  try {
    const { documentId } = req.params;
    const templateType = req.query.templateType as string | undefined;
    
    const document = await omBuilderService.getDocument(documentId);
    const fileName = document?.title 
      ? `${document.title.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`
      : `offering-memorandum-${documentId}.pdf`;
    
    const pdfBytes = await omBuilderService.generatePDFBytes(
      documentId,
      templateType as 'standard' | 'premium' | 'executive' | undefined
    );
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(Buffer.from(pdfBytes));
  } catch (error) {
    console.error('Error downloading PDF:', error);
    res.status(500).json({ error: 'Failed to download PDF' });
  }
});

// ---------------------------------------------------------------------------
// Brand Settings
// ---------------------------------------------------------------------------

// Brand settings — persisted in organization_brand_settings (Day 4 sub-fix 4b).
// Previously an in-memory Map that was wiped on every restart and divergent
// across horizontal replicas.

const DEFAULT_BRAND_SETTINGS = {
  primaryColor: '#1e3a5f',
  secondaryColor: '#c9a96e',
  fontFamily: 'sans-serif',
  logoUrl: null as string | null,
  companyName: '',
};

router.get('/brand-settings', async (req: Request, res: Response) => {
  const orgId = getOrgId(req);
  if (!orgId) {
    return res.status(401).json({ error: 'Unauthenticated' });
  }
  try {
    const { pool } = await import('../db');
    const result = await pool.query(
      `SELECT primary_color, secondary_color, font_family, logo_url, company_name, settings_json, updated_at
         FROM organization_brand_settings WHERE org_id = $1`,
      [orgId],
    );
    if (result.rows.length === 0) {
      return res.json(DEFAULT_BRAND_SETTINGS);
    }
    const row = result.rows[0];
    return res.json({
      primaryColor: row.primary_color ?? DEFAULT_BRAND_SETTINGS.primaryColor,
      secondaryColor: row.secondary_color ?? DEFAULT_BRAND_SETTINGS.secondaryColor,
      fontFamily: row.font_family ?? DEFAULT_BRAND_SETTINGS.fontFamily,
      logoUrl: row.logo_url ?? null,
      companyName: row.company_name ?? '',
      ...(row.settings_json ?? {}),
      updatedAt: row.updated_at,
    });
  } catch (error) {
    console.error('Error fetching brand settings:', error);
    return res.status(500).json({ error: 'Failed to fetch brand settings' });
  }
});

router.put('/brand-settings', async (req: Request, res: Response) => {
  const orgId = getOrgId(req);
  if (!orgId) {
    return res.status(401).json({ error: 'Unauthenticated' });
  }
  try {
    const { primaryColor, secondaryColor, fontFamily, logoUrl, companyName, ...rest } = req.body ?? {};
    const settingsJson = Object.keys(rest).length > 0 ? rest : null;

    const { pool } = await import('../db');
    const result = await pool.query(
      `INSERT INTO organization_brand_settings
         (org_id, primary_color, secondary_color, font_family, logo_url, company_name, settings_json)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
       ON CONFLICT (org_id) DO UPDATE
         SET primary_color = EXCLUDED.primary_color,
             secondary_color = EXCLUDED.secondary_color,
             font_family = EXCLUDED.font_family,
             logo_url = EXCLUDED.logo_url,
             company_name = EXCLUDED.company_name,
             settings_json = EXCLUDED.settings_json,
             updated_at = NOW()
       RETURNING primary_color, secondary_color, font_family, logo_url, company_name, settings_json, updated_at`,
      [
        orgId,
        primaryColor ?? DEFAULT_BRAND_SETTINGS.primaryColor,
        secondaryColor ?? DEFAULT_BRAND_SETTINGS.secondaryColor,
        fontFamily ?? DEFAULT_BRAND_SETTINGS.fontFamily,
        logoUrl ?? null,
        companyName ?? '',
        settingsJson ? JSON.stringify(settingsJson) : null,
      ],
    );
    const row = result.rows[0];
    return res.json({
      primaryColor: row.primary_color,
      secondaryColor: row.secondary_color,
      fontFamily: row.font_family,
      logoUrl: row.logo_url,
      companyName: row.company_name,
      ...(row.settings_json ?? {}),
      updatedAt: row.updated_at,
    });
  } catch (error) {
    console.error('Error saving brand settings:', error);
    return res.status(500).json({ error: 'Failed to save brand settings' });
  }
});

router.delete('/documents/:documentId', async (req: Request, res: Response) => {
  try {
    const { documentId } = req.params;
    await omBuilderService.deleteDocument(documentId);
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting OM document:', error);
    res.status(500).json({ error: 'Failed to delete document' });
  }
});

export default router;
