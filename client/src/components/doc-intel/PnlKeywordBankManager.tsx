import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Search, Plus, Trash2, Edit2, Save, X, Database, Filter, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface KeywordRule {
  id: string;
  orgId: string | null;
  keyword: string;
  department: string;
  bucket: string;
  matchType: string;
  priority: number;
  source: string;
  isActive: boolean;
  timesMatched: number;
  createdAt: string;
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

const SOURCE_BADGES: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> = {
  user_verified: { label: "User Verified", variant: "default" },
  manual: { label: "Manual", variant: "secondary" },
  import: { label: "Import", variant: "outline" },
  system: { label: "System", variant: "outline" },
};

export default function PnlKeywordBankManager() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [filterDepartment, setFilterDepartment] = useState<string>("all");
  const [filterBucket, setFilterBucket] = useState<string>("all");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<KeywordRule | null>(null);

  const [newRule, setNewRule] = useState({
    keyword: "",
    department: "",
    bucket: "Expense",
    priority: 50,
  });

  const { data, isLoading, refetch } = useQuery<KeywordBankResponse>({
    queryKey: ["/api/pnl/keyword-bank", filterDepartment, filterBucket, searchTerm],
    queryFn: () => {
      const params = new URLSearchParams();
      if (filterDepartment && filterDepartment !== "all") params.append("department", filterDepartment);
      if (filterBucket && filterBucket !== "all") params.append("bucket", filterBucket);
      if (searchTerm) params.append("search", searchTerm);
      return apiRequest(`/api/pnl/keyword-bank?${params.toString()}`);
    },
  });

  const addMutation = useMutation({
    mutationFn: (rule: typeof newRule) =>
      apiRequest("/api/pnl/keyword-bank", {
        method: "POST",
        body: JSON.stringify(rule),
      }),
    onSuccess: () => {
      toast({ title: "Rule Added", description: "Keyword rule has been added to the bank." });
      queryClient.invalidateQueries({ queryKey: ["/api/pnl/keyword-bank"] });
      setIsAddDialogOpen(false);
      setNewRule({ keyword: "", department: "", bucket: "Expense", priority: 50 });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...updates }: { id: string; department?: string; bucket?: string; priority?: number; isActive?: boolean }) =>
      apiRequest(`/api/pnl/keyword-bank/${id}`, {
        method: "PATCH",
        body: JSON.stringify(updates),
      }),
    onSuccess: () => {
      toast({ title: "Rule Updated", description: "Keyword rule has been updated." });
      queryClient.invalidateQueries({ queryKey: ["/api/pnl/keyword-bank"] });
      setEditingRule(null);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest(`/api/pnl/keyword-bank/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast({ title: "Rule Deleted", description: "Keyword rule has been removed." });
      queryClient.invalidateQueries({ queryKey: ["/api/pnl/keyword-bank"] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const rules = data?.rules ?? [];
  const stats = data?.stats;
  const departments = data?.departments ?? [];
  const buckets = data?.buckets ?? [];

  const filteredRules = rules.filter((rule) => {
    if (searchTerm && !rule.keyword.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                P&L Keyword Bank
              </CardTitle>
              <CardDescription>
                Manage learned department mappings. These rules are used to automatically classify P&L line items during import.
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                <RefreshCw className="h-4 w-4 mr-1" />
                Refresh
              </Button>
              <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="h-4 w-4 mr-1" />
                    Add Rule
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add Keyword Rule</DialogTitle>
                    <DialogDescription>Create a new mapping rule for P&L line items.</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label>Keyword/Phrase</Label>
                      <Input
                        placeholder="e.g., cleaning labor, dock wages"
                        value={newRule.keyword}
                        onChange={(e) => setNewRule((prev) => ({ ...prev, keyword: e.target.value }))}
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Department</Label>
                        <Select
                          value={newRule.department}
                          onValueChange={(val) => setNewRule((prev) => ({ ...prev, department: val }))}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select department" />
                          </SelectTrigger>
                          <SelectContent>
                            {departments.map((dept) => (
                              <SelectItem key={dept} value={dept}>
                                {dept}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Bucket</Label>
                        <Select
                          value={newRule.bucket}
                          onValueChange={(val) => setNewRule((prev) => ({ ...prev, bucket: val }))}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select bucket" />
                          </SelectTrigger>
                          <SelectContent>
                            {buckets.map((bucket) => (
                              <SelectItem key={bucket} value={bucket}>
                                {bucket}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Priority (1-1000)</Label>
                      <Input
                        type="number"
                        min={1}
                        max={1000}
                        value={newRule.priority}
                        onChange={(e) => setNewRule((prev) => ({ ...prev, priority: parseInt(e.target.value) || 50 }))}
                      />
                      <p className="text-xs text-muted-foreground">Higher priority rules are matched first.</p>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button
                      onClick={() => addMutation.mutate(newRule)}
                      disabled={!newRule.keyword || !newRule.department || addMutation.isPending}
                    >
                      Add Rule
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {stats && (
            <div className="flex flex-wrap gap-4 mb-6">
              <div className="text-sm">
                <span className="text-muted-foreground">Total Rules:</span>{" "}
                <span className="font-medium">{stats.total}</span>
              </div>
              {stats.bySource && Object.entries(stats.bySource).map(([source, count]) => (
                <Badge key={source} variant={SOURCE_BADGES[source]?.variant ?? "outline"}>
                  {SOURCE_BADGES[source]?.label ?? source}: {count}
                </Badge>
              ))}
            </div>
          )}

          <div className="flex flex-wrap gap-4 mb-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search keywords..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={filterDepartment} onValueChange={setFilterDepartment}>
              <SelectTrigger className="w-[150px]">
                <Filter className="h-4 w-4 mr-1" />
                <SelectValue placeholder="Department" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Departments</SelectItem>
                {departments.map((dept) => (
                  <SelectItem key={dept} value={dept}>
                    {dept}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterBucket} onValueChange={setFilterBucket}>
              <SelectTrigger className="w-[120px]">
                <SelectValue placeholder="Bucket" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Buckets</SelectItem>
                {buckets.map((bucket) => (
                  <SelectItem key={bucket} value={bucket}>
                    {bucket}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Keyword</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Bucket</TableHead>
                    <TableHead className="text-center">Priority</TableHead>
                    <TableHead className="text-center">Matches</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead className="w-[100px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRules.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                        No keyword rules found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredRules.map((rule) => (
                      <TableRow
                        key={rule.id}
                        className={cn(!rule.isActive && "opacity-50")}
                      >
                        <TableCell className="font-medium">{rule.keyword}</TableCell>
                        <TableCell>{rule.department}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{rule.bucket}</Badge>
                        </TableCell>
                        <TableCell className="text-center tabular-nums">{rule.priority}</TableCell>
                        <TableCell className="text-center tabular-nums">{rule.timesMatched}</TableCell>
                        <TableCell>
                          <Badge variant={SOURCE_BADGES[rule.source]?.variant ?? "outline"}>
                            {SOURCE_BADGES[rule.source]?.label ?? rule.source}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {rule.orgId && (
                            <div className="flex gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => setEditingRule(rule)}
                              >
                                <Edit2 className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:text-destructive"
                                onClick={() => deleteMutation.mutate(rule.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {editingRule && (
        <Dialog open={!!editingRule} onOpenChange={() => setEditingRule(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Keyword Rule</DialogTitle>
              <DialogDescription>Modify the department mapping for "{editingRule.keyword}"</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Department</Label>
                  <Select
                    value={editingRule.department}
                    onValueChange={(val) => setEditingRule((prev) => prev ? { ...prev, department: val } : null)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {departments.map((dept) => (
                        <SelectItem key={dept} value={dept}>
                          {dept}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Bucket</Label>
                  <Select
                    value={editingRule.bucket}
                    onValueChange={(val) => setEditingRule((prev) => prev ? { ...prev, bucket: val } : null)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {buckets.map((bucket) => (
                        <SelectItem key={bucket} value={bucket}>
                          {bucket}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Priority</Label>
                <Input
                  type="number"
                  min={1}
                  max={1000}
                  value={editingRule.priority}
                  onChange={(e) => setEditingRule((prev) => prev ? { ...prev, priority: parseInt(e.target.value) || 50 } : null)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingRule(null)}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (editingRule) {
                    updateMutation.mutate({
                      id: editingRule.id,
                      department: editingRule.department,
                      bucket: editingRule.bucket,
                      priority: editingRule.priority,
                    });
                  }
                }}
                disabled={updateMutation.isPending}
              >
                <Save className="h-4 w-4 mr-1" />
                Save Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
