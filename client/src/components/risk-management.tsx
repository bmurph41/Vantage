import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, AlertTriangle, TrendingUp, Target, Calendar, DollarSign, Clock, BarChart3, Users, X, Edit, Trash2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/currency-input";
import { DateInput } from "@/components/ui/date-input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { formatCurrency } from "@/lib/utils";
import type { Risk } from "@shared/schema";

const riskFormSchema = z.object({
  name: z.string().min(1, "Risk name is required"),
  description: z.string().optional(),
  category: z.enum(["technical", "financial", "legal", "regulatory", "operational", "market", "strategic", "environmental", "reputational", "cybersecurity"]),
  owner: z.string().min(1, "Risk owner is required"),
  likelihood: z.enum(["1", "2", "3", "4", "5"]),
  impact: z.enum(["1", "2", "3", "4", "5"]),
  impactCostUSD: z.number().min(0).optional(),
  impactScheduleDays: z.number().min(0).optional(),
  mitigationPlan: z.string().optional(),
  mitigationOwner: z.string().optional(),
  targetDate: z.string().optional(),
  mitigationCostUSD: z.number().min(0).optional(),
  residualLikelihood: z.enum(["1", "2", "3", "4", "5"]).optional(),
  residualImpact: z.enum(["1", "2", "3", "4", "5"]).optional(),
  status: z.enum(["identified", "analyzing", "mitigating", "monitoring", "closed"]),
  probability: z.number().min(0).max(100).optional(),
  confidenceLevel: z.number().min(0).max(100).optional(),
  riskVelocity: z.enum(["increasing", "stable", "decreasing"]).optional(),
});

interface RiskManagementProps {
  projectId: string;
}

