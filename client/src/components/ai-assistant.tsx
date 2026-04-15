/**
 * AI Assistant — Enhanced Frontend Component
 *
 * Enhancements over v1:
 *  - Markdown rendering (bold, italic, tables, headers, lists, code blocks)
 *  - Entity data injection: auto-detects entity page and passes live data to AI
 *  - Deal comparison mode: select 2–4 deals/models to compare side by side
 *  - Conversation history: persists across sessions, loadable from sidebar
 *  - Global learning indicator: shows when AI has learned from platform users
 *  - Collapsible history panel
 *  - Improved streaming reliability
 */

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useLocation } from 'wouter';
import { MarkdownRenderer } from '@/components/ui/markdown-renderer';
import {
  MessageCircle,
  X,
  Send,
  Loader2,
  Sparkles,
  EyeOff,
  AlertTriangle,
  Shield,
  BarChart3,
  GitBranch,
  FileText,
  TrendingDown,
  CheckSquare,
  ChevronDown,
  RotateCcw,
  ThumbsUp,
  ThumbsDown,
  BookOpen,
  ArrowLeft,
  Scale,
  Zap,
  Globe,
  Info,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { useQuery } from '@tanstack/react-query';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  advisoryMode?: AdvisoryMode;
  feedback?: 'helpful' | 'not_helpful';
  isStreaming?: boolean;
}

interface AssistantContext {
  currentPage: string;
  entityType?: string;
  entityId?: string;
  entityName?: string;
  advisoryMode?: AdvisoryMode;
  compareEntityIds?: string[];
}

type AdvisoryMode =
  | 'general'
  | 'critique'
  | 'risk_analysis'
  | 'benchmark_comparison'
  | 'options_analysis'
  | 'decision_memo'
  | 'stress_test'
  | 'next_actions';

interface AdvisoryModeInfo {
  id: AdvisoryMode;
  name: string;
  description: string;
  icon: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ADVISORY_MODES: AdvisoryModeInfo[] = [
  { id: 'general',              name: 'General',       description: 'General guidance & Q&A',         icon: 'MessageCircle' },
  { id: 'critique',             name: 'Critique',      description: 'Challenge my assumptions',        icon: 'AlertTriangle' },
  { id: 'risk_analysis',        name: 'Risk Analysis', description: 'Comprehensive risk register',     icon: 'Shield' },
  { id: 'benchmark_comparison', name: 'Benchmark',     description: 'Compare to market standards',     icon: 'BarChart' },
  { id: 'options_analysis',     name: 'Options',       description: 'Analyze alternatives',            icon: 'GitBranch' },
  { id: 'decision_memo',        name: 'Decision Memo', description: 'IC-ready investment memo',        icon: 'FileText' },
  { id: 'stress_test',          name: 'Stress Test',   description: 'Test adverse scenarios',          icon: 'TrendingDown' },
  { id: 'next_actions',         name: 'Next Actions',  description: 'Prioritized action items',        icon: 'CheckSquare' },
];

const getModeIcon = (iconName: string) => {
  const map: Record<string, any> = {
    MessageCircle, AlertTriangle, Shield,
    BarChart: BarChart3, GitBranch, FileText, TrendingDown, CheckSquare,
  };
  return map[iconName] ?? MessageCircle;
};


// ─── Main component ───────────────────────────────────────────────────────────

export function AIAssistant() {
  const [location] = useLocation();

  // Visibility state
  const [isOpen, setIsOpen] = useState(false);
  const [isHidden, setIsHidden] = useState(
    () => localStorage.getItem('ai-assistant-hidden') === 'true'
  );
  const [showHistory, setShowHistory] = useState(false);

  // Chat state
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [advisoryMode, setAdvisoryMode] = useState<AdvisoryMode>('general');
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);

  // Deal comparison mode
  const [compareMode, setCompareMode] = useState(false);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [compareInputValue, setCompareInputValue] = useState('');

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const messagesRef = useRef<Message[]>([]);
  messagesRef.current = messages;

