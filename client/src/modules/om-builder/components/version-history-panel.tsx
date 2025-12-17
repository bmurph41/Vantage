import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { History, RotateCcw, Clock, User, ChevronDown, ChevronUp, Save, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { OmDocumentVersion } from "@shared/schema";

interface VersionHistoryPanelProps {
  omId: string;
  currentSnapshot?: any;
  onRestore?: (snapshot: any) => void;
}

export function VersionHistoryPanel({ omId, currentSnapshot, onRestore }: VersionHistoryPanelProps) {
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState<OmDocumentVersion | null>(null);
  const [versionLabel, setVersionLabel] = useState("");
  const [changeNotes, setChangeNotes] = useState("");

  const { data: versions = [], isLoading } = useQuery<OmDocumentVersion[]>({
    queryKey: ['/api/om/oms', omId, 'versions'],
    enabled: !!omId && isOpen,
  });

  const saveVersionMutation = useMutation({
    mutationFn: (data: { omId: string; snapshot: any; versionLabel?: string; changeNotes?: string }) =>
      apiRequest('POST', '/api/om/versions', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/om/oms', omId, 'versions'] });
      setSaveDialogOpen(false);
      setVersionLabel("");
      setChangeNotes("");
      toast({ title: "Version Saved", description: "Your document version has been saved." });
    },
  });

  const restoreVersionMutation = useMutation({
    mutationFn: ({ omId, versionId }: { omId: string; versionId: string }) =>
      apiRequest('POST', `/api/om/oms/${omId}/restore-version`, { versionId }),
    onSuccess: (result: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/om/oms', omId] });
      queryClient.invalidateQueries({ queryKey: ['/api/om/oms', omId, 'versions'] });
      setRestoreDialogOpen(false);
      setSelectedVersion(null);
      if (onRestore && result?.snapshot) {
        onRestore(result.snapshot);
      }
      toast({ title: "Version Restored", description: "Your document has been restored to the selected version." });
    },
  });

  const handleSaveVersion = () => {
    if (!currentSnapshot) {
      toast({ title: "Error", description: "No content to save", variant: "destructive" });
      return;
    }
    saveVersionMutation.mutate({
      omId,
      snapshot: currentSnapshot,
      versionLabel: versionLabel || undefined,
      changeNotes: changeNotes || undefined,
    });
  };

  const handleRestoreVersion = () => {
    if (!selectedVersion) return;
    restoreVersionMutation.mutate({ omId, versionId: selectedVersion.id });
  };

  return (
    <div className="border rounded-lg bg-card">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" className="w-full justify-between p-4 h-auto">
            <div className="flex items-center gap-2">
              <History className="h-4 w-4" />
              <span className="font-medium">Version History</span>
              {versions.length > 0 && (
                <Badge variant="secondary" className="ml-2">{versions.length}</Badge>
              )}
            </div>
            {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="px-4 pb-4 border-t">
            <div className="flex justify-end py-3">
              <Button 
                size="sm" 
                onClick={() => setSaveDialogOpen(true)}
                disabled={!currentSnapshot}
                data-testid="button-save-version"
              >
                <Save className="h-4 w-4 mr-2" />
                Save Version
              </Button>
            </div>
            
            {isLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />
                ))}
              </div>
            ) : versions.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">
                <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No versions saved yet</p>
                <p className="text-xs">Save a version to track changes</p>
              </div>
            ) : (
              <ScrollArea className="h-[300px]">
                <div className="space-y-2">
                  {versions.map((version, index) => (
                    <div
                      key={version.id}
                      className="p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                      data-testid={`version-item-${version.id}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">
                              {version.versionLabel || `Version ${version.versionNumber}`}
                            </span>
                            {index === 0 && (
                              <Badge variant="outline" className="text-xs">Latest</Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                            <Clock className="h-3 w-3" />
                            <span>{formatDistanceToNow(new Date(version.createdAt))} ago</span>
                          </div>
                          {version.changeNotes && (
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                              {version.changeNotes}
                            </p>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedVersion(version);
                            setRestoreDialogOpen(true);
                          }}
                          disabled={index === 0}
                          data-testid={`button-restore-version-${version.id}`}
                        >
                          <RotateCcw className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>

      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save Version</DialogTitle>
            <DialogDescription>
              Save a snapshot of your current document. You can restore it later.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="version-label">Version Label (optional)</Label>
              <Input
                id="version-label"
                value={versionLabel}
                onChange={(e) => setVersionLabel(e.target.value)}
                placeholder="e.g., Final Draft, Before Revisions"
                data-testid="input-version-label"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="change-notes">Change Notes (optional)</Label>
              <Textarea
                id="change-notes"
                value={changeNotes}
                onChange={(e) => setChangeNotes(e.target.value)}
                placeholder="Describe what changed in this version..."
                rows={3}
                data-testid="input-change-notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveVersion}
              disabled={saveVersionMutation.isPending}
              data-testid="button-confirm-save-version"
            >
              <Check className="h-4 w-4 mr-2" />
              Save Version
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={restoreDialogOpen} onOpenChange={setRestoreDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Restore Version</DialogTitle>
            <DialogDescription>
              Are you sure you want to restore to this version? Your current changes will be saved as a new version before restoring.
            </DialogDescription>
          </DialogHeader>
          {selectedVersion && (
            <div className="p-4 bg-muted rounded-lg">
              <div className="font-medium">
                {selectedVersion.versionLabel || `Version ${selectedVersion.versionNumber}`}
              </div>
              <div className="text-sm text-muted-foreground">
                Created {formatDistanceToNow(new Date(selectedVersion.createdAt))} ago
              </div>
              {selectedVersion.changeNotes && (
                <p className="text-sm mt-2">{selectedVersion.changeNotes}</p>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setRestoreDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleRestoreVersion}
              disabled={restoreVersionMutation.isPending}
              data-testid="button-confirm-restore-version"
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Restore
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
