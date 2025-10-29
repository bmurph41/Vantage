import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Upload, FileText, Loader2, Send, Brain, CheckCircle2, XCircle, Clock, Sparkles } from "lucide-react";
import type { CddDocument } from "@shared/schema";

interface CddAdvisorProps {
  projectId: string;
}

interface RagResult {
  text: string;
  similarity: number;
  citation: {
    documentId: string | null;
    documentName: string;
    pageNo: number | null;
    sourceType: string;
    sourceId: string;
  };
  metadata: any;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  results?: RagResult[];
  timestamp: Date;
}

export function CddAdvisor({ projectId }: CddAdvisorProps) {
  const { toast } = useToast();
  const [query, setQuery] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  // Fetch documents
  const { data: documents = [], isLoading: documentsLoading } = useQuery<CddDocument[]>({
    queryKey: ['/api/dd/projects', projectId, 'cdd-documents'],
  });

  // RAG query mutation
  const ragMutation = useMutation({
    mutationFn: async (query: string) => {
      const response = await fetch(`/api/dd/projects/${projectId}/rag`, {
        method: 'POST',
        body: JSON.stringify({ query, limit: 5 }),
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error(await response.text());
      }
      return response.json();
    },
    onSuccess: (data: any) => {
      // Add assistant response to chat
      setChatMessages(prev => [...prev, {
        id: Date.now().toString() + '-assistant',
        role: 'assistant',
        content: generateAnswerFromResults(data.results),
        results: data.results,
        timestamp: new Date(),
      }]);
    },
    onError: (error: any) => {
      toast({
        title: "Search failed",
        description: error.message || "Failed to search documents",
        variant: "destructive",
      });
    },
  });

  // Document upload
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    const formData = new FormData();
    
    for (let i = 0; i < files.length; i++) {
      formData.append('documents', files[i]);
    }

    try {
      const response = await fetch(`/api/dd/projects/${projectId}/cdd-documents`, {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Upload failed' }));
        throw new Error(errorData.error || `Upload failed with status ${response.status}`);
      }

      toast({
        title: "Upload successful",
        description: `${files.length} document${files.length > 1 ? 's' : ''} uploaded successfully`,
      });

      // Invalidate documents query to refresh the list
      queryClient.invalidateQueries({ queryKey: ['/api/dd/projects', projectId, 'cdd-documents'] });
      
      // Reset file input
      event.target.value = '';
    } catch (error: any) {
      toast({
        title: "Upload failed",
        description: error.message || "Failed to upload documents",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  // Parse document
  const parseMutation = useMutation({
    mutationFn: async (documentId: string) => {
      return await apiRequest(`/api/dd/cdd-documents/${documentId}/parse`, 'POST');
    },
    onSuccess: () => {
      toast({
        title: "Parsing started",
        description: "Document is being parsed in the background",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/dd/projects', projectId, 'cdd-documents'] });
    },
    onError: (error: any) => {
      toast({
        title: "Parse failed",
        description: error.message || "Failed to parse document",
        variant: "destructive",
      });
    },
  });

  // Generate embeddings
  const embeddingsMutation = useMutation({
    mutationFn: async (documentId: string) => {
      return await apiRequest(`/api/dd/cdd-documents/${documentId}/embeddings`, 'POST');
    },
    onSuccess: () => {
      toast({
        title: "Embeddings generation started",
        description: "Document embeddings are being generated",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/dd/projects', projectId, 'cdd-documents'] });
    },
    onError: (error: any) => {
      toast({
        title: "Embeddings generation failed",
        description: error.message || "Failed to generate embeddings",
        variant: "destructive",
      });
    },
  });

  const handleSendQuery = () => {
    if (!query.trim()) return;

    // Add user message to chat
    setChatMessages(prev => [...prev, {
      id: Date.now().toString() + '-user',
      role: 'user',
      content: query,
      timestamp: new Date(),
    }]);

    // Execute RAG query
    ragMutation.mutate(query);
    setQuery("");
  };

  const getStatusBadge = (doc: CddDocument) => {
    if (doc.embeddingsStatus === 'completed') {
      return <Badge variant="default" className="bg-green-600"><CheckCircle2 className="h-3 w-3 mr-1" />Ready</Badge>;
    }
    if (doc.embeddingsStatus === 'failed' || doc.parseStatus === 'failed') {
      return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Failed</Badge>;
    }
    if (doc.embeddingsStatus === 'processing' || doc.parseStatus === 'parsing') {
      return <Badge variant="secondary"><Loader2 className="h-3 w-3 mr-1 animate-spin" />Processing</Badge>;
    }
    return <Badge variant="outline"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
  };

  const generateAnswerFromResults = (results: RagResult[]): string => {
    if (!results || results.length === 0) {
      return "I couldn't find any relevant information in the documents to answer your question.";
    }

    const topResult = results[0];
    return `Based on the documents, here's what I found:\n\n${topResult.text}\n\n(Source: ${topResult.citation.documentName}${topResult.citation.pageNo ? `, page ${topResult.citation.pageNo}` : ''})`;
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Left Column - Chat Interface */}
      <div className="lg:col-span-2">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Brain className="h-5 w-5 text-primary" />
                  CDD Copilot
                </CardTitle>
                <CardDescription>
                  Ask questions about your due diligence documents
                </CardDescription>
              </div>
              <Badge variant="secondary" className="gap-1">
                <Sparkles className="h-3 w-3" />
                AI-Powered
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {/* Chat Messages */}
            <ScrollArea className="h-[500px] pr-4 mb-4">
              {chatMessages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center py-12">
                  <Brain className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No conversations yet</h3>
                  <p className="text-sm text-muted-foreground max-w-md">
                    Upload documents and start asking questions about your due diligence materials.
                    The AI will search through your documents and provide answers with citations.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {chatMessages.map((message) => (
                    <div
                      key={message.id}
                      className={message.role === 'user' ? 'flex justify-end' : 'flex justify-start'}
                    >
                      <div
                        className={message.role === 'user' 
                          ? 'bg-primary text-primary-foreground rounded-lg px-4 py-2 max-w-[80%]'
                          : 'bg-muted rounded-lg px-4 py-2 max-w-[80%]'
                        }
                      >
                        <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                        
                        {/* Show citations if available */}
                        {message.results && message.results.length > 0 && (
                          <div className="mt-3 space-y-2">
                            <Separator className="my-2" />
                            <p className="text-xs font-semibold opacity-80">Sources:</p>
                            {message.results.slice(0, 3).map((result, idx) => (
                              <div key={idx} className="text-xs opacity-70 flex items-start gap-1">
                                <span className="font-mono">{idx + 1}.</span>
                                <span>
                                  {result.citation.documentName}
                                  {result.citation.pageNo && ` (p. ${result.citation.pageNo})`}
                                  <span className="ml-2 opacity-50">
                                    {Math.round(result.similarity * 100)}% match
                                  </span>
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  {ragMutation.isPending && (
                    <div className="flex justify-start">
                      <div className="bg-muted rounded-lg px-4 py-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </ScrollArea>

            {/* Query Input */}
            <div className="flex gap-2">
              <Input
                placeholder="Ask a question about your documents..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSendQuery()}
                disabled={ragMutation.isPending || documents.length === 0}
                data-testid="input-rag-query"
              />
              <Button
                onClick={handleSendQuery}
                disabled={!query.trim() || ragMutation.isPending || documents.length === 0}
                data-testid="button-send-query"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
            
            {documents.length === 0 && (
              <p className="text-xs text-muted-foreground mt-2">
                Upload documents first to start asking questions
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Right Column - Document Library */}
      <div>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Document Library
            </CardTitle>
            <CardDescription>
              Upload and manage CDD documents
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Upload Button */}
            <div className="mb-4">
              <label htmlFor="file-upload">
                <Button
                  variant="outline"
                  className="w-full"
                  disabled={isUploading}
                  asChild
                  data-testid="button-upload-documents"
                >
                  <span>
                    {isUploading ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Upload className="h-4 w-4 mr-2" />
                    )}
                    Upload Documents
                  </span>
                </Button>
              </label>
              <input
                id="file-upload"
                type="file"
                multiple
                accept=".pdf,.xlsx,.xls"
                onChange={handleFileUpload}
                className="hidden"
                data-testid="input-file-upload"
              />
              <p className="text-xs text-muted-foreground mt-2">
                Supported: PDF, Excel (max 100MB each)
              </p>
            </div>

            <Separator className="mb-4" />

            {/* Document List */}
            <ScrollArea className="h-[500px]">
              {documentsLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="animate-pulse">
                      <div className="h-16 bg-muted rounded"></div>
                    </div>
                  ))}
                </div>
              ) : documents.length === 0 ? (
                <div className="text-center py-8">
                  <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">
                    No documents uploaded yet
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {documents.map((doc) => (
                    <Card key={doc.id} className="p-3" data-testid={`document-card-${doc.id}`}>
                      <div className="space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate" title={doc.filename}>
                              {doc.filename}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {(doc.size / 1024 / 1024).toFixed(2)} MB
                            </p>
                          </div>
                          {getStatusBadge(doc)}
                        </div>

                        {/* Action Buttons */}
                        <div className="flex gap-2">
                          {doc.parseStatus === 'pending' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => parseMutation.mutate(doc.id)}
                              disabled={parseMutation.isPending}
                              className="text-xs h-7"
                              data-testid={`button-parse-${doc.id}`}
                            >
                              Parse
                            </Button>
                          )}
                          {doc.parseStatus === 'parsed' && doc.embeddingsStatus === 'pending' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => embeddingsMutation.mutate(doc.id)}
                              disabled={embeddingsMutation.isPending}
                              className="text-xs h-7"
                              data-testid={`button-embed-${doc.id}`}
                            >
                              Generate Embeddings
                            </Button>
                          )}
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
