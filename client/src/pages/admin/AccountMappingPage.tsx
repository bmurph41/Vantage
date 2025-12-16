import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Database, Link2, Plus, Trash2, Settings } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { FkAccount, FkAccountAlias } from "@shared/finance-kernel-schema";

type AliasWithTarget = FkAccountAlias & { targetAccount: FkAccount | null };

export default function AccountMappingPage() {
  const { toast } = useToast();
  const [selectedSourceSystem, setSelectedSourceSystem] = useState<string>("qbo");

  const { data: accounts = [], isLoading: accountsLoading } = useQuery<FkAccount[]>({
    queryKey: ["/api/fk/accounts"],
  });

  const { data: aliases = [], isLoading: aliasesLoading } = useQuery<AliasWithTarget[]>({
    queryKey: ["/api/fk/aliases", selectedSourceSystem],
    queryFn: () => fetch(`/api/fk/aliases?sourceSystem=${selectedSourceSystem}`).then(r => r.json()),
  });

  const { data: stats } = useQuery<{ 
    totalSourceAccounts: number; 
    mappedCount: number; 
    unmappedCount: number; 
    averageConfidence: number 
  }>({
    queryKey: ["/api/fk/aliases/stats", selectedSourceSystem],
    queryFn: () => fetch(`/api/fk/aliases/stats?sourceSystem=${selectedSourceSystem}`).then(r => r.json()),
  });

  const seedAccountsMutation = useMutation({
    mutationFn: () => apiRequest("/api/fk/accounts/seed", { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/fk/accounts"] });
      toast({ title: "Success", description: "Default marina accounts seeded successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateAliasMutation = useMutation({
    mutationFn: ({ aliasId, targetAccountId }: { aliasId: string; targetAccountId: string }) =>
      apiRequest(`/api/fk/aliases/${aliasId}`, { 
        method: "PATCH", 
        body: JSON.stringify({ targetAccountId }) 
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/fk/aliases", selectedSourceSystem] });
      queryClient.invalidateQueries({ queryKey: ["/api/fk/aliases/stats", selectedSourceSystem] });
      toast({ title: "Mapping updated" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteAliasMutation = useMutation({
    mutationFn: (aliasId: string) => apiRequest(`/api/fk/aliases/${aliasId}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/fk/aliases", selectedSourceSystem] });
      queryClient.invalidateQueries({ queryKey: ["/api/fk/aliases/stats", selectedSourceSystem] });
      toast({ title: "Mapping deleted" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const isLoading = accountsLoading || aliasesLoading;

  const groupedAccounts = accounts.reduce((acc, account) => {
    const type = account.accountType;
    if (!acc[type]) acc[type] = [];
    acc[type].push(account);
    return acc;
  }, {} as Record<string, FkAccount[]>);

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Database className="h-6 w-6" />
            Account Mapping
          </h1>
          <p className="text-muted-foreground">
            Map source system accounts to canonical Financial Kernel accounts
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => seedAccountsMutation.mutate()}
            disabled={seedAccountsMutation.isPending}
            data-testid="button-seed-accounts"
          >
            {seedAccountsMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Plus className="h-4 w-4 mr-2" />
            )}
            Seed Default Accounts
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Mappings</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalSourceAccounts || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-green-600">Mapped</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats?.mappedCount || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-orange-600">Unmapped</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{stats?.unmappedCount || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Avg Confidence</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.averageConfidence ? `${(stats.averageConfidence * 100).toFixed(0)}%` : "N/A"}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Canonical Accounts
            </CardTitle>
            <CardDescription>
              Target accounts for mapping ({accounts.length} total)
            </CardDescription>
          </CardHeader>
          <CardContent>
            {accountsLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : accounts.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>No accounts configured.</p>
                <p className="text-sm mt-2">Click "Seed Default Accounts" to create marina-specific accounts.</p>
              </div>
            ) : (
              <div className="space-y-4 max-h-[500px] overflow-auto">
                {Object.entries(groupedAccounts).map(([type, accts]) => (
                  <div key={type}>
                    <h4 className="font-medium text-sm text-muted-foreground uppercase mb-2">
                      {type.replace("_", " ")}
                    </h4>
                    <div className="space-y-1">
                      {accts.map((account) => (
                        <div
                          key={account.id}
                          className="flex items-center justify-between py-1 px-2 rounded hover:bg-muted"
                        >
                          <span className="text-sm">{account.name}</span>
                          <Badge variant="outline" className="text-xs">
                            {account.code}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Link2 className="h-5 w-5" />
                  Account Mappings
                </CardTitle>
                <CardDescription>
                  Source accounts mapped to canonical accounts
                </CardDescription>
              </div>
              <Select value={selectedSourceSystem} onValueChange={setSelectedSourceSystem}>
                <SelectTrigger className="w-40" data-testid="select-source-system">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="qbo">QuickBooks</SelectItem>
                  <SelectItem value="intacct">Intacct</SelectItem>
                  <SelectItem value="netsuite">NetSuite</SelectItem>
                  <SelectItem value="manual">Manual</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : aliases.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>No account mappings found for {selectedSourceSystem.toUpperCase()}.</p>
                <p className="text-sm mt-2">
                  Connect to {selectedSourceSystem.toUpperCase()} and import data to create mappings automatically.
                </p>
              </div>
            ) : (
              <div className="max-h-[500px] overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Source Account</TableHead>
                      <TableHead>Target Account</TableHead>
                      <TableHead className="w-24">Confidence</TableHead>
                      <TableHead className="w-16"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {aliases.map((alias) => (
                      <TableRow key={alias.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{alias.sourceAccountName}</div>
                            <div className="text-xs text-muted-foreground">{alias.sourceAccountId}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Select
                            value={alias.targetAccountId}
                            onValueChange={(value) =>
                              updateAliasMutation.mutate({ aliasId: alias.id, targetAccountId: value })
                            }
                          >
                            <SelectTrigger className="w-full" data-testid={`select-target-${alias.id}`}>
                              <SelectValue placeholder="Select target account" />
                            </SelectTrigger>
                            <SelectContent>
                              {accounts.map((account) => (
                                <SelectItem key={account.id} value={account.id}>
                                  {account.name} ({account.code})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              Number(alias.confidence) >= 0.9
                                ? "default"
                                : Number(alias.confidence) >= 0.7
                                ? "secondary"
                                : "outline"
                            }
                          >
                            {alias.confidence
                              ? `${(Number(alias.confidence) * 100).toFixed(0)}%`
                              : "Manual"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteAliasMutation.mutate(alias.id)}
                            disabled={deleteAliasMutation.isPending}
                            data-testid={`button-delete-${alias.id}`}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
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
      </div>
    </div>
  );
}
