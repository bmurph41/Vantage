import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Trash2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { EmailSequenceEnrollment, EmailSequence } from "@shared/schema";
import { EnrollmentFormModal } from "./enrollment-form-modal";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

export function EnrollmentList() {
  const { toast } = useToast();
  const [enrollModalOpen, setEnrollModalOpen] = useState(false);
  const [unenrollDialogOpen, setUnenrollDialogOpen] = useState(false);
  const [enrollmentToUnenroll, setEnrollmentToUnenroll] = useState<EmailSequenceEnrollment | null>(null);

  // Fetch all sequences for the dropdown
  const { data: sequences = [] } = useQuery<EmailSequence[]>({
    queryKey: ["/api/email-sequences"],
  });

  // Fetch all enrollments
  const { data: allEnrollments = [], isLoading } = useQuery<EmailSequenceEnrollment[]>({
    queryKey: ["/api/email-sequence-enrollments"],
  });

  const unenrollMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest(`/api/email-sequence-enrollments/${id}`, {
        method: "PUT",
        body: JSON.stringify({ status: "completed" }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/email-sequence-enrollments"] });
      toast({
        title: "Enrollment updated",
        description: "The enrollment has been marked as completed.",
      });
      setUnenrollDialogOpen(false);
      setEnrollmentToUnenroll(null);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update enrollment status.",
        variant: "destructive",
      });
    },
  });

  const handleUnenroll = (enrollment: EmailSequenceEnrollment) => {
    setEnrollmentToUnenroll(enrollment);
    setUnenrollDialogOpen(true);
  };

  const confirmUnenroll = () => {
    if (enrollmentToUnenroll) {
      unenrollMutation.mutate(enrollmentToUnenroll.id);
    }
  };

  const getSequenceName = (sequenceId: number) => {
    const sequence = sequences.find(s => s.id === sequenceId);
    return sequence?.name || `Sequence #${sequenceId}`;
  };

  if (isLoading) {
    return (
      <div className="text-center py-8 text-gray-500">
        Loading enrollments...
      </div>
    );
  }

  if (allEnrollments.length === 0) {
    return (
      <div className="text-center py-12">
        <Users className="h-12 w-12 text-gray-300 mx-auto mb-4" />
        <p className="text-gray-500 mb-2">No enrollments yet</p>
        <p className="text-sm text-gray-400 mb-4">
          Enroll contacts, leads, or deals into sequences to start automated campaigns
        </p>
        <Button onClick={() => setEnrollModalOpen(true)} data-testid="button-create-enrollment">
          <Plus className="h-4 w-4 mr-2" />
          Enroll Entity
        </Button>
        <EnrollmentFormModal
          open={enrollModalOpen}
          onClose={() => setEnrollModalOpen(false)}
        />
      </div>
    );
  }

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button onClick={() => setEnrollModalOpen(true)} data-testid="button-create-enrollment">
          <Plus className="h-4 w-4 mr-2" />
          Enroll Entity
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Sequence</TableHead>
            <TableHead>Entity Type</TableHead>
            <TableHead>Entity ID</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Enrolled</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {allEnrollments.map((enrollment) => (
            <TableRow key={enrollment.id} data-testid={`row-enrollment-${enrollment.id}`}>
              <TableCell className="font-medium">
                {getSequenceName(enrollment.sequenceId)}
              </TableCell>
              <TableCell>
                <Badge variant="outline">{enrollment.entityType}</Badge>
              </TableCell>
              <TableCell>{enrollment.entityId}</TableCell>
              <TableCell>
                <Badge
                  variant={
                    enrollment.status === "active" ? "default" :
                    enrollment.status === "paused" ? "secondary" :
                    "outline"
                  }
                  data-testid={`badge-status-${enrollment.id}`}
                >
                  {enrollment.status}
                </Badge>
              </TableCell>
              <TableCell className="text-sm text-gray-500">
                {new Date(enrollment.enrolledAt).toLocaleDateString()}
              </TableCell>
              <TableCell className="text-right">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleUnenroll(enrollment)}
                  disabled={enrollment.status === "completed"}
                  data-testid={`button-unenroll-${enrollment.id}`}
                >
                  <Trash2 className="h-4 w-4 text-red-600" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <EnrollmentFormModal
        open={enrollModalOpen}
        onClose={() => setEnrollModalOpen(false)}
      />

      <AlertDialog open={unenrollDialogOpen} onOpenChange={setUnenrollDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Complete Enrollment</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to mark this enrollment as completed? The entity will no longer receive emails from this sequence.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-unenroll">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmUnenroll}
              className="bg-red-600 hover:bg-red-700"
              data-testid="button-confirm-unenroll"
            >
              Complete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
