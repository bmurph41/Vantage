import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation, Link } from "wouter";
import { Check, X, ArrowLeft, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";

interface ReviewItem {
  id: string;
  extractedLabel: string;
  normalizedLabel: string;
  suggestedCanonicalLineItemId: string | null;
  suggestionJson: any;
  confidence: string;
  status: string;
}

interface CanonicalLineItem {
  id: string;
  canonicalKey: string;
  displayName: string;
  department: string;
  section: string;
}

interface ReviewResponse {
  items: ReviewItem[];
}

interface CanonicalItemsResponse {
  items: CanonicalLineItem[];
}

export default function PnlReview() {
  const [, navigate] = useLocation();
  const params = new URLSearchParams(window.location.search);
  const jobId = params.get("jobId");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [selectedMappings, setSelectedMappings] = useState<Record<string, string>>({});
  const [saveAsAlias, setSaveAsAlias] = useState(true);

  const reviewQuery = useQuery<ReviewResponse>({
    queryKey: ["/api/pnl/jobs", jobId, "review"],
    enabled: !!jobId,
  });

  const canonicalQuery = useQuery<CanonicalItemsResponse>({
    queryKey: ["/api/pnl/canonical-items"],
  });

  const remapMutation = useMutation({
    mutationFn: async ({ extractedLabel, canonicalLineItemId }: { extractedLabel: string; canonicalLineItemId: string }) => {
      const res = await fetch(`/api/pnl/jobs/${jobId}/remap`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ extractedLabel, canonicalLineItemId, saveAsAlias }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pnl/jobs", jobId, "review"] });
      toast({
        title: "Mapping saved",
        description: "The line item has been mapped successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Mapping failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const items = reviewQuery.data?.items ?? [];
  const needsReview = items.filter((i) => i.status === "needs_review");
  const approved = items.filter((i) => i.status === "approved");
  const canonicalItems = canonicalQuery.data?.items ?? [];

  const groupedCanonical = canonicalItems.reduce((acc, item) => {
    const section = item.section;
    if (!acc[section]) acc[section] = [];
    acc[section].push(item);
    return acc;
  }, {} as Record<string, CanonicalLineItem[]>);

  const handleMapping = (itemId: string, extractedLabel: string) => {
    const canonicalId = selectedMappings[itemId];
    if (!canonicalId) {
      toast({
        title: "Select a category",
        description: "Please select a canonical line item to map to.",
        variant: "destructive",
      });
      return;
    }
    remapMutation.mutate({ extractedLabel, canonicalLineItemId: canonicalId });
  };

  if (!jobId) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <Card>
          <CardContent className="py-8 text-center">
            <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground" />
            <p className="mt-4 text-muted-foreground">No job ID provided. Please go back and select a job to review.</p>
            <Link href="/modeling/pnl/upload">
              <Button className="mt-4" variant="outline">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Upload
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto p-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Link href="/modeling/pnl/upload">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="mr-1 h-4 w-4" />
                Back
              </Button>
            </Link>
            <h1 className="text-2xl font-bold" data-testid="page-title">P&L Mapping Review</h1>
          </div>
          <p className="text-muted-foreground mt-1">
            Review and correct line item mappings for accurate financial data.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Badge variant="outline">
            {needsReview.length} needs review
          </Badge>
          <Badge variant="secondary">
            {approved.length} approved
          </Badge>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Unmapped Line Items</CardTitle>
          <CardDescription>
            These line items could not be automatically mapped or have low confidence scores.
            Select the correct canonical category for each.
          </CardDescription>
          <div className="flex items-center gap-2 pt-2">
            <Checkbox
              id="saveAsAlias"
              checked={saveAsAlias}
              onCheckedChange={(checked) => setSaveAsAlias(!!checked)}
              data-testid="checkbox-save-alias"
            />
            <label htmlFor="saveAsAlias" className="text-sm text-muted-foreground cursor-pointer">
              Save mappings as aliases for future documents
            </label>
          </div>
        </CardHeader>
        <CardContent>
          {reviewQuery.isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : needsReview.length === 0 ? (
            <div className="text-center py-8">
              <CheckCircle2 className="h-12 w-12 mx-auto text-green-500" />
              <p className="mt-4 text-muted-foreground">All line items have been mapped!</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[300px]">Extracted Label</TableHead>
                  <TableHead className="w-[100px]">Confidence</TableHead>
                  <TableHead>Map To</TableHead>
                  <TableHead className="w-[100px]">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {needsReview.map((item) => (
                  <TableRow key={item.id} data-testid={`row-review-${item.id}`}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{item.extractedLabel}</p>
                        <p className="text-xs text-muted-foreground truncate">{item.normalizedLabel}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant={parseFloat(item.confidence) > 0.5 ? "secondary" : "destructive"}
                      >
                        {(parseFloat(item.confidence) * 100).toFixed(0)}%
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={selectedMappings[item.id] ?? ""}
                        onValueChange={(val) => setSelectedMappings((prev) => ({ ...prev, [item.id]: val }))}
                      >
                        <SelectTrigger data-testid={`select-mapping-${item.id}`}>
                          <SelectValue placeholder="Select canonical item..." />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(groupedCanonical).map(([section, items]) => (
                            <div key={section}>
                              <div className="px-2 py-1 text-xs font-semibold text-muted-foreground uppercase">
                                {section}
                              </div>
                              {items.map((ci) => (
                                <SelectItem key={ci.id} value={ci.id}>
                                  {ci.displayName}
                                </SelectItem>
                              ))}
                            </div>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        onClick={() => handleMapping(item.id, item.extractedLabel)}
                        disabled={!selectedMappings[item.id] || remapMutation.isPending}
                        data-testid={`button-map-${item.id}`}
                      >
                        {remapMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Check className="h-4 w-4" />
                        )}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {approved.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Approved Mappings</CardTitle>
            <CardDescription>
              These line items have been successfully mapped.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Extracted Label</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {approved.map((item) => (
                  <TableRow key={item.id} data-testid={`row-approved-${item.id}`}>
                    <TableCell>
                      <p className="font-medium">{item.extractedLabel}</p>
                    </TableCell>
                    <TableCell>
                      <Badge variant="default">
                        <CheckCircle2 className="mr-1 h-3 w-3" />
                        Approved
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