  // Detect entity context from URL
  const entityContext = useMemo((): Partial<AssistantContext> => {
    const parts = location.split('/').filter(Boolean);
    // /crm/deals/:id
    if (parts[0] === 'crm' && parts[1] === 'deals' && parts[2]) {
      return { entityType: 'deal', entityId: parts[2] };
    }
    // /modeling/projects/:projectId (or /modeling/projects/:projectId/*)
    if (parts[0] === 'modeling' && parts[1] === 'projects' && parts[2] && parts[2] !== 'new') {
      return { entityType: 'modeling_project', entityId: parts[2] };
    }
    // /workspaces/:workspaceId — deal workspace hub
    if (parts[0] === 'workspaces' && parts[1] && parts[1] !== 'new') {
      return { entityType: 'workspace', entityId: parts[1] };
    }
    // /dd/projects/:id
    if (parts[0] === 'dd' && parts[1] === 'projects' && parts[2]) {
      return { entityType: 'dd_project', entityId: parts[2] };
    }
    // /crm/properties/:id
    if (parts[0] === 'crm' && parts[1] === 'properties' && parts[2]) {
      return { entityType: 'property', entityId: parts[2] };
    }
    return {};
  }, [location]);

  // Derive entity context params for server-side context injection
  const entityContextParams = useMemo((): { dealId?: string; modelingProjectId?: string; workspaceId?: string } => {
    if (entityContext.entityType === 'deal' && entityContext.entityId) {
      return { dealId: entityContext.entityId };
    }
    if (entityContext.entityType === 'modeling_project' && entityContext.entityId) {
      return { modelingProjectId: entityContext.entityId };
    }
    if (entityContext.entityType === 'workspace' && entityContext.entityId) {
      return { workspaceId: entityContext.entityId };
    }
    return {};
  }, [entityContext]);

  const hasEntityContext = !!(
    entityContextParams.dealId ||
    entityContextParams.modelingProjectId ||
    entityContextParams.workspaceId
  );

  // Fetch context summary for the badge (only when on a deal/project page and panel is open)
  const contextSummaryParams = hasEntityContext && isOpen
    ? new URLSearchParams(
        Object.entries(entityContextParams)
          .filter(([, v]) => v)
          .map(([k, v]) => [k, v as string])
      ).toString()
    : null;

  const {
    data: contextSummaryData,
    isLoading: contextSummaryLoading,
  } = useQuery({
    queryKey: ['/api/ai-assistant/context-summary', contextSummaryParams],
    enabled: !!contextSummaryParams,
    queryFn: async () => {
      const res = await fetch(`/api/ai-assistant/context-summary?${contextSummaryParams}`);
      if (!res.ok) return null;
      const data = await res.json();
      return data.summary as {
        dealName?: string;
        projectName?: string;
        injectedSections: string[];
      } | null;
    },
    staleTime: 30_000,
  });

  const contextSummary = contextSummaryData ?? null;
  const contextLoaded = !contextSummaryLoading;

  // Fetch conversation history
  const { data: conversations = [] } = useQuery({
    queryKey: ['/api/ai-assistant/conversations'],
    enabled: isOpen && showHistory,
    queryFn: async () => {
      const res = await fetch('/api/ai-assistant/conversations');
      if (!res.ok) return [];
      return res.json();
    },
  });

