import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { StandardDialogShell } from "@/components/ui/standard-dialog-shell";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Archive, User, Building2, MapPin, AlertTriangle, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface ArchivePromptModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  salesCompId: string;
  onComplete?: () => void;
}

interface ArchiveCheck {
  salesCompId: string;
  sellerContactId: string | null;
  sellerCompanyId: string | null;
  sellerContact: {
    id: string;
    firstName: string;
    lastName: string;
    email: string | null;
    company: string | null;
  } | null;
  sellerCompany: {
    id: string;
    name: string;
    domain: string | null;
  } | null;
  propertyName: string;
  saleDate: string | null;
}

export function ArchivePromptModal({
  open,
  onOpenChange,
  salesCompId,
  onComplete,
}: ArchivePromptModalProps) {
  const [archiveContact, setArchiveContact] = useState(true);
  const [archiveCompany, setArchiveCompany] = useState(true);
  const [archiveNotes, setArchiveNotes] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: archiveCheck, isLoading } = useQuery<ArchiveCheck>({
    queryKey: ["/api/archive/sales-comps", salesCompId, "archive-check"],
    queryFn: async () => {
      const response = await fetch(`/api/archive/sales-comps/${salesCompId}/archive-check`);
      if (!response.ok) throw new Error("Failed to check archive candidates");
      return response.json();
    },
    enabled: open && !!salesCompId,
  });

  const archiveMutation = useMutation({
    mutationFn: async () => {
      return apiRequest(`/api/archive/sales-comps/${salesCompId}/archive-seller`, {
        method: "POST",
        body: JSON.stringify({
          archiveContact,
          archiveCompany,
          archiveNotes: archiveNotes.trim() || undefined,
        }),
      });
    },
    onSuccess: () => {
      toast({
        title: "Archive Complete",
        description: "The selected contacts and companies have been archived.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/archive"] });
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
      onOpenChange(false);
      onComplete?.();
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Archive Failed",
        description: error.message || "Failed to archive seller information.",
      });
    },
  });

  const handleSkip = () => {
    onOpenChange(false);
    onComplete?.();
  };

  const handleArchive = () => {
    if (!archiveContact && !archiveCompany) {
      handleSkip();
      return;
    }
    archiveMutation.mutate();
  };

  const hasArchiveCandidates = archiveCheck?.sellerContact || archiveCheck?.sellerCompany;

  if (isLoading) {
    return (
      <StandardDialogShell
        open={open}
        onOpenChange={onOpenChange}
        title="Archive Seller Information"
        icon={Archive}
        size="sm"
      >
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </StandardDialogShell>
    );
  }

  if (!hasArchiveCandidates) {
    if (open) {
      onOpenChange(false);
      onComplete?.();
    }
    return null;
  }

  return (
    <StandardDialogShell
      open={open}
      onOpenChange={onOpenChange}
      title="Archive Seller Information"
      description="This property has been marked as sold. Would you like to archive the seller's contact and company information?"
      icon={Archive}
      size="sm"
      secondaryAction={{
        label: "Keep Active",
        onClick: handleSkip,
      }}
      primaryAction={{
        label: "Archive Selected",
        loadingLabel: "Archiving...",
        onClick: handleArchive,
        disabled: archiveMutation.isPending,
        loading: archiveMutation.isPending,
        variant: "destructive",
      }}
    >
      <div className="space-y-4">
        <Card className="bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
              <div className="text-sm text-amber-800 dark:text-amber-200">
                <p className="font-medium">Why archive?</p>
                <p className="mt-1">
                  Since the property was sold, the seller is likely no longer the owner and may be out of the industry.
                  Archiving keeps your CRM clean while preserving the historical record.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <MapPin className="h-4 w-4" />
            <span>Property: <span className="font-medium text-foreground">{archiveCheck?.propertyName}</span></span>
          </div>
          {archiveCheck?.saleDate && (
            <Badge variant="outline" className="text-xs">
              Sold: {new Date(archiveCheck.saleDate).toLocaleDateString()}
            </Badge>
          )}
        </div>

        <Separator />

        <div className="space-y-4">
          {archiveCheck?.sellerContact && (
            <div className="flex items-start space-x-3">
              <Checkbox
                id="archive-contact"
                checked={archiveContact}
                onCheckedChange={(checked) => setArchiveContact(checked as boolean)}
              />
              <div className="flex-1">
                <Label
                  htmlFor="archive-contact"
                  className="text-sm font-medium cursor-pointer flex items-center gap-2"
                >
                  <User className="h-4 w-4 text-blue-500" />
                  Archive Contact
                </Label>
                <Card className="mt-2 bg-muted/50">
                  <CardContent className="p-3">
                    <p className="font-medium">
                      {archiveCheck.sellerContact.firstName} {archiveCheck.sellerContact.lastName}
                    </p>
                    {archiveCheck.sellerContact.email && (
                      <p className="text-sm text-muted-foreground">{archiveCheck.sellerContact.email}</p>
                    )}
                    {archiveCheck.sellerContact.company && (
                      <p className="text-sm text-muted-foreground">{archiveCheck.sellerContact.company}</p>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {archiveCheck?.sellerCompany && (
            <div className="flex items-start space-x-3">
              <Checkbox
                id="archive-company"
                checked={archiveCompany}
                onCheckedChange={(checked) => setArchiveCompany(checked as boolean)}
              />
              <div className="flex-1">
                <Label
                  htmlFor="archive-company"
                  className="text-sm font-medium cursor-pointer flex items-center gap-2"
                >
                  <Building2 className="h-4 w-4 text-purple-500" />
                  Archive Company
                </Label>
                <Card className="mt-2 bg-muted/50">
                  <CardContent className="p-3">
                    <p className="font-medium">{archiveCheck.sellerCompany.name}</p>
                    {archiveCheck.sellerCompany.domain && (
                      <p className="text-sm text-muted-foreground">{archiveCheck.sellerCompany.domain}</p>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="archive-notes" className="text-sm">
            Archive Notes (Optional)
          </Label>
          <Textarea
            id="archive-notes"
            placeholder="Add any notes about this archive..."
            value={archiveNotes}
            onChange={(e) => setArchiveNotes(e.target.value)}
            rows={2}
          />
        </div>
      </div>
    </StandardDialogShell>
  );
}
