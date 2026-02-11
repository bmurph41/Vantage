import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Edit, Play } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

const dedupeRuleSchema = z.object({
  name: z.string().min(1, "Name is required"),
  entityType: z.string().min(1, "Entity type is required"),
  matchFields: z.array(z.string()).min(1, "At least one match field is required"),
  matchStrategy: z.string().default("exact"),
  caseSensitive: z.boolean().default(false),
  autoMerge: z.boolean().default(false),
  priorityField: z.string().optional(),
  priorityOrder: z.string().default("desc"),
  isActive: z.boolean().default(true),
});

type DedupeRuleFormData = z.infer<typeof dedupeRuleSchema>;

interface DedupeRule {
  id: string;
  name: string;
  entityType: string;
  matchFields: string[];
  matchStrategy: string;
  caseSensitive: boolean;
  autoMerge: boolean;
  priorityField?: string | null;
  priorityOrder: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface DuplicateGroup {
  primary: any;
  duplicates: any[];
  matchedFields: string[];
}

export default function DedupePage() {
  const { toast } = useToast();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<DedupeRule | null>(null);
  const [selectedRuleForRun, setSelectedRuleForRun] = useState<DedupeRule | null>(null);
  const [duplicates, setDuplicates] = useState<DuplicateGroup[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const { data: rules = [] } = useQuery<DedupeRule[]>({
    queryKey: ['/api/dedupe-rules'],
  });

  const form = useForm<DedupeRuleFormData>({
    resolver: zodResolver(dedupeRuleSchema),
    defaultValues: {
      name: "",
      entityType: "contact",
      matchFields: ["email"],
      matchStrategy: "exact",
      caseSensitive: false,
      autoMerge: false,
      priorityOrder: "desc",
      isActive: true,
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: DedupeRuleFormData) => {
      return await apiRequest('POST', '/api/dedupe-rules', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/dedupe-rules'] });
      toast({
        title: "Success",
        description: "Dedupe rule created successfully",
      });
      setIsFormOpen(false);
      form.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<DedupeRuleFormData> }) => {
      return await apiRequest('PUT', `/api/dedupe-rules/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/dedupe-rules'] });
      toast({
        title: "Success",
        description: "Dedupe rule updated successfully",
      });
      setIsFormOpen(false);
      setEditingRule(null);
      form.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest('DELETE', `/api/dedupe-rules/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/dedupe-rules'] });
      toast({
        title: "Success",
        description: "Dedupe rule deleted successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const runRuleMutation = useMutation({
    mutationFn: async ({ entityType, ruleId }: { entityType: string; ruleId: string }) => {
      const response = await apiRequest('POST', '/api/dedupe/find', { entityType, ruleId });
      const data = await response.json();
      return data as DuplicateGroup[];
    },
    onSuccess: (data: DuplicateGroup[]) => {
      setDuplicates(data);
      setIsRunning(false);
      toast({
        title: "Scan Complete",
        description: `Found ${data.length} duplicate groups`,
      });
    },
    onError: (error: Error) => {
      setIsRunning(false);
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (data: DedupeRuleFormData) => {
    if (editingRule) {
      updateMutation.mutate({ id: editingRule.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleEdit = (rule: DedupeRule) => {
    setEditingRule(rule);
    form.reset({
      name: rule.name,
      entityType: rule.entityType,
      matchFields: rule.matchFields,
      matchStrategy: rule.matchStrategy,
      caseSensitive: rule.caseSensitive,
      autoMerge: rule.autoMerge,
      priorityField: rule.priorityField || undefined,
      priorityOrder: rule.priorityOrder,
      isActive: rule.isActive,
    });
    setIsFormOpen(true);
  };

  const handleDelete = (rule: DedupeRule) => {
    if (confirm(`Are you sure you want to delete "${rule.name}"?`)) {
      deleteMutation.mutate(rule.id);
    }
  };

  const handleRunRule = (rule: DedupeRule) => {
    setSelectedRuleForRun(rule);
    setIsRunning(true);
    setDuplicates([]);
    runRuleMutation.mutate({ entityType: rule.entityType, ruleId: rule.id });
  };

  return (
    <div className="flex h-screen overflow-hidden">
      <main className="flex-1 overflow-y-auto bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Dedupe Rules</h1>
              <p className="text-gray-600 mt-1">Configure rules to find and manage duplicate records</p>
            </div>
            <Button
              onClick={() => {
                setEditingRule(null);
                form.reset();
                setIsFormOpen(true);
              }}
              data-testid="button-create-rule"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Rule
            </Button>
          </div>

          <div className="grid grid-cols-1 gap-4 mb-8">
            {rules.map((rule) => (
              <Card key={rule.id} className="p-6" data-testid={`card-rule-${rule.id}`}>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="text-lg font-semibold text-gray-900" data-testid={`text-rule-name-${rule.id}`}>
                        {rule.name}
                      </h3>
                      <Badge variant={rule.isActive ? "default" : "secondary"} data-testid={`badge-rule-status-${rule.id}`}>
                        {rule.isActive ? "Active" : "Inactive"}
                      </Badge>
                      {rule.autoMerge && (
                        <Badge variant="destructive" data-testid={`badge-rule-automerge-${rule.id}`}>
                          Auto-Merge
                        </Badge>
                      )}
                    </div>

                    <div className="space-y-1 text-sm text-gray-600">
                      <div data-testid={`text-rule-entity-${rule.id}`}>
                        <span className="font-medium">Entity:</span> {rule.entityType}
                      </div>
                      <div data-testid={`text-rule-fields-${rule.id}`}>
                        <span className="font-medium">Match Fields:</span> {rule.matchFields.join(", ")}
                      </div>
                      <div data-testid={`text-rule-strategy-${rule.id}`}>
                        <span className="font-medium">Strategy:</span> {rule.matchStrategy} 
                        {rule.caseSensitive && " (case-sensitive)"}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRunRule(rule)}
                      disabled={!rule.isActive}
                      data-testid={`button-run-rule-${rule.id}`}
                    >
                      <Play className="h-4 w-4 mr-1" />
                      Run
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit(rule)}
                      data-testid={`button-edit-rule-${rule.id}`}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(rule)}
                      className="text-red-500 hover:text-red-700"
                      data-testid={`button-delete-rule-${rule.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {/* Duplicates Results */}
          {selectedRuleForRun && duplicates.length > 0 && (
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                Duplicate Groups ({duplicates.length})
              </h2>
              <div className="space-y-4">
                {duplicates.map((group, index) => (
                  <Card key={index} className="p-4" data-testid={`card-duplicate-group-${index}`}>
                    <div className="mb-2">
                      <Badge>Group {index + 1}</Badge>
                      <span className="ml-2 text-sm text-gray-600">
                        {group.duplicates.length + 1} records matched on: {group.matchedFields.join(", ")}
                      </span>
                    </div>
                    <div className="space-y-2">
                      <div className="p-2 bg-green-50 rounded" data-testid={`div-primary-record-${index}`}>
                        <span className="text-xs font-medium text-green-700">Primary</span>
                        <pre className="text-xs mt-1 overflow-x-auto">
                          {JSON.stringify(group.primary, null, 2)}
                        </pre>
                      </div>
                      {group.duplicates.map((dup, dupIndex) => (
                        <div 
                          key={dupIndex} 
                          className="p-2 bg-gray-50 rounded" 
                          data-testid={`div-duplicate-record-${index}-${dupIndex}`}
                        >
                          <span className="text-xs font-medium text-gray-700">Duplicate {dupIndex + 1}</span>
                          <pre className="text-xs mt-1 overflow-x-auto">
                            {JSON.stringify(dup, null, 2)}
                          </pre>
                        </div>
                      ))}
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Rule Form Modal */}
        <Dialog open={isFormOpen} onOpenChange={(open) => {
          setIsFormOpen(open);
          if (!open) {
            setEditingRule(null);
            form.reset();
          }
        }}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle data-testid="text-modal-title">
                {editingRule ? "Edit Dedupe Rule" : "Create Dedupe Rule"}
              </DialogTitle>
              <DialogDescription>
                Configure a rule to find duplicate records
              </DialogDescription>
            </DialogHeader>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Rule Name</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="e.g., Duplicate Contacts by Email" data-testid="input-rule-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="entityType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Entity Type</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-entity-type">
                            <SelectValue placeholder="Select entity type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="contact" data-testid="option-entity-contact">Contact</SelectItem>
                          <SelectItem value="company" data-testid="option-entity-company">Company</SelectItem>
                          <SelectItem value="lead" data-testid="option-entity-lead">Lead</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="matchStrategy"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Match Strategy</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-match-strategy">
                            <SelectValue placeholder="Select match strategy" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="exact" data-testid="option-strategy-exact">Exact Match</SelectItem>
                          <SelectItem value="fuzzy" data-testid="option-strategy-fuzzy">Fuzzy Match</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="caseSensitive"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <FormLabel>Case Sensitive</FormLabel>
                        <p className="text-sm text-gray-500">Enable case-sensitive matching</p>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          data-testid="switch-case-sensitive"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="autoMerge"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <FormLabel>Auto-Merge</FormLabel>
                        <p className="text-sm text-gray-500">Automatically merge duplicates (use with caution)</p>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          data-testid="switch-auto-merge"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="isActive"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <FormLabel>Active</FormLabel>
                        <p className="text-sm text-gray-500">Enable this rule</p>
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

                <DialogFooter>
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setIsFormOpen(false)}
                    data-testid="button-cancel"
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={createMutation.isPending || updateMutation.isPending}
                    data-testid="button-save"
                  >
                    {editingRule ? "Update Rule" : "Create Rule"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
