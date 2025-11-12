import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Edit, Trash2 } from "lucide-react";
import type { MarketingCampaign } from "@shared/schema";

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

  const { data: campaigns = [], isLoading } = useQuery<MarketingCampaign[]>({
    queryKey: ['/api/marketing/campaigns'],
  });

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
    mutationFn: (data: any) => apiRequest('/api/marketing/campaigns', 'POST', data),
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
      apiRequest(`/api/marketing/campaigns/${id}`, 'PATCH', data),
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
    mutationFn: (id: string) => apiRequest(`/api/marketing/campaigns/${id}`, 'DELETE'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/marketing/campaigns'] });
      toast({ title: "Campaign deleted successfully" });
    },
    onError: () => {
      toast({ title: "Failed to delete campaign", variant: "destructive" });
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

      {isLoading ? (
        <div className="text-center py-12">Loading campaigns...</div>
      ) : campaigns.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          No campaigns yet. Create your first campaign to get started.
        </div>
      ) : (
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
      )}
    </div>
  );
}
