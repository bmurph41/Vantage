import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
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
import { Skeleton } from "@/components/ui/skeleton";
import { MoreVertical, Send, Pencil, Trash2, Calendar, Mail } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format, parseISO } from "date-fns";

interface Campaign {
  id: string;
  name: string;
  subject: string;
  audienceType: string;
  recipientCount: number;
  scheduledAt: string | null;
  sentAt: string | null;
  status: string;
  openRate: string | null;
  clickRate: string | null;
  createdAt: string;
}

const statusConfig: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
  draft: { variant: "secondary", label: "Draft" },
  scheduled: { variant: "default", label: "Scheduled" },
  sending: { variant: "outline", label: "Sending" },
  sent: { variant: "default", label: "Sent" },
  failed: { variant: "destructive", label: "Failed" },
  cancelled: { variant: "secondary", label: "Cancelled" },
};

const audienceLabels: Record<string, string> = {
  all: "All Contacts",
  segment: "By Segment",
  list: "By List",
  manual: "Manual",
};

export default function ScheduledCampaigns() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: campaigns, isLoading, error } = useQuery<Campaign[]>({
    queryKey: ["/api/marketing/campaigns/scheduled"],
  });

  const sendNowMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/marketing/campaigns/${id}/send-now`);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Campaign sent successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/marketing/campaigns/scheduled"] });
    },
    onError: (err: any) => {
      toast({ title: "Failed to send campaign", description: err.message, variant: "destructive" });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("PUT", `/api/marketing/campaigns/${id}`, { status: "cancelled" });
    },
    onSuccess: () => {
      toast({ title: "Campaign cancelled" });
      queryClient.invalidateQueries({ queryKey: ["/api/marketing/campaigns/scheduled"] });
    },
    onError: (err: any) => {
      toast({ title: "Failed to cancel campaign", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/marketing/campaigns/${id}`);
    },
    onSuccess: () => {
      toast({ title: "Campaign deleted" });
      queryClient.invalidateQueries({ queryKey: ["/api/marketing/campaigns/scheduled"] });
      setDeleteId(null);
    },
    onError: (err: any) => {
      toast({ title: "Failed to delete campaign", description: err.message, variant: "destructive" });
      setDeleteId(null);
    },
  });

  const formatDate = (value: string | null) => {
    if (!value) return "-";
    try {
      return format(parseISO(value), "MMM d, yyyy 'at' h:mm a");
    } catch {
      return value;
    }
  };

  const getStatusBadge = (status: string) => {
    const config = statusConfig[status] || { variant: "outline" as const, label: status };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Scheduled Campaigns</CardTitle>
          <CardDescription>View and manage your email campaigns</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : error ? (
            <div className="text-center py-8 text-red-500">
              Failed to load campaigns. Please try again.
            </div>
          ) : !campaigns?.length ? (
            <div className="text-center py-12">
              <Mail className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium">No scheduled campaigns</h3>
              <p className="text-muted-foreground mt-1">
                Create a campaign from the Compose tab to get started.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto w-full">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Campaign Name</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Audience</TableHead>
                  <TableHead>Scheduled Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Open Rate</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {campaigns.map((campaign) => (
                  <TableRow key={campaign.id}>
                    <TableCell className="font-medium">{campaign.name}</TableCell>
                    <TableCell className="max-w-[200px] truncate">{campaign.subject}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {audienceLabels[campaign.audienceType] || campaign.audienceType}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {campaign.sentAt ? (
                        <div className="text-sm">
                          <span className="text-muted-foreground">Sent: </span>
                          {formatDate(campaign.sentAt)}
                        </div>
                      ) : campaign.scheduledAt ? (
                        <div className="flex items-center gap-1 text-sm">
                          <Calendar className="h-3 w-3 text-muted-foreground" />
                          {formatDate(campaign.scheduledAt)}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>{getStatusBadge(campaign.status)}</TableCell>
                    <TableCell>
                      {campaign.openRate ? `${campaign.openRate}%` : "-"}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {!["sent", "sending"].includes(campaign.status) && (
                            <>
                              <DropdownMenuItem
                                onClick={() => sendNowMutation.mutate(campaign.id)}
                              >
                                <Send className="h-4 w-4 mr-2" />
                                Send Now
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                            </>
                          )}
                          {campaign.status === "scheduled" && (
                            <DropdownMenuItem
                              onClick={() => cancelMutation.mutate(campaign.id)}
                            >
                              <Pencil className="h-4 w-4 mr-2" />
                              Cancel Schedule
                            </DropdownMenuItem>
                          )}
                          {!["sent", "sending"].includes(campaign.status) && (
                            <DropdownMenuItem
                              className="text-red-600"
                              onClick={() => setDeleteId(campaign.id)}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Campaign</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this campaign? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
