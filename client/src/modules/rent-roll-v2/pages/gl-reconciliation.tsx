import { useState, useEffect, useMemo, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";
import { 
  Plus,
  Pencil,
  Trash2,
  Building2,
  FileText,
  Link as LinkIcon,
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  RefreshCw
} from "lucide-react";
import DashboardNav from "../components/navigation/DashboardNav";

interface GLAccount {
  id: string;
  organizationId: string;
  accountCode: string;
  accountName: string;
  category: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
}

interface GLMapping {
  id: string;
  organizationId: string;
  glAccountId: string;
  chargeType: string;
  projectId: string | null;
  storageLocationId: string | null;
  isActive: boolean;
  createdAt: string;
  accountCode?: string;
  accountName?: string;
}

interface ReconciliationRecord {
  id: string;
  organizationId: string;
  projectId: string | null;
  periodMonth: number;
  periodYear: number;
  status: string;
  rentRollTotal: string;
  glTotal: string | null;
  varianceAmount: string | null;
  variancePercent: string | null;
  createdAt: string;
  reconciledAt: string | null;
  reconciledBy: string | null;
  notes: string | null;
}

const ACCOUNT_TYPES = [
  { value: "revenue", label: "Revenue" },
  { value: "deferred_revenue", label: "Deferred Revenue" },
  { value: "receivable", label: "Accounts Receivable" },
  { value: "liability", label: "Liability" },
  { value: "expense", label: "Expense" },
];

const CHARGE_TYPES = [
  { value: "base_rent", label: "Base Rent" },
  { value: "storage_fee", label: "Storage Fee" },
  { value: "electric", label: "Electric" },
  { value: "liveaboard", label: "Liveaboard" },
  { value: "seasonal", label: "Seasonal" },
  { value: "late_fee", label: "Late Fee" },
  { value: "other", label: "Other" },
];

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof CheckCircle2 }> = {
  pending: { label: "Pending", color: "bg-gray-100 text-gray-700", icon: Clock },
  in_progress: { label: "In Progress", color: "bg-blue-100 text-blue-700", icon: RefreshCw },
  reconciled: { label: "Reconciled", color: "bg-green-100 text-green-700", icon: CheckCircle2 },
  variance_identified: { label: "Variance", color: "bg-yellow-100 text-yellow-700", icon: AlertTriangle },
  closed: { label: "Closed", color: "bg-gray-200 text-gray-800", icon: XCircle },
};

const accountFormSchema = z.object({
  accountCode: z.string().min(1, "Account code is required"),
  accountName: z.string().min(1, "Account name is required"),
  category: z.string().min(1, "Category is required"),
  description: z.string().optional(),
});

const mappingFormSchema = z.object({
  glAccountId: z.string().min(1, "GL account is required"),
  chargeType: z.string().min(1, "Charge type is required"),
  projectId: z.string().optional(),
});

type AccountFormValues = z.infer<typeof accountFormSchema>;
type MappingFormValues = z.infer<typeof mappingFormSchema>;

