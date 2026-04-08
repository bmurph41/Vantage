import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Edit, Trash2, Play, Pause, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { EmailSequence } from "@shared/schema";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

interface SequenceListProps {
  sequences: EmailSequence[];
  isLoading: boolean;
  onEdit: (sequence: EmailSequence) => void;
}

export function SequenceList({ sequences, isLoading, onEdit }: SequenceListProps) {
  const { toast } = useToast();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [sequenceToDelete, setSequenceToDelete] = useState<EmailSequence | null>(null);

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest(`/api/email-sequences/${id}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/email-sequences"] });
      toast({
        title: "Sequence deleted",
        description: "The email sequence has been deleted successfully.",
      });
      setDeleteDialogOpen(false);
      setSequenceToDelete(null);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete sequence. Please try again.",
        variant: "destructive",
      });
    },
  });

  const toggleStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      return await apiRequest(`/api/email-sequences/${id}`, {
        method: "PUT",
        body: JSON.stringify({ status: status === "active" ? "paused" : "active" }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/email-sequences"] });
      toast({
        title: "Status updated",
        description: "The sequence status has been updated.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update sequence status.",
        variant: "destructive",
      });
    },
  });

  const handleDelete = (sequence: EmailSequence) => {
    setSequenceToDelete(sequence);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (sequenceToDelete) {
      deleteMutation.mutate(sequenceToDelete.id);
    }
  };

  if (isLoading) {
    return (
      <div className="text-center py-8 text-gray-500">
        Loading sequences...
      </div>
    );
  }

  if (sequences.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 mb-2">No email sequences yet</p>
        <p className="text-sm text-gray-400">
          Create your first sequence to start automating your email outreach
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="overflow-x-auto w-full">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Steps</TableHead>
            <TableHead>Enrollments</TableHead>
            <TableHead>Created</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sequences.map((sequence) => (
            <TableRow key={sequence.id} data-testid={`row-sequence-${sequence.id}`}>
              <TableCell className="font-medium">
                {sequence.name}
                {sequence.description && (
                  <p className="text-xs text-gray-500 mt-1">{sequence.description}</p>
                )}
              </TableCell>
              <TableCell>
                <Badge
                  variant={sequence.status === "active" ? "default" : "secondary"}
                  data-testid={`badge-status-${sequence.id}`}
                >
                  {sequence.status}
                </Badge>
              </TableCell>
              <TableCell data-testid={`text-steps-${sequence.id}`}>0</TableCell>
              <TableCell data-testid={`text-enrollments-${sequence.id}`}>0</TableCell>
              <TableCell className="text-sm text-gray-500">
                {new Date(sequence.createdAt).toLocaleDateString()}
              </TableCell>
              <TableCell className="text-right">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" data-testid={`button-actions-${sequence.id}`}>
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => onEdit(sequence)} data-testid={`action-edit-${sequence.id}`}>
                      <Edit className="h-4 w-4 mr-2" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => toggleStatusMutation.mutate({ id: sequence.id, status: sequence.status })}
                      data-testid={`action-toggle-${sequence.id}`}
                    >
                      {sequence.status === "active" ? (
                        <>
                          <Pause className="h-4 w-4 mr-2" />
                          Pause
                        </>
                      ) : (
                        <>
                          <Play className="h-4 w-4 mr-2" />
                          Activate
                        </>
                      )}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => handleDelete(sequence)}
                      className="text-red-600"
                      data-testid={`action-delete-${sequence.id}`}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Email Sequence</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{sequenceToDelete?.name}"? This action cannot be undone.
              All steps and enrollments will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-red-600 hover:bg-red-700"
              data-testid="button-confirm-delete"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