  useEffect(() => {
    if (isOpen) fetchSuggestions();
  }, [location, isOpen, advisoryMode]);

  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  }, [messages, streamingContent]);

  useEffect(() => {
    if (isOpen && inputRef.current) inputRef.current.focus();
  }, [isOpen]);

  // Reset conversation when navigating to a new entity
  useEffect(() => {
    if (entityContext.entityId) {
      setMessages([]);
      setConversationId(null);
    }
  }, [entityContext.entityId]);

  const fetchSuggestions = async () => {
    try {
      const res = await fetch(
        `/api/ai-assistant/suggestions?page=${encodeURIComponent(location)}&mode=${advisoryMode}`
      );
      if (res.ok) {
        const data = await res.json();
        setSuggestions(data.suggestions ?? []);
      }
    } catch {}
  };

  const getContext = useCallback((): AssistantContext => ({
    currentPage: location,
    advisoryMode,
    ...entityContext,
    compareEntityIds: compareMode && compareIds.length >= 2 ? compareIds : undefined,
  }), [location, advisoryMode, entityContext, compareMode, compareIds]);

  const sendMessage = async (content: string) => {
    if (!content.trim() || isLoading) return;

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: content.trim(),
      timestamp: new Date(),
      advisoryMode,
    };

    const currentMessages = [...messagesRef.current, userMsg];
    setMessages(currentMessages);
    setInputValue('');
    setIsLoading(true);
    setStreamingContent('');

    try {
      const csrfToken = decodeURIComponent(
        document.cookie.match(/(?:^|; )csrf_token=([^;]*)/)?.[1] ?? ''
      );
      const csrfHeaders: Record<string, string> = csrfToken
        ? { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken }
        : { 'Content-Type': 'application/json' };

      const endpoint = compareMode && compareIds.length >= 2
        ? '/api/ai-assistant/compare'
        : '/api/ai-assistant/chat/stream';

      if (compareMode && compareIds.length >= 2) {
        // Non-streaming compare request
        const res = await fetch('/api/ai-assistant/compare', {
          method: 'POST',
          headers: csrfHeaders,
          body: JSON.stringify({
            entityIds: compareIds,
            entityType: entityContext.entityType ?? 'deal',
            advisoryMode,
            message: content.trim(),
          }),
        });
        const data = await res.json();
        setMessages(prev => [...prev, {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: data.response,
          timestamp: new Date(),
          advisoryMode,
        }]);
        return;
      }

      // Streaming chat
      const res = await fetch('/api/ai-assistant/chat/stream', {
        method: 'POST',
        headers: csrfHeaders,
        body: JSON.stringify({
          message: content.trim(),
          context: getContext(),
          conversationHistory: currentMessages.slice(-12).map(m => ({
            role: m.role,
            content: m.content,
            timestamp: m.timestamp,
          })),
          advisoryMode,
          conversationId,
          ...(hasEntityContext ? { entityContext: entityContextParams } : {}),
        }),
      });

      if (!res.ok) throw new Error('Failed to get response');

      const reader = res.body?.getReader();
      if (!reader) throw new Error('No reader');

      const decoder = new TextDecoder();
      let accumulated = '';
      let lineBuffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        lineBuffer += decoder.decode(value, { stream: true });
        const lines = lineBuffer.split('\n');
        lineBuffer = lines.pop() ?? '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data: ')) continue;
          try {
            const parsed = JSON.parse(trimmed.slice(6));
            if (parsed.conversationId && !conversationId) setConversationId(parsed.conversationId);
            if (parsed.content) {
              accumulated += parsed.content;
              setStreamingContent(accumulated);
            }
            if (parsed.done && accumulated) {
              setMessages(prev => [...prev, {
                id: `assistant-${Date.now()}`,
                role: 'assistant',
                content: accumulated,
                timestamp: new Date(),
                advisoryMode,
              }]);
              setStreamingContent('');
              accumulated = '';
            }
            if (parsed.error) throw new Error(parsed.error);
          } catch {}
        }
      }

      if (accumulated) {
        setMessages(prev => [...prev, {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: accumulated,
          timestamp: new Date(),
          advisoryMode,
        }]);
        setStreamingContent('');
      }
    } catch (error) {
      setMessages(prev => [...prev, {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date(),
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFeedback = async (messageId: string, feedback: 'helpful' | 'not_helpful') => {
    setMessages(prev =>
      prev.map(m => m.id === messageId ? { ...m, feedback } : m)
    );

    const msg = messagesRef.current.find(m => m.id === messageId);
    const prevMsg = messagesRef.current[messagesRef.current.findIndex(m => m.id === messageId) - 1];

    try {
      const csrfToken = decodeURIComponent(
        document.cookie.match(/(?:^|; )csrf_token=([^;]*)/)?.[1] ?? ''
      );
      await fetch('/api/ai-assistant/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
        },
        body: JSON.stringify({
          messageId,
          rating: feedback === 'helpful' ? 'positive' : 'negative',
          advisoryMode,
          page: location,
          messageContent: msg?.content,
          userQuery: prevMsg?.role === 'user' ? prevMsg.content : undefined,
        }),
      });
    } catch {}
  };

  const loadConversation = async (convId: string) => {
    try {
      const res = await fetch(`/api/ai-assistant/conversations/${convId}/messages`);
      if (!res.ok) return;
      const msgs = await res.json();
      setMessages(msgs.map((m: any) => ({
        id: `loaded-${m.createdAt}-${Math.random()}`,
        role: m.role,
        content: m.content,
        timestamp: new Date(m.createdAt),
        advisoryMode: m.advisoryMode,
      })));
      setConversationId(convId);
      setShowHistory(false);
    } catch {}
  };

  const clearConversation = () => {
    setMessages([]);
    setConversationId(null);
    setStreamingContent('');
    fetchSuggestions();
  };

  const currentMode = ADVISORY_MODES.find(m => m.id === advisoryMode)!;
  const ModeIcon = getModeIcon(currentMode.icon);

  if (isHidden) {
    return (
      <button
        onClick={() => { setIsHidden(false); localStorage.removeItem('ai-assistant-hidden'); }}
        className="fixed bottom-4 right-4 z-50 bg-blue-600 text-white rounded-full p-2 shadow-lg hover:bg-blue-700 transition-colors opacity-50 hover:opacity-100"
        title="Show AI Advisor"
      >
        <Sparkles className="h-4 w-4" />
      </button>
    );
  }

  return (
    <>
      {/* Floating trigger button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-4 right-4 z-50 bg-blue-600 text-white rounded-full p-3 shadow-xl hover:bg-blue-700 transition-all hover:scale-105 flex items-center gap-2"
          title="Open AI Advisor"
        >
          <Sparkles className="h-5 w-5" />
          {entityContext.entityId && (
            <span className="text-xs font-medium pr-1">Analyze</span>
          )}
        </button>
      )}

      {/* Chat panel */}
      {isOpen && (
        <div className="fixed bottom-0 right-0 z-50 w-full h-full md:bottom-4 md:right-4 md:w-[420px] md:h-[640px] md:rounded-xl bg-background border border-border shadow-2xl flex flex-col overflow-hidden">

          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2.5 border-b bg-background shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <div className="h-7 w-7 rounded-lg bg-blue-600 flex items-center justify-center shrink-0">
                <Sparkles className="h-4 w-4 text-white" />
              </div>
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-sm font-semibold shrink-0">AI Advisor</span>
                {/* Context badge — visible when deal/project context is active */}
                {hasEntityContext && contextSummary && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="inline-flex items-center gap-1 bg-blue-50 border border-blue-200 text-blue-700 rounded-full px-2 py-0.5 text-xs font-medium cursor-default max-w-[160px] truncate">
                          <Info className="h-3 w-3 shrink-0" />
                          <span className="truncate">
                            {contextSummary.dealName ?? contextSummary.projectName ?? 'Context loaded'}
                          </span>
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="max-w-[260px]">
                        <p className="font-semibold text-xs mb-1">Context loaded</p>
                        {contextSummary.dealName && (
                          <p className="text-xs text-muted-foreground">Deal: {contextSummary.dealName}</p>
                        )}
                        {contextSummary.projectName && contextSummary.projectName !== contextSummary.dealName && (
                          <p className="text-xs text-muted-foreground">Project: {contextSummary.projectName}</p>
                        )}
                        {contextSummary.injectedSections.length > 0 && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Injected: {contextSummary.injectedSections.join(', ')}
                          </p>
                        )}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
                {/* Loading indicator while fetching context */}
                {hasEntityContext && !contextLoaded && (
                  <span className="inline-flex items-center gap-1 bg-muted border border-border text-muted-foreground rounded-full px-2 py-0.5 text-xs font-medium">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Loading context…
                  </span>
                )}
                {/* Fallback badge when context is active but summary unavailable */}
                {hasEntityContext && contextLoaded && !contextSummary && (
                  <span className="inline-flex items-center gap-1 bg-blue-50 border border-blue-200 text-blue-700 rounded-full px-2 py-0.5 text-xs font-medium">
                    <Info className="h-3 w-3 shrink-0" />
                    Context active
                  </span>
                )}
              </div>
              {/* Global learning indicator */}
              <span title="Learning from all platform users" className="ml-0.5 shrink-0">
                <Globe className="h-3 w-3 text-green-500 opacity-70" />
              </span>
            </div>

            <div className="flex items-center gap-1">
              {messages.length > 0 && (
                <button
                  onClick={clearConversation}
                  className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                  title="New conversation"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </button>
              )}
              <button
                onClick={() => setShowHistory(!showHistory)}
                className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                title="Conversation history"
              >
                <BookOpen className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => setCompareMode(!compareMode)}
                className={cn(
                  "p-1.5 rounded-md transition-colors",
                  compareMode
                    ? "bg-orange-100 text-orange-600 hover:bg-orange-200"
                    : "hover:bg-muted text-muted-foreground hover:text-foreground"
                )}
                title="Deal comparison mode"
              >
                <Scale className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => { setIsHidden(true); setIsOpen(false); localStorage.setItem('ai-assistant-hidden', 'true'); }}
                className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                title="Hide assistant"
              >
                <EyeOff className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* History panel overlay */}
          {showHistory && (
            <div className="absolute inset-0 z-10 bg-background flex flex-col">
              <div className="flex items-center gap-2 px-3 py-2.5 border-b">
                <button onClick={() => setShowHistory(false)} className="p-1 hover:bg-muted rounded">
                  <ArrowLeft className="h-4 w-4" />
                </button>
                <span className="text-sm font-medium">Past Conversations</span>
              </div>
              <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {(conversations as any[]).length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-8">No past conversations yet</p>
                ) : (
                  (conversations as any[]).map((conv: any) => (
                    <button
                      key={conv.id}
                      onClick={() => loadConversation(conv.id)}
                      className="w-full text-left px-3 py-2 rounded-lg hover:bg-muted transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium">
                          {ADVISORY_MODES.find(m => m.id === conv.advisoryMode)?.name ?? 'General'}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {conv.messageCount} msgs
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {new Date(conv.updatedAt).toLocaleDateString()}
                      </p>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Compare mode banner */}
          {compareMode && (
            <div className="bg-orange-50 border-b border-orange-200 px-3 py-2 shrink-0">
              <p className="text-xs font-medium text-orange-800 mb-1.5 flex items-center gap-1.5">
                <Scale className="h-3.5 w-3.5" /> Deal Comparison Mode
              </p>
              <div className="flex gap-1.5 flex-wrap">
                {compareIds.map((id, i) => (
                  <span key={id} className="inline-flex items-center gap-1 bg-orange-100 text-orange-800 rounded px-2 py-0.5 text-xs">
                    Deal {i + 1}: {id.slice(0, 8)}…
                    <button onClick={() => setCompareIds(ids => ids.filter(x => x !== id))} className="hover:text-red-600">×</button>
                  </span>
                ))}
              </div>
              <div className="flex gap-1.5 mt-1.5">
                <Input
                  value={compareInputValue}
                  onChange={e => setCompareInputValue(e.target.value)}
                  placeholder="Paste deal/model ID to add..."
                  className="h-7 text-xs"
                />
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={() => {
                    if (compareInputValue.trim() && compareIds.length < 4) {
                      setCompareIds(ids => [...ids, compareInputValue.trim()]);
                      setCompareInputValue('');
                    }
                  }}
                  disabled={compareIds.length >= 4}
                >
                  Add
                </Button>
              </div>
              {compareIds.length >= 2 && (
                <p className="text-xs text-orange-700 mt-1">
                  ✓ {compareIds.length} deals ready to compare — ask any question below
                </p>
              )}
            </div>
          )}

          {/* Advisory mode selector */}
          <div className="px-3 py-2 border-b shrink-0">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5 w-full justify-between">
                  <div className="flex items-center gap-1.5">
                    <ModeIcon className="h-3.5 w-3.5" />
                    <span className="font-medium">{currentMode.name}</span>
                    <span className="text-muted-foreground">— {currentMode.description}</span>
                  </div>
                  <ChevronDown className="h-3 w-3 opacity-50 shrink-0" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-80">
                <DropdownMenuLabel className="text-xs text-muted-foreground">Advisory Mode</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {ADVISORY_MODES.map(mode => {
                  const Icon = getModeIcon(mode.icon);
                  return (
                    <DropdownMenuItem
                      key={mode.id}
                      onClick={() => setAdvisoryMode(mode.id)}
                      className={cn("flex items-center gap-3 py-2", advisoryMode === mode.id && "bg-accent")}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <div className="flex flex-col">
                        <span className="font-medium text-sm">{mode.name}</span>
                        <span className="text-xs text-muted-foreground">{mode.description}</span>
                      </div>
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Messages */}
          <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-3 space-y-3">

            {/* Welcome state */}
            {messages.length === 0 && !streamingContent && (
              <div className="space-y-3">
                <div className="text-center text-muted-foreground py-2">
                  <div className="h-10 w-10 rounded-full bg-blue-50 border border-blue-200 flex items-center justify-center mx-auto mb-2">
                    <Sparkles className="h-5 w-5 text-blue-600" />
                  </div>
                  <p className="text-sm font-semibold text-foreground">
                    {hasEntityContext && contextSummary
                      ? `Ready to analyze: ${contextSummary.dealName ?? contextSummary.projectName ?? 'this deal'}`
                      : hasEntityContext
                      ? `Ready to analyze this ${entityContext.entityType?.replace('_', ' ')}`
                      : 'Your Investment Advisor'
                    }
                  </p>
                  <p className="text-xs mt-1 max-w-[280px] mx-auto leading-relaxed">
                    {hasEntityContext && contextSummary
                      ? `Live data loaded: ${contextSummary.injectedSections.join(', ')}. Ask me to critique it, analyze returns, benchmark, or write a decision memo.`
                      : hasEntityContext
                      ? 'I have access to this deal\'s data. Ask me to critique it, run a risk analysis, benchmark it, or generate a decision memo.'
                      : 'Analyze deals, compare benchmarks, identify risks, and make better investment decisions.'
                    }
                  </p>
                </div>

                {/* Entity quick actions */}
                {entityContext.entityId && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {[
                      { mode: 'critique' as AdvisoryMode, label: 'Critique Deal', icon: AlertTriangle },
                      { mode: 'risk_analysis' as AdvisoryMode, label: 'Risk Analysis', icon: Shield },
                      { mode: 'benchmark_comparison' as AdvisoryMode, label: 'Benchmark', icon: BarChart3 },
                      { mode: 'decision_memo' as AdvisoryMode, label: 'Decision Memo', icon: FileText },
                    ].map(({ mode, label, icon: Icon }) => (
                      <button
                        key={mode}
                        onClick={() => {
                          setAdvisoryMode(mode);
                          sendMessage(`Give me a ${label.toLowerCase()} for this ${entityContext.entityType?.replace('_', ' ')}.`);
                        }}
                        className="flex items-center gap-2 p-2 rounded-lg bg-muted hover:bg-muted/80 border border-transparent hover:border-border transition-colors text-left"
                      >
                        <Icon className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                        <span className="text-xs font-medium">{label}</span>
                      </button>
                    ))}
                  </div>
                )}

                {/* Suggested questions */}
                {suggestions.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-xs text-muted-foreground font-medium">Suggested questions:</p>
                    {suggestions.slice(0, 4).map((q, i) => (
                      <button
                        key={i}
                        onClick={() => sendMessage(q)}
                        className="w-full text-left text-xs px-2.5 py-2 rounded-lg bg-muted hover:bg-muted/80 transition-colors border border-transparent hover:border-border leading-snug"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Message list */}
            {messages.map(message => (
              <div
                key={message.id}
                className={cn("flex flex-col", message.role === 'user' ? "items-end" : "items-start")}
              >
                {/* Mode badge on assistant messages */}
                {message.role === 'assistant' && message.advisoryMode && message.advisoryMode !== 'general' && (
                  <div className="flex items-center gap-1 mb-1">
                    {(() => {
                      const mode = ADVISORY_MODES.find(m => m.id === message.advisoryMode);
                      if (!mode) return null;
                      const Icon = getModeIcon(mode.icon);
                      return (
                        <Badge variant="outline" className="text-xs py-0 h-5 gap-1">
                          <Icon className="h-3 w-3" />{mode.name}
                        </Badge>
                      );
                    })()}
                  </div>
                )}

                {/* Message bubble */}
                <div
                  className={cn(
                    "max-w-[92%] rounded-xl px-3 py-2",
                    message.role === 'user'
                      ? "bg-blue-600 text-white text-sm"
                      : "bg-muted border border-border/50 text-foreground"
                  )}
                >
                  {message.role === 'user'
                    ? <p className="text-sm">{message.content}</p>
                    : <MarkdownRenderer content={message.content} />
                  }
                </div>

                {/* Feedback buttons */}
                {message.role === 'assistant' && !message.feedback && (
                  <div className="flex items-center gap-1 mt-1">
                    <button
                      onClick={() => handleFeedback(message.id, 'helpful')}
                      className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-green-600 transition-colors"
                      title="Helpful — teaches the AI"
                    >
                      <ThumbsUp className="h-3 w-3" />
                    </button>
                    <button
                      onClick={() => handleFeedback(message.id, 'not_helpful')}
                      className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-red-500 transition-colors"
                      title="Not helpful"
                    >
                      <ThumbsDown className="h-3 w-3" />
                    </button>
                  </div>
                )}
                {message.feedback && (
                  <span className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                    {message.feedback === 'helpful' ? (
                      <><Zap className="h-3 w-3 text-green-500" /> AI learned from this</>
                    ) : 'We\'ll improve this.'}
                  </span>
                )}
              </div>
            ))}

            {/* Streaming in-progress */}
            {streamingContent && (
              <div className="flex flex-col items-start">
                {advisoryMode !== 'general' && (
                  <Badge variant="outline" className="text-xs py-0 h-5 gap-1 mb-1">
                    <ModeIcon className="h-3 w-3" />{currentMode.name}
                  </Badge>
                )}
                <div className="max-w-[92%] rounded-xl px-3 py-2 bg-muted border border-border/50">
                  {<MarkdownRenderer content={streamingContent} />}
                  <span className="inline-block w-1 h-3.5 bg-blue-600 animate-pulse ml-0.5 rounded-sm" />
                </div>
              </div>
            )}

            {/* Loading indicator */}
            {isLoading && !streamingContent && (
              <div className="flex justify-start">
                <div className="bg-muted border border-border/50 rounded-xl px-3 py-2 flex items-center gap-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-600" />
                  <span className="text-xs text-muted-foreground">Analyzing…</span>
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <form
            onSubmit={e => { e.preventDefault(); sendMessage(inputValue); }}
            className="p-3 border-t bg-background shrink-0"
          >
            <div className="flex gap-2">
              <Input
                ref={inputRef}
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                placeholder={
                  compareMode && compareIds.length >= 2
                    ? `Compare ${compareIds.length} deals…`
                    : advisoryMode === 'general'
                    ? 'Ask anything about this deal or market…'
                    : `Ask for ${currentMode.name.toLowerCase()}…`
                }
                disabled={isLoading}
                className="flex-1 h-9 text-sm"
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage(inputValue);
                  }
                }}
              />
              <Button
                type="submit"
                size="icon"
                disabled={isLoading || !inputValue.trim()}
                className="h-9 w-9 bg-blue-600 hover:bg-blue-700 shrink-0"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex items-center justify-between mt-1.5">
              <p className="text-xs text-muted-foreground">
                {hasEntityContext && contextSummary
                  ? <span className="text-blue-600">Context: {contextSummary.injectedSections.join(', ')}</span>
                  : hasEntityContext && !contextLoaded
                  ? <span className="text-blue-600">Live data loading…</span>
                  : 'AI Advisor for CRE & Marina investments'
                }
              </p>
              {compareMode && compareIds.length < 2 && (
                <span className="text-xs text-orange-600">Add {2 - compareIds.length} more deal{compareIds.length === 1 ? '' : 's'} to compare</span>
              )}
            </div>
          </form>
        </div>
      )}
    </>
  );
}
