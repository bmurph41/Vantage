import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { StandardDialogShell } from "@/components/ui/standard-dialog-shell";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  User, Building, Mail, Phone, Calendar, Star, TrendingUp, 
  MapPin, Globe, Linkedin, Activity, MessageSquare, Edit, X,
  Clock, Target, Save, Check, Loader2, Users
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";
import type { Lead, Company, Contact, Activity as ActivityType, User as UserType } from "@shared/schema";

interface LeadDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  lead: Lead | null;
  onEdit?: () => void;
}

const statusColors = {
  'none': 'bg-gray-50 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
  'new': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  'contacted': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
  'qualified': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  'unqualified': 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300',
  'converted': 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300',
};

const leadSources = [
  { value: 'google_ads', label: 'Google Ads' },
  { value: 'facebook_ads', label: 'Facebook Ads' },
  { value: 'email', label: 'Email' },
  { value: 'direct', label: 'Direct' },
  { value: 'referral', label: 'Referral' },
  { value: 'organic_search', label: 'Organic Search' },
  { value: 'social', label: 'Social Media' },
  { value: 'phone', label: 'Phone' },
  { value: 'website_form', label: 'Website Form' },
  { value: 'unknown', label: 'Unknown' },
];

const prospectStatuses = [
  { value: 'active', label: 'Active' },
  { value: 'target', label: 'Target' },
  { value: 'referral', label: 'Referral' },
  { value: 'past_client', label: 'Past Client' },
  { value: 'cold', label: 'Cold' },
  { value: 'nurture', label: 'Nurture' },
];

const leadFormSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Invalid email address"),
  phone: z.string().optional(),
  company: z.string().optional(),
  jobTitle: z.string().optional(),
  website: z.string().optional(),
  linkedinUrl: z.string().optional(),
  prospectStatus: z.string(),
  leadStatus: z.enum(['none', 'new', 'contacted', 'qualified', 'unqualified', 'converted']),
  leadSource: z.string(),
  assignedToId: z.string(),
  notes: z.string().optional(),
});

type LeadFormData = z.infer<typeof leadFormSchema>;

