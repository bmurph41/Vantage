import { Router, Request, Response } from 'express';
import { chat, chatStream, getSuggestedQuestions, ConversationMessage, AssistantContext } from '../services/ai-assistant-service';

const router = Router();

interface ChatRequest {
  message: string;
  context: AssistantContext;
  conversationHistory?: ConversationMessage[];
}

router.post('/chat', async (req: Request, res: Response) => {
  try {
    const { message, context, conversationHistory = [] } = req.body as ChatRequest;
    
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Message is required' });
    }
    
    if (!context || !context.currentPage) {
      return res.status(400).json({ error: 'Context with currentPage is required' });
    }
    
    const userId = (req as any).userId || 'user-1';
    const orgId = (req as any).tenantId || 'org-1';
    
    const enrichedContext: AssistantContext = {
      ...context,
      userId,
      orgId,
    };
    
    const response = await chat(message, enrichedContext, conversationHistory);
    
    res.json({
      response,
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
    const { message, context, conversationHistory = [] } = req.body as ChatRequest;
    
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Message is required' });
    }
    
    if (!context || !context.currentPage) {
      return res.status(400).json({ error: 'Context with currentPage is required' });
    }
    
    const userId = (req as any).userId || 'user-1';
    const orgId = (req as any).tenantId || 'org-1';
    
    const enrichedContext: AssistantContext = {
      ...context,
      userId,
      orgId,
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
  const suggestions = getSuggestedQuestions(currentPage);
  
  res.json({ suggestions });
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

export default router;
