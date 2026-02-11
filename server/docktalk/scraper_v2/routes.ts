import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { isV2Enabled, V2_CONFIG } from './config';
import { dt2Repo } from './storage/repo';
import { triggerManualIngestion, getRunnerStatus } from './runner/jobRunner';
import { getEmbeddingProvider } from './embeddings/provider';
import { generateTopicEmbedding } from './embeddings/stubProvider';
import type { Dt2CrawlPolicy, Dt2ContentSelectors } from '@shared/docktalk-v2-schema';

const router = Router();

const featureFlagMiddleware = (req: Request, res: Response, next: Function) => {
  if (!isV2Enabled()) {
    return res.status(404).json({
      error: 'The Docket Scraper V2 is not enabled',
      message: 'Set DOCKTALK_SCRAPER_V2=true to enable this feature',
    });
  }
  next();
};

router.use(featureFlagMiddleware);

const CreateSourceSchema = z.object({
  name: z.string().min(1).max(255),
  type: z.enum(['rss', 'sitemap', 'html']),
  baseUrl: z.string().url(),
  discoveryUrl: z.string().url(),
  allowPatterns: z.array(z.string()).optional(),
  denyPatterns: z.array(z.string()).optional(),
  contentSelectors: z.object({
    title: z.string().optional(),
    content: z.string().optional(),
    author: z.string().optional(),
    date: z.string().optional(),
    image: z.string().optional(),
  }).optional(),
  crawlPolicy: z.object({
    maxPagesPerRun: z.number().min(1).max(500).default(50),
    maxDepth: z.number().min(0).max(5).default(2),
    concurrency: z.number().min(1).max(5).default(2),
    minDelayMs: z.number().min(100).max(10000).default(1000),
    respectRobotsTxt: z.boolean().default(true),
  }).optional(),
  trustScore: z.number().min(0).max(100).optional(),
});

router.post('/sources', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    
    const parsed = CreateSourceSchema.parse(req.body);
    
    const source = await dt2Repo.createSource({
      userId: user.id,
      orgId: user.orgId,
      name: parsed.name,
      type: parsed.type,
      baseUrl: parsed.baseUrl,
      discoveryUrl: parsed.discoveryUrl,
      allowPatterns: parsed.allowPatterns,
      denyPatterns: parsed.denyPatterns,
      contentSelectors: parsed.contentSelectors as Dt2ContentSelectors,
      crawlPolicy: (parsed.crawlPolicy || {
        maxPagesPerRun: 50,
        maxDepth: 2,
        concurrency: 2,
        minDelayMs: 1000,
        respectRobotsTxt: true,
      }) as Dt2CrawlPolicy,
      trustScore: parsed.trustScore,
      status: 'active',
    });
    
    res.status(201).json(source);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    res.status(500).json({ error: 'Failed to create source' });
  }
});

router.get('/sources', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    
    const sources = await dt2Repo.getActiveSources(user.id, user.orgId);
    res.json(sources);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch sources' });
  }
});

router.delete('/sources/:id', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    
    await dt2Repo.deleteSource(req.params.id);
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete source' });
  }
});

router.post('/run', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    
    const runId = await triggerManualIngestion(user.id, user.orgId);
    res.status(202).json({ runId, message: 'Ingestion started' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to start ingestion' });
  }
});

router.get('/runs', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    
    const limit = parseInt(req.query.limit as string) || 20;
    const runs = await dt2Repo.getRuns(user.id, limit);
    res.json(runs);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch runs' });
  }
});

router.get('/runs/:id', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    
    const run = await dt2Repo.getRunById(req.params.id);
    if (!run) return res.status(404).json({ error: 'Run not found' });
    
    const events = await dt2Repo.getRunEvents(req.params.id);
    res.json({ ...run, events });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch run' });
  }
});

router.get('/articles', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    
    const label = req.query.label as 'high' | 'medium' | 'low' | undefined;
    const minScore = req.query.minScore ? parseInt(req.query.minScore as string) : undefined;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;
    
    const articles = await dt2Repo.getArticles(user.id, { label, minScore, limit, offset });
    res.json(articles);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch articles' });
  }
});

const FeedbackSchema = z.object({
  action: z.enum(['saved', 'opened', 'dismissed']),
});

router.post('/articles/:id/feedback', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    
    const parsed = FeedbackSchema.parse(req.body);
    
    await dt2Repo.storeFeedback(user.id, user.orgId, req.params.id, parsed.action);
    res.status(201).json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    res.status(500).json({ error: 'Failed to record feedback' });
  }
});

const UserRulesSchema = z.object({
  includeKeywords: z.array(z.string()).optional(),
  excludeKeywords: z.array(z.string()).optional(),
  includeEntities: z.array(z.string()).optional(),
  excludeEntities: z.array(z.string()).optional(),
  topicStatement: z.string().optional(),
  minScore: z.number().min(0).max(100).optional(),
});

router.get('/rules', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    
    const rules = await dt2Repo.getUserRules(user.id);
    res.json(rules || {});
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch rules' });
  }
});

router.put('/rules', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    
    const parsed = UserRulesSchema.parse(req.body);
    
    let topicEmbedding: number[] | undefined;
    if (parsed.topicStatement) {
      topicEmbedding = generateTopicEmbedding(parsed.topicStatement);
    }
    
    const rules = await dt2Repo.upsertUserRules(user.id, user.orgId, {
      ...parsed,
      cachedTopicEmbedding: topicEmbedding,
    });
    
    res.json(rules);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    res.status(500).json({ error: 'Failed to update rules' });
  }
});

router.get('/status', async (req: Request, res: Response) => {
  try {
    const status = getRunnerStatus();
    res.json({
      ...status,
      config: {
        embeddings: V2_CONFIG.embeddings,
        dedupe: V2_CONFIG.dedupe,
        relevance: {
          highThreshold: V2_CONFIG.relevance.highThreshold,
          mediumThreshold: V2_CONFIG.relevance.mediumThreshold,
        },
      },
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get status' });
  }
});

export default router;
