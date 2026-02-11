import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  Undo2,
  Download,
  Eye
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { format } from "date-fns";
import { useLocation } from "wouter";

export default function ImportHistory() {
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const { data: imports, isLoading } = useQuery({
    queryKey: ['/api/imports'],
  });

  const rollbackMutation = useMutation({
    mutationFn: async (importId: string) => {
      const response = await apiRequest(`/api/imports/${importId}/rollback`, {
        method: 'POST',
      });
      return response;
    },
    onSuccess: (data, importId) => {
      queryClient.invalidateQueries({ queryKey: ['/api/imports'] });
      queryClient.invalidateQueries({ queryKey: ['/api/contacts'] });
      toast({
        title: "Rollback Complete",
        description: data.message,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Rollback Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge variant="default" className="bg-green-600" data-testid={`badge-status-${status}`}>Completed</Badge>;
      case 'completed_with_errors':
        return <Badge variant="secondary" data-testid={`badge-status-${status}`}>Completed with Errors</Badge>;
      case 'processing':
        return <Badge variant="default" data-testid={`badge-status-${status}`}>Processing</Badge>;
      case 'failed':
        return <Badge variant="destructive" data-testid={`badge-status-${status}`}>Failed</Badge>;
      default:
        return <Badge variant="outline" data-testid={`badge-status-${status}`}>{status}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-6 px-6 max-w-7xl">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <Clock className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">Loading import history...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 px-6 max-w-7xl">
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold mb-2">Import History</h1>
          <p className="text-muted-foreground">
            View and manage your contact import history
          </p>
        </div>
        <Button onClick={() => navigate('/import-contacts')} data-testid="button-new-import">
          <Download className="mr-2 h-4 w-4" />
          New Import
        </Button>
      </div>

      {!imports || imports.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center space-y-4">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground" />
              <div>
                <h3 className="text-lg font-medium">No imports yet</h3>
                <p className="text-sm text-muted-foreground">
                  Start by importing your first CSV file
                </p>
              </div>
              <Button onClick={() => navigate('/import-contacts')} data-testid="button-first-import">
                <Download className="mr-2 h-4 w-4" />
                Import Contacts
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>All Imports</CardTitle>
            <CardDescription>
              {imports.length} import{imports.length !== 1 ? 's' : ''} found
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>File Name</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Success</TableHead>
                    <TableHead className="text-right">Failed</TableHead>
                    <TableHead className="text-right">Duplicates</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {imports.map((importJob: any) => (
                    <TableRow key={importJob.id} data-testid={`row-import-${importJob.id}`}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <span data-testid={`text-filename-${importJob.id}`}>{importJob.fileName}</span>
                        </div>
                      </TableCell>
                      <TableCell data-testid={`text-date-${importJob.id}`}>
                        {importJob.createdAt 
                          ? format(new Date(importJob.createdAt), 'MMM dd, yyyy HH:mm')
                          : 'N/A'}
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(importJob.status)}
                      </TableCell>
                      <TableCell className="text-right" data-testid={`text-total-${importJob.id}`}>
                        {importJob.totalRows}
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="text-green-600 font-medium" data-testid={`text-success-${importJob.id}`}>
                          {importJob.successfulRows}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="text-red-600 font-medium" data-testid={`text-failed-${importJob.id}`}>
                          {importJob.failedRows}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="text-yellow-600 font-medium" data-testid={`text-duplicates-${importJob.id}`}>
                          {importJob.duplicatesFound}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {importJob.canRollback && !importJob.rolledBackAt && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button 
                                  variant="ghost" 
                                  size="sm"
                                  data-testid={`button-rollback-${importJob.id}`}
                                >
                                  <Undo2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Rollback Import?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    This will delete all contacts that were created during this import. 
                                    Contacts that were updated will not be affected. This action cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel data-testid={`button-cancel-rollback-${importJob.id}`}>
                                    Cancel
                                  </AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => rollbackMutation.mutate(importJob.id)}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    data-testid={`button-confirm-rollback-${importJob.id}`}
                                  >
                                    Rollback
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}
                          {importJob.rolledBackAt && (
                            <Badge variant="outline" className="text-xs" data-testid={`badge-rolled-back-${importJob.id}`}>
                              Rolled Back
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="mt-6 p-4 bg-muted rounded-lg">
              <h4 className="font-medium mb-2 flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                Import Tips
              </h4>
              <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                <li>Only imports with newly created contacts can be rolled back</li>
                <li>Updated contacts during import cannot be reverted</li>
                <li>CSV files should include headers in the first row</li>
                <li>Recommended fields: First Name, Last Name, Email, Phone, Company</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
