import { Router, Request, Response } from 'express';
import { omBuilderService } from '../services/om-builder-service';
import { z } from 'zod';
import { fromZodError } from 'zod-validation-error';

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

router.post('/api/om-builder/documents/:documentId/export-pdf', async (req: Request, res: Response) => {
  try {
    const { documentId } = req.params;
    const pdfUrl = await omBuilderService.exportToPDF(documentId);
    res.json({ pdfUrl });
  } catch (error) {
    console.error('Error exporting OM to PDF:', error);
    res.status(500).json({ error: 'Failed to export PDF' });
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
