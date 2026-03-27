import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Plus,
  Edit,
  Trash2,
  Mail,
  Check,
  X,
  ExternalLink,
  RefreshCw,
  Users,
  Send,
  Calendar,
  TrendingUp,
  AlertCircle,
  Loader2,
  Link2Off,
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import type { MarketingCampaign } from "@shared/schema";

interface Provider {
  slug: string;
  displayName: string;
  description: string;
  connected: boolean;
  configured: boolean;
  comingSoon?: boolean;
  connection?: {
    accountLabel?: string;
    expiresAt?: string;
    lastSyncAt?: string;
  };
}

interface CCStatus {
  connected: boolean;
  accountLabel?: string;
  expiresAt?: string;
  lastSyncAt?: string;
  needsRefresh?: boolean;
}

interface CCList {
  id: string;
  name: string;
  contactCount: number;
}

interface CCCampaign {
  id: string;
  name: string;
  status: string;
  subject?: string;
  sentAt?: string;
  createdAt: string;
}

interface Lead {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  source: string;
  syncStatus: string;
  createdAt: string;
}

const campaignFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  status: z.enum(['planning', 'active', 'paused', 'completed', 'archived']),
  channel: z.enum(['email', 'paid_ads', 'social_media', 'content', 'events', 'direct_mail', 'seo', 'partnerships', 'referral', 'other']),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  budgetPlanned: z.string().optional(),
  budgetActual: z.string().optional(),
  goalLeads: z.string().optional(),
  goalRevenue: z.string().optional(),
  goalRoas: z.string().optional(),
  utmSource: z.string().optional(),
  utmMedium: z.string().optional(),
  utmCampaign: z.string().optional(),
  notes: z.string().optional(),
});

type CampaignFormData = z.infer<typeof campaignFormSchema>;

const statusBadgeVariant = (status: string) => {
  const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
    planning: 'outline',
    active: 'default',
    paused: 'secondary',
    completed: 'secondary',
    archived: 'destructive',
  };
  return variants[status] || 'outline';
};

