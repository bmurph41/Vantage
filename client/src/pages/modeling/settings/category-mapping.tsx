import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Search, Sparkles, Loader2, Link2, Unlink, Check, ArrowRight, BarChart3,
} from 'lucide-react';

type CoaAccount = {
  id: string;
  accountName: string;
  accountNumber?: string;
  accountType: string;
  detailType?: string;
  isActive: boolean;
  mappingId?: string;
  standardAccountId?: string;
  standardAccountName?: string;
};

type MappingProgress = {
  total: number;
  mapped: number;
  unmapped: number;
  percentage: number;
  byType: { type: string; total: number; mapped: number; percentage: number }[];
};

type StandardAccount = {
  id: string;
  name: string;
  categoryGroup: string;
  accountType: string;
};

type Suggestion = {
  id: string;
  coaAccountId: string;
  suggestedStandardAccountId: string;
  suggestedStandardAccountName: string;
  confidence: number;
  status: string;
};

export default function CategoryMapping() {
  const { toast } = useToast();
  const [selectedAccount, setSelectedAccount] = useState<CoaAccount | null>(null);
  const [mappingFilter, setMappingFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStandardAccountId, setSelectedStandardAccountId] = useState<string>('');

  const { data: progress, isLoading: progressLoading } = useQuery<MappingProgress>({
    queryKey: ['/api/coa/mapping/progress'],
  });

  const { data: accounts = [], isLoading: accountsLoading } = useQuery<CoaAccount[]>({
    queryKey: ['/api/coa'],
  });

  const { data: standardAccounts = [] } = useQuery<StandardAccount[]>({
    queryKey: ['/api/coa/standard-accounts'],
  });

  const { data: suggestions = [] } = useQuery<Suggestion[]>({
    queryKey: ['/api/coa/mapping/suggestions?status=pending'],
  });

  const generateSuggestionsMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('POST', '/api/coa/mapping/suggestions/generate');
    },
    onSuccess: async (res) => {
      const data = await res.json();
      queryClient.invalidateQueries({ queryKey: ['/api/coa/mapping/suggestions'] });
      queryClient.invalidateQueries({ queryKey: ['/api/coa/mapping/progress'] });
      toast({ title: 'Suggestions Generated', description: `${data.count || 0} suggestions created` });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to generate suggestions', variant: 'destructive' });
    },
  });

  const saveMappingMutation = useMutation({
    mutationFn: async (data: { coaAccountId: number; standardAccountId: number }) => {
      return apiRequest('POST', '/api/coa/mapping', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/coa'] });
      queryClient.invalidateQueries({ queryKey: ['/api/coa/mapping/progress'] });
      toast({ title: 'Mapped', description: 'Account mapping saved' });
      setSelectedStandardAccountId('');
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to save mapping', variant: 'destructive' });
    },
  });

  const removeMappingMutation = useMutation({
    mutationFn: async (mappingId: number) => {
      return apiRequest('DELETE', `/api/coa/mapping/${mappingId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/coa'] });
      queryClient.invalidateQueries({ queryKey: ['/api/coa/mapping/progress'] });
      toast({ title: 'Removed', description: 'Mapping removed' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to remove mapping', variant: 'destructive' });
    },
  });

  const acceptSuggestionMutation = useMutation({
    mutationFn: async (suggestion: Suggestion) => {
      return apiRequest('POST', '/api/coa/mapping', {
        coaAccountId: suggestion.coaAccountId,
        standardAccountId: suggestion.suggestedStandardAccountId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/coa'] });
      queryClient.invalidateQueries({ queryKey: ['/api/coa/mapping/suggestions'] });
      queryClient.invalidateQueries({ queryKey: ['/api/coa/mapping/progress'] });
      toast({ title: 'Accepted', description: 'Suggestion accepted and mapping saved' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to accept suggestion', variant: 'destructive' });
    },
  });

  const filteredAccounts = accounts.filter((a) => {
    if (mappingFilter === 'mapped' && !a.mappingId) return false;
    if (mappingFilter === 'unmapped' && a.mappingId) return false;
    if (typeFilter !== 'All' && a.accountType !== typeFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      if (!a.accountName.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const accountSuggestions = selectedAccount
    ? suggestions.filter((s) => s.coaAccountId === selectedAccount.id)
    : [];

  const groupedStandardAccounts = standardAccounts.reduce<Record<string, StandardAccount[]>>((acc, sa) => {
    const group = sa.categoryGroup || 'Other';
    if (!acc[group]) acc[group] = [];
    acc[group].push(sa);
    return acc;
  }, {});

  return (
    <div className="container mx-auto py-4 max-w-6xl space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-1">
        <div className="flex items-center gap-2.5">
          <Link2 className="h-6 w-6 text-muted-foreground" />
          <div>
            <h1 className="text-xl font-bold leading-tight">Category Mapping</h1>
            <p className="text-sm text-muted-foreground">Map your accounts to standard categories for normalization</p>
          </div>
        </div>
        <Button
          size="sm"
          className="h-8"
          onClick={() => generateSuggestionsMutation.mutate()}
          disabled={generateSuggestionsMutation.isPending}
        >
          {generateSuggestionsMutation.isPending ? (
            <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
          ) : (
            <Sparkles className="mr-1.5 h-3 w-3" />
          )}
          Generate Suggestions
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-2 pt-3 px-4">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" />
            <CardTitle className="text-sm">Mapping Progress</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="px-4 pb-3 pt-0">
          {progressLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          ) : progress ? (
            <div className="space-y-3">
              <div className="flex items-center gap-4 text-sm">
                <span><span className="font-medium">{progress.total}</span> total</span>
                <span className="text-green-600 dark:text-green-400"><span className="font-medium">{progress.mapped}</span> mapped</span>
                <span className="text-amber-600 dark:text-amber-400"><span className="font-medium">{progress.unmapped}</span> unmapped</span>
              </div>
              <Progress value={progress.percentage} className="h-2" />
              <p className="text-xs text-muted-foreground">{Math.round(progress.percentage)}% complete</p>
              {progress.byType?.length > 0 && (
                <div className="grid gap-2 sm:grid-cols-3 mt-2">
                  {progress.byType.map((bt) => (
                    <div key={bt.type} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="font-medium">{bt.type}</span>
                        <span className="text-muted-foreground">{bt.mapped}/{bt.total}</span>
                      </div>
                      <Progress value={bt.percentage} className="h-1.5" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No progress data available</p>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <Card className="h-full">
            <CardHeader className="pb-2 pt-3 px-4">
              <CardTitle className="text-sm">Accounts</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3 pt-0">
              <Tabs value={mappingFilter} onValueChange={setMappingFilter} className="mb-3">
                <TabsList className="h-8">
                  <TabsTrigger value="all" className="text-xs h-6">All</TabsTrigger>
                  <TabsTrigger value="unmapped" className="text-xs h-6">Unmapped</TabsTrigger>
                  <TabsTrigger value="mapped" className="text-xs h-6">Mapped</TabsTrigger>
                </TabsList>
              </Tabs>
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <div className="relative flex-1 min-w-[180px]">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Search..."
                    className="pl-8 h-8 text-sm"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="w-[120px] h-8 text-sm">
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
              {accountsLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <Skeleton key={i} className="h-10 w-full" />
                  ))}
                </div>
              ) : filteredAccounts.length === 0 ? (
                <p className="text-center py-6 text-sm text-muted-foreground">No accounts found</p>
              ) : (
                <div className="space-y-1 max-h-[500px] overflow-y-auto">
                  {filteredAccounts.map((account) => (
                    <div
                      key={account.id}
                      className={`flex items-center justify-between p-2 rounded-md cursor-pointer border transition-colors ${
                        selectedAccount?.id === account.id
                          ? 'border-primary bg-primary/5'
                          : 'border-transparent hover:bg-muted'
                      }`}
                      onClick={() => {
                        setSelectedAccount(account);
                        setSelectedStandardAccountId(account.standardAccountId ? String(account.standardAccountId) : '');
                      }}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{account.accountName}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">{account.accountType}</Badge>
                          {account.accountNumber && (
                            <span className="text-[10px] text-muted-foreground font-mono">#{account.accountNumber}</span>
                          )}
                        </div>
                      </div>
                      <Badge
                        variant={account.mappingId ? 'default' : 'secondary'}
                        className={`text-[10px] ml-2 ${
                          account.mappingId
                            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 hover:bg-green-100'
                            : 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 hover:bg-amber-100'
                        }`}
                      >
                        {account.mappingId ? 'Mapped' : 'Unmapped'}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2">
          <Card className="h-full">
            <CardHeader className="pb-2 pt-3 px-4">
              <CardTitle className="text-sm">Mapping Panel</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3 pt-0">
              {!selectedAccount ? (
                <div className="text-center py-12 text-muted-foreground">
                  <ArrowRight className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Select an account to map</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-1">
                    <p className="font-medium text-sm">{selectedAccount.accountName}</p>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">{selectedAccount.accountType}</Badge>
                      {selectedAccount.accountNumber && (
                        <span className="text-xs text-muted-foreground font-mono">#{selectedAccount.accountNumber}</span>
                      )}
                    </div>
                  </div>

                  {selectedAccount.standardAccountName && (
                    <div className="p-2 rounded-md bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800">
                      <p className="text-xs text-muted-foreground">Current Mapping</p>
                      <p className="text-sm font-medium text-green-700 dark:text-green-300">{selectedAccount.standardAccountName}</p>
                    </div>
                  )}

                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Standard Account</label>
                    <Select value={selectedStandardAccountId} onValueChange={setSelectedStandardAccountId}>
                      <SelectTrigger className="mt-1 h-8 text-sm">
                        <SelectValue placeholder="Select standard account..." />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(groupedStandardAccounts).map(([group, items]) => (
                          <div key={group}>
                            <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">{group}</div>
                            {items.map((sa) => (
                              <SelectItem key={sa.id} value={String(sa.id)}>{sa.name}</SelectItem>
                            ))}
                          </div>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="h-8"
                      disabled={!selectedStandardAccountId || saveMappingMutation.isPending}
                      onClick={() => {
                        saveMappingMutation.mutate({
                          coaAccountId: selectedAccount.id,
                          standardAccountId: Number(selectedStandardAccountId),
                        });
                      }}
                    >
                      {saveMappingMutation.isPending && <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />}
                      Save Mapping
                    </Button>
                    {selectedAccount.mappingId && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8"
                        disabled={removeMappingMutation.isPending}
                        onClick={() => removeMappingMutation.mutate(selectedAccount.mappingId!)}
                      >
                        <Unlink className="mr-1.5 h-3 w-3" />
                        Remove
                      </Button>
                    )}
                  </div>

                  {accountSuggestions.length > 0 && (
                    <div className="space-y-2 pt-2 border-t">
                      <p className="text-xs font-medium text-muted-foreground">Suggestions</p>
                      {accountSuggestions.map((s) => (
                        <div key={s.id} className="flex items-center justify-between p-2 rounded-md bg-muted">
                          <div>
                            <p className="text-sm font-medium">{s.suggestedStandardAccountName}</p>
                            <p className="text-[10px] text-muted-foreground">{Math.round(s.confidence * 100)}% confidence</p>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            disabled={acceptSuggestionMutation.isPending}
                            onClick={() => acceptSuggestionMutation.mutate(s)}
                          >
                            <Check className="mr-1 h-3 w-3" />
                            Accept
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
