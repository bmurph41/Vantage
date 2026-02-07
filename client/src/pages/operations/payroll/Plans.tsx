import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  usePayrollPlans,
  useCreatePlan,
  useDeletePlan,
  useDepartments,
  useCreateLine,
  useDeleteLine,
  usePositions,
  usePayrollCalc,
} from "@/hooks/use-payroll";
import {
  Plus,
  Trash2,
  Calculator,
  ChevronDown,
  ChevronRight,
  FileText,
  DollarSign,
} from "lucide-react";

const PLAN_TYPES = [
  { value: "OPERATIONS_ACTUAL", label: "Operations Actual" },
  { value: "OPERATIONS_BUDGET", label: "Operations Budget" },
  { value: "SELLER_TRAILING", label: "Seller Trailing" },
  { value: "UNDERWRITING_PROFORMA", label: "Underwriting Pro Forma" },
  { value: "VALUATOR_ACTUALS_SNAPSHOT", label: "Valuator Snapshot" },
];

const PAY_TYPES = [
  { value: "SALARY", label: "Salary" },
  { value: "HOURLY", label: "Hourly" },
];

export default function Plans() {
  const { user } = useAuth();
  const { data: plans, isLoading } = usePayrollPlans({});
  const { data: departments } = useDepartments(user?.orgId);
  const { data: positions } = usePositions(user?.orgId);
  const createPlan = useCreatePlan();
  const deletePlan = useDeletePlan();
  const createLine = useCreateLine();
  const deleteLine = useDeleteLine();

  const [newPlanOpen, setNewPlanOpen] = useState(false);
  const [newLineOpen, setNewLineOpen] = useState(false);
  const [expandedPlan, setExpandedPlan] = useState<string | null>(null);
  const [activePlanForLine, setActivePlanForLine] = useState<string | null>(null);

  // New plan form state
  const [planForm, setPlanForm] = useState({
    planName: "",
    planType: "OPERATIONS_ACTUAL",
    assetId: "",
  });

  // New line form state
  const [lineForm, setLineForm] = useState({
    lineLabel: "",
    departmentId: "",
    positionId: "",
    payType: "SALARY",
    annualSalary: "",
    hourlyRate: "",
    defaultWeeklyHours: "40",
    headcount: "1",
    workerType: "W2",
  });

  const handleCreatePlan = async () => {
    if (!planForm.planName || !planForm.planType) return;
    await createPlan.mutateAsync({
      planName: planForm.planName,
      planType: planForm.planType,
      assetId: planForm.assetId || undefined,
    });
    setPlanForm({ planName: "", planType: "OPERATIONS_ACTUAL", assetId: "" });
    setNewPlanOpen(false);
  };

  const handleCreateLine = async () => {
    if (!activePlanForLine || !lineForm.departmentId || !lineForm.lineLabel) return;
    await createLine.mutateAsync({
      planId: activePlanForLine,
      lineLabel: lineForm.lineLabel,
      departmentId: lineForm.departmentId,
      positionId: lineForm.positionId || undefined,
      payType: lineForm.payType,
      annualSalary: lineForm.payType === "SALARY" ? Number(lineForm.annualSalary) : undefined,
      hourlyRate: lineForm.payType === "HOURLY" ? Number(lineForm.hourlyRate) : undefined,
      defaultWeeklyHours: Number(lineForm.defaultWeeklyHours),
      headcount: Number(lineForm.headcount),
      workerType: lineForm.workerType,
    });
    setLineForm({
      lineLabel: "",
      departmentId: "",
      positionId: "",
      payType: "SALARY",
      annualSalary: "",
      hourlyRate: "",
      defaultWeeklyHours: "40",
      headcount: "1",
      workerType: "W2",
    });
    setNewLineOpen(false);
  };

  const handleDeletePlan = async (planId: string) => {
    if (!confirm("Delete this payroll plan and all its lines?")) return;
    await deletePlan.mutateAsync(planId);
    if (expandedPlan === planId) setExpandedPlan(null);
  };

  if (isLoading) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Payroll Plans</h2>
          <p className="text-sm text-muted-foreground">
            Create plans for operations, budgets, or underwriting pro formas
          </p>
        </div>
        <Dialog open={newPlanOpen} onOpenChange={setNewPlanOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Plan
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Payroll Plan</DialogTitle>
              <DialogDescription>
                Set up a new payroll plan for an asset or portfolio
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Plan Name</Label>
                <Input
                  placeholder="e.g., Marina Bay - 2025 Actual"
                  value={planForm.planName}
                  onChange={(e) =>
                    setPlanForm((prev) => ({ ...prev, planName: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Plan Type</Label>
                <Select
                  value={planForm.planType}
                  onValueChange={(v) =>
                    setPlanForm((prev) => ({ ...prev, planType: v }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PLAN_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setNewPlanOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleCreatePlan}
                disabled={!planForm.planName || createPlan.isPending}
              >
                {createPlan.isPending ? "Creating..." : "Create Plan"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Plans List */}
      {!plans || plans.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 space-y-4">
            <div className="p-4 rounded-full bg-primary/10">
              <FileText className="h-8 w-8 text-primary" />
            </div>
            <div className="text-center space-y-2">
              <h3 className="text-lg font-semibold">No Plans Yet</h3>
              <p className="text-sm text-muted-foreground">
                Create a payroll plan to start adding staff positions and tracking labor costs.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {plans.map((plan: any) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              departments={departments || []}
              isExpanded={expandedPlan === plan.id}
              onToggle={() =>
                setExpandedPlan(expandedPlan === plan.id ? null : plan.id)
              }
              onDelete={() => handleDeletePlan(plan.id)}
              onAddLine={() => {
                setActivePlanForLine(plan.id);
                setNewLineOpen(true);
              }}
              onDeleteLine={(lineId: string) => deleteLine.mutate({ planId: plan.id, lineId })}
            />
          ))}
        </div>
      )}

      {/* Add Line Dialog */}
      <Dialog open={newLineOpen} onOpenChange={setNewLineOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Payroll Line</DialogTitle>
            <DialogDescription>
              Add a position or employee to this plan
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Label / Title</Label>
              <Input
                placeholder="e.g., Dockhand - Full Time"
                value={lineForm.lineLabel}
                onChange={(e) =>
                  setLineForm((prev) => ({ ...prev, lineLabel: e.target.value }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label>
                Department <span className="text-destructive">*</span>
              </Label>
              <Select
                value={lineForm.departmentId}
                onValueChange={(v) =>
                  setLineForm((prev) => ({ ...prev, departmentId: v }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  {(departments || []).map((dept: any) => (
                    <SelectItem key={dept.id} value={dept.id}>
                      {dept.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>From Position Template (optional)</Label>
              <Select
                value={lineForm.positionId}
                onValueChange={(v) => {
                  const pos = positions?.find((p: any) => p.id === v);
                  setLineForm((prev) => ({
                    ...prev,
                    positionId: v,
                    lineLabel: pos?.title || prev.lineLabel,
                    departmentId: pos?.defaultDepartmentId || prev.departmentId,
                  }));
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose a template..." />
                </SelectTrigger>
                <SelectContent>
                  {(positions || []).map((pos: any) => (
                    <SelectItem key={pos.id} value={pos.id}>
                      {pos.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Pay Type</Label>
                <Select
                  value={lineForm.payType}
                  onValueChange={(v) =>
                    setLineForm((prev) => ({ ...prev, payType: v }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAY_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Worker Type</Label>
                <Select
                  value={lineForm.workerType}
                  onValueChange={(v) =>
                    setLineForm((prev) => ({ ...prev, workerType: v }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="W2">W-2 Employee</SelectItem>
                    <SelectItem value="CONTRACTOR_1099">1099 Contractor</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {lineForm.payType === "SALARY" ? (
              <div className="space-y-2">
                <Label>Annual Salary ($)</Label>
                <Input
                  type="number"
                  placeholder="55000"
                  value={lineForm.annualSalary}
                  onChange={(e) =>
                    setLineForm((prev) => ({ ...prev, annualSalary: e.target.value }))
                  }
                />
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Hourly Rate ($)</Label>
                  <Input
                    type="number"
                    placeholder="18.00"
                    value={lineForm.hourlyRate}
                    onChange={(e) =>
                      setLineForm((prev) => ({ ...prev, hourlyRate: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Weekly Hours</Label>
                  <Input
                    type="number"
                    placeholder="40"
                    value={lineForm.defaultWeeklyHours}
                    onChange={(e) =>
                      setLineForm((prev) => ({
                        ...prev,
                        defaultWeeklyHours: e.target.value,
                      }))
                    }
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label>Headcount</Label>
              <Input
                type="number"
                min="1"
                value={lineForm.headcount}
                onChange={(e) =>
                  setLineForm((prev) => ({ ...prev, headcount: e.target.value }))
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewLineOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateLine}
              disabled={
                !lineForm.departmentId || !lineForm.lineLabel || createLine.isPending
              }
            >
              {createLine.isPending ? "Adding..." : "Add Line"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Plan Card with expandable lines ────────────────────────────

function PlanCard({
  plan,
  departments,
  isExpanded,
  onToggle,
  onDelete,
  onAddLine,
  onDeleteLine,
}: {
  plan: any;
  departments: any[];
  isExpanded: boolean;
  onToggle: () => void;
  onDelete: () => void;
  onAddLine: () => void;
  onDeleteLine: (lineId: string) => void;
}) {
  const { data: calcData } = usePayrollCalc(
    isExpanded ? plan.id : "",
    { granularity: "monthly" },
  );

  const getDeptName = (deptId: string) =>
    departments.find((d) => d.id === deptId)?.name || "—";

  return (
    <Card>
      <CardHeader
        className="cursor-pointer hover:bg-muted/30 transition-colors"
        onClick={onToggle}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {isExpanded ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
            <div>
              <CardTitle className="text-base">{plan.planName}</CardTitle>
              <CardDescription className="capitalize">
                {plan.planType?.replace(/_/g, " ").toLowerCase()}
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
            {calcData?.grandTotals?.totalCost > 0 && (
              <Badge variant="outline" className="font-mono">
                <DollarSign className="h-3 w-3 mr-1" />
                {(calcData.grandTotals.totalCost / 1000).toFixed(1)}K
              </Badge>
            )}
            <Button size="sm" variant="outline" onClick={onAddLine}>
              <Plus className="h-3 w-3 mr-1" />
              Add Line
            </Button>
            <Button size="sm" variant="ghost" onClick={onDelete}>
              <Trash2 className="h-3 w-3 text-destructive" />
            </Button>
          </div>
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="pt-0">
          {plan.lines && plan.lines.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Position / Label</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Pay Type</TableHead>
                  <TableHead className="text-right">Rate</TableHead>
                  <TableHead className="text-right">Headcount</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {plan.lines.map((line: any) => (
                  <TableRow key={line.id}>
                    <TableCell className="font-medium">{line.lineLabel}</TableCell>
                    <TableCell>{getDeptName(line.departmentId)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {line.payType}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {line.payType === "SALARY"
                        ? `$${Number(line.annualSalary || 0).toLocaleString()}/yr`
                        : `$${Number(line.hourlyRate || 0).toFixed(2)}/hr`}
                    </TableCell>
                    <TableCell className="text-right">{line.headcount}</TableCell>
                    <TableCell>
                      <Badge variant={line.workerType === "W2" ? "default" : "secondary"} className="text-xs">
                        {line.workerType === "W2" ? "W-2" : "1099"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onDeleteLine(line.id)}
                      >
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No lines yet. Click "Add Line" to add positions to this plan.
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
