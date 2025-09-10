import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Copy, Clock, Eye, Trash2, Link, Calendar, Users } from "lucide-react";
import { format, addDays, addWeeks, addMonths } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import type { Project, ProjectShare } from "@shared/schema";
import { ddClient } from "@/lib/ddClient";

interface ShareProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: Project;
}

export function ShareProjectDialog({ open, onOpenChange, project }: ShareProjectDialogProps) {
  const { toast } = useToast();
  const [shares, setShares] = useState<ProjectShare[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasExpiration, setHasExpiration] = useState(false);
  const [expirationPreset, setExpirationPreset] = useState("1-week");
  const [accessLevel, setAccessLevel] = useState<"view" | "comment">("view");

  // Load existing shares when dialog opens
  const loadShares = async () => {
    try {
      const response = await fetch(`/api/dd/projects/${project.id}/shares`);
      if (response.ok) {
        const data = await response.json();
        setShares(data);
      }
    } catch (error) {
      console.error('Failed to load shares:', error);
    }
  };

  // Load shares when dialog opens
  const handleOpenChange = (newOpen: boolean) => {
    onOpenChange(newOpen);
    if (newOpen) {
      loadShares();
    }
  };

  const getExpirationDate = () => {
    if (!hasExpiration) return null;
    
    const now = new Date();
    switch (expirationPreset) {
      case "1-day": return addDays(now, 1);
      case "1-week": return addWeeks(now, 1);
      case "1-month": return addMonths(now, 1);
      case "3-months": return addMonths(now, 3);
      default: return addWeeks(now, 1);
    }
  };

  const createShare = async () => {
    setLoading(true);
    try {
      const expiresAt = getExpirationDate();
      const response = await fetch(`/api/dd/projects/${project.id}/shares`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          shareType: "public",
          accessLevel: accessLevel,
          expiresAt: expiresAt?.toISOString() || null,
        }),
      });

      if (response.ok) {
        const newShare = await response.json();
        setShares([newShare, ...shares]);
        toast({
          title: "Share link created",
          description: "Your project share link has been generated and copied to clipboard.",
        });
        
        // Copy to clipboard
        const shareUrl = `${window.location.origin}/shared/${newShare.shareToken}`;
        await navigator.clipboard.writeText(shareUrl);
      } else {
        throw new Error('Failed to create share');
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create share link. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const copyShareLink = async (shareToken: string) => {
    try {
      const shareUrl = `${window.location.origin}/shared/${shareToken}`;
      await navigator.clipboard.writeText(shareUrl);
      toast({
        title: "Copied!",
        description: "Share link copied to clipboard.",
      });
    } catch (error) {
      toast({
        title: "Copy failed",
        description: "Failed to copy link to clipboard.",
        variant: "destructive",
      });
    }
  };

  const deleteShare = async (shareId: string) => {
    try {
      const response = await fetch(`/api/dd/shares/${shareId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setShares(shares.filter(s => s.id !== shareId));
        toast({
          title: "Share deleted",
          description: "Share link has been revoked.",
        });
      } else {
        throw new Error('Failed to delete share');
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete share link.",
        variant: "destructive",
      });
    }
  };

  const getStatusBadge = (share: ProjectShare) => {
    const isExpired = share.expiresAt && new Date() > new Date(share.expiresAt);
    
    if (isExpired) {
      return <Badge variant="secondary" className="text-red-600">Expired</Badge>;
    }
    
    if (!share.isActive) {
      return <Badge variant="secondary">Inactive</Badge>;
    }
    
    return <Badge variant="default" className="bg-green-100 text-green-800">Active</Badge>;
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl" data-testid="dialog-share-project">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Share Project: {project.name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Create New Share */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Create New Share Link</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="access-level">Access Level</Label>
                <Select value={accessLevel} onValueChange={(value: "view" | "comment") => setAccessLevel(value)}>
                  <SelectTrigger data-testid="select-access-level">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="view">
                      <div className="flex items-center gap-2">
                        <Eye className="h-4 w-4" />
                        View Only
                      </div>
                    </SelectItem>
                    <SelectItem value="comment">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        View & Comment
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="expiration-preset">Link Expiration</Label>
                <Select value={hasExpiration ? expirationPreset : "never"} onValueChange={(value) => {
                  if (value === "never") {
                    setHasExpiration(false);
                  } else {
                    setHasExpiration(true);
                    setExpirationPreset(value);
                  }
                }}>
                  <SelectTrigger data-testid="select-expiration">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="never">Never expires</SelectItem>
                    <SelectItem value="1-day">1 day</SelectItem>
                    <SelectItem value="1-week">1 week</SelectItem>
                    <SelectItem value="1-month">1 month</SelectItem>
                    <SelectItem value="3-months">3 months</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button 
              onClick={createShare} 
              disabled={loading} 
              className="w-full"
              data-testid="button-create-share"
            >
              <Link className="h-4 w-4 mr-2" />
              {loading ? "Creating..." : "Create Share Link"}
            </Button>
          </div>

          <Separator />

          {/* Existing Shares */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Existing Share Links</h3>
            
            {shares.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                No share links created yet. Create one above to get started.
              </p>
            ) : (
              <div className="space-y-3">
                {shares.map((share) => (
                  <div 
                    key={share.id}
                    className="flex items-center justify-between p-4 border rounded-lg bg-card"
                    data-testid={`share-item-${share.id}`}
                  >
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        {getStatusBadge(share)}
                        <Badge variant="outline" className="capitalize">
                          {share.accessLevel}
                        </Badge>
                        {share.shareType === "public" && (
                          <Badge variant="outline">
                            <Link className="h-3 w-3 mr-1" />
                            Public Link
                          </Badge>
                        )}
                      </div>
                      
                      <div className="text-sm text-muted-foreground">
                        Created {format(new Date(share.createdAt), 'MMM d, yyyy')}
                        {share.expiresAt && (
                          <span className="flex items-center gap-1 mt-1">
                            <Clock className="h-3 w-3" />
                            Expires {format(new Date(share.expiresAt), 'MMM d, yyyy')}
                          </span>
                        )}
                        {share.lastAccessedAt && (
                          <span className="text-xs">
                            Last accessed {format(new Date(share.lastAccessedAt), 'MMM d, yyyy')}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyShareLink(share.shareToken)}
                        data-testid={`button-copy-${share.id}`}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => deleteShare(share.id)}
                        className="text-red-600 hover:text-red-700"
                        data-testid={`button-delete-${share.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}