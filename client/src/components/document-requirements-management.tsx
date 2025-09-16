import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from "@/components/ui/dialog";
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
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";
import { DocumentStatusChip, isDocumentStatusBlocking, isDocumentStatusComplete } from "./document-status-chip";
import { 
  useTaskDocumentRequirements,
  useCreateDocumentRequirement,
  useUpdateDocumentRequirement,
  useDeleteDocumentRequirement
} from "@/hooks/use-document-requirements";
import { 
  Plus, 
  MoreVertical, 
  Edit, 
  Trash, 
  Shield, 
  AlertTriangle,
  CheckCircle,
  FileText,
  ExternalLink
} from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import type { DocumentRequirement } from "@shared/schema";

const createRequirementSchema = z.object({
  requirementKey: z.string().min(1, "Requirement key is required"),
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  provider: z.string().min(1, "Provider is required"),
});

const updateRequirementSchema = z.object({
  status: z.enum(["requested", "received", "verified", "rejected", "outdated", "external_unavailable"]),
  externalDocId: z.string().optional(),
  externalVersion: z.string().optional(),
});

interface DocumentRequirementsManagementProps {
  taskId: string;
  readOnly?: boolean;
  showHeader?: boolean;
  compact?: boolean;
}

interface AddRequirementDialogProps {
  taskId: string;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

function AddRequirementDialog({ taskId, isOpen, onOpenChange }: AddRequirementDialogProps) {
  const createRequirement = useCreateDocumentRequirement();
  
  const form = useForm({
    resolver: zodResolver(createRequirementSchema),
    defaultValues: {
      requirementKey: "",
      title: "",
      description: "",
      provider: "",
    },
  });

  const onSubmit = async (data: z.infer<typeof createRequirementSchema>) => {
    try {
      await createRequirement.mutateAsync({
        taskId,
        ...data,
      });
      onOpenChange(false);
      form.reset();
    } catch (error) {
      console.error("Failed to create requirement:", error);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid="dialog-add-requirement">
        <DialogHeader>
          <DialogTitle>Add Document Requirement</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <Label htmlFor="requirementKey">Requirement Key *</Label>
            <Input
              id="requirementKey"
              {...form.register("requirementKey")}
              placeholder="insurance_certificate"
              data-testid="input-requirement-key"
            />
            {form.formState.errors.requirementKey && (
              <p className="text-sm text-destructive mt-1">
                {form.formState.errors.requirementKey.message}
              </p>
            )}
          </div>
          
          <div>
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              {...form.register("title")}
              placeholder="Insurance Certificate"
              data-testid="input-requirement-title"
            />
            {form.formState.errors.title && (
              <p className="text-sm text-destructive mt-1">
                {form.formState.errors.title.message}
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="provider">Provider *</Label>
            <Input
              id="provider"
              {...form.register("provider")}
              placeholder="Insurance Company"
              data-testid="input-requirement-provider"
            />
            {form.formState.errors.provider && (
              <p className="text-sm text-destructive mt-1">
                {form.formState.errors.provider.message}
              </p>
            )}
          </div>
          
          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              {...form.register("description")}
              placeholder="Optional description..."
              rows={3}
              data-testid="textarea-requirement-description"
            />
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => onOpenChange(false)}
              data-testid="button-cancel-add-requirement"
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={createRequirement.isPending}
              data-testid="button-submit-add-requirement"
            >
              {createRequirement.isPending ? "Adding..." : "Add Requirement"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface RequirementItemProps {
  requirement: DocumentRequirement;
  readOnly?: boolean;
}

function RequirementItem({ requirement, readOnly }: RequirementItemProps) {
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const updateRequirement = useUpdateDocumentRequirement();
  const deleteRequirement = useDeleteDocumentRequirement();
  
  const statusForm = useForm({
    resolver: zodResolver(updateRequirementSchema),
    defaultValues: {
      status: requirement.status,
      externalDocId: requirement.externalDocId || "",
      externalVersion: requirement.externalVersion || "",
    },
  });

  const handleStatusUpdate = async (data: z.infer<typeof updateRequirementSchema>) => {
    try {
      await updateRequirement.mutateAsync({
        requirementId: requirement.id,
        data,
      });
      setStatusDialogOpen(false);
    } catch (error) {
      console.error("Failed to update requirement:", error);
    }
  };

  const handleDelete = async () => {
    try {
      await deleteRequirement.mutateAsync(requirement.id);
    } catch (error) {
      console.error("Failed to delete requirement:", error);
    }
  };

  const isComplete = isDocumentStatusComplete(requirement.status);
  const isBlocking = isDocumentStatusBlocking(requirement.status);

  return (
    <div className="flex items-center justify-between p-4 border rounded-lg bg-card">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-3 mb-2">
          <div className="flex items-center gap-2">
            {isComplete && <CheckCircle className="h-4 w-4 text-green-600" />}
            {isBlocking && <AlertTriangle className="h-4 w-4 text-red-600" />}
            <h4 className="font-medium text-sm truncate">{requirement.title}</h4>
          </div>
          <DocumentStatusChip status={requirement.status} />
        </div>
        
        {requirement.description && (
          <p className="text-sm text-muted-foreground mb-2">{requirement.description}</p>
        )}
        
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span>Provider: {requirement.provider}</span>
          {requirement.externalDocId && (
            <span className="flex items-center gap-1">
              <ExternalLink className="h-3 w-3" />
              {requirement.externalDocId}
            </span>
          )}
          {requirement.receivedAt && (
            <span>Received: {format(new Date(requirement.receivedAt), "MMM dd")}</span>
          )}
          {requirement.verifiedAt && (
            <span>Verified: {format(new Date(requirement.verifiedAt), "MMM dd")}</span>
          )}
        </div>
      </div>

      {!readOnly && (
        <div className="flex items-center gap-2 ml-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setStatusDialogOpen(true)}
            data-testid={`button-update-status-${requirement.id}`}
          >
            Update Status
          </Button>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" data-testid={`button-requirement-menu-${requirement.id}`}>
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setStatusDialogOpen(true)}>
                <Edit className="h-4 w-4 mr-2" />
                Edit Status
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <DropdownMenuItem 
                    className="text-destructive"
                    onSelect={(e) => e.preventDefault()}
                  >
                    <Trash className="h-4 w-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Document Requirement</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to delete "{requirement.title}"? This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDelete}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      {/* Status Update Dialog */}
      <Dialog open={statusDialogOpen} onOpenChange={setStatusDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Update Document Status</DialogTitle>
          </DialogHeader>
          <form onSubmit={statusForm.handleSubmit(handleStatusUpdate)} className="space-y-4">
            <div>
              <Label>Status *</Label>
              <Select
                value={statusForm.watch("status")}
                onValueChange={(value) => statusForm.setValue("status", value as any)}
              >
                <SelectTrigger data-testid="select-requirement-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="requested">Requested</SelectItem>
                  <SelectItem value="received">Received</SelectItem>
                  <SelectItem value="verified">Verified</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                  <SelectItem value="outdated">Outdated</SelectItem>
                  <SelectItem value="external_unavailable">External Unavailable</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label htmlFor="externalDocId">External Document ID</Label>
              <Input
                id="externalDocId"
                {...statusForm.register("externalDocId")}
                placeholder="Optional external ID"
                data-testid="input-external-doc-id"
              />
            </div>
            
            <div>
              <Label htmlFor="externalVersion">Version</Label>
              <Input
                id="externalVersion"
                {...statusForm.register("externalVersion")}
                placeholder="Optional version"
                data-testid="input-external-version"
              />
            </div>

            <div className="flex justify-end space-x-2 pt-4">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setStatusDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={updateRequirement.isPending}
                data-testid="button-submit-status-update"
              >
                {updateRequirement.isPending ? "Updating..." : "Update Status"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function DocumentRequirementsManagement({ 
  taskId, 
  readOnly = false, 
  showHeader = true,
  compact = false 
}: DocumentRequirementsManagementProps) {
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const { data: requirements = [], isLoading } = useTaskDocumentRequirements(taskId);

  const verifiedCount = requirements.filter((req: DocumentRequirement) => req.status === "verified").length;
  const blockingCount = requirements.filter((req: DocumentRequirement) => 
    isDocumentStatusBlocking(req.status)
  ).length;

  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="h-4 bg-muted rounded w-1/3"></div>
        <div className="h-16 bg-muted rounded"></div>
        <div className="h-16 bg-muted rounded"></div>
      </div>
    );
  }

  const content = (
    <div className="space-y-4" data-testid="document-requirements-management">
      {showHeader && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-medium">Document Requirements</h3>
            {requirements.length > 0 && (
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">
                  {verifiedCount}/{requirements.length} Verified
                </Badge>
                {blockingCount > 0 && (
                  <Badge variant="destructive" className="text-xs">
                    {blockingCount} Issues
                  </Badge>
                )}
              </div>
            )}
          </div>
          
          {!readOnly && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAddDialogOpen(true)}
              data-testid="button-add-requirement"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Requirement
            </Button>
          )}
        </div>
      )}

      {requirements.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>No document requirements defined</p>
          {!readOnly && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAddDialogOpen(true)}
              className="mt-3"
              data-testid="button-add-first-requirement"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add First Requirement
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {requirements.map((requirement: DocumentRequirement) => (
            <RequirementItem
              key={requirement.id}
              requirement={requirement}
              readOnly={readOnly}
            />
          ))}
        </div>
      )}

      <AddRequirementDialog
        taskId={taskId}
        isOpen={addDialogOpen}
        onOpenChange={setAddDialogOpen}
      />
    </div>
  );

  if (compact) {
    return content;
  }

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-base">Document Requirements</CardTitle>
      </CardHeader>
      <CardContent>
        {content}
      </CardContent>
    </Card>
  );
}