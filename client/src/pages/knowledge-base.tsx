import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { formatDisplayDate } from "@/lib/date-utils";
import {
  Brain, Upload, Trash2, FileText, Plus, Search,
  CheckCircle, AlertCircle, Loader2, Database,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription,
  DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";

interface KnowledgeDocument {
  id: string;
  title: string;
  description: string | null;
  sourceType: string;
  fileName: string | null;
  chunkCount: number;
  status: string;
  createdAt: string;
}

export default function KnowledgeBasePage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showUpload, setShowUpload] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [content, setContent] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  const { data: documents = [], isLoading } = useQuery<KnowledgeDocument[]>({
    queryKey: ["/api/ai-assistant/knowledge"],
  });

  const uploadMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/ai-assistant/knowledge", {
        title,
        description,
        contentText: content,
        sourceType: "text",
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai-assistant/knowledge"] });
      toast({ title: "Document uploaded and processing" });
      setShowUpload(false);
      setTitle("");
      setDescription("");
      setContent("");
    },
    onError: () => {
      toast({ title: "Upload failed", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/ai-assistant/knowledge/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai-assistant/knowledge"] });
      toast({ title: "Document removed" });
    },
  });

  const filtered = documents.filter(
    (d) =>
      d.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (d.description || "").toLowerCase().includes(searchTerm.toLowerCase())
  );

  const statusBadge = (status: string) => {
    switch (status) {
      case "ready":
        return <Badge variant="default" className="gap-1"><CheckCircle className="h-3 w-3" /> Ready</Badge>;
      case "processing":
        return <Badge variant="secondary" className="gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Processing</Badge>;
      case "error":
        return <Badge variant="destructive" className="gap-1"><AlertCircle className="h-3 w-3" /> Error</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Brain className="h-6 w-6" /> AI Knowledge Base
          </h1>
          <p className="text-muted-foreground">
            Upload documents and knowledge that the AI assistant uses to provide better, context-aware answers.
          </p>
        </div>
        <Dialog open={showUpload} onOpenChange={setShowUpload}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" /> Add Knowledge
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Add Knowledge Document</DialogTitle>
              <DialogDescription>
                Paste text content that the AI assistant should learn from. It will be chunked, embedded, and available for all future conversations.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Title</label>
                <Input
                  placeholder="e.g., Marina Industry Best Practices"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Description (optional)</label>
                <Input
                  placeholder="Brief description of the content"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Content</label>
                <Textarea
                  placeholder="Paste the full text content here..."
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  rows={10}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {content.length > 0
                    ? `${content.length.toLocaleString()} characters, ~${Math.ceil(content.length / 4).toLocaleString()} tokens`
                    : "Supports plain text, markdown, or structured data"}
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowUpload(false)}>Cancel</Button>
              <Button
                onClick={() => uploadMutation.mutate()}
                disabled={!title.trim() || !content.trim() || uploadMutation.isPending}
              >
                {uploadMutation.isPending ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Processing...</>
                ) : (
                  <><Upload className="h-4 w-4 mr-2" /> Upload & Process</>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center gap-2">
        <Search className="h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search knowledge documents..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-sm"
        />
        <Badge variant="outline" className="ml-auto">
          <Database className="h-3 w-3 mr-1" />
          {documents.length} documents, {documents.reduce((s, d) => s + (d.chunkCount || 0), 0)} chunks
        </Badge>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20" />)}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Brain className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="text-lg font-medium mb-2">No knowledge documents yet</h3>
            <p className="text-muted-foreground mb-4">
              Upload documents, guides, or data that the AI assistant should reference when answering questions.
            </p>
            <Button onClick={() => setShowUpload(true)}>
              <Plus className="h-4 w-4 mr-2" /> Add Your First Document
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((doc) => (
            <Card key={doc.id}>
              <CardContent className="py-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-primary/10 mt-0.5">
                      <FileText className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-medium">{doc.title}</h3>
                      {doc.description && (
                        <p className="text-sm text-muted-foreground">{doc.description}</p>
                      )}
                      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                        {statusBadge(doc.status)}
                        <span>{doc.chunkCount} chunks</span>
                        <span>{doc.sourceType}</span>
                        <span>{formatDisplayDate(doc.createdAt)}</span>
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteMutation.mutate(doc.id)}
                    disabled={deleteMutation.isPending}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
