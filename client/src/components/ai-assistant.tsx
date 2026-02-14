import { useState, useRef, useEffect, useCallback } from 'react';
import { useLocation } from 'wouter';
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
  ThumbsDown
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
} from "@/components/ui/dropdown-menu";
import { Badge } from '@/components/ui/badge';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  advisoryMode?: AdvisoryMode;
  feedback?: 'helpful' | 'not_helpful';
}

interface AssistantContext {
  currentPage: string;
  entityType?: string;
  entityId?: string;
  entityName?: string;
  advisoryMode?: AdvisoryMode;
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

const ADVISORY_MODES: AdvisoryModeInfo[] = [
  { id: 'general', name: 'General', description: 'General questions and guidance', icon: 'MessageCircle' },
  { id: 'critique', name: 'Critique', description: 'Challenge my assumptions', icon: 'AlertTriangle' },
  { id: 'risk_analysis', name: 'Risk Analysis', description: 'Comprehensive risk assessment', icon: 'Shield' },
  { id: 'benchmark_comparison', name: 'Benchmark', description: 'Compare to market standards', icon: 'BarChart' },
  { id: 'options_analysis', name: 'Options', description: 'Analyze alternatives', icon: 'GitBranch' },
  { id: 'decision_memo', name: 'Decision Memo', description: 'Generate investment memo', icon: 'FileText' },
  { id: 'stress_test', name: 'Stress Test', description: 'Test adverse scenarios', icon: 'TrendingDown' },
  { id: 'next_actions', name: 'Next Actions', description: 'Prioritized action items', icon: 'CheckSquare' },
];

const getModeIcon = (iconName: string) => {
  const icons: Record<string, any> = {
    MessageCircle,
    AlertTriangle,
    Shield,
    BarChart: BarChart3,
    GitBranch,
    FileText,
    TrendingDown,
    CheckSquare,
  };
  return icons[iconName] || MessageCircle;
};

export function AIAssistant() {
  const [location] = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [isHidden, setIsHidden] = useState(() => localStorage.getItem('ai-assistant-hidden') === 'true');

  const hideAssistant = useCallback(() => {
    setIsHidden(true);
    setIsOpen(false);
    localStorage.setItem('ai-assistant-hidden', 'true');
  }, []);

  const showAssistant = useCallback(() => {
    setIsHidden(false);
    localStorage.removeItem('ai-assistant-hidden');
  }, []);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [streamingContent, setStreamingContent] = useState('');
  const [advisoryMode, setAdvisoryMode] = useState<AdvisoryMode>('general');
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const messagesRef = useRef<Message[]>([]);

  messagesRef.current = messages;

  const getContext = useCallback((): AssistantContext => {
    return {
      currentPage: location,
      advisoryMode,
    };
  }, [location, advisoryMode]);

  useEffect(() => {
    if (isOpen) {
      fetchSuggestions();
    }
  }, [location, isOpen, advisoryMode]);

  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  }, [messages, streamingContent]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const fetchSuggestions = async () => {
    try {
      const response = await fetch(`/api/ai-assistant/suggestions?page=${encodeURIComponent(location)}&mode=${advisoryMode}`);
      if (response.ok) {
        const data = await response.json();
        setSuggestions(data.suggestions || []);
      }
    } catch (error) {
      console.error('Failed to fetch suggestions:', error);
    }
  };

  const sendMessage = async (content: string) => {
    if (!content.trim() || isLoading) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: content.trim(),
      timestamp: new Date(),
      advisoryMode,
    };

    const currentMessages = [...messagesRef.current, userMessage];
    setMessages(currentMessages);
    setInputValue('');
    setIsLoading(true);
    setStreamingContent('');

