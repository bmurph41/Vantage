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
  return (req as any).orgId || (req as any).user?.orgId || null;
}

const generateOMSchema = z.object({
  templateId: z.string().nullable().optional(),
  title: z.string().min(1, 'Title is required'),
});

// Asset-class-specific OM templates from the registry
router.get('/api/om-builder/asset-templates', async (req: Request, res: Response) => {
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

router.get('/api/om-builder/asset-templates/:id', async (req: Request, res: Response) => {
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

router.get('/api/om-builder/templates', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const templates = await omBuilderService.getTemplates(orgId || undefined);
    res.json(templates);
  } catch (error) {
    console.error('Error fetching OM templates:', error);
    res.status(500).json({ error: 'Failed to fetch templates' });
  }
});

router.get('/api/om-builder/:dealId/data', async (req: Request, res: Response) => {
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

router.post('/api/om-builder/:dealId/generate', async (req: Request, res: Response) => {
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

router.get('/api/om-builder/:dealId/documents', async (req: Request, res: Response) => {
  try {
    const { dealId } = req.params;
    const documents = await omBuilderService.getDocumentsByDeal(dealId);
    res.json(documents);
  } catch (error) {
    console.error('Error fetching OM documents:', error);
    res.status(500).json({ error: 'Failed to fetch documents' });
  }
});

router.get('/api/om-builder/documents/:documentId', async (req: Request, res: Response) => {
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

router.post('/api/om-builder/documents/:documentId/export-pdf', async (req: Request, res: Response) => {
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

router.get('/api/om-builder/documents/:documentId/pdf', async (req: Request, res: Response) => {
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

router.get('/api/om-builder/documents/:documentId/download-pdf', async (req: Request, res: Response) => {
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

// In-memory brand settings store (would be DB in production)
const brandSettingsStore = new Map<string, any>();

router.get('/api/om-builder/brand-settings', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req) || 'default';
    const settings = brandSettingsStore.get(orgId) || {
      primaryColor: '#1e3a5f',
      secondaryColor: '#c9a96e',
      fontFamily: 'sans-serif',
      logoUrl: null,
      companyName: '',
    };
    res.json(settings);
  } catch (error) {
    console.error('Error fetching brand settings:', error);
    res.status(500).json({ error: 'Failed to fetch brand settings' });
  }
});

router.put('/api/om-builder/brand-settings', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req) || 'default';
    const { primaryColor, secondaryColor, fontFamily, logoUrl, companyName } = req.body;

    const settings = {
      primaryColor: primaryColor || '#1e3a5f',
      secondaryColor: secondaryColor || '#c9a96e',
      fontFamily: fontFamily || 'sans-serif',
      logoUrl: logoUrl || null,
      companyName: companyName || '',
      updatedAt: new Date().toISOString(),
    };

    brandSettingsStore.set(orgId, settings);
    res.json(settings);
  } catch (error) {
    console.error('Error saving brand settings:', error);
    res.status(500).json({ error: 'Failed to save brand settings' });
  }
});

router.delete('/api/om-builder/documents/:documentId', async (req: Request, res: Response) => {
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
