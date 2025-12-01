import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { ArrowLeft, Upload, FileSpreadsheet, Brain, CheckCircle2, AlertCircle, Clock, Settings, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { UploadDropzone } from "./UploadDropzone";
import { ReviewWizard } from "./ReviewWizard";
import { CategoryManager } from "./CategoryManager";
import { HoldingStation } from "./HoldingStation";
import type { DocIntelUpload, PnlCategory } from "@shared/schema";

interface UploadWithStats extends DocIntelUpload {
  stats?: {
    total: number;
    pending: number;
    confirmed: number;
    rejected: number;
    needsReview: number;
    highConfidence: number;
    lowConfidence: number;
  };
}

export default function DocumentIntelligence() {
  const { projectId } = useParams<{ projectId: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("holding");
  const [selectedUpload, setSelectedUpload] = useState<string | null>(null);

  const { data: uploads = [], isLoading: uploadsLoading } = useQuery<UploadWithStats[]>({
    queryKey: ["/api/modeling/projects", projectId, "documents"],
    enabled: !!projectId,
  });

  const { data: categories = [] } = useQuery<PnlCategory[]>({
    queryKey: ["/api/modeling/doc-intel/categories"],
  });

  const initMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("/api/modeling/doc-intel/init", { method: "POST" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/modeling/doc-intel/categories"] });
      toast({ title: "Initialized", description: "Default categories and patterns have been created." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to initialize document intelligence.", variant: "destructive" });
    },
  });

  const handleUploadComplete = (upload: DocIntelUpload) => {
    queryClient.invalidateQueries({ queryKey: ["/api/modeling/projects", projectId, "documents"] });
    setSelectedUpload(upload.id);
    toast({ title: "Upload successful", description: `${upload.originalName} is ready for processing.` });
  };

  const handleReviewComplete = () => {
    setSelectedUpload(null);
    queryClient.invalidateQueries({ queryKey: ["/api/modeling/projects", projectId, "documents"] });
    toast({ title: "Import complete", description: "Line items have been imported to your P&L." });
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ReactNode; label: string }> = {
      uploaded: { variant: "secondary", icon: <Clock className="h-3 w-3" />, label: "Pending" },
      processing: { variant: "default", icon: <Clock className="h-3 w-3 animate-spin" />, label: "Processing" },
      parsed: { variant: "outline", icon: <FileSpreadsheet className="h-3 w-3" />, label: "Parsed" },
      reviewing: { variant: "default", icon: <Brain className="h-3 w-3" />, label: "Reviewing" },
      completed: { variant: "secondary", icon: <CheckCircle2 className="h-3 w-3" />, label: "Completed" },
      error: { variant: "destructive", icon: <AlertCircle className="h-3 w-3" />, label: "Error" },
    };
    const config = statusConfig[status] || statusConfig.uploaded;
    return (
      <Badge variant={config.variant} className="gap-1">
        {config.icon}
        {config.label}
      </Badge>
    );
  };

  if (selectedUpload) {
    const upload = uploads.find(u => u.id === selectedUpload);
    if (upload) {
      return (
        <ReviewWizard
          projectId={projectId!}
          upload={upload}
          categories={categories}
          onClose={() => setSelectedUpload(null)}
          onComplete={handleReviewComplete}
        />
      );
    }
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(`/modeling/projects/${projectId}`)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold" data-testid="page-title">Document Intelligence</h1>
            <p className="text-muted-foreground">AI-powered P&L and Rent Roll import with smart categorization</p>
          </div>
        </div>
        {categories.length === 0 && (
          <Button onClick={() => initMutation.mutate()} disabled={initMutation.isPending} data-testid="button-initialize">
            {initMutation.isPending ? "Initializing..." : "Initialize Categories"}
          </Button>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="holding" data-testid="tab-holding">
            <Inbox className="h-4 w-4 mr-2" />
            Holding Station
          </TabsTrigger>
          <TabsTrigger value="uploads" data-testid="tab-uploads">
            <Upload className="h-4 w-4 mr-2" />
            Processing
          </TabsTrigger>
          <TabsTrigger value="categories" data-testid="tab-categories">
            <Settings className="h-4 w-4 mr-2" />
            Categories
          </TabsTrigger>
        </TabsList>

        <TabsContent value="holding" className="space-y-6">
          <HoldingStation
            projectId={projectId!}
            onProcessDocument={(uploadId) => {
              setActiveTab("uploads");
              setSelectedUpload(uploadId);
            }}
          />
        </TabsContent>

        <TabsContent value="uploads" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Upload Documents</CardTitle>
              <CardDescription>
                Upload Excel, CSV, or PDF files containing P&L statements or Rent Rolls for AI-powered parsing
              </CardDescription>
            </CardHeader>
            <CardContent>
              <UploadDropzone projectId={projectId!} onUploadComplete={handleUploadComplete} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent Uploads</CardTitle>
              <CardDescription>View and manage your uploaded documents</CardDescription>
            </CardHeader>
            <CardContent>
              {uploadsLoading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
                </div>
              ) : uploads.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <FileSpreadsheet className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No documents uploaded yet</p>
                  <p className="text-sm">Upload a P&L or Rent Roll to get started</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {uploads.map((upload) => (
                    <div
                      key={upload.id}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                      onClick={() => setSelectedUpload(upload.id)}
                      data-testid={`upload-item-${upload.id}`}
                    >
                      <div className="flex items-center gap-4">
                        <FileSpreadsheet className="h-8 w-8 text-green-600" />
                        <div>
                          <p className="font-medium">{upload.originalName}</p>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <span>{upload.docType?.toUpperCase() || "Unknown"}</span>
                            {upload.year && <span>• {upload.year}</span>}
                            <span>• {(upload.fileSize / 1024).toFixed(1)} KB</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        {upload.stats && upload.status === "reviewing" && (
                          <div className="flex items-center gap-2">
                            <Progress 
                              value={(upload.stats.confirmed / upload.stats.total) * 100} 
                              className="w-24 h-2"
                            />
                            <span className="text-sm text-muted-foreground">
                              {upload.stats.confirmed}/{upload.stats.total}
                            </span>
                          </div>
                        )}
                        {getStatusBadge(upload.status)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="categories">
          <CategoryManager />
        </TabsContent>
      </Tabs>
    </div>
  );
}