export function RiskManagement({ projectId }: RiskManagementProps) {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingRisk, setEditingRisk] = useState<Risk | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch risks
  const { data: risks = [], isLoading } = useQuery({
    queryKey: ['/api/dd/projects', projectId, 'risks'],
  });

  // Fetch risk analytics
  const { data: analytics } = useQuery({
    queryKey: ['/api/dd/projects', projectId, 'risks', 'analytics'],
  });

  // Fetch heatmap data
  const { data: heatmapData } = useQuery({
    queryKey: ['/api/dd/projects', projectId, 'risks', 'heatmap'],
  });

  // Create risk mutation
  const createRiskMutation = useMutation({
    mutationFn: (data: any) => apiRequest('POST', `/api/dd/projects/${projectId}/risks`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/dd/projects', projectId, 'risks'] });
      setIsAddDialogOpen(false);
      toast({ title: "Risk created successfully" });
    },
    onError: () => {
      toast({ title: "Failed to create risk", variant: "destructive" });
    },
  });

  // Update risk mutation
  const updateRiskMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => 
      apiRequest('PUT', `/api/dd/risks/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/dd/projects', projectId, 'risks'] });
      setEditingRisk(null);
      toast({ title: "Risk updated successfully" });
    },
    onError: () => {
      toast({ title: "Failed to update risk", variant: "destructive" });
    },
  });

  // Delete risk mutation
  const deleteRiskMutation = useMutation({
    mutationFn: (id: string) => apiRequest('DELETE', `/api/dd/risks/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/dd/projects', projectId, 'risks'] });
      toast({ title: "Risk deleted successfully" });
    },
    onError: () => {
      toast({ title: "Failed to delete risk", variant: "destructive" });
    },
  });

  const form = useForm({
    resolver: zodResolver(riskFormSchema),
    defaultValues: {
      name: "",
      description: "",
      category: "operational" as const,
      owner: "",
      likelihood: "3" as const,
      impact: "3" as const,
      impactCostUSD: 0,
      impactScheduleDays: 0,
      mitigationPlan: "",
      mitigationOwner: "",
      targetDate: "",
      mitigationCostUSD: 0,
      residualLikelihood: undefined,
      residualImpact: undefined,
      status: "identified" as const,
      probability: 50,
      confidenceLevel: 50,
      riskVelocity: "stable" as const,
    },
  });

  // Set form values when editing
  useEffect(() => {
    if (editingRisk) {
      form.reset({
        name: editingRisk.name,
        description: editingRisk.description || "",
        category: editingRisk.category,
        owner: editingRisk.owner,
        likelihood: editingRisk.likelihood,
        impact: editingRisk.impact,
        impactCostUSD: editingRisk.impactCostUSD || 0,
        impactScheduleDays: editingRisk.impactScheduleDays || 0,
        mitigationPlan: editingRisk.mitigationPlan || "",
        mitigationOwner: editingRisk.mitigationOwner || "",
        targetDate: editingRisk.targetDate || "",
        mitigationCostUSD: editingRisk.mitigationCostUSD || 0,
        residualLikelihood: editingRisk.residualLikelihood || undefined,
        residualImpact: editingRisk.residualImpact || undefined,
        status: editingRisk.status,
        probability: editingRisk.probability || 50,
        confidenceLevel: editingRisk.confidenceLevel || 50,
        riskVelocity: editingRisk.riskVelocity || "stable",
      });
    }
  }, [editingRisk]);

  const onSubmit = async (data: any) => {
    if (editingRisk) {
      updateRiskMutation.mutate({ id: editingRisk.id, data });
    } else {
      createRiskMutation.mutate(data);
    }
  };

  const getRiskSeverityColor = (score: number) => {
    if (score > 15) return "bg-red-100 text-red-800 border-red-200";
    if (score >= 8) return "bg-yellow-100 text-yellow-800 border-yellow-200";
    return "bg-green-100 text-green-800 border-green-200";
  };

  const getRiskSeverityLabel = (score: number) => {
    if (score > 15) return "High";
    if (score >= 8) return "Medium";
    return "Low";
  };

  const filteredRisks = risks.filter((risk: Risk) => {
    const categoryMatch = selectedCategory === "all" || risk.category === selectedCategory;
    const statusMatch = selectedStatus === "all" || risk.status === selectedStatus;
    return categoryMatch && statusMatch;
  });

  const categories = ["technical", "financial", "legal", "regulatory", "operational", "market", "strategic", "environmental", "reputational", "cybersecurity"];
  const statuses = ["identified", "analyzing", "mitigating", "monitoring", "closed"];

  if (isLoading) {
    return <div data-testid="loading-risks">Loading risk data...</div>;
  }

  return (
    <div className="space-y-6" data-testid="risk-management">
      {/* Risk Analytics Dashboard */}
      {analytics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total Risks</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="total-risks">{analytics.totalRisks}</div>
              <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                <AlertTriangle className="h-4 w-4" />
                <span>Active risks tracked</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Cost at Risk</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="cost-at-risk">
                {formatCurrency(analytics.totalCostAtRisk)}
              </div>
              <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                <DollarSign className="h-4 w-4" />
                <span>Potential financial impact</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Schedule at Risk</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="schedule-at-risk">
                {analytics.totalScheduleAtRisk} days
              </div>
              <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span>Potential delay impact</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Risk Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>High:</span>
                  <span className="font-medium text-red-600" data-testid="high-risks">
                    {analytics.risksBySeverity.high}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Medium:</span>
                  <span className="font-medium text-yellow-600" data-testid="medium-risks">
                    {analytics.risksBySeverity.medium}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Low:</span>
                  <span className="font-medium text-green-600" data-testid="low-risks">
                    {analytics.risksBySeverity.low}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Content Tabs */}
      <Tabs defaultValue="list" className="w-full">
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="list" data-testid="tab-risk-list">Risk List</TabsTrigger>
            <TabsTrigger value="heatmap" data-testid="tab-heatmap">Heatmap</TabsTrigger>
            <TabsTrigger value="analytics" data-testid="tab-analytics">Analytics</TabsTrigger>
          </TabsList>
          
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-risk">
                <Plus className="h-4 w-4 mr-2" />
                Add Risk
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Add New Risk</DialogTitle>
              </DialogHeader>
              <RiskForm 
                form={form} 
                onSubmit={onSubmit} 
                isSubmitting={createRiskMutation.isPending}
                onCancel={() => setIsAddDialogOpen(false)}
              />
            </DialogContent>
          </Dialog>
        </div>

        <TabsContent value="list" className="space-y-4">
          {/* Filters */}
          <div className="flex space-x-4">
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-48" data-testid="filter-category">
                <SelectValue placeholder="Filter by category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map((category) => (
                  <SelectItem key={category} value={category}>
                    {category.charAt(0).toUpperCase() + category.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
              <SelectTrigger className="w-48" data-testid="filter-status">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {statuses.map((status) => (
                  <SelectItem key={status} value={status}>
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Risk List */}
          <div className="grid gap-4">
            {filteredRisks.map((risk: Risk) => (
              <Card key={risk.id} className="border-l-4 border-l-blue-500">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <CardTitle className="text-lg" data-testid={`risk-title-${risk.id}`}>
                        {risk.name}
                      </CardTitle>
                      <div className="flex items-center space-x-2">
                        <Badge 
                          variant="outline" 
                          className={getRiskSeverityColor(risk.riskScore)}
                          data-testid={`risk-severity-${risk.id}`}
                        >
                          {getRiskSeverityLabel(risk.riskScore)} Risk (Score: {risk.riskScore})
                        </Badge>
                        <Badge variant="secondary" data-testid={`risk-category-${risk.id}`}>
                          {risk.category}
                        </Badge>
                        <Badge variant="outline" data-testid={`risk-status-${risk.id}`}>
                          {risk.status}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex space-x-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditingRisk(risk)}
                        data-testid={`button-edit-${risk.id}`}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteRiskMutation.mutate(risk.id)}
                        data-testid={`button-delete-${risk.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {risk.description && (
                    <p className="text-sm text-muted-foreground">{risk.description}</p>
                  )}
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="font-medium">Owner:</span>
                      <p data-testid={`risk-owner-${risk.id}`}>{risk.owner}</p>
                    </div>
                    <div>
                      <span className="font-medium">Likelihood:</span>
                      <p data-testid={`risk-likelihood-${risk.id}`}>{risk.likelihood}/5</p>
                    </div>
                    <div>
                      <span className="font-medium">Impact:</span>
                      <p data-testid={`risk-impact-${risk.id}`}>{risk.impact}/5</p>
                    </div>
                    <div>
                      <span className="font-medium">Cost Impact:</span>
                      <p data-testid={`risk-cost-${risk.id}`}>
                        {formatCurrency(risk.impactCostUSD || 0)}
                      </p>
                    </div>
                  </div>

                  {risk.mitigationPlan && (
                    <div>
                      <span className="font-medium text-sm">Mitigation Plan:</span>
                      <p className="text-sm text-muted-foreground mt-1">{risk.mitigationPlan}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="heatmap">
          <RiskHeatmap heatmapData={heatmapData} />
        </TabsContent>

        <TabsContent value="analytics">
          <RiskAnalytics analytics={analytics} risks={risks} />
        </TabsContent>
      </Tabs>

      {/* Edit Risk Dialog */}
      <Dialog open={!!editingRisk} onOpenChange={() => setEditingRisk(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Risk</DialogTitle>
          </DialogHeader>
          <RiskForm 
            form={form} 
            onSubmit={onSubmit} 
            isSubmitting={updateRiskMutation.isPending}
            onCancel={() => setEditingRisk(null)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Risk Form Component
function RiskForm({ form, onSubmit, isSubmitting, onCancel }: any) {
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Risk Name *</FormLabel>
                <FormControl>
                  <Input placeholder="Enter risk name" {...field} data-testid="input-risk-name" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="category"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Category *</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger data-testid="select-risk-category">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="technical">Technical</SelectItem>
                    <SelectItem value="financial">Financial</SelectItem>
                    <SelectItem value="legal">Legal</SelectItem>
                    <SelectItem value="regulatory">Regulatory</SelectItem>
                    <SelectItem value="operational">Operational</SelectItem>
                    <SelectItem value="market">Market</SelectItem>
                    <SelectItem value="strategic">Strategic</SelectItem>
                    <SelectItem value="environmental">Environmental</SelectItem>
                    <SelectItem value="reputational">Reputational</SelectItem>
                    <SelectItem value="cybersecurity">Cybersecurity</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Textarea placeholder="Describe the risk..." {...field} data-testid="input-risk-description" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="owner"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Risk Owner *</FormLabel>
                <FormControl>
                  <Input placeholder="Enter owner name" {...field} data-testid="input-risk-owner" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="status"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Status *</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger data-testid="select-risk-status">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="identified">Identified</SelectItem>
                    <SelectItem value="analyzing">Analyzing</SelectItem>
                    <SelectItem value="mitigating">Mitigating</SelectItem>
                    <SelectItem value="monitoring">Monitoring</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="likelihood"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Likelihood (1-5) *</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger data-testid="select-likelihood">
                      <SelectValue placeholder="Select likelihood" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="1">1 - Very Low</SelectItem>
                    <SelectItem value="2">2 - Low</SelectItem>
                    <SelectItem value="3">3 - Medium</SelectItem>
                    <SelectItem value="4">4 - High</SelectItem>
                    <SelectItem value="5">5 - Very High</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="impact"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Impact (1-5) *</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger data-testid="select-impact">
                      <SelectValue placeholder="Select impact" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="1">1 - Very Low</SelectItem>
                    <SelectItem value="2">2 - Low</SelectItem>
                    <SelectItem value="3">3 - Medium</SelectItem>
                    <SelectItem value="4">4 - High</SelectItem>
                    <SelectItem value="5">5 - Very High</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="impactCostUSD"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Financial Impact (USD)</FormLabel>
                <FormControl>
                  <CurrencyInput
                    value={field.value}
                    onValueChange={field.onChange}
                    onBlur={field.onBlur}
                    data-testid="input-cost-impact"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="impactScheduleDays"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Schedule Impact (Days)</FormLabel>
                <FormControl>
                  <Input 
                    type="number" 
                    placeholder="0" 
                    {...field}
                    onChange={(e) => field.onChange(Number(e.target.value))}
                    data-testid="input-schedule-impact"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="mitigationPlan"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Mitigation Plan</FormLabel>
              <FormControl>
                <Textarea placeholder="Describe mitigation plan..." {...field} data-testid="input-mitigation-plan" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="mitigationOwner"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Mitigation Owner</FormLabel>
                <FormControl>
                  <Input placeholder="Enter mitigation owner" {...field} data-testid="input-mitigation-owner" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="targetDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Target Completion Date</FormLabel>
                <FormControl>
                  <DateInput {...field} data-testid="input-target-date" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="flex justify-end space-x-2 pt-4">
          <Button type="button" variant="outline" onClick={onCancel} data-testid="button-cancel">
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting} data-testid="button-submit">
            {isSubmitting ? "Saving..." : "Save Risk"}
          </Button>
        </div>
      </form>
    </Form>
  );
}

// Risk Heatmap Component
function RiskHeatmap({ heatmapData }: any) {
  if (!heatmapData) {
    return <div data-testid="loading-heatmap">Loading heatmap...</div>;
  }

  const { matrix, details } = heatmapData;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Risk Heatmap</CardTitle>
        <p className="text-sm text-muted-foreground">
          Risk distribution by likelihood (horizontal) and impact (vertical)
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-4" data-testid="risk-heatmap">
          {/* Y-axis label */}
          <div className="flex items-center">
            <div className="w-16 text-sm font-medium">Impact</div>
            <div className="flex-1">
              {/* Column headers */}
              <div className="flex mb-2">
                <div className="w-16"></div>
                {[1, 2, 3, 4, 5].map((level) => (
                  <div key={level} className="flex-1 text-center text-xs font-medium">
                    {level}
                  </div>
                ))}
              </div>
              
              {/* Heatmap grid */}
              {matrix.map((row: number[], rowIndex: number) => (
                <div key={rowIndex} className="flex mb-1">
                  <div className="w-16 flex items-center justify-center text-xs font-medium">
                    {5 - rowIndex}
                  </div>
                  {row.map((count: number, colIndex: number) => {
                    const riskLevel = (5 - rowIndex) * (colIndex + 1);
                    let bgColor = "bg-gray-50";
                    if (riskLevel > 15) bgColor = "bg-red-100";
                    else if (riskLevel >= 8) bgColor = "bg-yellow-100";
                    else if (riskLevel >= 4) bgColor = "bg-green-100";

                    return (
                      <div
                        key={colIndex}
                        className={`flex-1 aspect-square border border-gray-200 ${bgColor} flex items-center justify-center text-sm font-medium hover:opacity-80 cursor-pointer`}
                        title={`${details[rowIndex][colIndex].length} risks`}
                        data-testid={`heatmap-cell-${rowIndex}-${colIndex}`}
                      >
                        {count}
                      </div>
                    );
                  })}
                </div>
              ))}
              
              {/* X-axis label */}
              <div className="text-center text-sm font-medium mt-2">Likelihood</div>
            </div>
          </div>
          
          {/* Legend */}
          <div className="flex items-center justify-center space-x-6 text-xs">
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 bg-red-100 border border-gray-200 rounded"></div>
              <span>High Risk (&gt;15)</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 bg-yellow-100 border border-gray-200 rounded"></div>
              <span>Medium Risk (8-15)</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 bg-green-100 border border-gray-200 rounded"></div>
              <span>Low Risk (&lt;8)</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Risk Analytics Component
function RiskAnalytics({ analytics, risks }: any) {
  if (!analytics) {
    return <div>Loading analytics...</div>;
  }

  return (
    <div className="space-y-6" data-testid="risk-analytics">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Category Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Risk by Category</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {analytics.categoryDistribution.map((item: any) => (
                <div key={item.category} className="flex items-center justify-between">
                  <span className="text-sm font-medium capitalize">{item.category}</span>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-muted-foreground">
                      {item.count} risks
                    </span>
                    <Badge variant="outline" className="text-xs">
                      Avg: {item.avgScore}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Risk Severity Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>Risk Severity Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>High Risk (Score {'>'} 15)</span>
                  <span className="font-medium">{analytics.risksBySeverity.high}</span>
                </div>
                <Progress 
                  value={(analytics.risksBySeverity.high / analytics.totalRisks) * 100} 
                  className="h-2"
                />
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Medium Risk (Score 8-15)</span>
                  <span className="font-medium">{analytics.risksBySeverity.medium}</span>
                </div>
                <Progress 
                  value={(analytics.risksBySeverity.medium / analytics.totalRisks) * 100} 
                  className="h-2"
                />
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Low Risk (Score {'<'} 8)</span>
                  <span className="font-medium">{analytics.risksBySeverity.low}</span>
                </div>
                <Progress 
                  value={(analytics.risksBySeverity.low / analytics.totalRisks) * 100} 
                  className="h-2"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}