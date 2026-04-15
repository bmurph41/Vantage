import { Router, Request, Response } from 'express';
import {
  chat,
  chatStream,
  getSuggestedQuestions,
  getAdvisoryModes,
  recordFeedback,
  getFeedbackStats,
  learnFromFeedback,
  ConversationMessage,
  AssistantContext,
  AdvisoryMode,
} from '../services/ai-assistant-service';
import {
  ingestDocument,
  listDocuments,
  getDocument,
  deleteDocument,
  getOrCreateConversation,
  saveMessage,
  getConversationHistory,
  listConversations,
  ensureKnowledgeBaseSchema,
  getGlobalKnowledgeStats,
} from '../services/knowledge-base-service';
import { resolveDealContext } from '../services/deal-context-resolver';

const router = Router();

// ─── Bootstrap schema on first import ────────────────────────────────────────
ensureKnowledgeBaseSchema().catch(err =>
  console.error('[AI Routes] Schema bootstrap error:', err)
);

// ─── Context summary (for frontend badge) ────────────────────────────────────

router.get('/context-summary', async (req: Request, res: Response) => {
  try {
    const dealId = req.query.dealId as string | undefined;
    const modelingProjectId = req.query.modelingProjectId as string | undefined;
    const workspaceId = req.query.workspaceId as string | undefined;

    if (!dealId && !modelingProjectId && !workspaceId) {
      return res.json({ summary: null });
    }

    const orgId = (req as any).user?.orgId ?? 'org-1';
    const result = await resolveDealContext(orgId, { dealId, modelingProjectId, workspaceId });

    return res.json({ summary: result?.summary ?? null });
  } catch (error: any) {
    console.error('[AI Routes] Context summary error:', error);
    return res.json({ summary: null });
  }
});

// ─── Chat (non-streaming) ─────────────────────────────────────────────────────

