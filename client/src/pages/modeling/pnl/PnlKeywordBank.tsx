import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Plus, Search, Trash2, Edit, Database, AlertCircle, ArrowLeft } from "lucide-react";
import { Link } from "wouter";

interface KeywordRule {
  id: string;
  orgId: string | null;
  department: string;
  bucket: string;
  keyword: string;
  matchType: string;
  priority: number;
  canonicalLineItemId: string | null;
  isActive: boolean;
  source: string;
  timesMatched: number;
  createdAt: string;
  updatedAt: string;
}

interface KeywordBankResponse {
  rules: KeywordRule[];
  stats: {
    total: number;
    byDepartment: Record<string, number>;
    byBucket: Record<string, number>;
    bySource: Record<string, number>;
  };
  departments: string[];
  buckets: string[];
}

export default function PnlKeywordBank() {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState<string>("");
  const [bucketFilter, setBucketFilter] = useState<string>("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<KeywordRule | null>(null);

  const [newKeyword, setNewKeyword] = useState("");
  const [newDepartment, setNewDepartment] = useState("");
  const [newBucket, setNewBucket] = useState("");
  const [newMatchType, setNewMatchType] = useState("phrase");
  const [newPriority, setNewPriority] = useState("50");

  const { data, isLoading, refetch } = useQuery<KeywordBankResponse>({
    queryKey: ["/api/pnl/keyword-bank", departmentFilter, bucketFilter, searchTerm],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (departmentFilter) params.set("department", departmentFilter);
      if (bucketFilter) params.set("bucket", bucketFilter);
      if (searchTerm) params.set("search", searchTerm);
      const res = await fetch(`/api/pnl/keyword-bank?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch keyword bank");
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: { keyword: string; department: string; bucket: string; matchType: string; priority: number }) => {
      return apiRequest("/api/pnl/keyword-bank", { method: "POST", body: JSON.stringify(data) });
    },
    onSuccess: () => {
      toast({ title: "Keyword rule created successfully" });
      setIsAddDialogOpen(false);
      resetForm();
      refetch();
    },
    onError: (error: any) => {
      toast({ title: "Failed to create keyword rule", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ ruleId, data }: { ruleId: string; data: any }) => {
      return apiRequest(`/api/pnl/keyword-bank/${ruleId}`, { method: "PATCH", body: JSON.stringify(data) });
    },
    onSuccess: () => {
      toast({ title: "Keyword rule updated successfully" });
      setEditingRule(null);
      refetch();
    },
    onError: (error: any) => {
      toast({ title: "Failed to update keyword rule", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (ruleId: string) => {
      return apiRequest(`/api/pnl/keyword-bank/${ruleId}`, { method: "DELETE" });
    },
    onSuccess: () => {
      toast({ title: "Keyword rule deleted successfully" });
      refetch();
    },
    onError: (error: any) => {
      toast({ title: "Failed to delete keyword rule", description: error.message, variant: "destructive" });
    },
  });

  const seedDefaultMutation = useMutation({
    mutationFn: async (isGlobal: boolean) => {
      return apiRequest("/api/pnl/keyword-bank/seed-default", { 
        method: "POST", 
        body: JSON.stringify({ isGlobal }) 
      });
    },
    onSuccess: (data: any) => {
      toast({ title: "Keyword bank seeded", description: `Imported: ${data.imported}, Skipped: ${data.skipped}` });
      refetch();
    },
    onError: (error: any) => {
      toast({ title: "Failed to seed keyword bank", description: error.message, variant: "destructive" });
    },
  });

  const resetForm = () => {
    setNewKeyword("");
    setNewDepartment("");
    setNewBucket("");
    setNewMatchType("phrase");
    setNewPriority("50");
  };

  const handleCreate = () => {
    if (!newKeyword || !newDepartment || !newBucket) {
      toast({ title: "Please fill in all required fields", variant: "destructive" });
      return;
    }
    createMutation.mutate({
      keyword: newKeyword,
      department: newDepartment,
      bucket: newBucket,
      matchType: newMatchType,
      priority: parseInt(newPriority) || 50,
    });
  };

  const getMatchTypeBadgeColor = (matchType: string) => {
    switch (matchType) {
      case "exact": return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100";
      case "phrase": return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100";
      case "token": return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100";
      case "regex": return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-100";
      default: return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-100";
    }
  };

  const getSourceBadgeColor = (source: string) => {
    switch (source) {
      case "seed": return "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-100";
      case "manual": return "bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-100";
      case "learned": return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-100";
      case "import": return "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-100";
      case "observed": return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-100";
      default: return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-100";
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-4 mb-4">
        <Link href="/modeling/pnl/upload">
          <Button variant="ghost" size="sm" data-testid="link-back-pnl">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to P&L Upload
          </Button>
        </Link>
      </div>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-xl font-semibold" data-testid="text-keyword-bank-title">Keyword Bank</h2>
            <p className="text-sm text-muted-foreground">
              Manage keyword rules for automatic P&L line item classification. Rules improve AI parsing accuracy over time.
            </p>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={() => seedDefaultMutation.mutate(false)}
              disabled={seedDefaultMutation.isPending}
              data-testid="button-seed-default"
            >
              <Database className="h-4 w-4 mr-2" />
              Seed Default Rules
            </Button>
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button data-testid="button-add-rule">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Rule
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Keyword Rule</DialogTitle>
                  <DialogDescription>
                    Create a new keyword rule for P&L classification.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="keyword">Keyword</Label>
                    <Input
                      id="keyword"
                      value={newKeyword}
                      onChange={(e) => setNewKeyword(e.target.value)}
                      placeholder="e.g., slip rental income"
                      data-testid="input-keyword"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Department</Label>
                      <Select value={newDepartment} onValueChange={setNewDepartment}>
                        <SelectTrigger data-testid="select-department">
                          <SelectValue placeholder="Select department" />
                        </SelectTrigger>
                        <SelectContent>
                          {data?.departments?.map((dept) => (
                            <SelectItem key={dept} value={dept} data-testid={`select-item-department-${dept}`}>{dept}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Bucket</Label>
                      <Select value={newBucket} onValueChange={setNewBucket}>
                        <SelectTrigger data-testid="select-bucket">
                          <SelectValue placeholder="Select bucket" />
                        </SelectTrigger>
                        <SelectContent>
                          {data?.buckets?.map((bucket) => (
                            <SelectItem key={bucket} value={bucket} data-testid={`select-item-bucket-${bucket}`}>{bucket}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Match Type</Label>
                      <Select value={newMatchType} onValueChange={setNewMatchType}>
                        <SelectTrigger data-testid="select-match-type">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="exact" data-testid="select-item-match-exact">Exact (0.98)</SelectItem>
                          <SelectItem value="phrase" data-testid="select-item-match-phrase">Phrase (0.92)</SelectItem>
                          <SelectItem value="token" data-testid="select-item-match-token">Token (0.80)</SelectItem>
                          <SelectItem value="regex" data-testid="select-item-match-regex">Regex (0.85)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="priority">Priority (1-1000)</Label>
                      <Input
                        id="priority"
                        type="number"
                        min="1"
                        max="1000"
                        value={newPriority}
                        onChange={(e) => setNewPriority(e.target.value)}
                        data-testid="input-priority"
                      />
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsAddDialogOpen(false)} data-testid="button-cancel-add">Cancel</Button>
                  <Button onClick={handleCreate} disabled={createMutation.isPending} data-testid="button-create-rule">
                    Create Rule
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {data?.stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card data-testid="card-total-rules">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Rules</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="text-total-rules">{data.stats.total}</div>
              </CardContent>
            </Card>
            <Card data-testid="card-departments">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Departments</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="text-departments-count">{Object.keys(data.stats.byDepartment).length}</div>
              </CardContent>
            </Card>
            <Card data-testid="card-from-seed">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">From Seed</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="text-seed-count">{data.stats.bySource?.seed || 0}</div>
              </CardContent>
            </Card>
            <Card data-testid="card-learned">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Learned</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="text-learned-count">{data.stats.bySource?.learned || 0}</div>
              </CardContent>
            </Card>
          </div>
        )}

        <Card>
          <CardHeader className="pb-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search keywords..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                  data-testid="input-search"
                />
              </div>
              <Select value={departmentFilter || "all"} onValueChange={(v) => setDepartmentFilter(v === "all" ? "" : v)}>
                <SelectTrigger className="w-[180px]" data-testid="filter-department">
                  <SelectValue placeholder="All departments" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" data-testid="filter-item-department-all">All departments</SelectItem>
                  {data?.departments?.map((dept) => (
                    <SelectItem key={dept} value={dept} data-testid={`filter-item-department-${dept}`}>{dept}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={bucketFilter || "all"} onValueChange={(v) => setBucketFilter(v === "all" ? "" : v)}>
                <SelectTrigger className="w-[180px]" data-testid="filter-bucket">
                  <SelectValue placeholder="All buckets" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" data-testid="filter-item-bucket-all">All buckets</SelectItem>
                  {data?.buckets?.map((bucket) => (
                    <SelectItem key={bucket} value={bucket} data-testid={`filter-item-bucket-${bucket}`}>{bucket}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading keyword rules...</div>
            ) : !data?.rules?.length ? (
              <div className="text-center py-8">
                <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No keyword rules found.</p>
                <p className="text-sm text-muted-foreground mt-2">
                  Click "Seed Default Rules" to import the standard keyword bank, or add rules manually.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Keyword</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead>Bucket</TableHead>
                      <TableHead>Match Type</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead className="text-right">Times Matched</TableHead>
                      <TableHead className="w-[100px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.rules.map((rule) => (
                      <TableRow key={rule.id} data-testid={`row-rule-${rule.id}`}>
                        <TableCell className="font-medium max-w-[200px] truncate" title={rule.keyword} data-testid={`text-keyword-${rule.id}`}>
                          {rule.keyword}
                        </TableCell>
                        <TableCell data-testid={`text-department-${rule.id}`}>{rule.department}</TableCell>
                        <TableCell data-testid={`text-bucket-${rule.id}`}>{rule.bucket}</TableCell>
                        <TableCell data-testid={`text-matchtype-${rule.id}`}>
                          <Badge variant="secondary" className={getMatchTypeBadgeColor(rule.matchType)}>
                            {rule.matchType}
                          </Badge>
                        </TableCell>
                        <TableCell data-testid={`text-priority-${rule.id}`}>{rule.priority}</TableCell>
                        <TableCell data-testid={`text-source-${rule.id}`}>
                          <Badge variant="outline" className={getSourceBadgeColor(rule.source)}>
                            {rule.source}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right" data-testid={`text-matched-${rule.id}`}>{rule.timesMatched}</TableCell>
                        <TableCell>
                          {rule.orgId && (
                            <div className="flex gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setEditingRule(rule)}
                                data-testid={`button-edit-${rule.id}`}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => deleteMutation.mutate(rule.id)}
                                data-testid={`button-delete-${rule.id}`}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
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

        <Dialog open={!!editingRule} onOpenChange={(open) => !open && setEditingRule(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Keyword Rule</DialogTitle>
              <DialogDescription>Update the keyword rule configuration.</DialogDescription>
            </DialogHeader>
            {editingRule && (
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Keyword</Label>
                  <Input value={editingRule.keyword} disabled className="bg-muted" data-testid="input-edit-keyword" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Department</Label>
                    <Select 
                      value={editingRule.department} 
                      onValueChange={(val) => setEditingRule({ ...editingRule, department: val })}
                    >
                      <SelectTrigger data-testid="select-edit-department">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {data?.departments?.map((dept) => (
                          <SelectItem key={dept} value={dept} data-testid={`select-item-edit-department-${dept}`}>{dept}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Bucket</Label>
                    <Select 
                      value={editingRule.bucket} 
                      onValueChange={(val) => setEditingRule({ ...editingRule, bucket: val })}
                    >
                      <SelectTrigger data-testid="select-edit-bucket">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {data?.buckets?.map((bucket) => (
                          <SelectItem key={bucket} value={bucket} data-testid={`select-item-edit-bucket-${bucket}`}>{bucket}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Match Type</Label>
                    <Select 
                      value={editingRule.matchType} 
                      onValueChange={(val) => setEditingRule({ ...editingRule, matchType: val })}
                    >
                      <SelectTrigger data-testid="select-edit-match-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="exact" data-testid="select-item-edit-match-exact">Exact (0.98)</SelectItem>
                        <SelectItem value="phrase" data-testid="select-item-edit-match-phrase">Phrase (0.92)</SelectItem>
                        <SelectItem value="token" data-testid="select-item-edit-match-token">Token (0.80)</SelectItem>
                        <SelectItem value="regex" data-testid="select-item-edit-match-regex">Regex (0.85)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Priority</Label>
                    <Input
                      type="number"
                      min="1"
                      max="1000"
                      value={editingRule.priority}
                      onChange={(e) => setEditingRule({ ...editingRule, priority: parseInt(e.target.value) || 50 })}
                      data-testid="input-edit-priority"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="isActive"
                    checked={editingRule.isActive}
                    onChange={(e) => setEditingRule({ ...editingRule, isActive: e.target.checked })}
                    className="h-4 w-4"
                    data-testid="checkbox-edit-active"
                  />
                  <Label htmlFor="isActive">Active</Label>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingRule(null)} data-testid="button-cancel-edit">Cancel</Button>
              <Button
                onClick={() => {
                  if (editingRule) {
                    updateMutation.mutate({
                      ruleId: editingRule.id,
                      data: {
                        department: editingRule.department,
                        bucket: editingRule.bucket,
                        matchType: editingRule.matchType,
                        priority: editingRule.priority,
                        isActive: editingRule.isActive,
                      },
                    });
                  }
                }}
                disabled={updateMutation.isPending}
                data-testid="button-save-edit"
              >
                Save Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
