import { useState, useRef } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Upload, Download, Plus, Trash2, Search, TreePine, List, Loader2, FileSpreadsheet,
} from 'lucide-react';

type CoaAccount = {
  id: string;
  accountName: string;
  accountNumber?: string;
  accountType: string;
  detailType?: string;
  parentId?: string | null;
  parentName?: string;
  isActive: boolean;
  source?: string;
  depth?: number;
  children?: CoaAccount[];
};

type ImportResult = {
  imported: number;
  skipped: number;
  errors: string[];
};

const ACCOUNT_TYPES = ['Income', 'COGS', 'Expense', 'Other Income', 'Other Expense'];

function flattenTree(items: CoaAccount[], depth = 0): CoaAccount[] {
  const result: CoaAccount[] = [];
  for (const item of items) {
    result.push({ ...item, depth });
    if (item.children?.length) {
      result.push(...flattenTree(item.children, depth + 1));
    }
  }
  return result;
}

export default function ChartOfAccounts() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [treeView, setTreeView] = useState(false);
  const [typeFilter, setTypeFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [formData, setFormData] = useState({
    accountName: '',
    accountType: 'Expense',
    accountNumber: '',
    detailType: '',
  });

  const { data: accounts = [], isLoading } = useQuery<CoaAccount[]>({
    queryKey: ['/api/coa', treeView ? '?tree=true' : ''],
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/coa/import/csv', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || res.statusText);
      }
      return res.json();
    },
    onSuccess: (data) => {
      setImportResult(data);
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      queryClient.invalidateQueries({ queryKey: ['/api/coa'] });
      toast({ title: 'Import Complete', description: `${data.imported} accounts imported` });
    },
    onError: (err: Error) => {
      toast({ title: 'Import Failed', description: err.message, variant: 'destructive' });
    },
  });

  const addAccountMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      return apiRequest('POST', '/api/coa', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/coa'] });
      toast({ title: 'Success', description: 'Account added successfully' });
      setIsAddDialogOpen(false);
      setFormData({ accountName: '', accountType: 'Expense', accountNumber: '', detailType: '' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to add account', variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest('DELETE', `/api/coa/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/coa'] });
      toast({ title: 'Deleted', description: 'Account removed' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to delete account', variant: 'destructive' });
    },
  });

  const displayAccounts = (() => {
    let list: CoaAccount[];
    if (treeView && accounts.length > 0 && accounts[0]?.children !== undefined) {
      list = flattenTree(accounts);
    } else {
      list = accounts;
    }

    if (typeFilter !== 'All') {
      list = list.filter((a) => a.accountType === typeFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((a) => a.accountName.toLowerCase().includes(q));
    }
    return list;
  })();

  return (
    <div className="container mx-auto py-4 max-w-5xl space-y-4">
      <div className="flex items-center gap-2.5 mb-1">
        <FileSpreadsheet className="h-6 w-6 text-muted-foreground" />
        <div>
          <h1 className="text-xl font-bold leading-tight">Chart of Accounts</h1>
          <p className="text-sm text-muted-foreground">Manage your chart of accounts for financial normalization</p>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-2 pt-3 px-4">
          <div className="flex items-center gap-2">
            <Upload className="h-4 w-4 text-primary" />
            <CardTitle className="text-sm">Import COA</CardTitle>
          </div>
          <CardDescription className="text-xs">Upload a CSV file to import accounts</CardDescription>
        </CardHeader>
        <CardContent className="px-4 pb-3 pt-0">
          <div className="flex flex-wrap items-center gap-3">
            <Input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              className="max-w-xs h-8 text-sm"
              onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
            />
            <Button
              size="sm"
              className="h-8"
              disabled={!selectedFile || uploadMutation.isPending}
              onClick={() => selectedFile && uploadMutation.mutate(selectedFile)}
            >
              {uploadMutation.isPending && <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />}
              Upload CSV
            </Button>
            <a href="/api/coa/template" download>
              <Button variant="outline" size="sm" className="h-8">
                <Download className="mr-1.5 h-3 w-3" />
                Download Template
              </Button>
            </a>
          </div>
          {importResult && (
            <div className="mt-3 p-3 rounded-md bg-muted text-sm space-y-1">
              <p><span className="font-medium text-green-600 dark:text-green-400">{importResult.imported}</span> imported</p>
              <p><span className="font-medium text-amber-600 dark:text-amber-400">{importResult.skipped}</span> skipped</p>
              {importResult.errors.length > 0 && (
                <div className="text-red-600 dark:text-red-400">
                  {importResult.errors.map((err, i) => (
                    <p key={i} className="text-xs">{err}</p>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2 pt-3 px-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-sm">Accounts</CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant={treeView ? 'default' : 'outline'}
                size="sm"
                className="h-7 text-xs"
                onClick={() => setTreeView(!treeView)}
              >
                {treeView ? <TreePine className="mr-1 h-3 w-3" /> : <List className="mr-1 h-3 w-3" />}
                {treeView ? 'Tree View' : 'Flat View'}
              </Button>
              <Button size="sm" className="h-7 text-xs" onClick={() => setIsAddDialogOpen(true)}>
                <Plus className="mr-1 h-3 w-3" />
                Add Account
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-4 pb-3 pt-0">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <div className="relative flex-1 min-w-[200px] max-w-xs">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search accounts..."
                className="pl-8 h-8 text-sm"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[140px] h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="All">All Types</SelectItem>
                <SelectItem value="Income">Income</SelectItem>
                <SelectItem value="COGS">COGS</SelectItem>
                <SelectItem value="Expense">Expense</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          ) : displayAccounts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              <p>No accounts found.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs py-1.5">Account #</TableHead>
                    <TableHead className="text-xs py-1.5">Name</TableHead>
                    <TableHead className="text-xs py-1.5">Type</TableHead>
                    <TableHead className="text-xs py-1.5">Detail Type</TableHead>
                    <TableHead className="text-xs py-1.5">Parent</TableHead>
                    <TableHead className="text-xs py-1.5">Active</TableHead>
                    <TableHead className="text-xs py-1.5">Source</TableHead>
                    <TableHead className="text-xs py-1.5 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayAccounts.map((account) => (
                    <TableRow key={account.id}>
                      <TableCell className="py-1.5 text-sm font-mono">{account.accountNumber || '—'}</TableCell>
                      <TableCell
                        className="py-1.5 text-sm font-medium"
                        style={{ paddingLeft: treeView && account.depth ? `${account.depth * 24 + 16}px` : undefined }}
                      >
                        {account.accountName}
                      </TableCell>
                      <TableCell className="py-1.5">
                        <Badge variant="outline" className="text-xs">{account.accountType}</Badge>
                      </TableCell>
                      <TableCell className="py-1.5 text-sm text-muted-foreground">{account.detailType || '—'}</TableCell>
                      <TableCell className="py-1.5 text-sm text-muted-foreground">{account.parentName || '—'}</TableCell>
                      <TableCell className="py-1.5">
                        <Badge variant={account.isActive ? 'default' : 'secondary'} className="text-xs">
                          {account.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-1.5 text-sm text-muted-foreground">{account.source || '—'}</TableCell>
                      <TableCell className="py-1.5 text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => deleteMutation.mutate(account.id)}
                          disabled={deleteMutation.isPending}
                        >
                          <Trash2 className="h-3.5 w-3.5 text-red-500" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Account</DialogTitle>
            <DialogDescription>Add a new account to the chart of accounts</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">Account Name *</label>
              <Input
                className="mt-1"
                value={formData.accountName}
                onChange={(e) => setFormData({ ...formData, accountName: e.target.value })}
                placeholder="e.g. Slip Revenue"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Account Type</label>
              <Select value={formData.accountType} onValueChange={(val) => setFormData({ ...formData, accountType: val })}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ACCOUNT_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Account Number</label>
              <Input
                className="mt-1"
                value={formData.accountNumber}
                onChange={(e) => setFormData({ ...formData, accountNumber: e.target.value })}
                placeholder="e.g. 4000"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Detail Type</label>
              <Input
                className="mt-1"
                value={formData.detailType}
                onChange={(e) => setFormData({ ...formData, detailType: e.target.value })}
                placeholder="e.g. Service Fee Income"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={() => {
                if (!formData.accountName.trim()) {
                  toast({ title: 'Error', description: 'Account name is required', variant: 'destructive' });
                  return;
                }
                addAccountMutation.mutate(formData);
              }}
              disabled={addAccountMutation.isPending}
            >
              {addAccountMutation.isPending && <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />}
              Add Account
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
