import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { AlertCircle, CheckCircle2, SkipForward, HelpCircle, Save, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface DepartmentOption {
  department: string;
  bucket: string;
  description: string;
}

interface DepartmentVerification {
  id: string;
  jobId: string;
  orgId: string;
  originalLabel: string;
  normalizedLabel: string;
  suggestedDepartments: DepartmentOption[];
  ambiguityReason: string;
  status: string;
  selectedDepartment?: string;
  selectedBucket?: string;
  keywordRuleId?: string;
  saveToKeywordBank: boolean;
  createdAt: string;
}

interface Props {
  jobId?: string;
  onComplete?: () => void;
}

export default function PnlDepartmentVerification({ jobId, onComplete }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selections, setSelections] = useState<Record<string, { departmentIndex: number; saveToBank: boolean }>>({});

  const { data, isLoading, refetch } = useQuery<{ verifications: DepartmentVerification[] }>({
    queryKey: ["/api/pnl/department-verifications", jobId],
    queryFn: () => apiRequest(jobId ? `/api/pnl/department-verifications/${jobId}` : "/api/pnl/department-verifications"),
  });

  const resolveMutation = useMutation({
    mutationFn: async ({ id, department, bucket, saveToKeywordBank }: { id: string; department: string; bucket: string; saveToKeywordBank: boolean }) => {
      return apiRequest(`/api/pnl/department-verifications/${id}/resolve`, {
        method: "POST",
        body: JSON.stringify({ department, bucket, saveToKeywordBank }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pnl/department-verifications"] });
      refetch();
    },
  });

  const skipMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest(`/api/pnl/department-verifications/${id}/skip`, { method: "POST" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pnl/department-verifications"] });
      refetch();
    },
  });

  const handleSelectDepartment = (verificationId: string, index: number) => {
    setSelections((prev) => ({
      ...prev,
      [verificationId]: {
        ...prev[verificationId],
        departmentIndex: index,
        saveToBank: prev[verificationId]?.saveToBank ?? true,
      },
    }));
  };

  const handleToggleSaveToBank = (verificationId: string, checked: boolean) => {
    setSelections((prev) => ({
      ...prev,
      [verificationId]: {
        ...prev[verificationId],
        saveToBank: checked,
      },
    }));
  };

  const handleResolve = async (verification: DepartmentVerification) => {
    const selection = selections[verification.id];
    if (selection === undefined || selection.departmentIndex === undefined) {
      toast({ title: "Please select a department", variant: "destructive" });
      return;
    }

    const option = verification.suggestedDepartments[selection.departmentIndex];
    if (!option) return;

    try {
      await resolveMutation.mutateAsync({
        id: verification.id,
        department: option.department,
        bucket: option.bucket,
        saveToKeywordBank: selection.saveToBank,
      });
      toast({
        title: "Department Verified",
        description: selection.saveToBank
          ? `"${verification.originalLabel}" mapped to ${option.department}. Saved to keyword bank for future imports.`
          : `"${verification.originalLabel}" mapped to ${option.department}.`,
      });
      
      setSelections((prev) => {
        const next = { ...prev };
        delete next[verification.id];
        return next;
      });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleSkip = async (verification: DepartmentVerification) => {
    try {
      await skipMutation.mutateAsync(verification.id);
      toast({ title: "Skipped", description: `"${verification.originalLabel}" will use default mapping.` });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const pendingVerifications = data?.verifications ?? [];

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Department Verification</CardTitle>
          <CardDescription>Loading ambiguous line items...</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-20 w-full" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  if (pendingVerifications.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-500" />
            All Items Verified
          </CardTitle>
          <CardDescription>
            No ambiguous line items require verification. All P&L entries have been mapped to departments.
          </CardDescription>
        </CardHeader>
        {onComplete && (
          <CardContent>
            <Button onClick={onComplete}>Continue to Review</Button>
          </CardContent>
        )}
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-amber-500" />
          Department Verification Required
        </CardTitle>
        <CardDescription>
          {pendingVerifications.length} line item(s) need your input to determine the correct department.
          Your choices will be saved to the keyword bank for future imports.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {pendingVerifications.map((verification) => {
          const selection = selections[verification.id];
          const isProcessing = resolveMutation.isPending || skipMutation.isPending;

          return (
            <div
              key={verification.id}
              className={cn(
                "border rounded-lg p-4 space-y-4",
                selection?.departmentIndex !== undefined ? "border-green-200 bg-green-50/50 dark:border-green-800 dark:bg-green-950/20" : "border-amber-200 bg-amber-50/30 dark:border-amber-800 dark:bg-amber-950/20"
              )}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-lg">{verification.originalLabel}</span>
                    <Badge variant="secondary" className="text-xs">
                      Ambiguous
                    </Badge>
                  </div>
                  <div className="flex items-start gap-1 text-sm text-muted-foreground">
                    <HelpCircle className="h-4 w-4 mt-0.5 shrink-0" />
                    <span>{verification.ambiguityReason}</span>
                  </div>
                </div>
              </div>

              <RadioGroup
                value={selection?.departmentIndex?.toString()}
                onValueChange={(val) => handleSelectDepartment(verification.id, parseInt(val))}
                className="space-y-2"
              >
                {verification.suggestedDepartments.map((option, idx) => (
                  <div
                    key={idx}
                    className={cn(
                      "flex items-start space-x-3 p-3 rounded-md border cursor-pointer transition-colors",
                      selection?.departmentIndex === idx
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-muted-foreground/50"
                    )}
                    onClick={() => handleSelectDepartment(verification.id, idx)}
                  >
                    <RadioGroupItem value={idx.toString()} id={`${verification.id}-${idx}`} className="mt-0.5" />
                    <div className="flex-1">
                      <Label htmlFor={`${verification.id}-${idx}`} className="font-medium cursor-pointer">
                        {option.department}
                        <Badge variant="outline" className="ml-2 text-xs">
                          {option.bucket}
                        </Badge>
                      </Label>
                      <p className="text-sm text-muted-foreground mt-0.5">{option.description}</p>
                    </div>
                  </div>
                ))}
              </RadioGroup>

              <div className="flex items-center justify-between pt-2 border-t">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id={`save-${verification.id}`}
                    checked={selection?.saveToBank ?? true}
                    onCheckedChange={(checked) => handleToggleSaveToBank(verification.id, !!checked)}
                  />
                  <Label htmlFor={`save-${verification.id}`} className="text-sm cursor-pointer">
                    Remember this choice for future imports
                  </Label>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSkip(verification)}
                    disabled={isProcessing}
                  >
                    <SkipForward className="h-4 w-4 mr-1" />
                    Skip
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => handleResolve(verification)}
                    disabled={selection?.departmentIndex === undefined || isProcessing}
                  >
                    {isProcessing ? (
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4 mr-1" />
                    )}
                    Confirm
                  </Button>
                </div>
              </div>
            </div>
          );
        })}

        {pendingVerifications.length > 1 && (
          <div className="flex justify-end pt-4 border-t">
            <Button variant="outline" onClick={onComplete} disabled={pendingVerifications.length > 0}>
              Complete All ({pendingVerifications.length} remaining)
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
