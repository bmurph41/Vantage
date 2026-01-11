import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Check, X, Trash2, Shield, TrendingUp, Clock, Building2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ReviewQueueItem {
  id: string;
  category: "storage_type" | "contract_term" | "rate_type" | "slip_status";
  name: string;
  organizationId: string;
  organizationName: string | null;
  status: "pending" | "approved" | "rejected" | "promoted";
  usageCount: number;
  reviewedBy: string | null;
  reviewedAt: string | null;
  reviewNotes: string | null;
  createdAt: string;
  updatedAt: string;
}

interface GlobalPromotedType {
  id: string;
  category: "storage_type" | "contract_term" | "rate_type" | "slip_status";
  name: string;
  description: string | null;
  promotedBy: string | null;
  promotedAt: string;
  createdAt: string;
}

interface TypeStatistics {
  pendingByCategory: { category: string; count: number }[];
  globalByCategory: { category: string; count: number }[];
  totalPending: number;
}

const CATEGORY_LABELS: Record<string, string> = {
  storage_type: "Storage Types",
  contract_term: "Contract Terms",
  rate_type: "Rate Types",
  slip_status: "Slip Statuses",
};

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  approved: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  rejected: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  promoted: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
};

export default function AdminTypeManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>("pending");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [promoteDialogOpen, setPromoteDialogOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<ReviewQueueItem | null>(null);
  const [description, setDescription] = useState("");
  const [rejectNotes, setRejectNotes] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: statistics, isLoading: statsLoading } = useQuery<TypeStatistics>({
    queryKey: ["/api/admin/type-statistics"],
  });

  const { data: reviewQueue = [], isLoading: queueLoading } = useQuery<ReviewQueueItem[]>({
    queryKey: ["/api/admin/type-review-queue", statusFilter, categoryFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (categoryFilter !== "all") params.set("category", categoryFilter);
      const response = await fetch(`/api/admin/type-review-queue?${params}`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch review queue");
      return response.json();
    },
  });

  const { data: globalTypes = [], isLoading: globalLoading } = useQuery<GlobalPromotedType[]>({
    queryKey: ["/api/admin/global-promoted-types"],
  });

  const promoteMutation = useMutation({
    mutationFn: async ({ reviewId, description }: { reviewId: string; description: string }) => {
      return await apiRequest("POST", "/api/admin/promote-type", { reviewId, description });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/type-review-queue"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/global-promoted-types"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/type-statistics"] });
      setPromoteDialogOpen(false);
      setSelectedItem(null);
      setDescription("");
      toast({
        title: "Type Promoted",
        description: "The custom type has been promoted to a global default",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to promote type",
        variant: "destructive",
      });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ reviewId, notes }: { reviewId: string; notes: string }) => {
      return await apiRequest("POST", "/api/admin/reject-type", { reviewId, notes });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/type-review-queue"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/type-statistics"] });
      setRejectDialogOpen(false);
      setSelectedItem(null);
      setRejectNotes("");
      toast({
        title: "Type Rejected",
        description: "The custom type has been rejected",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to reject type",
        variant: "destructive",
      });
    },
  });

  const deleteGlobalMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/admin/global-promoted-types/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to delete global type");
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/global-promoted-types"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/type-statistics"] });
      setDeleteId(null);
      toast({
        title: "Global Type Deleted",
        description: "The global promoted type has been removed",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete global type",
        variant: "destructive",
      });
    },
  });

  const handlePromote = (item: ReviewQueueItem) => {
    setSelectedItem(item);
    setDescription("");
    setPromoteDialogOpen(true);
  };

  const handleReject = (item: ReviewQueueItem) => {
    setSelectedItem(item);
    setRejectNotes("");
    setRejectDialogOpen(true);
  };

  const confirmPromote = () => {
    if (selectedItem) {
      promoteMutation.mutate({ reviewId: selectedItem.id, description });
    }
  };

  const confirmReject = () => {
    if (selectedItem) {
      rejectMutation.mutate({ reviewId: selectedItem.id, notes: rejectNotes });
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <div className="flex-1 space-y-4 p-4 md:p-6 lg:p-8 pt-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight" data-testid="text-page-title">
            Admin Type Management
          </h2>
          <p className="text-muted-foreground">
            Review and promote custom types created by users to global defaults
          </p>
        </div>
        <Shield className="h-8 w-8 text-muted-foreground" />
      </div>

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
            <CardTitle className="text-sm font-medium">Pending Reviews</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-pending-count">
              {statsLoading ? "..." : statistics?.totalPending || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Custom types awaiting review
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
            <CardTitle className="text-sm font-medium">Global Defaults</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-global-count">
              {globalLoading ? "..." : globalTypes.length}
            </div>
            <p className="text-xs text-muted-foreground">
              Promoted to all organizations
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
            <CardTitle className="text-sm font-medium">By Category</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-1">
              {statistics?.pendingByCategory?.map((cat) => (
                <Badge key={cat.category} variant="secondary" className="text-xs">
                  {CATEGORY_LABELS[cat.category]}: {cat.count}
                </Badge>
              )) || <span className="text-muted-foreground text-sm">No pending</span>}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
            <CardTitle className="text-sm font-medium">Global by Type</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-1">
              {statistics?.globalByCategory?.map((cat) => (
                <Badge key={cat.category} variant="outline" className="text-xs">
                  {CATEGORY_LABELS[cat.category]}: {cat.count}
                </Badge>
              )) || <span className="text-muted-foreground text-sm">None yet</span>}
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="review-queue" className="space-y-4">
        <TabsList>
          <TabsTrigger value="review-queue" data-testid="tab-review-queue">
            Review Queue
          </TabsTrigger>
          <TabsTrigger value="global-types" data-testid="tab-global-types">
            Global Defaults
          </TabsTrigger>
        </TabsList>

        <TabsContent value="review-queue" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <CardTitle>Custom Type Review Queue</CardTitle>
                  <CardDescription>
                    Review custom types submitted by users and decide whether to promote them
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-[140px]" data-testid="select-status-filter">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="promoted">Promoted</SelectItem>
                      <SelectItem value="rejected">Rejected</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                    <SelectTrigger className="w-[160px]" data-testid="select-category-filter">
                      <SelectValue placeholder="Category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      <SelectItem value="storage_type">Storage Types</SelectItem>
                      <SelectItem value="contract_term">Contract Terms</SelectItem>
                      <SelectItem value="rate_type">Rate Types</SelectItem>
                      <SelectItem value="slip_status">Slip Statuses</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {queueLoading ? (
                <div className="text-center py-8 text-muted-foreground">Loading...</div>
              ) : reviewQueue.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No items in the review queue matching your filters
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Category</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Organization</TableHead>
                      <TableHead>Usage</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Submitted</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reviewQueue.map((item) => (
                      <TableRow key={item.id} data-testid={`row-review-${item.id}`}>
                        <TableCell>
                          <Badge variant="outline">
                            {CATEGORY_LABELS[item.category] || item.category}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium">{item.name}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {item.organizationName || "Unknown"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{item.usageCount}x</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={STATUS_COLORS[item.status]}>
                            {item.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatDate(item.createdAt)}
                        </TableCell>
                        <TableCell className="text-right">
                          {item.status === "pending" && (
                            <div className="flex justify-end gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handlePromote(item)}
                                data-testid={`button-promote-${item.id}`}
                              >
                                <Check className="h-4 w-4 text-green-600" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleReject(item)}
                                data-testid={`button-reject-${item.id}`}
                              >
                                <X className="h-4 w-4 text-red-600" />
                              </Button>
                            </div>
                          )}
                          {item.status !== "pending" && item.reviewNotes && (
                            <span className="text-xs text-muted-foreground">
                              {item.reviewNotes}
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="global-types" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Global Promoted Types</CardTitle>
              <CardDescription>
                These types are available to all organizations as default options
              </CardDescription>
            </CardHeader>
            <CardContent>
              {globalLoading ? (
                <div className="text-center py-8 text-muted-foreground">Loading...</div>
              ) : globalTypes.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No global types have been promoted yet
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Category</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Promoted</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {globalTypes.map((item) => (
                      <TableRow key={item.id} data-testid={`row-global-${item.id}`}>
                        <TableCell>
                          <Badge variant="outline">
                            {CATEGORY_LABELS[item.category] || item.category}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium">{item.name}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {item.description || "-"}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatDate(item.promotedAt)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setDeleteId(item.id)}
                            data-testid={`button-delete-global-${item.id}`}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
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
      </Tabs>

      {/* Promote Dialog */}
      <Dialog open={promoteDialogOpen} onOpenChange={setPromoteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Promote to Global Default</DialogTitle>
            <DialogDescription>
              This will make "{selectedItem?.name}" available as a default option for all organizations.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Description (optional)</label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Add a description for this type..."
                className="mt-1"
                data-testid="input-promote-description"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPromoteDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={confirmPromote}
              disabled={promoteMutation.isPending}
              data-testid="button-confirm-promote"
            >
              {promoteMutation.isPending ? "Promoting..." : "Promote to Global"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Custom Type</DialogTitle>
            <DialogDescription>
              This will reject "{selectedItem?.name}" from being promoted to a global default.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Reason (optional)</label>
              <Textarea
                value={rejectNotes}
                onChange={(e) => setRejectNotes(e.target.value)}
                placeholder="Add a reason for rejecting..."
                className="mt-1"
                data-testid="input-reject-notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmReject}
              disabled={rejectMutation.isPending}
              data-testid="button-confirm-reject"
            >
              {rejectMutation.isPending ? "Rejecting..." : "Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Global Type Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Global Type?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove this type from the global defaults. Organizations that have already used it will still have it, but it won't appear as a default option for new selections.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button
              variant="destructive"
              onClick={() => deleteId && deleteGlobalMutation.mutate(deleteId)}
              disabled={deleteGlobalMutation.isPending}
              data-testid="button-confirm-delete-global"
            >
              {deleteGlobalMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
