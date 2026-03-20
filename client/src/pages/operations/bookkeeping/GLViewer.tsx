import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BookOpen,
  Plus,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface GlEntry {
  id: string;
  marinaId: string;
  accountName: string;
  accountType: string;
  amount: string;
  periodStart: string;
  periodEnd: string;
  source: string;
  notes: string | null;
  createdAt: string;
}

interface OwnedAsset {
  id: string;
  name: string;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

const ACCOUNT_TYPES = ["revenue", "expense", "asset", "liability", "equity"] as const;
const PAGE_SIZE = 25;

export default function GLViewer() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [page, setPage] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Form state for new entry
  const [formMarinaId, setFormMarinaId] = useState("");
  const [formAccountName, setFormAccountName] = useState("");
  const [formAccountType, setFormAccountType] = useState<string>("revenue");
  const [formAmount, setFormAmount] = useState("");
  const [formPeriodStart, setFormPeriodStart] = useState("");
  const [formPeriodEnd, setFormPeriodEnd] = useState("");
  const [formNotes, setFormNotes] = useState("");

  // Fetch owned assets for marina selector
  const { data: ownedAssets = [] } = useQuery<OwnedAsset[]>({
    queryKey: ["/api/operations-context/assets/owned"],
  });

  // Build query params
  const buildQueryString = () => {
    const params = new URLSearchParams();
    params.set("limit", String(PAGE_SIZE));
    params.set("offset", String(page * PAGE_SIZE));
    if (filterType && filterType !== "all") params.set("accountType", filterType);
    if (startDate) params.set("startDate", startDate);
    if (endDate) params.set("endDate", endDate);
    return params.toString();
  };

  const {
    data: glData,
    isLoading,
  } = useQuery<{ rows: GlEntry[]; total: number }>({
    queryKey: ["/api/bookkeeping/gl", filterType, startDate, endDate, page],
    queryFn: async () => {
      const res = await fetch(`/api/bookkeeping/gl?${buildQueryString()}`);
      if (!res.ok) throw new Error("Failed to fetch GL entries");
      return res.json();
    },
  });

  const entries = glData?.rows ?? [];
  const total = glData?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  // Filter by search term client-side (account name)
  const filtered = searchTerm
    ? entries.filter((e) =>
        e.accountName.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : entries;

  // Create entry mutation
  const createMutation = useMutation({
    mutationFn: async (data: Record<string, string>) => {
      const res = await fetch("/api/bookkeeping/gl", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create entry");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "GL entry created successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/bookkeeping/gl"] });
      queryClient.invalidateQueries({ queryKey: ["/api/bookkeeping/pnl"] });
      setDialogOpen(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to create entry",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setFormMarinaId("");
    setFormAccountName("");
    setFormAccountType("revenue");
    setFormAmount("");
    setFormPeriodStart("");
    setFormPeriodEnd("");
    setFormNotes("");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formMarinaId || !formAccountName || !formAmount || !formPeriodStart || !formPeriodEnd) {
      toast({
        title: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }
    createMutation.mutate({
      marinaId: formMarinaId,
      accountName: formAccountName,
      accountType: formAccountType,
      amount: formAmount,
      periodStart: formPeriodStart,
      periodEnd: formPeriodEnd,
      notes: formNotes,
    });
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-lg font-semibold">General Ledger</h2>
          <p className="text-sm text-muted-foreground">
            Browse, search, and manage GL entries
          </p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-[#1E4FAB] hover:bg-[#1a4294]">
              <Plus className="w-4 h-4 mr-2" />
              Add Entry
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Add GL Entry</DialogTitle>
              <DialogDescription>
                Create a new manual general ledger entry.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="marina">Asset / Marina *</Label>
                <Select value={formMarinaId} onValueChange={setFormMarinaId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select asset..." />
                  </SelectTrigger>
                  <SelectContent>
                    {ownedAssets.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="accountName">Account Name *</Label>
                <Input
                  id="accountName"
                  value={formAccountName}
                  onChange={(e) => setFormAccountName(e.target.value)}
                  placeholder="e.g., Wet Slip Revenue"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Account Type *</Label>
                  <Select value={formAccountType} onValueChange={setFormAccountType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ACCOUNT_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t.charAt(0).toUpperCase() + t.slice(1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="amount">Amount *</Label>
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    value={formAmount}
                    onChange={(e) => setFormAmount(e.target.value)}
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="periodStart">Period Start *</Label>
                  <Input
                    id="periodStart"
                    type="date"
                    value={formPeriodStart}
                    onChange={(e) => setFormPeriodStart(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="periodEnd">Period End *</Label>
                  <Input
                    id="periodEnd"
                    type="date"
                    value={formPeriodEnd}
                    onChange={(e) => setFormPeriodEnd(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Input
                  id="notes"
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="Optional notes..."
                />
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="bg-[#1E4FAB] hover:bg-[#1a4294]"
                >
                  {createMutation.isPending && (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  )}
                  Create Entry
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters Row */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex-1 min-w-[200px]">
              <Label className="text-xs text-muted-foreground mb-1 block">
                Search Account
              </Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by account name..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            <div className="w-[160px]">
              <Label className="text-xs text-muted-foreground mb-1 block">
                Account Type
              </Label>
              <Select value={filterType} onValueChange={(v) => { setFilterType(v); setPage(0); }}>
                <SelectTrigger>
                  <SelectValue placeholder="All types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {ACCOUNT_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t.charAt(0).toUpperCase() + t.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="w-[160px]">
              <Label className="text-xs text-muted-foreground mb-1 block">
                Start Date
              </Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => { setStartDate(e.target.value); setPage(0); }}
              />
            </div>

            <div className="w-[160px]">
              <Label className="text-xs text-muted-foreground mb-1 block">
                End Date
              </Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => { setEndDate(e.target.value); setPage(0); }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* GL Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-[#1E4FAB]" />
            GL Entries
            {total > 0 && (
              <Badge variant="secondary" className="ml-2">
                {total.toLocaleString()} total
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <AlertCircle className="w-12 h-12 mx-auto mb-3 text-muted-foreground/50" />
              <p className="font-medium">No GL entries found</p>
              <p className="text-sm mt-1">
                {searchTerm || filterType !== "all" || startDate || endDate
                  ? "Try adjusting your filters."
                  : "Click \"Add Entry\" to create your first GL entry, or import via CSV."}
              </p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Account</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Source</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell className="text-sm whitespace-nowrap">
                        {entry.periodStart}
                      </TableCell>
                      <TableCell className="font-medium">
                        {entry.accountName}
                        {entry.notes && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {entry.notes}
                          </p>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            entry.accountType === "revenue"
                              ? "text-green-700 border-green-300"
                              : entry.accountType === "expense"
                              ? "text-red-700 border-red-300"
                              : entry.accountType === "asset"
                              ? "text-blue-700 border-blue-300"
                              : entry.accountType === "liability"
                              ? "text-orange-700 border-orange-300"
                              : "text-purple-700 border-purple-300"
                          }
                        >
                          {entry.accountType}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(parseFloat(entry.amount))}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-xs">
                          {entry.source}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-4">
                  <p className="text-sm text-muted-foreground">
                    Showing {page * PAGE_SIZE + 1}-
                    {Math.min((page + 1) * PAGE_SIZE, total)} of {total}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page === 0}
                      onClick={() => setPage((p) => p - 1)}
                    >
                      <ChevronLeft className="w-4 h-4" />
                      Previous
                    </Button>
                    <span className="text-sm text-muted-foreground">
                      Page {page + 1} of {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page >= totalPages - 1}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      Next
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