export default function GLReconciliationPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("accounts");
  const [accountDialogOpen, setAccountDialogOpen] = useState(false);
  const [mappingDialogOpen, setMappingDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<GLAccount | null>(null);
  const [editingMapping, setEditingMapping] = useState<GLMapping | null>(null);

  const getDefaultAccountValues = useCallback((): AccountFormValues => ({
    accountCode: "",
    accountName: "",
    category: "revenue",
    description: "",
  }), []);

  const getDefaultMappingValues = useCallback((): MappingFormValues => ({
    glAccountId: "",
    chargeType: "",
    projectId: "",
  }), []);

  const accountForm = useForm<AccountFormValues>({
    resolver: zodResolver(accountFormSchema),
    defaultValues: getDefaultAccountValues(),
  });

  const mappingForm = useForm<MappingFormValues>({
    resolver: zodResolver(mappingFormSchema),
    defaultValues: getDefaultMappingValues(),
  });

  useEffect(() => {
    if (editingAccount) {
      accountForm.reset({
        accountCode: editingAccount.accountCode || "",
        accountName: editingAccount.accountName || "",
        category: editingAccount.category || "revenue",
        description: editingAccount.description || "",
      }, { keepDefaultValues: false });
    }
  }, [editingAccount]);

  useEffect(() => {
    if (editingMapping) {
      mappingForm.reset({
        glAccountId: editingMapping.glAccountId || "",
        chargeType: editingMapping.chargeType || "",
        projectId: editingMapping.projectId || "",
      }, { keepDefaultValues: false });
    }
  }, [editingMapping]);

  const { data: accounts, isLoading: accountsLoading } = useQuery<GLAccount[]>({
    queryKey: ['/api/gl-accounts'],
  });

  const { data: mappings, isLoading: mappingsLoading } = useQuery<GLMapping[]>({
    queryKey: ['/api/gl-mappings'],
  });

  const { data: records, isLoading: recordsLoading } = useQuery<ReconciliationRecord[]>({
    queryKey: ['/api/reconciliation-records'],
  });

  const { data: projects } = useQuery<any[]>({
    queryKey: ['/api/marina-locations'],
  });

  const createAccountMutation = useMutation({
    mutationFn: async (data: AccountFormValues) => {
      return apiRequest('POST', '/api/gl-accounts', { ...data, isActive: true });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/gl-accounts'] });
      setAccountDialogOpen(false);
      setEditingAccount(null);
      accountForm.reset(getDefaultAccountValues(), { keepDefaultValues: false });
      toast({ title: "GL Account created successfully" });
    },
    onError: () => {
      toast({ title: "Failed to create GL account", variant: "destructive" });
    },
  });

  const updateAccountMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: AccountFormValues }) => {
      return apiRequest('PUT', `/api/gl-accounts/${id}`, { ...data, isActive: true });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/gl-accounts'] });
      setAccountDialogOpen(false);
      setEditingAccount(null);
      accountForm.reset(getDefaultAccountValues(), { keepDefaultValues: false });
      toast({ title: "GL Account updated successfully" });
    },
    onError: () => {
      toast({ title: "Failed to update GL account", variant: "destructive" });
    },
  });

  const deleteAccountMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest('DELETE', `/api/gl-accounts/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/gl-accounts'] });
      toast({ title: "GL Account deleted successfully" });
    },
    onError: () => {
      toast({ title: "Failed to delete GL account", variant: "destructive" });
    },
  });

  const createMappingMutation = useMutation({
    mutationFn: async (data: MappingFormValues) => {
      return apiRequest('POST', '/api/gl-mappings', { 
        ...data, 
        projectId: data.projectId || null,
        isActive: true 
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/gl-mappings'] });
      setMappingDialogOpen(false);
      setEditingMapping(null);
      mappingForm.reset(getDefaultMappingValues(), { keepDefaultValues: false });
      toast({ title: "GL Mapping created successfully" });
    },
    onError: () => {
      toast({ title: "Failed to create GL mapping", variant: "destructive" });
    },
  });

  const updateMappingMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: MappingFormValues }) => {
      return apiRequest('PUT', `/api/gl-mappings/${id}`, { 
        ...data, 
        projectId: data.projectId || null,
        isActive: true
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/gl-mappings'] });
      setMappingDialogOpen(false);
      setEditingMapping(null);
      mappingForm.reset(getDefaultMappingValues(), { keepDefaultValues: false });
      toast({ title: "GL Mapping updated successfully" });
    },
    onError: () => {
      toast({ title: "Failed to update GL mapping", variant: "destructive" });
    },
  });

  const deleteMappingMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest('DELETE', `/api/gl-mappings/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/gl-mappings'] });
      toast({ title: "GL Mapping deleted successfully" });
    },
    onError: () => {
      toast({ title: "Failed to delete GL mapping", variant: "destructive" });
    },
  });

  const onAccountSubmit = (values: AccountFormValues) => {
    if (editingAccount) {
      updateAccountMutation.mutate({ id: editingAccount.id, data: values });
    } else {
      createAccountMutation.mutate(values);
    }
  };

  const onMappingSubmit = (values: MappingFormValues) => {
    if (editingMapping) {
      updateMappingMutation.mutate({ id: editingMapping.id, data: values });
    } else {
      createMappingMutation.mutate(values);
    }
  };

  const formatCurrency = (value: string | null) => {
    if (!value) return '-';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(parseFloat(value));
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-card">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
          <div className="mb-4">
            <h1 className="text-3xl font-semibold text-foreground" data-testid="text-page-title">
              Rent Roll
            </h1>
            <p className="text-sm text-muted-foreground mt-1" data-testid="text-page-description">
              Key performance metrics and trends
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <DashboardNav />
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6" data-testid="tabs-gl-reconciliation">
            <TabsTrigger value="accounts" data-testid="tab-accounts">
              <Building2 className="mr-2 h-4 w-4" />
              GL Accounts
            </TabsTrigger>
            <TabsTrigger value="mappings" data-testid="tab-mappings">
              <LinkIcon className="mr-2 h-4 w-4" />
              Mappings
            </TabsTrigger>
            <TabsTrigger value="records" data-testid="tab-records">
              <FileText className="mr-2 h-4 w-4" />
              Reconciliation
            </TabsTrigger>
          </TabsList>

          <TabsContent value="accounts">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2">
                <div>
                  <CardTitle>GL Accounts</CardTitle>
                  <CardDescription>Manage your general ledger accounts</CardDescription>
                </div>
                <Dialog open={accountDialogOpen} onOpenChange={(open) => {
                  setAccountDialogOpen(open);
                  if (!open) {
                    setEditingAccount(null);
                    accountForm.reset(getDefaultAccountValues(), { keepDefaultValues: false });
                  }
                }}>
                  <DialogTrigger asChild>
                    <Button size="sm" data-testid="button-add-account">
                      <Plus className="mr-2 h-4 w-4" />
                      Add Account
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <Form {...accountForm}>
                      <form onSubmit={accountForm.handleSubmit(onAccountSubmit)}>
                        <DialogHeader>
                          <DialogTitle>{editingAccount ? 'Edit GL Account' : 'Add GL Account'}</DialogTitle>
                          <DialogDescription>
                            {editingAccount ? 'Update the GL account details' : 'Create a new general ledger account'}
                          </DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                          <FormField
                            control={accountForm.control}
                            name="accountCode"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Account Code</FormLabel>
                                <FormControl>
                                  <Input placeholder="e.g., 4000" {...field} data-testid="input-account-code" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={accountForm.control}
                            name="accountName"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Account Name</FormLabel>
                                <FormControl>
                                  <Input placeholder="e.g., Marina Revenue" {...field} data-testid="input-account-name" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={accountForm.control}
                            name="category"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Category</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                  <FormControl>
                                    <SelectTrigger data-testid="select-category">
                                      <SelectValue placeholder="Select category" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    {ACCOUNT_TYPES.map(type => (
                                      <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={accountForm.control}
                            name="description"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Description (Optional)</FormLabel>
                                <FormControl>
                                  <Input placeholder="Account description" {...field} data-testid="input-description" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                        <DialogFooter>
                          <Button type="button" variant="outline" onClick={() => setAccountDialogOpen(false)}>
                            Cancel
                          </Button>
                          <Button 
                            type="submit" 
                            disabled={createAccountMutation.isPending || updateAccountMutation.isPending}
                            data-testid="button-save-account"
                          >
                            {editingAccount ? 'Update' : 'Create'}
                          </Button>
                        </DialogFooter>
                      </form>
                    </Form>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                {accountsLoading ? (
                  <div className="space-y-2">
                    {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
                  </div>
                ) : !accounts?.length ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-medium">No GL accounts yet</h3>
                    <p className="text-sm text-muted-foreground mt-1">Create your first GL account to get started</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Account Code</TableHead>
                        <TableHead>Account Name</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {accounts.map(account => (
                        <TableRow key={account.id} data-testid={`row-account-${account.id}`}>
                          <TableCell className="font-mono">{account.accountCode}</TableCell>
                          <TableCell>{account.accountName}</TableCell>
                          <TableCell>
                            <Badge variant="secondary">
                              {ACCOUNT_TYPES.find(t => t.value === account.category)?.label || account.category}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={account.isActive ? "default" : "outline"}>
                              {account.isActive ? 'Active' : 'Inactive'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setEditingAccount(account);
                                setAccountDialogOpen(true);
                              }}
                              data-testid={`button-edit-account-${account.id}`}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => deleteAccountMutation.mutate(account.id)}
                              data-testid={`button-delete-account-${account.id}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="mappings">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2">
                <div>
                  <CardTitle>GL Mappings</CardTitle>
                  <CardDescription>Map charge types to GL accounts</CardDescription>
                </div>
                <Dialog open={mappingDialogOpen} onOpenChange={(open) => {
                  setMappingDialogOpen(open);
                  if (!open) {
                    setEditingMapping(null);
                    mappingForm.reset(getDefaultMappingValues(), { keepDefaultValues: false });
                  }
                }}>
                  <DialogTrigger asChild>
                    <Button size="sm" data-testid="button-add-mapping">
                      <Plus className="mr-2 h-4 w-4" />
                      Add Mapping
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <Form {...mappingForm}>
                      <form onSubmit={mappingForm.handleSubmit(onMappingSubmit)}>
                        <DialogHeader>
                          <DialogTitle>{editingMapping ? 'Edit GL Mapping' : 'Add GL Mapping'}</DialogTitle>
                          <DialogDescription>
                            {editingMapping ? 'Update the mapping details' : 'Map a charge type to a GL account'}
                          </DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                          <FormField
                            control={mappingForm.control}
                            name="glAccountId"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>GL Account</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                  <FormControl>
                                    <SelectTrigger data-testid="select-gl-account">
                                      <SelectValue placeholder="Select GL account" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    {accounts?.map(account => (
                                      <SelectItem key={account.id} value={account.id}>
                                        {account.accountCode} - {account.accountName}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={mappingForm.control}
                            name="chargeType"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Charge Type</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                  <FormControl>
                                    <SelectTrigger data-testid="select-charge-type">
                                      <SelectValue placeholder="Select charge type" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    {CHARGE_TYPES.map(type => (
                                      <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={mappingForm.control}
                            name="projectId"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Project (Optional)</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                  <FormControl>
                                    <SelectTrigger data-testid="select-project">
                                      <SelectValue placeholder="All projects" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="">All Projects</SelectItem>
                                    {projects?.map(project => (
                                      <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                        <DialogFooter>
                          <Button type="button" variant="outline" onClick={() => setMappingDialogOpen(false)}>
                            Cancel
                          </Button>
                          <Button 
                            type="submit" 
                            disabled={createMappingMutation.isPending || updateMappingMutation.isPending}
                            data-testid="button-save-mapping"
                          >
                            {editingMapping ? 'Update' : 'Create'}
                          </Button>
                        </DialogFooter>
                      </form>
                    </Form>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                {mappingsLoading ? (
                  <div className="space-y-2">
                    {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
                  </div>
                ) : !mappings?.length ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <LinkIcon className="h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-medium">No mappings yet</h3>
                    <p className="text-sm text-muted-foreground mt-1">Create mappings to link charge types to GL accounts</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Charge Type</TableHead>
                        <TableHead>GL Account</TableHead>
                        <TableHead>Project</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {mappings.map(mapping => (
                        <TableRow key={mapping.id} data-testid={`row-mapping-${mapping.id}`}>
                          <TableCell>
                            <Badge variant="outline">
                              {CHARGE_TYPES.find(t => t.value === mapping.chargeType)?.label || mapping.chargeType}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {mapping.accountCode ? `${mapping.accountCode} - ${mapping.accountName}` : '-'}
                          </TableCell>
                          <TableCell>
                            {mapping.projectId 
                              ? projects?.find(p => p.id === mapping.projectId)?.name || mapping.projectId
                              : <span className="text-muted-foreground">All Projects</span>}
                          </TableCell>
                          <TableCell>
                            <Badge variant={mapping.isActive ? "default" : "outline"}>
                              {mapping.isActive ? 'Active' : 'Inactive'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setEditingMapping(mapping);
                                setMappingDialogOpen(true);
                              }}
                              data-testid={`button-edit-mapping-${mapping.id}`}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => deleteMappingMutation.mutate(mapping.id)}
                              data-testid={`button-delete-mapping-${mapping.id}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="records">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2">
                <div>
                  <CardTitle>Reconciliation Records</CardTitle>
                  <CardDescription>Monthly reconciliation between rent roll and GL</CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                {recordsLoading ? (
                  <div className="space-y-2">
                    {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
                  </div>
                ) : !records?.length ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-medium">No reconciliation records</h3>
                    <p className="text-sm text-muted-foreground mt-1">Reconciliation records will appear here once created</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Period</TableHead>
                        <TableHead>Project</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Rent Roll Total</TableHead>
                        <TableHead className="text-right">GL Total</TableHead>
                        <TableHead className="text-right">Variance</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {records.map(record => {
                        const statusConfig = STATUS_CONFIG[record.status] || STATUS_CONFIG.pending;
                        const StatusIcon = statusConfig.icon;
                        const hasVariance = record.varianceAmount && parseFloat(record.varianceAmount) !== 0;

                        return (
                          <TableRow key={record.id} data-testid={`row-record-${record.id}`}>
                            <TableCell className="font-medium">
                              {format(new Date(record.periodYear, record.periodMonth - 1), 'MMMM yyyy')}
                            </TableCell>
                            <TableCell>
                              {record.projectId 
                                ? projects?.find(p => p.id === record.projectId)?.name || 'Unknown'
                                : <span className="text-muted-foreground">All Projects</span>}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className={statusConfig.color}>
                                <StatusIcon className="mr-1 h-3 w-3" />
                                {statusConfig.label}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              {formatCurrency(record.rentRollTotal)}
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              {formatCurrency(record.glTotal)}
                            </TableCell>
                            <TableCell className="text-right">
                              {hasVariance ? (
                                <span className={parseFloat(record.varianceAmount!) < 0 ? 'text-red-600' : 'text-yellow-600'}>
                                  {formatCurrency(record.varianceAmount)}
                                  {record.variancePercent && (
                                    <span className="text-xs ml-1">({record.variancePercent}%)</span>
                                  )}
                                </span>
                              ) : (
                                <span className="text-green-600">-</span>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
