import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { Calendar, DollarSign, Plus, Edit, Trash2, Tag, TrendingUp, Settings } from "lucide-react";

const pricingRuleFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  ruleType: z.enum(["seasonal", "demand", "desirability", "event", "promotional"]),
  isActive: z.boolean().default(true),
  priority: z.coerce.number().min(1).default(1),
  description: z.string().optional(),
  validFrom: z.string().min(1, "Start date is required"),
  validTo: z.string().optional(),
  adjustmentType: z.enum(["percentage", "fixed", "override"]),
  adjustmentValue: z.coerce.number(),
  minimumRate: z.coerce.number().optional(),
  maximumRate: z.coerce.number().optional(),
  minimumStay: z.coerce.number().optional(),
  maximumStay: z.coerce.number().optional(),
});

type PricingRuleFormData = z.infer<typeof pricingRuleFormSchema>;

export default function PricingManagement() {
  const { toast } = useToast();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<any>(null);

  // Fetch marinas for selection
  const { data: marinas = [] } = useQuery({
    queryKey: ["/api/marinas"],
    queryFn: async () => apiRequest("/api/marinas"),
  });

  // Default to first marina
  const selectedMarinaId = marinas[0]?.id || "";

  const form = useForm<PricingRuleFormData>({
    resolver: zodResolver(pricingRuleFormSchema),
    defaultValues: {
      name: "",
      ruleType: "seasonal",
      isActive: true,
      priority: 1,
      adjustmentType: "percentage",
      adjustmentValue: 0,
    },
  });

  // Fetch pricing rules
  const { data: pricingRules = [], isLoading: rulesLoading } = useQuery({
    queryKey: ["/api/pricing-rules"],
    queryFn: async () => apiRequest("/api/pricing-rules"),
  });

  // Fetch slip pricing
  const { data: slipPricing = [], isLoading: slipPricingLoading } = useQuery({
    queryKey: ["/api/slip-pricing"],
    queryFn: async () => apiRequest("/api/slip-pricing"),
  });

  // Create or update pricing rule mutation
  const saveRuleMutation = useMutation({
    mutationFn: async (data: PricingRuleFormData) => {
      // Validate marina selection
      if (!selectedMarinaId) {
        throw new Error("Marina data is still loading. Please wait and try again.");
      }

      // Validate dates
      if (data.validTo && data.validFrom) {
        const fromDate = new Date(data.validFrom);
        const toDate = new Date(data.validTo);
        if (toDate < fromDate) {
          throw new Error("End date must be after start date");
        }
      }

      const payload = {
        marinaId: selectedMarinaId,
        name: data.name,
        ruleType: data.ruleType,
        isActive: data.isActive,
        priority: data.priority,
        description: data.description,
        validFrom: new Date(data.validFrom).toISOString(),
        validTo: data.validTo ? new Date(data.validTo).toISOString() : null,
        adjustment: {
          type: data.adjustmentType,
          value: data.adjustmentValue,
          minimumRate: data.minimumRate,
          maximumRate: data.maximumRate,
        },
        conditions: {
          minimumStay: data.minimumStay,
          maximumStay: data.maximumStay,
        },
      };

      if (editingRule) {
        // Update existing rule
        return apiRequest(`/api/pricing-rules/${editingRule.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
          headers: { "Content-Type": "application/json" },
        });
      } else {
        // Create new rule
        return apiRequest("/api/pricing-rules", {
          method: "POST",
          body: JSON.stringify(payload),
          headers: { "Content-Type": "application/json" },
        });
      }
    },
    onSuccess: () => {
      toast({
        title: editingRule ? "Pricing rule updated" : "Pricing rule created",
        description: editingRule 
          ? "The pricing rule has been successfully updated."
          : "The pricing rule has been successfully created.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/pricing-rules"] });
      setCreateDialogOpen(false);
      setEditingRule(null);
      form.reset();
    },
    onError: (error: any) => {
      toast({
        title: editingRule ? "Failed to update pricing rule" : "Failed to create pricing rule",
        description: error.message || "Please check your inputs and try again.",
        variant: "destructive",
      });
    },
  });

  // Delete pricing rule mutation
  const deleteRuleMutation = useMutation({
    mutationFn: async (ruleId: string) => {
      return apiRequest(`/api/pricing-rules/${ruleId}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      toast({
        title: "Pricing rule deleted",
        description: "The pricing rule has been removed.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/pricing-rules"] });
    },
  });

  // Toggle active status mutation
  const toggleActiveMutation = useMutation({
    mutationFn: async ({ ruleId, isActive }: { ruleId: string; isActive: boolean }) => {
      return apiRequest(`/api/pricing-rules/${ruleId}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive }),
        headers: { "Content-Type": "application/json" },
      });
    },
    onSuccess: () => {
      toast({
        title: "Pricing rule updated",
        description: "The rule status has been updated.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/pricing-rules"] });
    },
  });

  const onSubmit = (data: PricingRuleFormData) => {
    saveRuleMutation.mutate(data);
  };

  const handleEditRule = (rule: any) => {
    setEditingRule(rule);
    // Pre-fill form with rule data
    form.reset({
      name: rule.name,
      ruleType: rule.ruleType,
      isActive: rule.isActive,
      priority: rule.priority,
      description: rule.description || "",
      validFrom: rule.validFrom ? new Date(rule.validFrom).toISOString().split('T')[0] : "",
      validTo: rule.validTo ? new Date(rule.validTo).toISOString().split('T')[0] : "",
      adjustmentType: rule.adjustment?.type || "percentage",
      adjustmentValue: rule.adjustment?.value || 0,
      minimumRate: rule.adjustment?.minimumRate,
      maximumRate: rule.adjustment?.maximumRate,
      minimumStay: rule.conditions?.minimumStay,
      maximumStay: rule.conditions?.maximumStay,
    });
    setCreateDialogOpen(true);
  };

  const handleCreateNew = () => {
    setEditingRule(null);
    form.reset({
      name: "",
      ruleType: "seasonal",
      isActive: true,
      priority: 1,
      adjustmentType: "percentage",
      adjustmentValue: 0,
    });
    setCreateDialogOpen(true);
  };

  const getRuleTypeBadge = (ruleType: string) => {
    const colors: Record<string, string> = {
      seasonal: "bg-green-100 text-green-800",
      demand: "bg-blue-100 text-blue-800",
      desirability: "bg-purple-100 text-purple-800",
      event: "bg-orange-100 text-orange-800",
      promotional: "bg-pink-100 text-pink-800",
    };
    return (
      <Badge className={colors[ruleType] || "bg-gray-100 text-gray-800"}>
        {ruleType}
      </Badge>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-4xl font-bold text-gray-900">Pricing Management</h1>
              <p className="text-gray-600 mt-2">Configure dynamic pricing rules and slip rates</p>
            </div>
            <Button 
              onClick={handleCreateNew} 
              disabled={!selectedMarinaId}
              data-testid="button-create-rule"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Pricing Rule
            </Button>
          </div>
        </div>

        <Dialog open={createDialogOpen} onOpenChange={(open) => {
          setCreateDialogOpen(open);
          if (!open) {
            setEditingRule(null);
            form.reset();
          }
        }}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingRule ? "Edit Pricing Rule" : "Create Pricing Rule"}</DialogTitle>
              <DialogDescription>
                Define dynamic pricing adjustments based on seasons, demand, or special events.
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem className="col-span-2">
                            <FormLabel>Rule Name</FormLabel>
                            <FormControl>
                              <Input placeholder="Summer Peak Season" {...field} data-testid="input-rule-name" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="ruleType"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Rule Type</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-rule-type">
                                  <SelectValue placeholder="Select type" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="seasonal">Seasonal</SelectItem>
                                <SelectItem value="demand">Demand-Based</SelectItem>
                                <SelectItem value="desirability">Desirability</SelectItem>
                                <SelectItem value="event">Event</SelectItem>
                                <SelectItem value="promotional">Promotional</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="priority"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Priority</FormLabel>
                            <FormControl>
                              <Input type="number" min="1" {...field} data-testid="input-priority" />
                            </FormControl>
                            <FormDescription>Higher = applied first</FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="validFrom"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Valid From</FormLabel>
                            <FormControl>
                              <Input type="date" {...field} data-testid="input-valid-from" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="validTo"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Valid To (Optional)</FormLabel>
                            <FormControl>
                              <Input type="date" {...field} data-testid="input-valid-to" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="adjustmentType"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Adjustment Type</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-adjustment-type">
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="percentage">Percentage</SelectItem>
                                <SelectItem value="fixed">Fixed Amount</SelectItem>
                                <SelectItem value="override">Override Rate</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="adjustmentValue"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Adjustment Value</FormLabel>
                            <FormControl>
                              <Input 
                                type="number" 
                                step="0.01" 
                                placeholder={form.watch("adjustmentType") === "percentage" ? "10 (for 10%)" : "50.00"}
                                {...field} 
                                data-testid="input-adjustment-value"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="minimumStay"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Minimum Stay (nights)</FormLabel>
                            <FormControl>
                              <Input type="number" min="1" {...field} data-testid="input-minimum-stay" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="maximumStay"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Maximum Stay (nights)</FormLabel>
                            <FormControl>
                              <Input type="number" min="1" {...field} data-testid="input-maximum-stay" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="description"
                        render={({ field }) => (
                          <FormItem className="col-span-2">
                            <FormLabel>Description</FormLabel>
                            <FormControl>
                              <Textarea 
                                placeholder="Describe when this rule should be applied..." 
                                {...field} 
                                data-testid="input-description"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="isActive"
                        render={({ field }) => (
                          <FormItem className="flex items-center justify-between col-span-2 border rounded-lg p-4">
                            <div className="space-y-0.5">
                              <FormLabel className="text-base">Active</FormLabel>
                              <FormDescription>
                                Enable this rule immediately upon creation
                              </FormDescription>
                            </div>
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                                data-testid="switch-is-active"
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>

                    <DialogFooter>
                      <Button 
                        type="button" 
                        variant="outline" 
                        onClick={() => setCreateDialogOpen(false)}
                        data-testid="button-cancel-create"
                      >
                        Cancel
                      </Button>
                      <Button 
                        type="submit" 
                        disabled={saveRuleMutation.isPending || !selectedMarinaId}
                        data-testid="button-submit-create"
                      >
                        {saveRuleMutation.isPending 
                          ? (editingRule ? "Updating..." : "Creating...") 
                          : (editingRule ? "Update Rule" : "Create Rule")}
                      </Button>
                    </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>

        <Tabs defaultValue="rules" className="space-y-6">
          <TabsList>
            <TabsTrigger value="rules" data-testid="tab-rules">
              <Settings className="w-4 h-4 mr-2" />
              Pricing Rules
            </TabsTrigger>
            <TabsTrigger value="slips" data-testid="tab-slips">
              <DollarSign className="w-4 h-4 mr-2" />
              Slip Base Rates
            </TabsTrigger>
            <TabsTrigger value="analytics" data-testid="tab-analytics">
              <TrendingUp className="w-4 h-4 mr-2" />
              Pricing Analytics
            </TabsTrigger>
          </TabsList>

          {/* Pricing Rules Tab */}
          <TabsContent value="rules" className="space-y-4">
            {rulesLoading ? (
              <Card>
                <CardContent className="pt-6">
                  <p className="text-center text-muted-foreground">Loading pricing rules...</p>
                </CardContent>
              </Card>
            ) : pricingRules.length === 0 ? (
              <Card>
                <CardContent className="pt-6 text-center">
                  <Tag className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-lg font-medium mb-2">No pricing rules configured</p>
                  <p className="text-muted-foreground mb-6">
                    Create your first pricing rule to implement dynamic pricing
                  </p>
                  <Button onClick={() => setCreateDialogOpen(true)} data-testid="button-create-first-rule">
                    <Plus className="w-4 h-4 mr-2" />
                    Create Pricing Rule
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {pricingRules.map((rule: any) => (
                  <Card key={rule.id} data-testid={`card-rule-${rule.id}`}>
                    <CardHeader>
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <CardTitle>{rule.name}</CardTitle>
                            {getRuleTypeBadge(rule.ruleType)}
                            <Badge variant={rule.isActive ? "default" : "secondary"}>
                              {rule.isActive ? "Active" : "Inactive"}
                            </Badge>
                          </div>
                          <CardDescription>{rule.description}</CardDescription>
                        </div>
                        <div className="flex gap-2">
                          <Switch
                            checked={rule.isActive}
                            onCheckedChange={(checked) =>
                              toggleActiveMutation.mutate({ ruleId: rule.id, isActive: checked })
                            }
                            data-testid={`switch-active-${rule.id}`}
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditRule(rule)}
                            data-testid={`button-edit-${rule.id}`}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteRuleMutation.mutate(rule.id)}
                            data-testid={`button-delete-${rule.id}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground">Adjustment</p>
                          <p className="font-medium">
                            {rule.adjustment?.type === "percentage"
                              ? `${rule.adjustment.value > 0 ? "+" : ""}${rule.adjustment.value}%`
                              : rule.adjustment?.type === "fixed"
                              ? `$${rule.adjustment.value}`
                              : `$${rule.adjustment?.value}/night`}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Priority</p>
                          <p className="font-medium">{rule.priority}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Valid From</p>
                          <p className="font-medium">{format(new Date(rule.validFrom), "PP")}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Valid To</p>
                          <p className="font-medium">
                            {rule.validTo ? format(new Date(rule.validTo), "PP") : "Ongoing"}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Slip Base Rates Tab */}
          <TabsContent value="slips">
            <Card>
              <CardHeader>
                <CardTitle>Slip Base Rates</CardTitle>
                <CardDescription>
                  Configure base rates and seasonal pricing for individual slips
                </CardDescription>
              </CardHeader>
              <CardContent>
                {slipPricingLoading ? (
                  <p className="text-center text-muted-foreground py-8">Loading slip pricing...</p>
                ) : slipPricing.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground mb-4">No slip pricing configured</p>
                    <Button data-testid="button-configure-slip-pricing">Configure Slip Pricing</Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {slipPricing.map((pricing: any) => (
                      <div key={pricing.id} className="flex justify-between items-center border-b pb-4">
                        <div>
                          <p className="font-medium">Slip {pricing.slipId}</p>
                          <p className="text-sm text-muted-foreground">
                            Base Rate: ${parseFloat(pricing.baseRate).toFixed(2)}/night
                          </p>
                        </div>
                        <Button variant="ghost" size="sm">
                          <Edit className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics">
            <Card>
              <CardHeader>
                <CardTitle>Pricing Analytics</CardTitle>
                <CardDescription>
                  View pricing performance and revenue optimization insights
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12">
                  <TrendingUp className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-lg font-medium mb-2">Analytics Coming Soon</p>
                  <p className="text-muted-foreground">
                    Revenue trends, rate optimization, and booking conversion analytics
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