    try {
      const response = await fetch('/api/ai-assistant/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: content.trim(),
          context: getContext(),
          conversationHistory: currentMessages.slice(-10).map(m => ({
            role: m.role,
            content: m.content,
            timestamp: m.timestamp,
          })),
          advisoryMode,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get response');
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No reader available');

      const decoder = new TextDecoder();
      let accumulatedContent = '';
      let lineBuffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        lineBuffer += chunk;
        
        const lines = lineBuffer.split('\n');
        lineBuffer = lines.pop() || '';

        for (const line of lines) {
          const trimmedLine = line.trim();
          if (trimmedLine.startsWith('data: ')) {
            try {
              const jsonStr = trimmedLine.slice(6);
              if (jsonStr) {
                const data = JSON.parse(jsonStr);
                if (data.content) {
                  accumulatedContent += data.content;
                  setStreamingContent(accumulatedContent);
                }
                if (data.done && accumulatedContent) {
                  const assistantMessage: Message = {
                    id: `assistant-${Date.now()}`,
                    role: 'assistant',
                    content: accumulatedContent,
                    timestamp: new Date(),
                    advisoryMode,
                  };
                  setMessages(prev => [...prev, assistantMessage]);
                  setStreamingContent('');
                  accumulatedContent = '';
                }
                if (data.error) {
                  throw new Error(data.error);
                }
              }
            } catch (parseError) {
            }
          }
        }
      }

      if (lineBuffer.trim().startsWith('data: ')) {
        try {
          const jsonStr = lineBuffer.trim().slice(6);
          if (jsonStr) {
            const data = JSON.parse(jsonStr);
            if (data.content) {
              accumulatedContent += data.content;
            }
          }
        } catch {}
      }

      if (accumulatedContent) {
        const assistantMessage: Message = {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: accumulatedContent,
          timestamp: new Date(),
          advisoryMode,
        };
        setMessages(prev => {
          const lastMsg = prev[prev.length - 1];
          if (lastMsg?.role === 'assistant' && lastMsg?.content === accumulatedContent) {
            return prev;
          }
          return [...prev, assistantMessage];
        });
        setStreamingContent('');
      }
    } catch (error) {
      console.error('Chat error:', error);
      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(inputValue);
  };

  const handleSuggestionClick = (suggestion: string) => {
    sendMessage(suggestion);
  };

  const clearConversation = () => {
    setMessages([]);
    setStreamingContent('');
  };

