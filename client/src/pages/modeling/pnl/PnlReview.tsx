import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation, Link } from "wouter";
import { Check, X, ArrowLeft, Loader2, AlertCircle, CheckCircle2, AlertTriangle, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";

interface AmbiguousDepartmentOption {
  department: string;
  bucket: string;
  description: string;
}

interface AmbiguityInfo {
  reason: string;
  possibleDepartments: AmbiguousDepartmentOption[];
  matchedKeyword: string;
}

interface ReviewItem {
  id: string;
  extractedLabel: string;
  normalizedLabel: string;
  suggestedCanonicalLineItemId: string | null;
  suggestionJson: {
    mappingMethod?: string;
    suggestion?: any;
    department?: string | null;
    bucket?: string | null;
    isAmbiguous?: boolean;
    ambiguityInfo?: AmbiguityInfo | null;
  };
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
  const [selectedDepartments, setSelectedDepartments] = useState<Record<string, { department: string; bucket: string }>>({});
  const [saveAsAlias, setSaveAsAlias] = useState(true);
  const [addToKeywordBank, setAddToKeywordBank] = useState(true);

  const reviewQuery = useQuery<ReviewResponse>({
    queryKey: ["/api/pnl/jobs", jobId, "review"],
    enabled: !!jobId,
  });

  const canonicalQuery = useQuery<CanonicalItemsResponse>({
    queryKey: ["/api/pnl/canonical-items"],
  });

  const remapMutation = useMutation({
    mutationFn: async ({ 
      extractedLabel, 
      canonicalLineItemId,
      department,
      bucket,
    }: { 
      extractedLabel: string; 
      canonicalLineItemId: string;
      department?: string;
      bucket?: string;
    }) => {
      const res = await fetch(`/api/pnl/jobs/${jobId}/remap`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ 
          extractedLabel, 
          canonicalLineItemId, 
          saveAsAlias,
          addToKeywordBank: addToKeywordBank && !!department && !!bucket,
          department,
          bucket,
        }),
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
  const ambiguousItems = items.filter((i) => i.status === "ambiguous" || i.suggestionJson?.isAmbiguous);
  const needsReview = items.filter((i) => i.status === "needs_review" && !i.suggestionJson?.isAmbiguous);
  const approved = items.filter((i) => i.status === "approved");
  const canonicalItems = canonicalQuery.data?.items ?? [];

  const groupedCanonical = canonicalItems.reduce((acc, item) => {
    const section = item.section;
    if (!acc[section]) acc[section] = [];
    acc[section].push(item);
    return acc;
  }, {} as Record<string, CanonicalLineItem[]>);

  const handleMapping = (itemId: string, extractedLabel: string, isAmbiguous: boolean = false) => {
    const canonicalId = selectedMappings[itemId];
    if (!canonicalId) {
      toast({
        title: "Select a category",
        description: "Please select a canonical line item to map to.",
        variant: "destructive",
      });
      return;
    }
    
    const deptSelection = isAmbiguous ? selectedDepartments[itemId] : undefined;
    if (isAmbiguous && !deptSelection) {
      toast({
        title: "Select a department",
        description: "Please select which department this line item belongs to.",
        variant: "destructive",
      });
      return;
    }
    
    remapMutation.mutate({ 
      extractedLabel, 
      canonicalLineItemId: canonicalId,
      department: deptSelection?.department,
      bucket: deptSelection?.bucket,
    });
  };

  const handleAmbiguousMapping = (itemId: string, extractedLabel: string) => {
    const deptSelection = selectedDepartments[itemId];
    if (!deptSelection) {
      toast({
        title: "Select a department",
        description: "Please select which department this line item belongs to.",
        variant: "destructive",
      });
      return;
    }
    
    const matchingCanonical = canonicalItems.find(
      (c) => c.department === deptSelection.department
    );
    
    remapMutation.mutate({ 
      extractedLabel, 
      canonicalLineItemId: matchingCanonical?.id || selectedMappings[itemId] || '',
      department: deptSelection.department,
      bucket: deptSelection.bucket,
    });
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
          {ambiguousItems.length > 0 && (
            <Badge variant="outline" className="border-amber-500 text-amber-600">
              <AlertTriangle className="mr-1 h-3 w-3" />
              {ambiguousItems.length} need verification
            </Badge>
          )}
          <Badge variant="outline">
            {needsReview.length} needs review
          </Badge>
          <Badge variant="secondary">
            {approved.length} approved
          </Badge>
        </div>
      </div>

      {ambiguousItems.length > 0 && (
        <Card className="border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20">
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              <CardTitle className="text-amber-900 dark:text-amber-100">Ambiguous Line Items - Verification Required</CardTitle>
            </div>
            <CardDescription className="text-amber-800 dark:text-amber-200">
              These line items could belong to different departments depending on how your marina operates.
              Please select the correct department for each.
            </CardDescription>
            <div className="flex items-center gap-4 pt-2">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="addToKeywordBank"
                  checked={addToKeywordBank}
                  onCheckedChange={(checked) => setAddToKeywordBank(!!checked)}
                />
                <label htmlFor="addToKeywordBank" className="text-sm text-muted-foreground cursor-pointer">
                  Remember my choices for future documents
                </label>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {ambiguousItems.map((item) => {
              const ambiguityInfo = item.suggestionJson?.ambiguityInfo;
              const possibleDepts = ambiguityInfo?.possibleDepartments ?? [];
              const selectedDept = selectedDepartments[item.id];
              
              return (
                <div 
                  key={item.id} 
                  className="border rounded-lg p-4 bg-white dark:bg-gray-900 space-y-3"
                  data-testid={`ambiguous-item-${item.id}`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-lg">{item.extractedLabel}</p>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger>
                              <HelpCircle className="h-4 w-4 text-muted-foreground" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-sm">
                              <p className="text-sm">{ambiguityInfo?.reason || "This item needs department verification."}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                      <p className="text-sm text-muted-foreground">{item.normalizedLabel}</p>
                    </div>
                    <Badge variant="outline" className="border-amber-500 text-amber-600">
                      Needs Verification
                    </Badge>
                  </div>
                  
                  {ambiguityInfo?.reason && (
                    <Alert className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30">
                      <AlertTriangle className="h-4 w-4 text-amber-600" />
                      <AlertDescription className="text-amber-800 dark:text-amber-200 text-sm">
                        {ambiguityInfo.reason}
                      </AlertDescription>
                    </Alert>
                  )}
                  
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Select the correct department:</Label>
                    <RadioGroup
                      value={selectedDept ? `${selectedDept.department}|${selectedDept.bucket}` : ""}
                      onValueChange={(val) => {
                        const [department, bucket] = val.split("|");
                        setSelectedDepartments((prev) => ({
                          ...prev,
                          [item.id]: { department, bucket },
                        }));
                      }}
                      className="grid gap-2"
                    >
                      {possibleDepts.map((opt, idx) => (
                        <div 
                          key={idx} 
                          className={`flex items-center space-x-3 p-3 rounded-lg border transition-colors cursor-pointer ${
                            selectedDept?.department === opt.department && selectedDept?.bucket === opt.bucket
                              ? "border-primary bg-primary/5"
                              : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                          }`}
                        >
                          <RadioGroupItem 
                            value={`${opt.department}|${opt.bucket}`} 
                            id={`${item.id}-${idx}`}
                          />
                          <Label 
                            htmlFor={`${item.id}-${idx}`} 
                            className="flex-1 cursor-pointer"
                          >
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{opt.department}</span>
                              <Badge variant="secondary" className="text-xs">{opt.bucket}</Badge>
                            </div>
                            <p className="text-sm text-muted-foreground mt-0.5">{opt.description}</p>
                          </Label>
                        </div>
                      ))}
                    </RadioGroup>
                  </div>
                  
                  <div className="flex justify-end pt-2">
                    <Button
                      onClick={() => handleAmbiguousMapping(item.id, item.extractedLabel)}
                      disabled={!selectedDept || remapMutation.isPending}
                      className="min-w-[120px]"
                    >
                      {remapMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <Check className="h-4 w-4 mr-2" />
                      )}
                      Confirm
                    </Button>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

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
          ) : needsReview.length === 0 && ambiguousItems.length === 0 ? (
            <div className="text-center py-8">
              <CheckCircle2 className="h-12 w-12 mx-auto text-green-500" />
              <p className="mt-4 text-muted-foreground">All line items have been mapped!</p>
            </div>
          ) : needsReview.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No unmapped items. Please review the ambiguous items above.</p>
            </div>
          ) : (
            <div className="overflow-x-auto w-full">
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
            </div>
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
            <div className="overflow-x-auto w-full">
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
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
