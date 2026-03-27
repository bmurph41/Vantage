import { Router, Request, Response } from 'express';
import {
  chat,
  chatStream,
  getSuggestedQuestions,
  getAdvisoryModes,
  recordFeedback,
  getFeedbackStats,
  ConversationMessage,
  AssistantContext,
  AdvisoryMode
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
  learnFromFeedback,
} from '../services/knowledge-base-service';

const router = Router();

interface ChatRequest {
  message: string;
  context: AssistantContext;
  conversationHistory?: ConversationMessage[];
  advisoryMode?: AdvisoryMode;
}

router.post('/chat', async (req: Request, res: Response) => {
  try {
    const { message, context, conversationHistory = [], advisoryMode, conversationId } = req.body as ChatRequest & { conversationId?: string };

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Message is required' });
    }

    if (!context || !context.currentPage) {
      return res.status(400).json({ error: 'Context with currentPage is required' });
    }

    const userId = (req as any).user?.id || 'user-1';
    const orgId = (req as any).user?.orgId || 'org-1';

    const enrichedContext: AssistantContext = {
      ...context,
      userId,
      orgId,
      advisoryMode: advisoryMode || context.advisoryMode || 'general',
    };

    // Get or create persistent conversation
    const convId = await getOrCreateConversation({
      orgId,
      userId,
      conversationId,
      advisoryMode: enrichedContext.advisoryMode,
    });

    // Save user message
    await saveMessage({
      conversationId: convId,
      role: 'user',
      content: message,
      advisoryMode: enrichedContext.advisoryMode,
      page: context.currentPage,
    });

    const result = await chat(message, enrichedContext, conversationHistory);

    // Save assistant response with RAG references
    await saveMessage({
      conversationId: convId,
      role: 'assistant',
      content: result.response,
      advisoryMode: enrichedContext.advisoryMode,
      page: context.currentPage,
      ragChunkIds: result.ragChunkIds,
    });

    res.json({
      response: result.response,
      conversationId: convId,
      advisoryMode: enrichedContext.advisoryMode,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[AI Assistant] Chat error:', error);
    res.status(500).json({
      error: 'Failed to process chat request',
      message: error.message
    });
  }
});

router.post('/chat/stream', async (req: Request, res: Response) => {
  try {
    const { message, context, conversationHistory = [], advisoryMode, conversationId: reqConvId } = req.body as ChatRequest & { conversationId?: string };

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Message is required' });
    }

    if (!context || !context.currentPage) {
      return res.status(400).json({ error: 'Context with currentPage is required' });
    }

    const userId = (req as any).user?.id || 'user-1';
    const orgId = (req as any).user?.orgId || 'org-1';

    const enrichedContext: AssistantContext = {
      ...context,
      userId,
      orgId,
      advisoryMode: advisoryMode || context.advisoryMode || 'general',
    };

    // Persist conversation + user message
    const convId = await getOrCreateConversation({
      orgId,
      userId,
      conversationId: reqConvId,
      advisoryMode: enrichedContext.advisoryMode,
    });

    await saveMessage({
      conversationId: convId,
      role: 'user',
      content: message,
      advisoryMode: enrichedContext.advisoryMode,
      page: context.currentPage,
    });

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    // Send conversationId to client so it can track the session
    res.write(`data: ${JSON.stringify({ conversationId: convId })}\n\n`);

    let fullResponse = '';
    try {
      for await (const chunk of chatStream(message, enrichedContext, conversationHistory)) {
        fullResponse += chunk;
        res.write(`data: ${JSON.stringify({ content: chunk })}\n\n`);
      }
      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);

      // Persist assistant response
      if (fullResponse) {
        saveMessage({
          conversationId: convId,
          role: 'assistant',
          content: fullResponse,
          advisoryMode: enrichedContext.advisoryMode,
          page: context.currentPage,
        }).catch(err => console.error('[AI Assistant] Save assistant message error:', err));
      }
    } catch (streamError: any) {
      res.write(`data: ${JSON.stringify({ error: streamError.message })}\n\n`);
    }

    res.end();
  } catch (error: any) {
    console.error('[AI Assistant] Stream error:', error);
    res.status(500).json({
      error: 'Failed to process stream request',
      message: error.message
    });
  }
});

