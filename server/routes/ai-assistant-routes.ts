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

const router = Router();

interface ChatRequest {
  message: string;
  context: AssistantContext;
  conversationHistory?: ConversationMessage[];
  advisoryMode?: AdvisoryMode;
}

router.post('/chat', async (req: Request, res: Response) => {
  try {
    const { message, context, conversationHistory = [], advisoryMode } = req.body as ChatRequest;
    
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
    
    const response = await chat(message, enrichedContext, conversationHistory);
    
    res.json({
      response,
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
    const { message, context, conversationHistory = [], advisoryMode } = req.body as ChatRequest;
    
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
    
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    
    try {
      for await (const chunk of chatStream(message, enrichedContext, conversationHistory)) {
        res.write(`data: ${JSON.stringify({ content: chunk })}\n\n`);
      }
      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
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

export default router;
