import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Trash2, Plus } from "lucide-react";
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

interface CustomType {
  id: string;
  name: string;
}

interface CustomTypeCategoryProps {
  title: string;
  description: string;
  endpoint: string;
  queryKey: string;
  addLabel: string;
  deleteConfirmMessage: (name: string) => string;
}

function CustomTypeCategory({
  title,
  description,
  endpoint,
  queryKey,
  addLabel,
  deleteConfirmMessage,
}: CustomTypeCategoryProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [newName, setNewName] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteName, setDeleteName] = useState<string>("");

  const { data: items = [], isLoading } = useQuery<CustomType[]>({
    queryKey: [queryKey],
  });

  const createMutation = useMutation({
    mutationFn: async (name: string) => {
      return await apiRequest("POST", endpoint, { name });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [queryKey] });
      setNewName("");
      toast({
        title: "Added successfully",
        description: `${addLabel} has been added`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || `Failed to add ${addLabel.toLowerCase()}`,
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`${endpoint}/${id}`, { 
        method: "DELETE",
        credentials: "include",
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: "Failed to delete" }));
        throw new Error(error.error || "Failed to delete");
      }
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [queryKey] });
      setDeleteId(null);
      toast({
        title: "Deleted successfully",
        description: `${addLabel} has been removed`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || `Failed to delete ${addLabel.toLowerCase()}`,
        variant: "destructive",
      });
    },
  });

  const handleAdd = () => {
    const trimmed = newName.trim();
    if (!trimmed) {
      toast({
        title: "Name required",
        description: `Please enter a name for the ${addLabel.toLowerCase()}`,
        variant: "destructive",
      });
      return;
    }
    createMutation.mutate(trimmed);
  };

  const handleDeleteClick = (item: CustomType) => {
    setDeleteId(item.id);
    setDeleteName(item.name);
  };

  const handleConfirmDelete = () => {
    if (deleteId) {
      deleteMutation.mutate(deleteId);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold mb-2">{title}</h3>
        <p className="text-sm text-muted-foreground mb-4">{description}</p>
      </div>

      {/* Add New Item */}
      <div className="flex gap-2">
        <Input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder={`Enter ${addLabel.toLowerCase()}`}
          data-testid={`input-add-${queryKey}`}
          onKeyDown={(e) => {
            if (e.key === "Enter" && newName.trim()) {
              handleAdd();
            }
          }}
        />
        <Button
          onClick={handleAdd}
          disabled={createMutation.isPending || !newName.trim()}
          data-testid={`button-add-${queryKey}`}
        >
          <Plus className="h-4 w-4 mr-2" />
          Add
        </Button>
      </div>

      {/* List of Items */}
      <div className="space-y-2">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground">No custom items added yet</p>
        ) : (
          items.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between p-2 rounded-md border"
              data-testid={`item-${queryKey}-${item.id}`}
            >
              <span className="text-sm">{item.name}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleDeleteClick(item)}
                data-testid={`button-delete-${queryKey}-${item.id}`}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Deletion</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteConfirmMessage(deleteName)}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid={`button-cancel-delete-${queryKey}`}>
              Cancel
            </AlertDialogCancel>
            <Button
              variant="destructive"
              onClick={handleConfirmDelete}
              disabled={deleteMutation.isPending}
              data-testid={`button-confirm-delete-${queryKey}`}
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default function CustomTypesManagement() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Custom Type Management</CardTitle>
        <CardDescription>
          Add and manage custom types for storage, rates, contract terms, and slip statuses.
          These custom types will be available across all projects.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-8">
        <CustomTypeCategory
          title="Custom Storage Types"
          description="Add custom storage type options beyond the built-in types"
          endpoint="/api/rent-roll/custom-storage-types"
          queryKey="/api/rent-roll/custom-storage-types"
          addLabel="Storage Type"
          deleteConfirmMessage={(name) =>
            `Are you sure you want to delete "${name}"? This will remove it from all projects.`
          }
        />

        <CustomTypeCategory
          title="Custom Rate Types"
          description="Add custom rate type options beyond the built-in types"
          endpoint="/api/rent-roll/custom-rate-types"
          queryKey="/api/rent-roll/custom-rate-types"
          addLabel="Rate Type"
          deleteConfirmMessage={(name) =>
            `Are you sure you want to delete "${name}"? This will remove it from all projects.`
          }
        />

        <CustomTypeCategory
          title="Custom Contract Terms"
          description="Add custom contract term options beyond the built-in terms"
          endpoint="/api/rent-roll/custom-contract-terms"
          queryKey="/api/rent-roll/custom-contract-terms"
          addLabel="Contract Term"
          deleteConfirmMessage={(name) =>
            `Are you sure you want to delete "${name}"? This will remove it from all projects.`
          }
        />

        <CustomTypeCategory
          title="Custom Slip Statuses"
          description="Add custom slip status options beyond the built-in statuses"
          endpoint="/api/rent-roll/custom-slip-statuses"
          queryKey="/api/rent-roll/custom-slip-statuses"
          addLabel="Slip Status"
          deleteConfirmMessage={(name) =>
            `Are you sure you want to delete "${name}"? This will remove it from all projects.`
          }
        />
      </CardContent>
    </Card>
  );
}
