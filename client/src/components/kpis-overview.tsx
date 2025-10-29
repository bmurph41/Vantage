import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { 
  TrendingUp, 
  FileText, 
  Search, 
  Filter,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Info
} from "lucide-react";
import type { Kpi, CddDocument } from "@shared/schema";

interface KpisOverviewProps {
  projectId: string;
}

export function KpisOverview({ projectId }: KpisOverviewProps) {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [confidenceFilter, setConfidenceFilter] = useState<string>("all");

  // Fetch KPIs
  const { data: kpis = [], isLoading: kpisLoading } = useQuery<Kpi[]>({
    queryKey: ['/api/dd/projects', projectId, 'kpis'],
  });

  // Fetch documents for source information
  const { data: documents = [] } = useQuery<CddDocument[]>({
    queryKey: ['/api/dd/projects', projectId, 'cdd-documents'],
  });

  // Delete KPI mutation
  const deleteMutation = useMutation({
    mutationFn: async (kpiId: string) => {
      return await apiRequest(`/api/dd/kpis/${kpiId}`, 'DELETE');
    },
    onSuccess: () => {
      toast({
        title: "KPI deleted",
        description: "The KPI has been removed successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/dd/projects', projectId, 'kpis'] });
    },
    onError: (error: any) => {
      toast({
        title: "Delete failed",
        description: error.message || "Failed to delete KPI",
        variant: "destructive",
      });
    },
  });

  // Get unique categories for filter
  const categories = Array.from(new Set(kpis.map(kpi => kpi.category).filter(Boolean)));

  // Filter KPIs
  const filteredKpis = kpis.filter(kpi => {
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesName = kpi.name.toLowerCase().includes(query);
      const matchesValue = kpi.valueText?.toLowerCase().includes(query);
      const matchesCategory = kpi.category?.toLowerCase().includes(query);
      if (!matchesName && !matchesValue && !matchesCategory) return false;
    }

    // Category filter
    if (categoryFilter !== "all" && kpi.category !== categoryFilter) {
      return false;
    }

    // Confidence filter
    if (confidenceFilter !== "all") {
      if (confidenceFilter !== kpi.confidence) {
        return false;
      }
    }

    return true;
  });

  const getConfidenceBadge = (confidence: "high" | "medium" | "low") => {
    if (confidence === "high") {
      return (
        <Badge variant="default" className="bg-green-600">
          <CheckCircle2 className="h-3 w-3 mr-1" />
          High
        </Badge>
      );
    }
    if (confidence === "medium") {
      return (
        <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
          <Info className="h-3 w-3 mr-1" />
          Medium
        </Badge>
      );
    }
    return (
      <Badge variant="destructive">
        <AlertCircle className="h-3 w-3 mr-1" />
        Low
      </Badge>
    );
  };

  const getSourceDocument = (sourceDocumentId: string | null) => {
    if (!sourceDocumentId) return "Unknown";
    const doc = documents.find(d => d.id === sourceDocumentId);
    return doc?.filename || "Unknown Document";
  };

  const handleDelete = (kpiId: string) => {
    if (confirm("Are you sure you want to delete this KPI?")) {
      deleteMutation.mutate(kpiId);
    }
  };

  // Group KPIs by category for summary stats
  const kpisByCategory = kpis.reduce((acc, kpi) => {
    const cat = kpi.category || "Uncategorized";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(kpi);
    return acc;
  }, {} as Record<string, Kpi[]>);

  const avgConfidence = kpis.length > 0
    ? kpis.filter(kpi => kpi.confidence === 'high').length / kpis.length
    : 0;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total KPIs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{kpis.length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Across {Object.keys(kpisByCategory).length} categories
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              High Confidence
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{Math.round(avgConfidence * 100)}%</div>
            <p className="text-xs text-muted-foreground mt-1">
              KPIs with high confidence
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Source Documents
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {new Set(kpis.map(k => k.sourceDocumentId).filter(Boolean)).size}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Documents with extracted KPIs
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main KPIs Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                Key Performance Indicators
              </CardTitle>
              <CardDescription>
                AI-extracted metrics from your due diligence documents
              </CardDescription>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3 mt-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search KPIs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                data-testid="input-search-kpis"
              />
            </div>
            
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-full sm:w-[200px]" data-testid="select-category-filter">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map(cat => (
                  <SelectItem key={cat} value={cat!}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={confidenceFilter} onValueChange={setConfidenceFilter}>
              <SelectTrigger className="w-full sm:w-[200px]" data-testid="select-confidence-filter">
                <SelectValue placeholder="Confidence" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Confidence</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {kpisLoading ? (
            <div className="text-center py-12">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent"></div>
              <p className="mt-4 text-muted-foreground">Loading KPIs...</p>
            </div>
          ) : filteredKpis.length === 0 ? (
            <div className="text-center py-12">
              <TrendingUp className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No KPIs found</h3>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                {kpis.length === 0 
                  ? "Upload documents and use the CDD Copilot to extract KPIs from your documents."
                  : "No KPIs match your current filters. Try adjusting your search criteria."
                }
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Value</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Unit</TableHead>
                    <TableHead>Confidence</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Page</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredKpis.map((kpi) => (
                    <TableRow key={kpi.id} data-testid={`row-kpi-${kpi.id}`}>
                      <TableCell className="font-medium">{kpi.name}</TableCell>
                      <TableCell>{kpi.valueText ?? (kpi.valueNum != null ? kpi.valueNum : '-')}</TableCell>
                      <TableCell>
                        {kpi.category ? (
                          <Badge variant="outline">{kpi.category}</Badge>
                        ) : (
                          <span className="text-muted-foreground text-sm">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {kpi.unit || '-'}
                      </TableCell>
                      <TableCell>{getConfidenceBadge(kpi.confidence)}</TableCell>
                      <TableCell className="max-w-[200px] truncate" title={getSourceDocument(kpi.sourceDocumentId)}>
                        <div className="flex items-center gap-1 text-sm">
                          <FileText className="h-3 w-3 text-muted-foreground" />
                          {getSourceDocument(kpi.sourceDocumentId)}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {kpi.pageHint || '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(kpi.id)}
                          disabled={deleteMutation.isPending}
                          data-testid={`button-delete-kpi-${kpi.id}`}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
