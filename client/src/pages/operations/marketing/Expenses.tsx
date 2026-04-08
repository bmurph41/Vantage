import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Form,
  FormControl,
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
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Edit, Trash2 } from "lucide-react";
import type { MarketingExpense, MarketingCampaign } from "@shared/schema";

const expenseFormSchema = z.object({
  campaignId: z.string().optional(),
  vendor: z.string().min(1, "Vendor is required"),
  category: z.enum(['advertising', 'software', 'agency_fees', 'content_creation', 'events', 'sponsorships', 'tools', 'other']),
  description: z.string().min(1, "Description is required"),
  amount: z.string().min(1, "Amount is required"),
  date: z.string().min(1, "Date is required"),
  status: z.enum(['pending', 'approved', 'paid', 'rejected']),
  invoiceUrl: z.string().optional(),
  poNumber: z.string().optional(),
  glAccount: z.string().optional(),
  paidDate: z.string().optional(),
  notes: z.string().optional(),
});

type ExpenseFormData = z.infer<typeof expenseFormSchema>;

const statusBadgeVariant = (status: string) => {
  const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
    pending: 'outline',
    approved: 'default',
    paid: 'secondary',
    rejected: 'destructive',
  };
  return variants[status] || 'outline';
};

export default function Expenses() {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<MarketingExpense | null>(null);

  const { data: expenses = [], isLoading } = useQuery<MarketingExpense[]>({
    queryKey: ['/api/marketing/expenses'],
  });

  const { data: campaigns = [] } = useQuery<MarketingCampaign[]>({
    queryKey: ['/api/marketing/campaigns'],
  });

  const form = useForm<ExpenseFormData>({
    resolver: zodResolver(expenseFormSchema),
    defaultValues: {
      campaignId: '',
      vendor: '',
      category: 'other',
      description: '',
      amount: '',
      date: '',
      status: 'pending',
      invoiceUrl: '',
      poNumber: '',
      glAccount: '',
      paidDate: '',
      notes: '',
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest('/api/marketing/expenses', 'POST', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/marketing/expenses'] });
      toast({ title: "Expense created successfully" });
      setDialogOpen(false);
      form.reset();
    },
    onError: () => {
      toast({ title: "Failed to create expense", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      apiRequest(`/api/marketing/expenses/${id}`, 'PATCH', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/marketing/expenses'] });
      toast({ title: "Expense updated successfully" });
      setDialogOpen(false);
      setEditingExpense(null);
      form.reset();
    },
    onError: () => {
      toast({ title: "Failed to update expense", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/marketing/expenses/${id}`, 'DELETE'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/marketing/expenses'] });
      toast({ title: "Expense deleted successfully" });
    },
    onError: () => {
      toast({ title: "Failed to delete expense", variant: "destructive" });
    },
  });

  const onSubmit = (data: ExpenseFormData) => {
    const payload = {
      ...data,
      amount: parseFloat(data.amount),
      campaignId: data.campaignId || null,
      paidDate: data.paidDate || null,
    };

    if (editingExpense) {
      updateMutation.mutate({ id: editingExpense.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const handleEdit = (expense: MarketingExpense) => {
    setEditingExpense(expense);
    form.reset({
      campaignId: expense.campaignId || '',
      vendor: expense.vendor,
      category: expense.category,
      description: expense.description,
      amount: expense.amount?.toString() || '',
      date: expense.date || '',
      status: expense.status,
      invoiceUrl: expense.invoiceUrl || '',
      poNumber: expense.poNumber || '',
      glAccount: expense.glAccount || '',
      paidDate: expense.paidDate || '',
      notes: expense.notes || '',
    });
    setDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this expense?')) {
      deleteMutation.mutate(id);
    }
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
    setEditingExpense(null);
    form.reset();
  };

  const totalExpenses = expenses.reduce((sum, exp) => sum + parseFloat(exp.amount || '0'), 0);
  const pendingExpenses = expenses.filter(exp => exp.status === 'pending').length;
  const paidExpenses = expenses.filter(exp => exp.status === 'paid').length;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold" data-testid="page-title">Marketing Expenses</h1>
        <Dialog open={dialogOpen} onOpenChange={handleDialogClose}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-expense">
              <Plus className="w-4 h-4 mr-2" />
              Add Expense
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingExpense ? 'Edit Expense' : 'Add Expense'}</DialogTitle>
              <DialogDescription>
                {editingExpense ? 'Update expense details' : 'Record a new marketing expense'}
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="vendor"
                    render={({ field }) => (
                      <FormItem className="col-span-2">
                        <FormLabel>Vendor *</FormLabel>
                        <FormControl>
                          <Input {...field} data-testid="input-vendor" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="campaignId"
                    render={({ field }) => (
                      <FormItem className="col-span-2">
                        <FormLabel>Campaign</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-campaign">
                              <SelectValue placeholder="Select campaign" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="">None</SelectItem>
                            {campaigns.map((campaign) => (
                              <SelectItem key={campaign.id} value={campaign.id}>
                                {campaign.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
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
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-category">
                              <SelectValue placeholder="Select category" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="advertising">Advertising</SelectItem>
                            <SelectItem value="software">Software</SelectItem>
                            <SelectItem value="agency_fees">Agency Fees</SelectItem>
                            <SelectItem value="content_creation">Content Creation</SelectItem>
                            <SelectItem value="events">Events</SelectItem>
                            <SelectItem value="sponsorships">Sponsorships</SelectItem>
                            <SelectItem value="tools">Tools</SelectItem>
                            <SelectItem value="other">Other</SelectItem>
                          </SelectContent>
                        </Select>
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
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-status">
                              <SelectValue placeholder="Select status" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="pending">Pending</SelectItem>
                            <SelectItem value="approved">Approved</SelectItem>
                            <SelectItem value="paid">Paid</SelectItem>
                            <SelectItem value="rejected">Rejected</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="amount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Amount ($) *</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" {...field} data-testid="input-amount" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Date *</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} data-testid="input-date" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="paidDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Paid Date</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} data-testid="input-paid-date" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="poNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>PO Number</FormLabel>
                        <FormControl>
                          <Input {...field} data-testid="input-po-number" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="glAccount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>GL Account</FormLabel>
                        <FormControl>
                          <Input {...field} data-testid="input-gl-account" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="invoiceUrl"
                    render={({ field }) => (
                      <FormItem className="col-span-2">
                        <FormLabel>Invoice URL</FormLabel>
                        <FormControl>
                          <Input {...field} data-testid="input-invoice-url" />
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
                        <FormLabel>Description *</FormLabel>
                        <FormControl>
                          <Textarea {...field} data-testid="input-description" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem className="col-span-2">
                        <FormLabel>Notes</FormLabel>
                        <FormControl>
                          <Textarea {...field} data-testid="input-notes" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <DialogFooter>
                  <Button type="submit" data-testid="button-submit" disabled={createMutation.isPending || updateMutation.isPending}>
                    {(createMutation.isPending || updateMutation.isPending) ? 'Saving...' : (editingExpense ? 'Update' : 'Create')}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="border rounded-lg p-4">
          <div className="text-sm font-medium text-muted-foreground">Total Expenses</div>
          <div className="text-2xl font-bold" data-testid="value-total-expenses">
            ${totalExpenses.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>
        <div className="border rounded-lg p-4">
          <div className="text-sm font-medium text-muted-foreground">Pending Approval</div>
          <div className="text-2xl font-bold" data-testid="value-pending-expenses">{pendingExpenses}</div>
        </div>
        <div className="border rounded-lg p-4">
          <div className="text-sm font-medium text-muted-foreground">Paid</div>
          <div className="text-2xl font-bold" data-testid="value-paid-expenses">{paidExpenses}</div>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-12">Loading expenses...</div>
      ) : expenses.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          No expenses yet. Add your first expense to get started.
        </div>
      ) : (
        <div className="border rounded-lg">
          <div className="overflow-x-auto w-full">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Vendor</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {expenses.map((expense) => (
                <TableRow key={expense.id} data-testid={`row-expense-${expense.id}`}>
                  <TableCell data-testid={`text-date-${expense.id}`}>{expense.date}</TableCell>
                  <TableCell className="font-medium" data-testid={`text-vendor-${expense.id}`}>
                    {expense.vendor}
                  </TableCell>
                  <TableCell data-testid={`text-description-${expense.id}`}>
                    {expense.description}
                  </TableCell>
                  <TableCell data-testid={`text-category-${expense.id}`}>
                    {expense.category?.replace(/_/g, ' ')}
                  </TableCell>
                  <TableCell data-testid={`text-amount-${expense.id}`}>
                    ${parseFloat(expense.amount || '0').toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusBadgeVariant(expense.status)} data-testid={`badge-status-${expense.id}`}>
                      {expense.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(expense)}
                        data-testid={`button-edit-${expense.id}`}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(expense.id)}
                        data-testid={`button-delete-${expense.id}`}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </div>
        </div>
      )}
    </div>
  );
}