  const handleFeedback = async (messageId: string, feedback: 'helpful' | 'not_helpful') => {
    setMessages(prev => prev.map(m => 
      m.id === messageId ? { ...m, feedback } : m
    ));
    
    try {
      await fetch('/api/ai-assistant/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageId,
          rating: feedback === 'helpful' ? 'positive' : 'negative',
          advisoryMode,
          page: currentPage,
        }),
      });
    } catch (error) {
      console.error('[AI Assistant] Failed to record feedback:', error);
    }
  };

  const currentMode = ADVISORY_MODES.find(m => m.id === advisoryMode) || ADVISORY_MODES[0];
  const ModeIcon = getModeIcon(currentMode.icon);

  if (isHidden) {
    return (
      <Button
        onClick={showAssistant}
        className="fixed bottom-6 right-6 h-8 w-8 rounded-full shadow-md z-50 bg-muted hover:bg-muted/80 text-muted-foreground opacity-40 hover:opacity-100 transition-all duration-300"
        title="Show AI Assistant"
        size="icon"
        variant="ghost"
      >
        <Sparkles className="h-3.5 w-3.5" />
      </Button>
    );
  }

  return (
    <>
      <Button
        onClick={() => setIsOpen(true)}
        className={cn(
          "fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg z-50",
          "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700",
          "transition-all duration-300 hover:scale-105",
          isOpen && "hidden"
        )}
      >
        <Sparkles className="h-6 w-6 text-white" />
      </Button>

      {isOpen && (
        <div className="fixed bottom-6 right-6 w-[420px] h-[650px] max-h-[85vh] bg-background border rounded-xl shadow-2xl z-50 flex flex-col overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-white" />
              <h3 className="font-semibold text-white">MarinaMatch Advisor</h3>
            </div>
            <div className="flex items-center gap-1">
              {messages.length > 0 && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={clearConversation}
                  className="text-white/80 hover:text-white hover:bg-white/10 h-8 w-8"
                  title="Clear conversation"
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={hideAssistant}
                className="text-white/80 hover:text-white hover:bg-white/10 h-8 w-8"
                title="Hide assistant"
              >
                <EyeOff className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsOpen(false)}
                className="text-white hover:bg-white/10 h-8 w-8"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
          </div>

          <div className="px-3 py-2 border-b bg-muted/30">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="w-full justify-between h-9">
                  <div className="flex items-center gap-2">
                    <ModeIcon className="h-4 w-4" />
                    <span className="font-medium">{currentMode.name}</span>
                    <span className="text-xs text-muted-foreground hidden sm:inline">- {currentMode.description}</span>
                  </div>
                  <ChevronDown className="h-4 w-4 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-80">
                <DropdownMenuLabel>Advisory Mode</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {ADVISORY_MODES.map((mode) => {
                  const Icon = getModeIcon(mode.icon);
                  return (
                    <DropdownMenuItem
                      key={mode.id}
                      onClick={() => setAdvisoryMode(mode.id)}
                      className={cn(
                        "flex items-center gap-3 py-2",
                        advisoryMode === mode.id && "bg-accent"
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <div className="flex flex-col">
                        <span className="font-medium">{mode.name}</span>
                        <span className="text-xs text-muted-foreground">{mode.description}</span>
                      </div>
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div 
            ref={scrollContainerRef}
            className="flex-1 overflow-y-auto p-3"
          >
            {messages.length === 0 && !streamingContent && (
              <div className="space-y-4">
                <div className="text-center text-muted-foreground py-3">
                  <Sparkles className="h-8 w-8 mx-auto mb-2 text-blue-500" />
                  <p className="text-sm font-medium">Your Marina Investment Advisor</p>
                  <p className="text-xs mt-1">I can analyze deals, compare benchmarks, identify risks, and help you make better investment decisions.</p>
                </div>
                
                {suggestions.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground font-medium">Try asking:</p>
                    {suggestions.map((suggestion, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleSuggestionClick(suggestion)}
                        className="w-full text-left text-sm p-2.5 rounded-lg bg-muted hover:bg-muted/80 transition-colors border border-transparent hover:border-border"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                )}

                <div className="pt-2 border-t">
                  <p className="text-xs text-muted-foreground mb-2">Quick Actions:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { mode: 'critique' as AdvisoryMode, label: 'Critique Deal' },
                      { mode: 'risk_analysis' as AdvisoryMode, label: 'Risk Analysis' },
                      { mode: 'benchmark_comparison' as AdvisoryMode, label: 'Compare Benchmarks' },
                      { mode: 'stress_test' as AdvisoryMode, label: 'Stress Test' },
                    ].map(({ mode, label }) => (
                      <Badge
                        key={mode}
                        variant="secondary"
                        className="cursor-pointer hover:bg-secondary/80 text-xs"
                        onClick={() => {
                          setAdvisoryMode(mode);
                          setInputValue(`Help me with a ${label.toLowerCase()}`);
                          inputRef.current?.focus();
                        }}
                      >
                        {label}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-3">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={cn(
                    "flex flex-col",
                    message.role === 'user' ? "items-end" : "items-start"
                  )}
                >
                  {message.role === 'assistant' && message.advisoryMode && message.advisoryMode !== 'general' && (
                    <div className="flex items-center gap-1 mb-1">
                      {(() => {
                        const mode = ADVISORY_MODES.find(m => m.id === message.advisoryMode);
                        if (mode) {
                          const Icon = getModeIcon(mode.icon);
                          return (
                            <Badge variant="outline" className="text-xs py-0 h-5">
                              <Icon className="h-3 w-3 mr-1" />
                              {mode.name}
                            </Badge>
                          );
                        }
                        return null;
                      })()}
                    </div>
                  )}
                  <div
                    className={cn(
                      "max-w-[90%] rounded-lg px-3 py-2 text-sm",
                      message.role === 'user'
                        ? "bg-blue-600 text-white"
                        : "bg-muted"
                    )}
                  >
                    <div className="whitespace-pre-wrap">{message.content}</div>
                  </div>
                  {message.role === 'assistant' && !message.feedback && (
                    <div className="flex items-center gap-1 mt-1">
                      <button
                        onClick={() => handleFeedback(message.id, 'helpful')}
                        className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                        title="Helpful"
                      >
                        <ThumbsUp className="h-3 w-3" />
                      </button>
                      <button
                        onClick={() => handleFeedback(message.id, 'not_helpful')}
                        className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                        title="Not helpful"
                      >
                        <ThumbsDown className="h-3 w-3" />
                      </button>
                    </div>
                  )}
                  {message.feedback && (
                    <span className="text-xs text-muted-foreground mt-1">
                      {message.feedback === 'helpful' ? 'Thanks for the feedback!' : 'We\'ll improve this.'}
                    </span>
                  )}
                </div>
              ))}

              {streamingContent && (
                <div className="flex flex-col items-start">
                  {advisoryMode !== 'general' && (
                    <div className="flex items-center gap-1 mb-1">
                      <Badge variant="outline" className="text-xs py-0 h-5">
                        <ModeIcon className="h-3 w-3 mr-1" />
                        {currentMode.name}
                      </Badge>
                    </div>
                  )}
                  <div className="max-w-[90%] rounded-lg px-3 py-2 text-sm bg-muted">
                    <div className="whitespace-pre-wrap">{streamingContent}</div>
                  </div>
                </div>
              )}

              {isLoading && !streamingContent && (
                <div className="flex justify-start">
                  <div className="bg-muted rounded-lg px-3 py-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                  </div>
                </div>
              )}
            </div>
          </div>

          <form onSubmit={handleSubmit} className="p-3 border-t bg-background">
            <div className="flex gap-2">
              <Input
                ref={inputRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder={advisoryMode === 'general' ? "Ask me anything..." : `Ask for ${currentMode.name.toLowerCase()}...`}
                disabled={isLoading}
                className="flex-1"
              />
              <Button
                type="submit"
                size="icon"
                disabled={isLoading || !inputValue.trim()}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground text-center mt-2">
              Your AI advisor for marina investments
            </p>
          </form>
        </div>
      )}
    </>
  );
}
