import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChevronDown, ChevronRight, Plus, Pencil, Trash2, TrendingUp, Calendar, DollarSign, Percent, AlertCircle } from "lucide-react";
import { format } from "date-fns";

interface LeaseEconomicsSectionProps {
  leaseId: string;
  isOpen?: boolean;
  onToggle?: () => void;
}

type LeaseRentStep = {
  id: string;
  leaseId: string;
  effectiveDate: string;
  baseRentAmount: string;
  baseRentPeriod: string;
  description: string | null;
};

type LeaseEscalation = {
  id: string;
  leaseId: string;
  escalationType: string;
  value: string;
  cap: string | null;
  floor: string | null;
  frequency: string;
  effectiveDate: string | null;
  description: string | null;
};

type LeaseConcession = {
  id: string;
  leaseId: string;
  concessionType: string;
  amount: string;
  startDate: string | null;
  endDate: string | null;
  amortizeOverMonths: number | null;
  description: string | null;
};

export default function LeaseEconomicsSection({ leaseId, isOpen = false, onToggle }: LeaseEconomicsSectionProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(isOpen);
  const [activeTab, setActiveTab] = useState("rent-steps");
  const [showRentStepDialog, setShowRentStepDialog] = useState(false);
  const [showEscalationDialog, setShowEscalationDialog] = useState(false);
  const [showConcessionDialog, setShowConcessionDialog] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);

  const { data: hasV2 } = useQuery<{ hasV2: boolean }>({
    queryKey: ["/api/leases", leaseId, "has-economics-v2"],
    enabled: !!leaseId,
  });

  const { data: rentSteps = [], isLoading: loadingSteps } = useQuery<LeaseRentStep[]>({
    queryKey: ["/api/leases", leaseId, "rent-steps"],
    enabled: !!leaseId && open,
  });

  const { data: escalations = [], isLoading: loadingEscalations } = useQuery<LeaseEscalation[]>({
    queryKey: ["/api/leases", leaseId, "escalations"],
    enabled: !!leaseId && open,
  });

  const { data: concessions = [], isLoading: loadingConcessions } = useQuery<LeaseConcession[]>({
    queryKey: ["/api/leases", leaseId, "concessions"],
    enabled: !!leaseId && open,
  });

  const handleToggle = () => {
    setOpen(!open);
    onToggle?.();
  };

  const createRentStepMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("POST", `/api/leases/${leaseId}/rent-steps`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leases", leaseId, "rent-steps"] });
      queryClient.invalidateQueries({ queryKey: ["/api/leases", leaseId, "has-economics-v2"] });
      setShowRentStepDialog(false);
      setEditingItem(null);
      toast({ title: "Rent step added" });
    },
    onError: () => {
      toast({ title: "Failed to add rent step", variant: "destructive" });
    },
  });

  const updateRentStepMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      return apiRequest("PUT", `/api/rent-steps/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leases", leaseId, "rent-steps"] });
      setShowRentStepDialog(false);
      setEditingItem(null);
      toast({ title: "Rent step updated" });
    },
    onError: () => {
      toast({ title: "Failed to update rent step", variant: "destructive" });
    },
  });

  const deleteRentStepMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/rent-steps/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leases", leaseId, "rent-steps"] });
      queryClient.invalidateQueries({ queryKey: ["/api/leases", leaseId, "has-economics-v2"] });
      toast({ title: "Rent step deleted" });
    },
    onError: () => {
      toast({ title: "Failed to delete rent step", variant: "destructive" });
    },
  });

  const createEscalationMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("POST", `/api/leases/${leaseId}/escalations`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leases", leaseId, "escalations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/leases", leaseId, "has-economics-v2"] });
      setShowEscalationDialog(false);
      setEditingItem(null);
      toast({ title: "Escalation added" });
    },
    onError: () => {
      toast({ title: "Failed to add escalation", variant: "destructive" });
    },
  });

  const deleteEscalationMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/escalations/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leases", leaseId, "escalations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/leases", leaseId, "has-economics-v2"] });
      toast({ title: "Escalation deleted" });
    },
    onError: () => {
      toast({ title: "Failed to delete escalation", variant: "destructive" });
    },
  });

  const createConcessionMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("POST", `/api/leases/${leaseId}/concessions`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leases", leaseId, "concessions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/leases", leaseId, "has-economics-v2"] });
      setShowConcessionDialog(false);
      setEditingItem(null);
      toast({ title: "Concession added" });
    },
    onError: () => {
      toast({ title: "Failed to add concession", variant: "destructive" });
    },
  });

  const deleteConcessionMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/concessions/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leases", leaseId, "concessions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/leases", leaseId, "has-economics-v2"] });
      toast({ title: "Concession deleted" });
    },
    onError: () => {
      toast({ title: "Failed to delete concession", variant: "destructive" });
    },
  });

  const formatCurrency = (amount: string | number) => {
    const num = typeof amount === "string" ? parseFloat(amount) : amount;
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(num);
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-";
    try {
      return format(new Date(dateStr), "MMM d, yyyy");
    } catch {
      return dateStr;
    }
  };

  return (
    <Collapsible open={open} onOpenChange={handleToggle} className="border rounded-lg">
      <CollapsibleTrigger asChild>
        <div className="flex items-center justify-between p-4 cursor-pointer hover-elevate" data-testid="lease-economics-trigger">
          <div className="flex items-center gap-3">
            <TrendingUp className="h-5 w-5 text-muted-foreground" />
            <div>
              <h3 className="font-medium">Advanced Economics</h3>
              <p className="text-sm text-muted-foreground">
                Rent steps, escalations, and concessions
              </p>
            </div>
            {hasV2?.hasV2 && (
              <Badge variant="secondary" className="ml-2">V2 Active</Badge>
            )}
          </div>
          {open ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
        </div>
      </CollapsibleTrigger>

      <CollapsibleContent className="border-t">
        <div className="p-4">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="rent-steps" data-testid="tab-rent-steps">
                <Calendar className="h-4 w-4 mr-2" />
                Rent Steps ({rentSteps.length})
              </TabsTrigger>
              <TabsTrigger value="escalations" data-testid="tab-escalations">
                <Percent className="h-4 w-4 mr-2" />
                Escalations ({escalations.length})
              </TabsTrigger>
              <TabsTrigger value="concessions" data-testid="tab-concessions">
                <DollarSign className="h-4 w-4 mr-2" />
                Concessions ({concessions.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="rent-steps" className="mt-4">
              <div className="flex justify-between items-center mb-4">
                <p className="text-sm text-muted-foreground">
                  Define rent changes over the lease term
                </p>
                <RentStepDialog
                  open={showRentStepDialog}
                  onOpenChange={setShowRentStepDialog}
                  onSubmit={(data) => {
                    if (editingItem) {
                      updateRentStepMutation.mutate({ id: editingItem.id, data });
                    } else {
                      createRentStepMutation.mutate(data);
                    }
                  }}
                  isLoading={createRentStepMutation.isPending || updateRentStepMutation.isPending}
                  editingItem={editingItem}
                  onClose={() => {
                    setShowRentStepDialog(false);
                    setEditingItem(null);
                  }}
                />
              </div>

              {rentSteps.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Calendar className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No rent steps defined</p>
                  <p className="text-xs">Base rent from the lease will be used</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Effective Date</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Period</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="w-[80px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rentSteps.map((step) => (
                      <TableRow key={step.id} data-testid={`rent-step-row-${step.id}`}>
                        <TableCell>{formatDate(step.effectiveDate)}</TableCell>
                        <TableCell>{formatCurrency(step.baseRentAmount)}</TableCell>
                        <TableCell className="capitalize">{step.baseRentPeriod}</TableCell>
                        <TableCell className="text-muted-foreground">{step.description || "-"}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => {
                                setEditingItem(step);
                                setShowRentStepDialog(true);
                              }}
                              data-testid={`edit-rent-step-${step.id}`}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => deleteRentStepMutation.mutate(step.id)}
                              data-testid={`delete-rent-step-${step.id}`}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </TabsContent>

            <TabsContent value="escalations" className="mt-4">
              <div className="flex justify-between items-center mb-4">
                <p className="text-sm text-muted-foreground">
                  Automatic rent increases over time
                </p>
                <EscalationDialog
                  open={showEscalationDialog}
                  onOpenChange={setShowEscalationDialog}
                  onSubmit={(data) => createEscalationMutation.mutate(data)}
                  isLoading={createEscalationMutation.isPending}
                  onClose={() => {
                    setShowEscalationDialog(false);
                    setEditingItem(null);
                  }}
                />
              </div>

              {escalations.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Percent className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No escalations defined</p>
                  <p className="text-xs">Rent will remain flat</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Value</TableHead>
                      <TableHead>Frequency</TableHead>
                      <TableHead>Cap/Floor</TableHead>
                      <TableHead className="w-[60px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {escalations.map((esc) => (
                      <TableRow key={esc.id} data-testid={`escalation-row-${esc.id}`}>
                        <TableCell className="capitalize">{esc.escalationType.replace("_", " ")}</TableCell>
                        <TableCell>
                          {esc.escalationType === "fixed_percent" ? `${parseFloat(esc.value) * 100}%` : formatCurrency(esc.value)}
                        </TableCell>
                        <TableCell className="capitalize">{esc.frequency}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {esc.cap || esc.floor ? `${esc.floor || "-"} / ${esc.cap || "-"}` : "-"}
                        </TableCell>
                        <TableCell>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => deleteEscalationMutation.mutate(esc.id)}
                            data-testid={`delete-escalation-${esc.id}`}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </TabsContent>

            <TabsContent value="concessions" className="mt-4">
              <div className="flex justify-between items-center mb-4">
                <p className="text-sm text-muted-foreground">
                  Free rent, credits, and other concessions
                </p>
                <ConcessionDialog
                  open={showConcessionDialog}
                  onOpenChange={setShowConcessionDialog}
                  onSubmit={(data) => createConcessionMutation.mutate(data)}
                  isLoading={createConcessionMutation.isPending}
                  onClose={() => {
                    setShowConcessionDialog(false);
                    setEditingItem(null);
                  }}
                />
              </div>

              {concessions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <DollarSign className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No concessions defined</p>
                  <p className="text-xs">Full rent will be charged</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Dates</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="w-[60px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {concessions.map((conc) => (
                      <TableRow key={conc.id} data-testid={`concession-row-${conc.id}`}>
                        <TableCell className="capitalize">{conc.concessionType.replace("_", " ")}</TableCell>
                        <TableCell>{formatCurrency(conc.amount)}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {conc.startDate ? `${formatDate(conc.startDate)} - ${formatDate(conc.endDate)}` : "-"}
                        </TableCell>
                        <TableCell className="text-muted-foreground">{conc.description || "-"}</TableCell>
                        <TableCell>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => deleteConcessionMutation.mutate(conc.id)}
                            data-testid={`delete-concession-${conc.id}`}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function RentStepDialog({
  open,
  onOpenChange,
  onSubmit,
  isLoading,
  editingItem,
  onClose,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: any) => void;
  isLoading: boolean;
  editingItem?: any;
  onClose: () => void;
}) {
  const [effectiveDate, setEffectiveDate] = useState(editingItem?.effectiveDate?.split("T")[0] || "");
  const [baseRentAmount, setBaseRentAmount] = useState(editingItem?.baseRentAmount || "");
  const [baseRentPeriod, setBaseRentPeriod] = useState(editingItem?.baseRentPeriod || "month");
  const [description, setDescription] = useState(editingItem?.description || "");

  const handleSubmit = () => {
    if (!effectiveDate || !baseRentAmount) return;
    onSubmit({
      effectiveDate,
      baseRentAmount: parseFloat(baseRentAmount),
      baseRentPeriod,
      description: description || null,
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) onClose(); }}>
      <DialogTrigger asChild>
        <Button size="sm" data-testid="add-rent-step-button">
          <Plus className="h-4 w-4 mr-2" />
          Add Rent Step
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editingItem ? "Edit" : "Add"} Rent Step</DialogTitle>
          <DialogDescription>
            Define a rent amount change on a specific date
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="effective-date">Effective Date</Label>
            <Input
              id="effective-date"
              type="date"
              value={effectiveDate}
              onChange={(e) => setEffectiveDate(e.target.value)}
              data-testid="rent-step-effective-date"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="amount">Rent Amount</Label>
            <Input
              id="amount"
              type="number"
              placeholder="0.00"
              value={baseRentAmount}
              onChange={(e) => setBaseRentAmount(e.target.value)}
              data-testid="rent-step-amount"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="period">Period</Label>
            <Select value={baseRentPeriod} onValueChange={setBaseRentPeriod}>
              <SelectTrigger data-testid="rent-step-period">
                <SelectValue placeholder="Select period" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="month">Monthly</SelectItem>
                <SelectItem value="year">Annual</SelectItem>
                <SelectItem value="season">Seasonal</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="description">Description (optional)</Label>
            <Input
              id="description"
              placeholder="e.g., Year 2 rent"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              data-testid="rent-step-description"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={isLoading || !effectiveDate || !baseRentAmount} data-testid="save-rent-step">
            {isLoading ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EscalationDialog({
  open,
  onOpenChange,
  onSubmit,
  isLoading,
  onClose,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: any) => void;
  isLoading: boolean;
  onClose: () => void;
}) {
  const [escalationType, setEscalationType] = useState("fixed_percent");
  const [value, setValue] = useState("");
  const [frequency, setFrequency] = useState("annual");
  const [cap, setCap] = useState("");
  const [floor, setFloor] = useState("");
  const [description, setDescription] = useState("");

  const handleSubmit = () => {
    if (!value) return;
    const numValue = escalationType === "fixed_percent" ? parseFloat(value) / 100 : parseFloat(value);
    onSubmit({
      escalationType,
      value: numValue,
      frequency,
      cap: cap ? parseFloat(cap) / 100 : null,
      floor: floor ? parseFloat(floor) / 100 : null,
      description: description || null,
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) onClose(); }}>
      <DialogTrigger asChild>
        <Button size="sm" data-testid="add-escalation-button">
          <Plus className="h-4 w-4 mr-2" />
          Add Escalation
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Escalation</DialogTitle>
          <DialogDescription>
            Define automatic rent increases
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label>Escalation Type</Label>
            <Select value={escalationType} onValueChange={setEscalationType}>
              <SelectTrigger data-testid="escalation-type">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="fixed_percent">Fixed Percent</SelectItem>
                <SelectItem value="fixed_amount">Fixed Amount</SelectItem>
                <SelectItem value="cpi_linked">CPI Linked</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>Value ({escalationType === "fixed_percent" ? "%" : "$"})</Label>
            <Input
              type="number"
              placeholder={escalationType === "fixed_percent" ? "3.0" : "100.00"}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              data-testid="escalation-value"
            />
          </div>
          <div className="grid gap-2">
            <Label>Frequency</Label>
            <Select value={frequency} onValueChange={setFrequency}>
              <SelectTrigger data-testid="escalation-frequency">
                <SelectValue placeholder="Select frequency" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="annual">Annual</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="on_date">On Specific Date</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Cap (%)</Label>
              <Input
                type="number"
                placeholder="5.0"
                value={cap}
                onChange={(e) => setCap(e.target.value)}
                data-testid="escalation-cap"
              />
            </div>
            <div className="grid gap-2">
              <Label>Floor (%)</Label>
              <Input
                type="number"
                placeholder="2.0"
                value={floor}
                onChange={(e) => setFloor(e.target.value)}
                data-testid="escalation-floor"
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={isLoading || !value} data-testid="save-escalation">
            {isLoading ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ConcessionDialog({
  open,
  onOpenChange,
  onSubmit,
  isLoading,
  onClose,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: any) => void;
  isLoading: boolean;
  onClose: () => void;
}) {
  const [concessionType, setConcessionType] = useState("free_rent");
  const [amount, setAmount] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [amortizeMonths, setAmortizeMonths] = useState("");
  const [description, setDescription] = useState("");

  const handleSubmit = () => {
    if (!amount) return;
    onSubmit({
      concessionType,
      amount: parseFloat(amount),
      startDate: startDate || null,
      endDate: endDate || null,
      amortizeOverMonths: amortizeMonths ? parseInt(amortizeMonths) : null,
      description: description || null,
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) onClose(); }}>
      <DialogTrigger asChild>
        <Button size="sm" data-testid="add-concession-button">
          <Plus className="h-4 w-4 mr-2" />
          Add Concession
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Concession</DialogTitle>
          <DialogDescription>
            Define rent reductions or credits
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label>Concession Type</Label>
            <Select value={concessionType} onValueChange={setConcessionType}>
              <SelectTrigger data-testid="concession-type">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="free_rent">Free Rent</SelectItem>
                <SelectItem value="one_time_credit">One-Time Credit</SelectItem>
                <SelectItem value="amortized_concession">Amortized Concession</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>Amount ($)</Label>
            <Input
              type="number"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              data-testid="concession-amount"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Start Date</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                data-testid="concession-start-date"
              />
            </div>
            <div className="grid gap-2">
              <Label>End Date</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                data-testid="concession-end-date"
              />
            </div>
          </div>
          {concessionType === "amortized_concession" && (
            <div className="grid gap-2">
              <Label>Amortize Over (months)</Label>
              <Input
                type="number"
                placeholder="12"
                value={amortizeMonths}
                onChange={(e) => setAmortizeMonths(e.target.value)}
                data-testid="concession-amortize-months"
              />
            </div>
          )}
          <div className="grid gap-2">
            <Label>Description (optional)</Label>
            <Input
              placeholder="e.g., Move-in special"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              data-testid="concession-description"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={isLoading || !amount} data-testid="save-concession">
            {isLoading ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