router.get('/suggestions', (req: Request, res: Response) => {
  const currentPage = (req.query.page as string) || '/';
  const advisoryMode = (req.query.mode as AdvisoryMode) || undefined;
  const suggestions = getSuggestedQuestions(currentPage, advisoryMode);
  
  res.json({ suggestions });
});

router.get('/modes', (_req: Request, res: Response) => {
  const modes = getAdvisoryModes();
  res.json({ modes });
});

router.get('/health', (_req: Request, res: Response) => {
  const hasApiKey = !!process.env.OPENAI_API_KEY;
  
  res.json({
    status: hasApiKey ? 'ready' : 'missing_api_key',
    message: hasApiKey 
      ? 'AI Assistant is ready' 
      : 'OpenAI API key not configured',
  });
});

router.post('/feedback', async (req: Request, res: Response) => {
  try {
    const { messageId, rating, advisoryMode, page, messageContent, userQuery } = req.body;

    if (!messageId || !rating) {
      return res.status(400).json({ error: 'messageId and rating are required' });
    }

    if (!['positive', 'negative'].includes(rating)) {
      return res.status(400).json({ error: 'rating must be positive or negative' });
    }

    const userId = (req as any).user?.id || 'user-1';
    const orgId = (req as any).user?.orgId || 'org-1';

    const feedback = await recordFeedback({
      userId,
      orgId,
      messageId,
      rating,
      advisoryMode: advisoryMode || 'general',
      page: page || '/',
      messageContent,
      userQuery,
    });

    // Learn from positive feedback — store Q&A for future RAG retrieval
    if (userQuery && messageContent) {
      learnFromFeedback({
        orgId,
        userQuery,
        assistantResponse: messageContent,
        rating,
        advisoryMode: advisoryMode || 'general',
      }).catch(err => console.error('[AI Assistant] Learn from feedback error:', err));
    }

    res.json({ success: true, feedbackId: feedback.id });
  } catch (error: any) {
    console.error('[AI Assistant] Feedback error:', error);
    res.status(500).json({ error: 'Failed to record feedback' });
  }
});

router.get('/feedback/stats', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user?.orgId || 'org-1';
    const stats = await getFeedbackStats(orgId);
    res.json(stats);
  } catch (error: any) {
    console.error('[AI Assistant] Stats error:', error);
    res.status(500).json({ error: 'Failed to get feedback stats' });
  }
});

// ─── Knowledge Base Routes ──────────────────────────────────────────────────

router.get('/knowledge', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user?.orgId;
    const docs = await listDocuments(orgId);
    res.json(docs);
  } catch (error: any) {
    console.error('[Knowledge Base] List error:', error);
    res.status(500).json({ error: 'Failed to list documents' });
  }
});

router.post('/knowledge', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user?.orgId;
    const userId = (req as any).user?.id;
    const { title, description, contentText, sourceType, fileName, mimeType } = req.body;

    if (!title || !contentText) {
      return res.status(400).json({ error: 'title and contentText are required' });
    }

    const result = await ingestDocument({
      orgId,
      userId,
      title,
      description,
      contentText,
      sourceType: sourceType || 'text',
      fileName,
      mimeType,
    });

    res.json(result);
  } catch (error: any) {
    console.error('[Knowledge Base] Ingest error:', error);
    res.status(500).json({ error: 'Failed to ingest document' });
  }
});

router.get('/knowledge/:id', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user?.orgId;
    const doc = await getDocument(req.params.id, orgId);
    if (!doc) return res.status(404).json({ error: 'Document not found' });
    res.json(doc);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to get document' });
  }
});

router.delete('/knowledge/:id', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user?.orgId;
    const success = await deleteDocument(req.params.id, orgId);
    if (!success) return res.status(404).json({ error: 'Document not found' });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to delete document' });
  }
});

// ─── Conversation History Routes ────────────────────────────────────────────

router.get('/conversations', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user?.orgId;
    const userId = (req as any).user?.id;
    const conversations = await listConversations(orgId, userId);
    res.json(conversations);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to list conversations' });
  }
});

router.get('/conversations/:id/messages', async (req: Request, res: Response) => {
  try {
    const messages = await getConversationHistory(req.params.id);
    res.json(messages);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to get messages' });
  }
});

export default router;
