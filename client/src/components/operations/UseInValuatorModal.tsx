import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { DatePickerWithRange } from "@/components/ui/date-range-picker";
import { DateRange } from "react-day-picker";
import { subMonths, format } from "date-fns";
import { Loader2, ArrowRight, Check, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface UseInValuatorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  marinaId: string;
  module?: string;
}

interface ValuatorProject {
  id: string;
  name: string;
  projectType?: string;
}

interface ProjectContext {
  projectId: string;
  marinaId: string | null;
  projectType: string;
}

interface ProjectWithContext extends ValuatorProject {
  context?: ProjectContext;
}

export function UseInValuatorModal({
  open,
  onOpenChange,
  marinaId,
  module,
}: UseInValuatorModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [step, setStep] = useState(1);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [scope, setScope] = useState<string>(module || "ALL");
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subMonths(new Date(), 12),
    to: new Date(),
  });
  const [overwrite, setOverwrite] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);

  const { data: projects = [] } = useQuery<ValuatorProject[]>({
    queryKey: ["/api/modeling/projects"],
    enabled: open,
  });

  const { data: projectContexts = [] } = useQuery<ProjectContext[]>({
    queryKey: ["/api/operations-context/projects/contexts-by-marina", marinaId],
    queryFn: async () => {
      const response = await fetch(`/api/operations-context/projects/contexts-by-marina/${marinaId}`);
      if (!response.ok) return [];
      return response.json();
    },
    enabled: open && !!marinaId,
  });

  const { data: projectContext } = useQuery<ProjectContext>({
    queryKey: ["/api/operations-context/projects", selectedProjectId, "context"],
    enabled: !!selectedProjectId,
  });

  const linkedProjectIds = new Set(projectContexts.map(ctx => ctx.projectId));
  
  const eligibleProjects = projects.filter((p) => {
    return linkedProjectIds.has(p.id);
  });

  const importMutation = useMutation({
    mutationFn: async (data: {
      projectId: string;
      scope: string;
      rangeStart: string;
      rangeEnd: string;
      overwrite: boolean;
    }) => {
      return apiRequest("POST", `/api/operations-context/projects/${data.projectId}/import-actuals`, {
        scope: data.scope,
        rangeStart: data.rangeStart,
        rangeEnd: data.rangeEnd,
        overwrite: data.overwrite,
      });
    },
    onSuccess: async (response) => {
      const result = await response.json();
      setImportResult(result);
      setStep(5);
      queryClient.invalidateQueries({ queryKey: ["/api/operations-context/projects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/modeling/projects"] });
      toast({
        title: "Import Complete",
        description: `Imported ${result.rowsWritten} rows across ${result.monthsAffected} months.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Import Failed",
        description: error.message || "Failed to import actuals to assumptions",
        variant: "destructive",
      });
    },
  });

  const handleNext = () => {
    if (step === 4) {
      if (!dateRange?.from || !dateRange?.to) {
        toast({
          title: "Date Range Required",
          description: "Please select a date range for import",
          variant: "destructive",
        });
        return;
      }
      
      importMutation.mutate({
        projectId: selectedProjectId,
        scope,
        rangeStart: format(dateRange.from, "yyyy-MM-dd"),
        rangeEnd: format(dateRange.to, "yyyy-MM-dd"),
        overwrite,
      });
    } else {
      setStep(step + 1);
    }
  };

  const handleBack = () => {
    setStep(step - 1);
  };

  const handleClose = () => {
    setStep(1);
    setSelectedProjectId("");
    setScope(module || "ALL");
    setDateRange({
      from: subMonths(new Date(), 12),
      to: new Date(),
    });
    setOverwrite(false);
    setImportResult(null);
    onOpenChange(false);
  };

  const canProceed = () => {
    switch (step) {
      case 1:
        return !!selectedProjectId;
      case 2:
        return !!scope;
      case 3:
        return dateRange?.from && dateRange?.to;
      case 4:
        return true;
      default:
        return false;
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Import Actuals to Financial Model</DialogTitle>
          <DialogDescription>
            Step {step} of 5: {
              step === 1 ? "Select Project" :
              step === 2 ? "Choose Scope" :
              step === 3 ? "Select Timeframe" :
              step === 4 ? "Confirm Import" :
              "Complete"
            }
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {step === 1 && (
            <div className="space-y-4">
              <Label>Select a Financial Model Project</Label>
              <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a project..." />
                </SelectTrigger>
                <SelectContent>
                  {eligibleProjects.length === 0 ? (
                    <SelectItem value="none" disabled>
                      No eligible projects found
                    </SelectItem>
                  ) : (
                    eligibleProjects.map((project) => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">
                Only projects linked to this marina can receive actuals data.
              </p>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <Label>Import Scope</Label>
              <RadioGroup value={scope} onValueChange={setScope}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="ALL" id="all" />
                  <Label htmlFor="all">All Modules</Label>
                </div>
                {module && (
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value={module} id="current" />
                    <Label htmlFor="current">Only {module}</Label>
                  </div>
                )}
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="FUEL" id="fuel" />
                  <Label htmlFor="fuel">Fuel Sales Only</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="SHIP_STORE" id="ship-store" />
                  <Label htmlFor="ship-store">Ship Store Only</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="SERVICE" id="service" />
                  <Label htmlFor="service">Service Dept Only</Label>
                </div>
              </RadioGroup>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <Label>Timeframe for Import</Label>
              <DatePickerWithRange
                date={dateRange}
                onDateChange={setDateRange}
              />
              <p className="text-sm text-muted-foreground">
                Default: Trailing 12 months. Actuals will be aggregated monthly.
              </p>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <Label>Import Options</Label>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="overwrite"
                  checked={overwrite}
                  onCheckedChange={(checked) => setOverwrite(checked as boolean)}
                />
                <Label htmlFor="overwrite" className="text-sm">
                  Overwrite existing assumptions (otherwise fill blanks only)
                </Label>
              </div>
              
              <div className="bg-muted p-4 rounded-lg mt-4">
                <h4 className="font-medium mb-2">Import Summary</h4>
                <ul className="text-sm space-y-1">
                  <li>
                    <span className="text-muted-foreground">Project:</span>{" "}
                    {projects.find(p => p.id === selectedProjectId)?.name}
                  </li>
                  <li>
                    <span className="text-muted-foreground">Scope:</span> {scope}
                  </li>
                  <li>
                    <span className="text-muted-foreground">Date Range:</span>{" "}
                    {dateRange?.from && format(dateRange.from, "MMM d, yyyy")} -{" "}
                    {dateRange?.to && format(dateRange.to, "MMM d, yyyy")}
                  </li>
                  <li>
                    <span className="text-muted-foreground">Mode:</span>{" "}
                    {overwrite ? "Overwrite existing" : "Fill blanks only"}
                  </li>
                </ul>
              </div>
            </div>
          )}

          {step === 5 && importResult && (
            <div className="space-y-4 text-center">
              <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center mx-auto">
                <Check className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
              <h3 className="text-lg font-medium">Import Complete!</h3>
              <div className="bg-muted p-4 rounded-lg">
                <ul className="text-sm space-y-1">
                  <li>
                    <span className="font-medium">{importResult.rowsWritten}</span> assumption rows created
                  </li>
                  <li>
                    <span className="font-medium">{importResult.monthsAffected}</span> months affected
                  </li>
                  <li>
                    Completed in <span className="font-medium">{importResult.durationMs}ms</span>
                  </li>
                </ul>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          {step > 1 && step < 5 && (
            <Button variant="outline" onClick={handleBack}>
              Back
            </Button>
          )}
          
          {step < 5 ? (
            <Button
              onClick={handleNext}
              disabled={!canProceed() || importMutation.isPending}
            >
              {importMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Importing...
                </>
              ) : step === 4 ? (
                <>
                  Import Now
                  <ArrowRight className="h-4 w-4 ml-2" />
                </>
              ) : (
                <>
                  Next
                  <ArrowRight className="h-4 w-4 ml-2" />
                </>
              )}
            </Button>
          ) : (
            <Button onClick={handleClose}>
              Done
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default UseInValuatorModal;