export default function LeadDetailModal({ isOpen, onClose, lead }: LeadDetailModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("overview");
  const [isEditing, setIsEditing] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const isAutosaveRef = useRef(false);
  const autosaveTimerRef = useRef<NodeJS.Timeout | null>(null);

  const form = useForm<LeadFormData>({
    resolver: zodResolver(leadFormSchema),
    mode: 'onChange',
    defaultValues: {
      firstName: lead?.firstName || '',
      lastName: lead?.lastName || '',
      email: lead?.email || '',
      phone: lead?.phone || '',
      company: lead?.company || '',
      jobTitle: lead?.jobTitle || '',
      website: lead?.website || '',
      linkedinUrl: lead?.linkedinUrl || '',
      prospectStatus: lead?.prospectStatus || 'active',
      leadStatus: lead?.leadStatus as any || 'new',
      leadSource: lead?.leadSource || 'unknown',
      assignedToId: lead?.assignedToId || '',
      notes: lead?.notes || '',
    },
  });

  // Fetch all companies to find matching company
  const { data: companies = [] } = useQuery<Company[]>({
    queryKey: ['/api/companies'],
    enabled: isOpen && !!lead?.company,
  });

  // Fetch all contacts to find matching contact
  const { data: contacts = [] } = useQuery<Contact[]>({
    queryKey: ['/api/contacts'],
    enabled: isOpen && !!lead,
  });

  // Fetch activities related to this lead
  const { data: activities = [] } = useQuery<ActivityType[]>({
    queryKey: ['/api/activities'],
    enabled: isOpen,
  });

  // Fetch users for assigned user display
  const { data: users = [] } = useQuery<UserType[]>({
    queryKey: ['/api/users'],
    enabled: isOpen,
  });

  // Update lead mutation
  const updateLeadMutation = useMutation({
    mutationFn: async (data: LeadFormData) => {
      if (!lead) return;
      return await apiRequest('PATCH', `/api/leads/${lead.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/leads'] });
      
      if (!isAutosaveRef.current) {
        toast({
          title: "Success",
          description: "Lead updated successfully",
        });
        setIsEditing(false);
      } else {
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 2000);
        isAutosaveRef.current = false;
      }
    },
    onError: () => {
      if (!isAutosaveRef.current) {
        toast({
          title: "Error",
          description: "Failed to update lead",
          variant: "destructive",
        });
      } else {
        setSaveStatus('idle');
        isAutosaveRef.current = false;
      }
    },
  });

  const onSubmit = (data: LeadFormData) => {
    isAutosaveRef.current = false;
    updateLeadMutation.mutate(data);
  };

  const autoSave = (data: LeadFormData) => {
    isAutosaveRef.current = true;
    setSaveStatus('saving');
    updateLeadMutation.mutate(data);
  };

  // Reset form when lead changes
  useEffect(() => {
    if (lead) {
      form.reset({
        firstName: lead.firstName,
        lastName: lead.lastName,
        email: lead.email,
        phone: lead.phone || '',
        company: lead.company || '',
        jobTitle: lead.jobTitle || '',
        website: lead.website || '',
        linkedinUrl: lead.linkedinUrl || '',
        prospectStatus: lead.prospectStatus || 'active',
        leadStatus: lead.leadStatus as any,
        leadSource: lead.leadSource,
        assignedToId: lead.assignedToId,
        notes: lead.notes || '',
      });
      setIsEditing(false);
      setSaveStatus('idle');
    }
  }, [lead]);

  // Autosave on form changes when editing
  useEffect(() => {
    if (!isEditing) return;

    const subscription = form.watch(() => {
      // Clear previous timer
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
      }

      // Schedule new autosave
      autosaveTimerRef.current = setTimeout(() => {
        const formData = form.getValues();
        const isValid = form.formState.isValid;
        
        if (isValid) {
          autoSave(formData);
        }
      }, 1500); // Wait 1.5 seconds after user stops typing
    });

    return () => {
      subscription.unsubscribe();
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
      }
    };
  }, [isEditing]);

  if (!lead) {
    return null;
  }

  const assignedUser = users.find(u => u.id === form.watch('assignedToId'));
  const matchingCompany = companies.find(c => c.name.toLowerCase() === lead.company?.toLowerCase());
  const relatedContact = contacts.find(c => c.email === lead.email);
  const leadActivities = activities.filter(a => a.entityType === 'lead' && a.entityId === lead.id);

  const leadName = lead ? `${form.watch('firstName')} ${form.watch('lastName')}`.trim() : '';
  const modalTitle = leadName || 'Lead Details';

  const footerContent = (
    <div className="flex items-center justify-between w-full">
      <div className="flex items-center gap-2">
        <Badge className={statusColors[form.watch('leadStatus') as keyof typeof statusColors]}>
          {form.watch('leadStatus').replace('_', ' ')}
        </Badge>
        <Badge variant="outline" className="capitalize">
          {form.watch('prospectStatus').replace('_', ' ')}
        </Badge>
      </div>
      <div className="flex gap-2 items-center">
        {isEditing && (
          <div className="flex items-center gap-1.5 text-sm mr-2" data-testid="text-save-status">
            {saveStatus === 'saving' && (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                <span className="text-gray-600">Saving...</span>
              </>
            )}
            {saveStatus === 'saved' && (
              <>
                <Check className="w-4 h-4 text-green-600" />
                <span className="text-green-600">Saved</span>
              </>
            )}
          </div>
        )}
        {isEditing ? (
          <Button 
            onClick={() => {
              setIsEditing(false);
              form.reset();
              setSaveStatus('idle');
            }} 
            variant="outline" 
            size="sm"
            data-testid="button-done-edit"
          >
            Done
          </Button>
        ) : (
          <Button 
            onClick={() => setIsEditing(true)} 
            variant="outline" 
            size="sm" 
            data-testid="button-edit-lead"
          >
            <Edit className="w-4 h-4 mr-2" />
            Edit
          </Button>
        )}
      </div>
    </div>
  );

  return (
    <StandardDialogShell
      open={isOpen}
      onOpenChange={onClose}
      title={modalTitle}
      icon={Users}
      size="lg"
      showProgressBar={true}
      footer={footerContent}
      className="max-h-[90vh] overflow-hidden flex flex-col"
    >
      <div data-testid="modal-lead-detail">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="flex w-full overflow-x-auto scrollbar-hide sm:grid sm:grid-cols-4 flex-shrink-0">
            <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
            <TabsTrigger value="company" data-testid="tab-company">Company</TabsTrigger>
            <TabsTrigger value="activity" data-testid="tab-activity">Activity</TabsTrigger>
            <TabsTrigger value="notes" data-testid="tab-notes">Notes</TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto mt-4">
            <TabsContent value="overview" className="mt-0 space-y-4">
              {/* Contact Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <User className="w-5 h-5" />
                    Contact Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="firstName" className="font-semibold">First Name</Label>
                      {isEditing ? (
                        <Input
                          id="firstName"
                          {...form.register('firstName')}
                          className="border-2 border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                          data-testid="input-first-name"
                        />
                      ) : (
                        <div className="font-medium px-3 py-2">{form.watch('firstName')}</div>
                      )}
                      {form.formState.errors.firstName && (
                        <p className="text-sm text-red-500">{form.formState.errors.firstName.message}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="lastName" className="font-semibold">Last Name</Label>
                      {isEditing ? (
                        <Input
                          id="lastName"
                          {...form.register('lastName')}
                          className="border-2 border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                          data-testid="input-last-name"
                        />
                      ) : (
                        <div className="font-medium px-3 py-2">{form.watch('lastName')}</div>
                      )}
                      {form.formState.errors.lastName && (
                        <p className="text-sm text-red-500">{form.formState.errors.lastName.message}</p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="email" className="font-semibold flex items-center gap-2">
                        <Mail className="w-4 h-4 text-gray-500" />
                        Email
                      </Label>
                      {isEditing ? (
                        <Input
                          id="email"
                          type="email"
                          {...form.register('email')}
                          className="border-2 border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                          data-testid="input-email"
                        />
                      ) : (
                        <div className="font-medium px-3 py-2">{form.watch('email')}</div>
                      )}
                      {form.formState.errors.email && (
                        <p className="text-sm text-red-500">{form.formState.errors.email.message}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="phone" className="font-semibold flex items-center gap-2">
                        <Phone className="w-4 h-4 text-gray-500" />
                        Phone
                      </Label>
                      {isEditing ? (
                        <Input
                          id="phone"
                          {...form.register('phone')}
                          className="border-2 border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                          data-testid="input-phone"
                        />
                      ) : (
                        <div className="font-medium px-3 py-2">{form.watch('phone') || '-'}</div>
                      )}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="company" className="font-semibold flex items-center gap-2">
                        <Building className="w-4 h-4 text-gray-500" />
                        Company
                      </Label>
                      {isEditing ? (
                        <Input
                          id="company"
                          {...form.register('company')}
                          className="border-2 border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                          data-testid="input-company"
                        />
                      ) : (
                        <div className="font-medium px-3 py-2">{form.watch('company') || '-'}</div>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="jobTitle" className="font-semibold flex items-center gap-2">
                        <Target className="w-4 h-4 text-gray-500" />
                        Job Title
                      </Label>
                      {isEditing ? (
                        <Input
                          id="jobTitle"
                          {...form.register('jobTitle')}
                          className="border-2 border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                          data-testid="input-job-title"
                        />
                      ) : (
                        <div className="font-medium px-3 py-2">{form.watch('jobTitle') || '-'}</div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="website" className="font-semibold flex items-center gap-2">
                      <Globe className="w-4 h-4 text-gray-500" />
                      Website
                    </Label>
                    {isEditing ? (
                      <Input
                        id="website"
                        {...form.register('website')}
                        className="border-2 border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                        data-testid="input-website"
                      />
                    ) : form.watch('website') ? (
                      <a 
                        href={form.watch('website')} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="font-medium text-blue-600 hover:underline px-3 py-2 block"
                      >
                        {form.watch('website')}
                      </a>
                    ) : (
                      <div className="px-3 py-2">-</div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="linkedinUrl" className="font-semibold flex items-center gap-2">
                      <Linkedin className="w-4 h-4 text-gray-500" />
                      LinkedIn
                    </Label>
                    {isEditing ? (
                      <Input
                        id="linkedinUrl"
                        {...form.register('linkedinUrl')}
                        className="border-2 border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                        data-testid="input-linkedin"
                      />
                    ) : form.watch('linkedinUrl') ? (
                      <a 
                        href={form.watch('linkedinUrl')} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="font-medium text-blue-600 hover:underline px-3 py-2 block"
                      >
                        View Profile
                      </a>
                    ) : (
                      <div className="px-3 py-2">-</div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Lead Details */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <TrendingUp className="w-5 h-5" />
                    Lead Details
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="leadStatus" className="font-semibold">Status</Label>
                      {isEditing ? (
                        <Select
                          value={form.watch('leadStatus')}
                          onValueChange={(value) => form.setValue('leadStatus', value as any)}
                        >
                          <SelectTrigger 
                            className="border-2 border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                            data-testid="select-lead-status"
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">None</SelectItem>
                            <SelectItem value="new">New</SelectItem>
                            <SelectItem value="contacted">Contacted</SelectItem>
                            <SelectItem value="qualified">Qualified</SelectItem>
                            <SelectItem value="unqualified">Unqualified</SelectItem>
                            <SelectItem value="converted">Converted</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <div className="font-medium capitalize px-3 py-2">{form.watch('leadStatus').replace('_', ' ')}</div>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="prospectStatus" className="font-semibold flex items-center gap-2">
                        <Star className="w-4 h-4 text-gray-500" />
                        Prospect Status
                      </Label>
                      {isEditing ? (
                        <Select
                          value={form.watch('prospectStatus')}
                          onValueChange={(value) => form.setValue('prospectStatus', value)}
                        >
                          <SelectTrigger 
                            className="border-2 border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                            data-testid="select-prospect-status"
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {prospectStatuses.map((status) => (
                              <SelectItem key={status.value} value={status.value}>
                                {status.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <div className="font-medium capitalize px-3 py-2">
                          {prospectStatuses.find(s => s.value === form.watch('prospectStatus'))?.label || 'Active'}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="leadSource" className="font-semibold">Source</Label>
                      {isEditing ? (
                        <Select
                          value={form.watch('leadSource')}
                          onValueChange={(value) => form.setValue('leadSource', value)}
                        >
                          <SelectTrigger 
                            className="border-2 border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                            data-testid="select-lead-source"
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {leadSources.map((source) => (
                              <SelectItem key={source.value} value={source.value}>
                                {source.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <div className="font-medium capitalize px-3 py-2">
                          {leadSources.find(s => s.value === form.watch('leadSource'))?.label || 'Unknown'}
                        </div>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="assignedToId" className="font-semibold">Assigned To</Label>
                      {isEditing ? (
                        <Select
                          value={form.watch('assignedToId')}
                          onValueChange={(value) => form.setValue('assignedToId', value)}
                        >
                          <SelectTrigger 
                            className="border-2 border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                            data-testid="select-assigned-to"
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {users.map((user) => (
                              <SelectItem key={user.id} value={user.id}>
                                {user.firstName} {user.lastName}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <div className="font-medium px-3 py-2">
                          {assignedUser ? `${assignedUser.firstName} ${assignedUser.lastName}` : 'Unassigned'}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Created</div>
                      <div className="font-medium flex items-center gap-2 px-3 py-2">
                        <Calendar className="w-4 h-4" />
                        {format(new Date(lead.createdAt), 'MM/dd/yyyy')}
                      </div>
                    </div>
                    {lead.lastActivityDate && (
                      <div>
                        <div className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Last Activity</div>
                        <div className="font-medium flex items-center gap-2 px-3 py-2">
                          <Clock className="w-4 h-4" />
                          {format(new Date(lead.lastActivityDate), 'MM/dd/yyyy')}
                        </div>
                      </div>
                    )}
                  </div>

                  {lead.utmCampaign && (
                    <div>
                      <div className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Campaign</div>
                      <div className="font-medium px-3 py-2">{lead.utmCampaign}</div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="company" className="mt-0 space-y-4">
              {matchingCompany ? (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Building className="w-5 h-5" />
                      {matchingCompany.name}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {matchingCompany.industry && (
                      <div>
                        <div className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Industry</div>
                        <div className="font-medium">{matchingCompany.industry}</div>
                      </div>
                    )}
                    {matchingCompany.size && (
                      <div>
                        <div className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Company Size</div>
                        <div className="font-medium">{matchingCompany.size}</div>
                      </div>
                    )}
                    {matchingCompany.website && (
                      <div>
                        <div className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Website</div>
                        <a href={matchingCompany.website} target="_blank" rel="noopener noreferrer" className="font-medium text-blue-600 hover:underline">
                          {matchingCompany.website}
                        </a>
                      </div>
                    )}
                    {matchingCompany.phone && (
                      <div>
                        <div className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Phone</div>
                        <div className="font-medium">{matchingCompany.phone}</div>
                      </div>
                    )}
                    {matchingCompany.address && (
                      <div>
                        <div className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Address</div>
                        <div className="font-medium">{matchingCompany.address}</div>
                      </div>
                    )}
                    {matchingCompany.description && (
                      <div>
                        <div className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Description</div>
                        <div className="text-gray-700 dark:text-gray-300">{matchingCompany.description}</div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ) : lead.company ? (
                <Card>
                  <CardContent className="py-8 text-center">
                    <Building className="w-12 h-12 mx-auto text-gray-400 mb-3" />
                    <h3 className="text-lg font-medium mb-2">Company: {lead.company}</h3>
                    <p className="text-gray-500 mb-4">No detailed company record found</p>
                    <Button variant="outline" size="sm" data-testid="button-create-company">
                      Create Company Record
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="py-8 text-center">
                    <Building className="w-12 h-12 mx-auto text-gray-400 mb-3" />
                    <p className="text-gray-500">No company associated with this lead</p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="activity" className="mt-0 space-y-4">
              {leadActivities.length > 0 ? (
                <div className="space-y-3">
                  {leadActivities.map((activity) => (
                    <Card key={activity.id}>
                      <CardContent className="py-4">
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                            <Activity className="w-5 h-5 text-blue-600" />
                          </div>
                          <div className="flex-1">
                            <div className="font-medium capitalize">{activity.type.replace('_', ' ')}</div>
                            <div className="text-sm text-gray-600 dark:text-gray-400">{activity.description}</div>
                            <div className="text-xs text-gray-500 mt-1">
                              {format(new Date(activity.createdAt), 'MM/dd/yyyy h:mm a')}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <Card>
                  <CardContent className="py-8 text-center">
                    <Activity className="w-12 h-12 mx-auto text-gray-400 mb-3" />
                    <p className="text-gray-500">No activity recorded yet</p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="notes" className="mt-0 space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Notes</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <Label htmlFor="notes" className="font-semibold">Add or edit notes</Label>
                    {isEditing ? (
                      <Textarea
                        id="notes"
                        placeholder="Add notes about this lead..."
                        {...form.register('notes')}
                        rows={6}
                        className="border-2 border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                        data-testid="textarea-notes"
                      />
                    ) : (
                      <div className="min-h-[150px] p-3 border rounded-md bg-gray-50 dark:bg-gray-900">
                        <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                          {form.watch('notes') || 'No notes yet'}
                        </p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </StandardDialogShell>
  );
}
