import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import {
  Calculator,
  Plus,
  Search,
  FileDown,
  Edit3,
  Check,
  X,
  Filter,
  Upload,
  Building2,
  AlertCircle,
} from 'lucide-react';

interface Account {
  id: string;
  accountCode: string;
  accountName: string;
  accountType: string;
  parentAccountId: string | null;
  parentAccountName?: string;
  isActive: boolean;
  description: string | null;
  createdAt: string;
}

const ACCOUNT_TYPES = [
  { value: 'asset', label: 'Asset', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' },
  { value: 'liability', label: 'Liability', color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' },
  { value: 'equity', label: 'Equity', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200' },
  { value: 'revenue', label: 'Revenue', color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' },
  { value: 'expense', label: 'Expense', color: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200' },
];

const TEMPLATES = [
  { value: 'marina', label: 'Marina / Waterfront' },
  { value: 'restaurant', label: 'Restaurant / F&B' },
  { value: 'hotel', label: 'Hotel / Hospitality' },
  { value: 'multifamily', label: 'Multifamily Residential' },
];

function getTypeColor(type: string): string {
  return ACCOUNT_TYPES.find((t) => t.value === type)?.color || 'bg-gray-100 text-gray-800';
}

function AddAccountDialog({
  open,
  onOpenChange,
  existingAccounts,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingAccounts: Account[];
}) {
  const { toast } = useToast();
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [type, setType] = useState('revenue');
  const [parentId, setParentId] = useState<string>('');
  const [description, setDescription] = useState('');

  const createMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('POST', '/api/bookkeeping/chart-of-accounts', {
        accountCode: code,
        accountName: name,
        accountType: type,
        parentAccountId: parentId || null,
        description: description || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/bookkeeping/chart-of-accounts'] });
      toast({ title: 'Account Created', description: `${code} - ${name} has been added.` });
      onOpenChange(false);
      setCode('');
      setName('');
      setType('revenue');
      setParentId('');
      setDescription('');
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to Create Account',
        description: error.message || 'Please check your inputs and try again.',
        variant: 'destructive',
      });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add Account</DialogTitle>
          <DialogDescription>
            Add a new account to your chart of accounts
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Account Code</Label>
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="e.g., 4100"
              />
            </div>
            <div className="space-y-2">
              <Label>Account Type</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ACCOUNT_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Account Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Wet Slip Revenue"
            />
          </div>

          <div className="space-y-2">
            <Label>Parent Account (Optional)</Label>
            <Select value={parentId} onValueChange={setParentId}>
              <SelectTrigger>
                <SelectValue placeholder="None (top-level account)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">None</SelectItem>
                {existingAccounts
                  .filter((a) => a.accountType === type)
                  .map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.accountCode} - {a.accountName}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Description (Optional)</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of this account..."
              rows={2}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={() => createMutation.mutate()}
            disabled={!code || !name || createMutation.isPending}
          >
            {createMutation.isPending ? 'Creating...' : 'Create Account'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ImportTemplateDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { toast } = useToast();
  const [template, setTemplate] = useState('marina');

  const importMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('POST', '/api/bookkeeping/chart-of-accounts/import-template', {
        template,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/bookkeeping/chart-of-accounts'] });
      toast({
        title: 'Template Imported',
        description: `Standard ${TEMPLATES.find((t) => t.value === template)?.label} chart of accounts has been imported.`,
      });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: 'Import Failed',
        description: error.message || 'Failed to import template.',
        variant: 'destructive',
      });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Import Template</DialogTitle>
          <DialogDescription>
            Import a standard chart of accounts template for your property type
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Template Type</Label>
            <Select value={template} onValueChange={setTemplate}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TEMPLATES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    <span className="flex items-center gap-2">
                      <Building2 className="h-4 w-4" />
                      {t.label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="text-xs text-muted-foreground bg-muted p-3 rounded-lg">
            This will add standard accounts for the selected industry.
            Existing accounts will not be modified or duplicated.
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => importMutation.mutate()} disabled={importMutation.isPending}>
            {importMutation.isPending ? 'Importing...' : 'Import Template'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function BookkeepingChartOfAccounts() {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<{ accountCode: string; accountName: string; accountType: string }>({
    accountCode: '',
    accountName: '',
    accountType: '',
  });

  const { data: accounts, isLoading } = useQuery<Account[]>({
    queryKey: ['/api/bookkeeping/chart-of-accounts'],
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Account> }) => {
      return apiRequest('PUT', `/api/bookkeeping/chart-of-accounts/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/bookkeeping/chart-of-accounts'] });
      toast({ title: 'Account Updated' });
      setEditingId(null);
    },
    onError: (error: any) => {
      toast({
        title: 'Update Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Default accounts when API returns nothing
  const displayAccounts: Account[] = accounts || [
    { id: '1', accountCode: '1000', accountName: 'Cash & Equivalents', accountType: 'asset', parentAccountId: null, isActive: true, description: null, createdAt: '' },
    { id: '2', accountCode: '1200', accountName: 'Accounts Receivable', accountType: 'asset', parentAccountId: null, isActive: true, description: null, createdAt: '' },
    { id: '3', accountCode: '1500', accountName: 'Fixed Assets', accountType: 'asset', parentAccountId: null, isActive: true, description: null, createdAt: '' },
    { id: '4', accountCode: '2000', accountName: 'Accounts Payable', accountType: 'liability', parentAccountId: null, isActive: true, description: null, createdAt: '' },
    { id: '5', accountCode: '2100', accountName: 'Accrued Liabilities', accountType: 'liability', parentAccountId: null, isActive: true, description: null, createdAt: '' },
    { id: '6', accountCode: '3000', accountName: 'Owner Equity', accountType: 'equity', parentAccountId: null, isActive: true, description: null, createdAt: '' },
    { id: '7', accountCode: '4100', accountName: 'Wet Slip Revenue', accountType: 'revenue', parentAccountId: null, isActive: true, description: 'Monthly and annual wet slip rental income', createdAt: '' },
    { id: '8', accountCode: '4200', accountName: 'Dry Storage Revenue', accountType: 'revenue', parentAccountId: null, isActive: true, description: 'Indoor and outdoor dry storage', createdAt: '' },
    { id: '9', accountCode: '4300', accountName: 'Fuel Sales', accountType: 'revenue', parentAccountId: null, isActive: true, description: 'Gas and diesel fuel sales', createdAt: '' },
    { id: '10', accountCode: '4400', accountName: 'Ship Store Sales', accountType: 'revenue', parentAccountId: null, isActive: true, description: null, createdAt: '' },
    { id: '11', accountCode: '4500', accountName: 'Service Revenue', accountType: 'revenue', parentAccountId: null, isActive: true, description: null, createdAt: '' },
    { id: '12', accountCode: '4600', accountName: 'Boat Rentals', accountType: 'revenue', parentAccountId: null, isActive: true, description: null, createdAt: '' },
    { id: '13', accountCode: '5100', accountName: 'Payroll & Benefits', accountType: 'expense', parentAccountId: null, isActive: true, description: null, createdAt: '' },
    { id: '14', accountCode: '5200', accountName: 'Utilities', accountType: 'expense', parentAccountId: null, isActive: true, description: null, createdAt: '' },
    { id: '15', accountCode: '5300', accountName: 'Insurance', accountType: 'expense', parentAccountId: null, isActive: true, description: null, createdAt: '' },
    { id: '16', accountCode: '5400', accountName: 'Maintenance & Repairs', accountType: 'expense', parentAccountId: null, isActive: true, description: null, createdAt: '' },
    { id: '17', accountCode: '5500', accountName: 'Property Tax', accountType: 'expense', parentAccountId: null, isActive: true, description: null, createdAt: '' },
    { id: '18', accountCode: '5600', accountName: 'Marketing', accountType: 'expense', parentAccountId: null, isActive: false, description: null, createdAt: '' },
  ];

  const filteredAccounts = displayAccounts.filter((acct) => {
    if (filterType !== 'all' && acct.accountType !== filterType) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      return (
        acct.accountCode.toLowerCase().includes(term) ||
        acct.accountName.toLowerCase().includes(term) ||
        acct.accountType.toLowerCase().includes(term)
      );
    }
    return true;
  });

  const startEditing = (acct: Account) => {
    setEditingId(acct.id);
    setEditValues({
      accountCode: acct.accountCode,
      accountName: acct.accountName,
      accountType: acct.accountType,
    });
  };

  const saveEdit = () => {
    if (!editingId) return;
    updateMutation.mutate({ id: editingId, data: editValues });
  };

  const toggleActive = (acct: Account) => {
    updateMutation.mutate({
      id: acct.id,
      data: { isActive: !acct.isActive },
    });
  };

  const typeCounts = ACCOUNT_TYPES.map((t) => ({
    ...t,
    count: displayAccounts.filter((a) => a.accountType === t.value).length,
  }));

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Calculator className="w-5 h-5 text-[#1E4FAB]" />
            Chart of Accounts
          </h2>
          <p className="text-sm text-muted-foreground">
            Manage your general ledger account structure
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setImportDialogOpen(true)}>
            <Upload className="w-4 h-4 mr-2" />
            Import Template
          </Button>
          <Button size="sm" onClick={() => setAddDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Add Account
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-5 gap-3">
        {typeCounts.map((t) => (
          <Card
            key={t.value}
            className={`cursor-pointer transition-all ${filterType === t.value ? 'ring-2 ring-primary' : 'hover:shadow-sm'}`}
            onClick={() => setFilterType(filterType === t.value ? 'all' : t.value)}
          >
            <CardContent className="pt-3 pb-3 text-center">
              <Badge className={t.color}>{t.label}</Badge>
              <div className="text-2xl font-bold mt-1">{t.count}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Search and Filter */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search accounts..."
            className="pl-10"
          />
        </div>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-[150px]">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Filter type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {ACCOUNT_TYPES.map((t) => (
              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="text-sm text-muted-foreground">
          {filteredAccounts.length} of {displayAccounts.length} accounts
        </div>
      </div>

      {/* Accounts Table */}
      <Card>
        <CardContent className="pt-0">
          {filteredAccounts.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <AlertCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p className="font-medium">No accounts found</p>
              <p className="text-sm mt-1">
                {searchTerm ? 'Try adjusting your search term.' : 'Add accounts or import a template to get started.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto w-full">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px]">Code</TableHead>
                  <TableHead>Account Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Parent</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAccounts.map((acct) => (
                  <TableRow key={acct.id} className={!acct.isActive ? 'opacity-50' : ''}>
                    <TableCell className="font-mono text-sm">
                      {editingId === acct.id ? (
                        <Input
                          value={editValues.accountCode}
                          onChange={(e) => setEditValues((v) => ({ ...v, accountCode: e.target.value }))}
                          className="h-8 w-20"
                        />
                      ) : (
                        acct.accountCode
                      )}
                    </TableCell>
                    <TableCell className="font-medium">
                      {editingId === acct.id ? (
                        <Input
                          value={editValues.accountName}
                          onChange={(e) => setEditValues((v) => ({ ...v, accountName: e.target.value }))}
                          className="h-8"
                        />
                      ) : (
                        <div>
                          {acct.accountName}
                          {acct.description && (
                            <p className="text-xs text-muted-foreground">{acct.description}</p>
                          )}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      {editingId === acct.id ? (
                        <Select
                          value={editValues.accountType}
                          onValueChange={(v) => setEditValues((ev) => ({ ...ev, accountType: v }))}
                        >
                          <SelectTrigger className="h-8 w-[120px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {ACCOUNT_TYPES.map((t) => (
                              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Badge className={getTypeColor(acct.accountType)}>
                          {acct.accountType.charAt(0).toUpperCase() + acct.accountType.slice(1)}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {acct.parentAccountName || '--'}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={acct.isActive}
                          onCheckedChange={() => toggleActive(acct)}
                          className="data-[state=checked]:bg-green-500"
                        />
                        <span className="text-xs">{acct.isActive ? 'Active' : 'Inactive'}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {editingId === acct.id ? (
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" onClick={saveEdit} className="h-8 w-8 p-0">
                            <Check className="h-4 w-4 text-green-600" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => setEditingId(null)} className="h-8 w-8 p-0">
                            <X className="h-4 w-4 text-red-600" />
                          </Button>
                        </div>
                      ) : (
                        <Button variant="ghost" size="sm" onClick={() => startEditing(acct)} className="h-8 w-8 p-0">
                          <Edit3 className="h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <AddAccountDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        existingAccounts={displayAccounts}
      />
      <ImportTemplateDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
      />
    </div>
  );
}