router.post('/chat', async (req: Request, res: Response) => {
  try {
    const {
      message,
      context,
      conversationHistory = [],
      advisoryMode,
      conversationId,
      entityContext,
    } = req.body as {
      message: string;
      context: AssistantContext;
      conversationHistory?: ConversationMessage[];
      advisoryMode?: AdvisoryMode;
      conversationId?: string;
      entityContext?: { dealId?: string; modelingProjectId?: string; workspaceId?: string };
    };

    if (!message?.trim()) return res.status(400).json({ error: 'Message is required' });
    if (!context?.currentPage) return res.status(400).json({ error: 'Context.currentPage is required' });

    const userId = (req as any).user?.id ?? 'user-1';
    const orgId = (req as any).user?.orgId ?? 'org-1';

    const enrichedContext: AssistantContext = {
      ...context,
      userId,
      orgId,
      advisoryMode: advisoryMode ?? context.advisoryMode ?? 'general',
    };

    // Resolve deal/project context and inject it into the system prompt
    if (entityContext?.dealId || entityContext?.modelingProjectId || entityContext?.workspaceId) {
      const resolved = await resolveDealContext(orgId, {
        dealId: entityContext.dealId,
        modelingProjectId: entityContext.modelingProjectId,
        workspaceId: entityContext.workspaceId,
      });
      if (resolved) {
        enrichedContext.injectedContextBlock = resolved.contextBlock;
      }
    }

    const convId = await getOrCreateConversation({ orgId, userId, conversationId, advisoryMode: enrichedContext.advisoryMode });
    await saveMessage({ conversationId: convId, role: 'user', content: message, advisoryMode: enrichedContext.advisoryMode, page: context.currentPage });

    const result = await chat(message, enrichedContext, conversationHistory);

    await saveMessage({ conversationId: convId, role: 'assistant', content: result.response, advisoryMode: enrichedContext.advisoryMode, page: context.currentPage, ragChunkIds: result.ragChunkIds });

    return res.json({
      response: result.response,
      conversationId: convId,
      advisoryMode: enrichedContext.advisoryMode,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[AI Routes] Chat error:', error);
    return res.status(500).json({ error: 'Failed to process chat request', message: error.message });
  }
});

// ─── Streaming chat ───────────────────────────────────────────────────────────

router.post('/chat/stream', async (req: Request, res: Response) => {
  try {
    const {
      message,
      context,
      conversationHistory = [],
      advisoryMode,
      conversationId: reqConvId,
      entityContext,
    } = req.body as {
      message: string;
      context: AssistantContext;
      conversationHistory?: ConversationMessage[];
      advisoryMode?: AdvisoryMode;
      conversationId?: string;
      entityContext?: { dealId?: string; modelingProjectId?: string; workspaceId?: string };
    };

    if (!message?.trim()) return res.status(400).json({ error: 'Message is required' });
    if (!context?.currentPage) return res.status(400).json({ error: 'Context.currentPage is required' });

    const userId = (req as any).user?.id ?? 'user-1';
    const orgId = (req as any).user?.orgId ?? 'org-1';

    const enrichedContext: AssistantContext = {
      ...context,
      userId,
      orgId,
      advisoryMode: advisoryMode ?? context.advisoryMode ?? 'general',
    };

    // Resolve deal/project context and inject it into the system prompt
    if (entityContext?.dealId || entityContext?.modelingProjectId || entityContext?.workspaceId) {
      const resolved = await resolveDealContext(orgId, {
        dealId: entityContext.dealId,
        modelingProjectId: entityContext.modelingProjectId,
        workspaceId: entityContext.workspaceId,
      });
      if (resolved) {
        enrichedContext.injectedContextBlock = resolved.contextBlock;
      }
    }

    const convId = await getOrCreateConversation({ orgId, userId, conversationId: reqConvId, advisoryMode: enrichedContext.advisoryMode });
    await saveMessage({ conversationId: convId, role: 'user', content: message, advisoryMode: enrichedContext.advisoryMode, page: context.currentPage });

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    res.write(`data: ${JSON.stringify({ conversationId: convId })}\n\n`);

    let fullResponse = '';
    try {
      for await (const chunk of chatStream(message, enrichedContext, conversationHistory)) {
        fullResponse += chunk;
        res.write(`data: ${JSON.stringify({ content: chunk })}\n\n`);
      }
      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);

      if (fullResponse) {
        saveMessage({ conversationId: convId, role: 'assistant', content: fullResponse, advisoryMode: enrichedContext.advisoryMode, page: context.currentPage })
          .catch(err => console.error('[AI Routes] Save assistant message error:', err));
      }
    } catch (streamError: any) {
      res.write(`data: ${JSON.stringify({ error: streamError.message })}\n\n`);
    }

    return res.end();
  } catch (error: any) {
    console.error('[AI Routes] Stream error:', error);
    return res.status(500).json({ error: 'Failed to process stream request', message: error.message });
  }
});

// ─── Deal comparison ──────────────────────────────────────────────────────────

/**
 * POST /api/ai-assistant/compare
 * Accepts 2–4 entity IDs and returns a structured comparison analysis.
 * Body: { entityIds: string[], entityType: string, advisoryMode?: AdvisoryMode }
 */
router.post('/compare', async (req: Request, res: Response) => {
  try {
    const { entityIds, entityType = 'deal', advisoryMode = 'benchmark_comparison', message } = req.body;

    if (!entityIds || !Array.isArray(entityIds) || entityIds.length < 2) {
      return res.status(400).json({ error: 'Provide at least 2 entityIds to compare' });
    }

    if (entityIds.length > 4) {
      return res.status(400).json({ error: 'Maximum 4 entities can be compared at once' });
    }

    const userId = (req as any).user?.id ?? 'user-1';
    const orgId = (req as any).user?.orgId ?? 'org-1';

    const comparisonContext: AssistantContext = {
      currentPage: '/crm/deals',
      entityType,
      userId,
      orgId,
      advisoryMode,
      compareEntityIds: entityIds,
    };

    const comparisonMessage = message ?? `Compare these ${entityIds.length} ${entityType}s side by side. Evaluate: (1) valuation and pricing, (2) risk profile, (3) return potential, (4) operational complexity, (5) your recommendation on which to prioritize and why.`;

    const result = await chat(comparisonMessage, comparisonContext, []);

    return res.json({
      response: result.response,
      entityIds,
      advisoryMode,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[AI Routes] Compare error:', error);
    return res.status(500).json({ error: 'Failed to compare entities', message: error.message });
  }
});

// ─── Investment criteria evaluation ──────────────────────────────────────────

/**
 * POST /api/ai-assistant/evaluate-criteria
 * Evaluate a specific deal against the org's buy-box investment criteria.
 */
router.post('/evaluate-criteria', async (req: Request, res: Response) => {
  try {
    const { entityId, entityType = 'deal' } = req.body;

    if (!entityId) return res.status(400).json({ error: 'entityId is required' });

    const userId = (req as any).user?.id ?? 'user-1';
    const orgId = (req as any).user?.orgId ?? 'org-1';

    const evalContext: AssistantContext = {
      currentPage: '/crm/deals',
      entityId,
      entityType,
      userId,
      orgId,
      advisoryMode: 'benchmark_comparison',
    };

    const evalMessage = `Evaluate this ${entityType} against our investment criteria and buy-box. Score it across all key dimensions and give a clear GO / NO-GO / CONDITIONAL recommendation with specific reasons. Reference our criteria directly if available.`;

    const result = await chat(evalMessage, evalContext, []);

    return res.json({
      response: result.response,
      entityId,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to evaluate criteria', message: error.message });
  }
});

// ─── Suggestions ──────────────────────────────────────────────────────────────

router.get('/suggestions', (req: Request, res: Response) => {
  const currentPage = (req.query.page as string) ?? '/';
  const advisoryMode = (req.query.mode as AdvisoryMode) ?? undefined;
  res.json({ suggestions: getSuggestedQuestions(currentPage, advisoryMode) });
});

router.get('/modes', (_req: Request, res: Response) => {
  res.json({ modes: getAdvisoryModes() });
});

router.get('/health', (_req: Request, res: Response) => {
  const hasApiKey = !!process.env.OPENAI_API_KEY || !!process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
  res.json({
    status: hasApiKey ? 'ready' : 'missing_api_key',
    message: hasApiKey ? 'AI Assistant is ready' : 'OpenAI API key not configured',
  });
});

// ─── Feedback ─────────────────────────────────────────────────────────────────

router.post('/feedback', async (req: Request, res: Response) => {
  try {
    const { messageId, rating, advisoryMode, page, messageContent, userQuery } = req.body;

    if (!messageId || !rating) return res.status(400).json({ error: 'messageId and rating are required' });
    if (!['positive', 'negative'].includes(rating)) return res.status(400).json({ error: 'rating must be positive or negative' });

    const userId = (req as any).user?.id ?? 'user-1';
    const orgId = (req as any).user?.orgId ?? 'org-1';

    const feedback = await recordFeedback({
      userId, orgId, messageId, rating,
      advisoryMode: advisoryMode ?? 'general',
      page: page ?? '/',
      messageContent,
      userQuery,
    });

    // Learn from positive feedback — adds to org knowledge AND global pool
    if (userQuery && messageContent) {
      learnFromFeedback({
        orgId,
        userQuery,
        assistantResponse: messageContent,
        rating,
        advisoryMode: advisoryMode ?? 'general',
      }).catch(err => console.error('[AI Routes] Learn from feedback error:', err));
    }

    return res.json({ success: true, feedbackId: feedback.id });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to record feedback' });
  }
});

router.get('/feedback/stats', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user?.orgId ?? 'org-1';
    const stats = await getFeedbackStats(orgId);
    return res.json(stats);
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to get feedback stats' });
  }
});

// ─── Knowledge base ───────────────────────────────────────────────────────────

router.get('/knowledge', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user?.orgId;
    const docs = await listDocuments(orgId);
    return res.json(docs);
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to list documents' });
  }
});

router.post('/knowledge', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user?.orgId;
    const userId = (req as any).user?.id;
    const { title, description, contentText, sourceType, fileName, mimeType } = req.body;

    if (!title || !contentText) return res.status(400).json({ error: 'title and contentText are required' });

    const result = await ingestDocument({ orgId, userId, title, description, contentText, sourceType: sourceType ?? 'text', fileName, mimeType });
    return res.json(result);
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to ingest document' });
  }
});