export default function Campaigns() {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<MarketingCampaign | null>(null);

  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [selectedListId, setSelectedListId] = useState<string>("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("connected") === "constant_contact") {
      toast({
        title: "Connected!",
        description: "Successfully connected to Constant Contact.",
      });
      window.history.replaceState({}, "", window.location.pathname + "?tab=campaigns");
      queryClient.invalidateQueries({ queryKey: ["/api/email-marketing"] });
    }
    if (params.get("connected") === "mailchimp") {
      toast({
        title: "Connected!",
        description: "Successfully connected to Mailchimp.",
      });
      window.history.replaceState({}, "", window.location.pathname + "?tab=campaigns");
      queryClient.invalidateQueries({ queryKey: ["/api/email-marketing"] });
    }
    if (params.get("error")) {
      toast({
        title: "Connection Failed",
        description: "Failed to connect. Please try again.",
        variant: "destructive",
      });
      window.history.replaceState({}, "", window.location.pathname + "?tab=campaigns");
    }
  }, [toast]);

  const { data: campaigns = [], isLoading } = useQuery<MarketingCampaign[]>({
    queryKey: ['/api/marketing/campaigns'],
  });

  const { data: providers } = useQuery<Provider[]>({
    queryKey: ["/api/email-marketing/providers"],
  });

  const { data: ccStatus, isLoading: ccStatusLoading } = useQuery<CCStatus>({
    queryKey: ["/api/email-marketing/constant-contact/status"],
  });

  const { data: mcStatus, isLoading: mcStatusLoading } = useQuery<CCStatus>({
    queryKey: ["/api/email-marketing/mailchimp/status"],
  });

  const { data: ccLists, isLoading: ccListsLoading } = useQuery<CCList[]>({
    queryKey: ["/api/email-marketing/constant-contact/lists"],
    enabled: ccStatus?.connected === true,
  });

  const { data: mcLists } = useQuery<CCList[]>({
    queryKey: ["/api/email-marketing/mailchimp/lists"],
    enabled: mcStatus?.connected === true,
  });

  const { data: ccCampaigns, isLoading: ccCampaignsLoading } = useQuery<CCCampaign[]>({
    queryKey: ["/api/email-marketing/constant-contact/campaigns"],
    enabled: ccStatus?.connected === true,
  });

  const { data: mcCampaigns, isLoading: mcCampaignsLoading } = useQuery<CCCampaign[]>({
    queryKey: ["/api/email-marketing/mailchimp/campaigns"],
    enabled: mcStatus?.connected === true,
  });

  const { data: leads, isLoading: leadsLoading } = useQuery<Lead[]>({
    queryKey: ["/api/email-marketing/leads"],
  });

  const ccProvider = providers?.find(p => p.slug === "constant_contact");
  const mcProvider = providers?.find(p => p.slug === "mailchimp");
  const isConnected = ccStatus?.connected === true;
  const isMcConnected = mcStatus?.connected === true;
  const anyProviderConnected = isConnected || isMcConnected;

  const form = useForm<CampaignFormData>({
    resolver: zodResolver(campaignFormSchema),
    defaultValues: {
      name: '',
      description: '',
      status: 'planning',
      channel: 'other',
      startDate: '',
      endDate: '',
      budgetPlanned: '',
      budgetActual: '',
      goalLeads: '',
      goalRevenue: '',
      goalRoas: '',
      utmSource: '',
      utmMedium: '',
      utmCampaign: '',
      notes: '',
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest('POST', '/api/marketing/campaigns', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/marketing/campaigns'] });
      toast({ title: "Campaign created successfully" });
      setDialogOpen(false);
      form.reset();
    },
    onError: () => {
      toast({ title: "Failed to create campaign", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      apiRequest('PATCH', `/api/marketing/campaigns/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/marketing/campaigns'] });
      toast({ title: "Campaign updated successfully" });
      setDialogOpen(false);
      setEditingCampaign(null);
      form.reset();
    },
    onError: () => {
      toast({ title: "Failed to update campaign", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest('DELETE', `/api/marketing/campaigns/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/marketing/campaigns'] });
      toast({ title: "Campaign deleted successfully" });
    },
    onError: () => {
      toast({ title: "Failed to delete campaign", variant: "destructive" });
    },
  });

  const connectMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/email-marketing/constant-contact/auth");
      const data = await res.json();
      if (data.authUrl) {
        window.location.href = data.authUrl;
      } else {
        throw new Error(data.message || "Failed to generate auth URL");
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Connection Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const connectMailchimpMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/email-marketing/mailchimp/auth");
      const data = await res.json();
      if (data.authUrl) {
        window.location.href = data.authUrl;
      } else {
        throw new Error(data.message || "Failed to generate auth URL");
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Connection Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/email-marketing/constant-contact/disconnect");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/email-marketing"] });
      toast({
        title: "Disconnected",
        description: "Constant Contact has been disconnected.",
      });
    },
  });

  const disconnectMailchimpMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/email-marketing/mailchimp/disconnect");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/email-marketing"] });
      toast({
        title: "Disconnected",
        description: "Mailchimp has been disconnected.",
      });
    },
  });

  const subscribeMutation = useMutation({
    mutationFn: async (data: { email: string; firstName?: string; lastName?: string; listIds: string[] }) => {
      return apiRequest("POST", "/api/email-marketing/constant-contact/subscribe", data);
    },
    onSuccess: () => {
      toast({
        title: "Contact Added",
        description: "Contact has been added to the selected list.",
      });
      setEmail("");
      setFirstName("");
      setLastName("");
      setSelectedListId("");
      queryClient.invalidateQueries({ queryKey: ["/api/email-marketing/leads"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to Add Contact",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: CampaignFormData) => {
    const payload = {
      ...data,
      budgetPlanned: data.budgetPlanned ? parseFloat(data.budgetPlanned) : null,
      budgetActual: data.budgetActual ? parseFloat(data.budgetActual) : null,
      goalLeads: data.goalLeads ? parseInt(data.goalLeads) : null,
      goalRevenue: data.goalRevenue ? parseFloat(data.goalRevenue) : null,
      goalRoas: data.goalRoas ? parseFloat(data.goalRoas) : null,
      startDate: data.startDate || null,
      endDate: data.endDate || null,
    };

    if (editingCampaign) {
      updateMutation.mutate({ id: editingCampaign.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const handleEdit = (campaign: MarketingCampaign) => {
    setEditingCampaign(campaign);
    form.reset({
      name: campaign.name,
      description: campaign.description || '',
      status: campaign.status,
      channel: campaign.channel,
      startDate: campaign.startDate || '',
      endDate: campaign.endDate || '',
      budgetPlanned: campaign.budgetPlanned?.toString() || '',
      budgetActual: campaign.budgetActual?.toString() || '',
      goalLeads: campaign.goalLeads?.toString() || '',
      goalRevenue: campaign.goalRevenue?.toString() || '',
      goalRoas: campaign.goalRoas?.toString() || '',
      utmSource: campaign.utmSource || '',
      utmMedium: campaign.utmMedium || '',
      utmCampaign: campaign.utmCampaign || '',
      notes: campaign.notes || '',
    });
    setDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this campaign?')) {
      deleteMutation.mutate(id);
    }
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
    setEditingCampaign(null);
    form.reset();
  };

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !selectedListId) {
      toast({
        title: "Missing Information",
        description: "Please enter an email and select a list.",
        variant: "destructive",
      });
      return;
    }
    subscribeMutation.mutate({
      email,
      firstName: firstName || undefined,
      lastName: lastName || undefined,
      listIds: [selectedListId],
    });
  };

  const showCombinedEmpty = campaigns.length === 0 && !anyProviderConnected && !isLoading && !ccStatusLoading && !mcStatusLoading;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold" data-testid="page-title">Marketing Campaigns</h1>
        <Dialog open={dialogOpen} onOpenChange={handleDialogClose}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-campaign">
              <Plus className="w-4 h-4 mr-2" />
              Add Campaign
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingCampaign ? 'Edit Campaign' : 'Add Campaign'}</DialogTitle>
              <DialogDescription>
                {editingCampaign ? 'Update campaign details' : 'Create a new marketing campaign'}
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem className="col-span-2">
                        <FormLabel>Campaign Name *</FormLabel>
                        <FormControl>
                          <Input {...field} data-testid="input-name" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Status *</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-status">
                              <SelectValue placeholder="Select status" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="planning">Planning</SelectItem>
                            <SelectItem value="active">Active</SelectItem>
                            <SelectItem value="paused">Paused</SelectItem>
                            <SelectItem value="completed">Completed</SelectItem>
                            <SelectItem value="archived">Archived</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="channel"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Channel *</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-channel">
                              <SelectValue placeholder="Select channel" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="email">Email</SelectItem>
                            <SelectItem value="paid_ads">Paid Ads</SelectItem>
                            <SelectItem value="social_media">Social Media</SelectItem>
                            <SelectItem value="content">Content</SelectItem>
                            <SelectItem value="events">Events</SelectItem>
                            <SelectItem value="direct_mail">Direct Mail</SelectItem>
                            <SelectItem value="seo">SEO</SelectItem>
                            <SelectItem value="partnerships">Partnerships</SelectItem>
                            <SelectItem value="referral">Referral</SelectItem>
                            <SelectItem value="other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="startDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Start Date</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} data-testid="input-start-date" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="endDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>End Date</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} data-testid="input-end-date" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="budgetPlanned"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Planned Budget ($)</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" {...field} data-testid="input-budget-planned" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="budgetActual"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Actual Budget ($)</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" {...field} data-testid="input-budget-actual" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="goalLeads"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Lead Goal</FormLabel>
                        <FormControl>
                          <Input type="number" {...field} data-testid="input-goal-leads" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="goalRevenue"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Revenue Goal ($)</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" {...field} data-testid="input-goal-revenue" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="goalRoas"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>ROAS Goal</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" {...field} data-testid="input-goal-roas" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="utmSource"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>UTM Source</FormLabel>
                        <FormControl>
                          <Input {...field} data-testid="input-utm-source" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="utmMedium"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>UTM Medium</FormLabel>
                        <FormControl>
                          <Input {...field} data-testid="input-utm-medium" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="utmCampaign"
                    render={({ field }) => (
                      <FormItem className="col-span-2">
                        <FormLabel>UTM Campaign</FormLabel>
                        <FormControl>
                          <Input {...field} data-testid="input-utm-campaign" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem className="col-span-2">
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Textarea {...field} data-testid="input-description" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem className="col-span-2">
                        <FormLabel>Notes</FormLabel>
                        <FormControl>
                          <Textarea {...field} data-testid="input-notes" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <DialogFooter>
                  <Button type="submit" data-testid="button-submit" disabled={createMutation.isPending || updateMutation.isPending}>
                    {(createMutation.isPending || updateMutation.isPending) ? 'Saving...' : (editingCampaign ? 'Update' : 'Create')}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Mail className="w-5 h-5 text-blue-600" />
                <CardTitle>Constant Contact</CardTitle>
              </div>
              {isConnected ? (
                <Badge variant="default" className="bg-green-100 text-green-800" data-testid="badge-cc-connected">
                  <Check className="w-3 h-3 mr-1" />
                  Connected
                </Badge>
              ) : (
                <Badge variant="outline" data-testid="badge-cc-disconnected">
                  <X className="w-3 h-3 mr-1" />
                  Not Connected
                </Badge>
              )}
            </div>
            <CardDescription>
              Professional email marketing, automation, and list management
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {ccStatusLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-4 w-32" />
              </div>
            ) : isConnected ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Account:</span>
                  <span className="font-medium">{ccStatus?.accountLabel || "Connected Account"}</span>
                </div>
                {ccStatus?.expiresAt && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Token Expires:</span>
                    <span className={ccStatus.needsRefresh ? "text-amber-600" : ""}>
                      {formatDistanceToNow(new Date(ccStatus.expiresAt), { addSuffix: true })}
                    </span>
                  </div>
                )}
                {ccLists && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Contact Lists:</span>
                    <span className="font-medium">{ccLists.length}</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground space-y-2">
                <p>Connect Constant Contact to:</p>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li>Sync contacts from MarinaMatch leads</li>
                  <li>Track email campaign performance</li>
                  <li>Manage subscriber lists</li>
                </ul>
              </div>
            )}
          </CardContent>
          <CardFooter>
            {isConnected ? (
              <div className="flex gap-2 w-full">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/email-marketing"] })}
                  data-testid="btn-refresh-cc"
                >
                  <RefreshCw className="w-4 h-4 mr-1" />
                  Refresh
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => disconnectMutation.mutate()}
                  disabled={disconnectMutation.isPending}
                  data-testid="btn-disconnect-cc"
                >
                  <Link2Off className="w-4 h-4 mr-1" />
                  Disconnect
                </Button>
              </div>
            ) : (
              <Button
                onClick={() => connectMutation.mutate()}
                disabled={connectMutation.isPending || !ccProvider?.configured}
                className="w-full"
                data-testid="btn-connect-cc"
              >
                {connectMutation.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <ExternalLink className="w-4 h-4 mr-2" />
                )}
                {ccProvider?.configured ? "Connect Constant Contact" : "API Keys Required"}
              </Button>
            )}
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Mail className="w-5 h-5 text-yellow-600" />
                <CardTitle>Mailchimp</CardTitle>
              </div>
              {isMcConnected ? (
                <Badge variant="default" className="bg-green-100 text-green-800" data-testid="badge-mc-connected">
                  <Check className="w-3 h-3 mr-1" />
                  Connected
                </Badge>
              ) : (
                <Badge variant="outline" data-testid="badge-mc-disconnected">
                  <X className="w-3 h-3 mr-1" />
                  Not Connected
                </Badge>
              )}
            </div>
            <CardDescription>
              All-in-one marketing platform for growing businesses
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {mcStatusLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-4 w-32" />
              </div>
            ) : isMcConnected ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Account:</span>
                  <span className="font-medium">{mcStatus?.accountLabel || "Connected Account"}</span>
                </div>
                {mcLists && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Audiences:</span>
                    <span className="font-medium">{mcLists.length}</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground space-y-2">
                <p>Connect Mailchimp to:</p>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li>Sync contacts from MarinaMatch leads</li>
                  <li>Track email campaign performance</li>
                  <li>Manage subscriber audiences</li>
                </ul>
              </div>
            )}
          </CardContent>
          <CardFooter>
            {isMcConnected ? (
              <div className="flex gap-2 w-full">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/email-marketing/mailchimp"] })}
                  data-testid="btn-refresh-mc"
                >
                  <RefreshCw className="w-4 h-4 mr-1" />
                  Refresh
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => disconnectMailchimpMutation.mutate()}
                  disabled={disconnectMailchimpMutation.isPending}
                  data-testid="btn-disconnect-mc"
                >
                  <Link2Off className="w-4 h-4 mr-1" />
                  Disconnect
                </Button>
              </div>
            ) : (
              <Button
                onClick={() => connectMailchimpMutation.mutate()}
                disabled={connectMailchimpMutation.isPending || !mcProvider?.configured}
                className="w-full"
                data-testid="btn-connect-mailchimp"
              >
                {connectMailchimpMutation.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <ExternalLink className="w-4 h-4 mr-2" />
                )}
                {mcProvider?.configured ? "Connect Mailchimp" : "API Keys Required"}
              </Button>
            )}
          </CardFooter>
        </Card>
      </div>

      {isLoading ? (
        <div className="text-center py-12">Loading campaigns...</div>
      ) : showCombinedEmpty ? (
        <Card className="border-dashed">
          <CardContent className="py-8 text-center">
            <Mail className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Get Started with Marketing</h3>
            <p className="text-muted-foreground mb-4 max-w-md mx-auto">
              Create your first campaign or connect an email marketing provider to start syncing contacts and tracking performance.
            </p>
          </CardContent>
        </Card>
      ) : campaigns.length > 0 ? (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Channel</TableHead>
                <TableHead>Budget (Planned / Actual)</TableHead>
                <TableHead>Dates</TableHead>
                <TableHead>Goals</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {campaigns.map((campaign) => (
                <TableRow key={campaign.id} data-testid={`row-campaign-${campaign.id}`}>
                  <TableCell className="font-medium" data-testid={`text-name-${campaign.id}`}>
                    {campaign.name}
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusBadgeVariant(campaign.status)} data-testid={`badge-status-${campaign.id}`}>
                      {campaign.status}
                    </Badge>
                  </TableCell>
                  <TableCell data-testid={`text-channel-${campaign.id}`}>
                    {campaign.channel?.replace(/_/g, ' ')}
                  </TableCell>
                  <TableCell data-testid={`text-budget-${campaign.id}`}>
                    ${campaign.budgetPlanned?.toLocaleString() || '0'} / ${campaign.budgetActual?.toLocaleString() || '0'}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground" data-testid={`text-dates-${campaign.id}`}>
                    {campaign.startDate || 'N/A'} - {campaign.endDate || 'N/A'}
                  </TableCell>
                  <TableCell className="text-sm" data-testid={`text-goals-${campaign.id}`}>
                    {campaign.goalLeads ? `${campaign.goalLeads} leads` : ''}
                    {campaign.goalRevenue ? `, $${campaign.goalRevenue.toLocaleString()}` : ''}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(campaign)}
                        data-testid={`button-edit-${campaign.id}`}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(campaign.id)}
                        data-testid={`button-delete-${campaign.id}`}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="text-center py-12 text-muted-foreground">
          No campaigns yet. Create your first campaign to get started.
        </div>
      )}

      {anyProviderConnected && (
        <>
          <div className="grid gap-6 md:grid-cols-2">
            {isConnected && (
              <Card>
                <CardHeader>
                  <div className="flex items-center space-x-2">
                    <TrendingUp className="w-5 h-5 text-primary" />
                    <CardTitle>Recent Campaigns (Constant Contact)</CardTitle>
                  </div>
                  <CardDescription>
                    Email campaigns from your Constant Contact account
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {ccCampaignsLoading ? (
                    <div className="space-y-3">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="flex items-center justify-between">
                          <Skeleton className="h-4 w-48" />
                          <Skeleton className="h-4 w-20" />
                        </div>
                      ))}
                    </div>
                  ) : ccCampaigns?.length ? (
                    <div className="space-y-3">
                      {ccCampaigns.slice(0, 5).map((campaign) => (
                        <div key={campaign.id} className="flex items-center justify-between border-b pb-2 last:border-0">
                          <div>
                            <p className="font-medium text-sm">{campaign.name}</p>
                            {campaign.subject && (
                              <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                                {campaign.subject}
                              </p>
                            )}
                          </div>
                          <div className="text-right">
                            <Badge variant={campaign.status === "SENT" ? "default" : "secondary"} className="text-xs">
                              {campaign.status}
                            </Badge>
                            {campaign.sentAt && (
                              <p className="text-xs text-muted-foreground mt-1">
                                {format(new Date(campaign.sentAt), "MM/dd/yyyy")}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground text-center py-4">
                      No campaigns found
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {isMcConnected && (
              <Card>
                <CardHeader>
                  <div className="flex items-center space-x-2">
                    <TrendingUp className="w-5 h-5 text-primary" />
                    <CardTitle>Recent Campaigns (Mailchimp)</CardTitle>
                  </div>
                  <CardDescription>
                    Email campaigns from your Mailchimp account
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {mcCampaignsLoading ? (
                    <div className="space-y-3">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="flex items-center justify-between">
                          <Skeleton className="h-4 w-48" />
                          <Skeleton className="h-4 w-20" />
                        </div>
                      ))}
                    </div>
                  ) : mcCampaigns?.length ? (
                    <div className="space-y-3">
                      {mcCampaigns.slice(0, 5).map((campaign) => (
                        <div key={campaign.id} className="flex items-center justify-between border-b pb-2 last:border-0">
                          <div>
                            <p className="font-medium text-sm">{campaign.name}</p>
                            {campaign.subject && (
                              <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                                {campaign.subject}
                              </p>
                            )}
                          </div>
                          <div className="text-right">
                            <Badge variant={campaign.status === "SENT" ? "default" : "secondary"} className="text-xs">
                              {campaign.status}
                            </Badge>
                            {campaign.sentAt && (
                              <p className="text-xs text-muted-foreground mt-1">
                                {format(new Date(campaign.sentAt), "MM/dd/yyyy")}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground text-center py-4">
                      No campaigns found
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <div className="flex items-center space-x-2">
                  <Users className="w-5 h-5 text-primary" />
                  <CardTitle>Recent Leads</CardTitle>
                </div>
                <CardDescription>
                  Contacts added through MarinaMatch
                </CardDescription>
              </CardHeader>
              <CardContent>
                {leadsLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="flex items-center justify-between">
                        <Skeleton className="h-4 w-48" />
                        <Skeleton className="h-4 w-20" />
                      </div>
                    ))}
                  </div>
                ) : leads?.length ? (
                  <div className="space-y-3">
                    {leads.slice(0, 5).map((lead) => (
                      <div key={lead.id} className="flex items-center justify-between border-b pb-2 last:border-0">
                        <div>
                          <p className="font-medium text-sm">{lead.email}</p>
                          {(lead.firstName || lead.lastName) && (
                            <p className="text-xs text-muted-foreground">
                              {[lead.firstName, lead.lastName].filter(Boolean).join(" ")}
                            </p>
                          )}
                        </div>
                        <div className="text-right">
                          <Badge
                            variant={lead.syncStatus === "synced" ? "default" : "secondary"}
                            className="text-xs"
                          >
                            {lead.syncStatus === "synced" ? "Synced" : "Pending"}
                          </Badge>
                          <p className="text-xs text-muted-foreground mt-1">
                            {formatDistanceToNow(new Date(lead.createdAt), { addSuffix: true })}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground text-center py-4">
                    No leads captured yet
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}

      {isConnected && (
        <Card>
          <CardHeader>
            <div className="flex items-center space-x-2">
              <Users className="w-5 h-5 text-primary" />
              <CardTitle>Add Contact to List</CardTitle>
            </div>
            <CardDescription>
              Capture leads and sync them directly to Constant Contact
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubscribe} className="grid gap-4 md:grid-cols-5">
              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="contact@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  data-testid="input-email"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name</Label>
                <Input
                  id="firstName"
                  placeholder="John"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  data-testid="input-first-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name</Label>
                <Input
                  id="lastName"
                  placeholder="Doe"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  data-testid="input-last-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="list">Contact List *</Label>
                <Select value={selectedListId} onValueChange={setSelectedListId}>
                  <SelectTrigger id="list" data-testid="select-list">
                    <SelectValue placeholder="Select a list" />
                  </SelectTrigger>
                  <SelectContent>
                    {ccListsLoading ? (
                      <div className="p-2 text-sm text-muted-foreground">Loading lists...</div>
                    ) : ccLists?.length ? (
                      ccLists.map((list) => (
                        <SelectItem key={list.id} value={list.id}>
                          {list.name} ({list.contactCount} contacts)
                        </SelectItem>
                      ))
                    ) : (
                      <div className="p-2 text-sm text-muted-foreground">No lists available</div>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <Button
                  type="submit"
                  disabled={subscribeMutation.isPending || !email || !selectedListId}
                  className="w-full"
                  data-testid="btn-subscribe"
                >
                  {subscribeMutation.isPending ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4 mr-2" />
                  )}
                  Add Contact
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
