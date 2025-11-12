import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Edit, Trash2 } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { RentRollEntryDialog } from "./RentRollEntryDialog";
import { RENT_ROLL_QUERY_KEYS } from "@/types/rent-roll";
import type { RentRollEntry } from "@/types/rent-roll";

interface RentRollEntriesTableProps {
  entries: RentRollEntry[];
  isLoading: boolean;
  rentRollId: string;
}

export function RentRollEntriesTable({ entries, isLoading, rentRollId }: RentRollEntriesTableProps) {
  const [editingEntry, setEditingEntry] = useState<RentRollEntry | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const { toast } = useToast();

  const deleteMutation = useMutation({
    mutationFn: async (entryId: string) => {
      return apiRequest(`/api/operations/rent-rolls/${rentRollId}/entries/${entryId}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: RENT_ROLL_QUERY_KEYS.entries(rentRollId) });
      queryClient.invalidateQueries({ queryKey: RENT_ROLL_QUERY_KEYS.summary(rentRollId) });
      toast({
        title: "Entry deleted",
        description: "The rent roll entry has been deleted successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete entry. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleEdit = (entry: RentRollEntry) => {
    setEditingEntry(entry);
    setIsEditDialogOpen(true);
  };

  const handleDelete = (entry: RentRollEntry) => {
    if (confirm(`Are you sure you want to delete ${entry.unitNumber || entry.tenantName || 'this entry'}?`)) {
      deleteMutation.mutate(entry.id);
    }
  };

  const formatCurrency = (amount: string | number) => {
    const value = typeof amount === 'string' ? parseFloat(amount) : amount;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatDate = (date: Date | string | null) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString();
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      occupied: "default",
      vacant: "secondary",
      reserved: "outline",
    };
    return (
      <Badge variant={variants[status] || "default"}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  const getTypeBadge = (type: string) => {
    const colors: Record<string, string> = {
      slip: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
      rack: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
      commercial: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300",
      seasonal: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300",
    };
    return (
      <Badge className={colors[type] || ""}>
        {type.charAt(0).toUpperCase() + type.slice(1)}
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  if (!entries.length) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p>No entries found. Add your first unit to get started.</p>
      </div>
    );
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Type</TableHead>
            <TableHead>Unit #</TableHead>
            <TableHead>Tenant</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Monthly Rate</TableHead>
            <TableHead>Lease Start</TableHead>
            <TableHead>Lease End</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.map((entry) => (
            <TableRow key={entry.id} data-testid={`entry-row-${entry.id}`}>
              <TableCell>{getTypeBadge(entry.entryType)}</TableCell>
              <TableCell className="font-medium">{entry.unitNumber || '-'}</TableCell>
              <TableCell>{entry.tenantName || '-'}</TableCell>
              <TableCell>{getStatusBadge(entry.status)}</TableCell>
              <TableCell>{formatCurrency(entry.monthlyRate)}</TableCell>
              <TableCell>{formatDate(entry.leaseStartDate)}</TableCell>
              <TableCell>{formatDate(entry.leaseEndDate)}</TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleEdit(entry)}
                    data-testid={`button-edit-entry-${entry.id}`}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(entry)}
                    disabled={deleteMutation.isPending}
                    data-testid={`button-delete-entry-${entry.id}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {editingEntry && (
        <RentRollEntryDialog
          open={isEditDialogOpen}
          onOpenChange={setIsEditDialogOpen}
          rentRollId={rentRollId}
          entry={editingEntry}
        />
      )}
    </>
  );
}