router.get('/knowledge/:id', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user?.orgId;
    const doc = await getDocument(req.params.id, orgId);
    if (!doc) return res.status(404).json({ error: 'Document not found' });
    return res.json(doc);
  } catch {
    return res.status(500).json({ error: 'Failed to get document' });
  }
});

router.delete('/knowledge/:id', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user?.orgId;
    const success = await deleteDocument(req.params.id, orgId);
    if (!success) return res.status(404).json({ error: 'Document not found' });
    return res.json({ success: true });
  } catch {
    return res.status(500).json({ error: 'Failed to delete document' });
  }
});

// Global knowledge stats
router.get('/knowledge/global/stats', async (_req: Request, res: Response) => {
  try {
    const stats = await getGlobalKnowledgeStats();
    return res.json(stats);
  } catch {
    return res.status(500).json({ error: 'Failed to get global stats' });
  }
});

// ─── Conversation history ─────────────────────────────────────────────────────

router.get('/conversations', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user?.orgId;
    const userId = (req as any).user?.id;
    const conversations = await listConversations(orgId, userId);
    return res.json(conversations);
  } catch {
    return res.status(500).json({ error: 'Failed to list conversations' });
  }
});

router.get('/conversations/:id/messages', async (req: Request, res: Response) => {
  try {
    const messages = await getConversationHistory(req.params.id);
    return res.json(messages);
  } catch {
    return res.status(500).json({ error: 'Failed to get messages' });
  }
});

export default router;
