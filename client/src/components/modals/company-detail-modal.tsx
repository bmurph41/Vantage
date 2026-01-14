import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Building, Globe, MapPin, Phone, Mail, Users, Edit2, Save, X, FileText, 
  DollarSign, TrendingUp, Activity, Calendar, Clock, Check, Loader2,
  Plus, ExternalLink, Anchor, MessageSquare, CheckSquare, FolderOpen,
  MoreVertical, Send, Filter, ArrowUpRight, Briefcase, Target, AlertCircle
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format, formatDistanceToNow, differenceInDays } from "date-fns";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { AddressInput, type AddressComponents } from "@/components/address-input";
import type { Company, Contact, Deal, Property, Activity as ActivityType, Note, CrmTask, CrmFile } from "@shared/schema";

interface CompanyDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  company: Company | null;
  onContactClick?: (contact: Contact) => void;
  onPropertyClick?: (property: Property) => void;
  onDealClick?: (deal: Deal) => void;
}

const companyFormSchema = z.object({
  name: z.string().min(1, "Company name is required"),
  industry: z.string().optional(),
  size: z.string().optional(),
  website: z.string().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  description: z.string().optional(),
});

type CompanyFormData = z.infer<typeof companyFormSchema>;

const industryColors: Record<string, string> = {
  technology: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  manufacturing: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  finance: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  healthcare: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  retail: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  consulting: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200',
  marina: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200',
  real_estate: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
  other: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
};

const sizeColors: Record<string, string> = {
  'startup': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  'small': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200', 
  'medium': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  'large': 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  'enterprise': 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
};

const activityTypeIcons: Record<string, any> = {
  email: Mail,
  call: Phone,
  meeting: Calendar,
  note: FileText,
  task: CheckSquare,
  default: Activity,
};

const activityTypeColors: Record<string, string> = {
  email: 'text-blue-600 bg-blue-100 dark:bg-blue-900 dark:text-blue-300',
  call: 'text-green-600 bg-green-100 dark:bg-green-900 dark:text-green-300',
  meeting: 'text-purple-600 bg-purple-100 dark:bg-purple-900 dark:text-purple-300',
  note: 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900 dark:text-yellow-300',
  task: 'text-orange-600 bg-orange-100 dark:bg-orange-900 dark:text-orange-300',
  default: 'text-gray-600 bg-gray-100 dark:bg-gray-800 dark:text-gray-300',
};

type CompanyContactLink = {
  id: string;
  contactId: string;
  companyId: string;
  role?: string | null;
  isPrimary?: boolean;
  contact?: Contact | null;
};

type CompanyPropertyLink = {
  id: string;
  companyId: string;
  propertyId: string;
  relationship?: string | null;
  property?: Property | null;
};

export default function CompanyDetailModal({ 
  isOpen, 
  onClose, 
  company,
  onContactClick,
  onPropertyClick,
  onDealClick
}: CompanyDetailModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("overview");
  const [isEditing, setIsEditing] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [newNote, setNewNote] = useState("");
  const [activityFilter, setActivityFilter] = useState<string>("all");
  const isAutosaveRef = useRef(false);
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const form = useForm<CompanyFormData>({
    resolver: zodResolver(companyFormSchema),
    mode: 'onChange',
    defaultValues: {
      name: company?.name || '',
      industry: company?.industry || '',
      size: company?.size || '',
      website: company?.website || '',
      phone: company?.phone || '',
      address: company?.address || '',
      description: company?.description || '',
    },
  });

  // Fetch linked contacts for this company
  const { data: linkedContacts = [] } = useQuery<CompanyContactLink[]>({
    queryKey: ['/api/companies', company?.id, 'contacts'],
    enabled: isOpen && !!company?.id,
  });

  // Fetch linked properties for this company
  const { data: linkedProperties = [] } = useQuery<CompanyPropertyLink[]>({
    queryKey: ['/api/companies', company?.id, 'properties'],
    enabled: isOpen && !!company?.id,
  });

  // Fetch all contacts (for companyId matching)
  const { data: allContacts = [] } = useQuery<Contact[]>({
    queryKey: ['/api/contacts'],
    enabled: isOpen,
  });

  // Fetch deals
  const { data: allDeals = [] } = useQuery<Deal[]>({
    queryKey: ['/api/deals'],
    enabled: isOpen,
  });

  // Fetch all properties
  const { data: allProperties = [] } = useQuery<Property[]>({
    queryKey: ['/api/properties'],
    enabled: isOpen,
  });

  // Fetch activities for this company
  const { data: activities = [] } = useQuery<ActivityType[]>({
    queryKey: ['/api/activities', 'company', company?.id],
    enabled: isOpen && !!company?.id,
  });

  // Fetch notes for this company
  const { data: notes = [] } = useQuery<Note[]>({
    queryKey: ['/api/notes', 'company', company?.id],
    enabled: isOpen && !!company?.id,
  });

  // Fetch tasks for this company
  const { data: tasks = [] } = useQuery<CrmTask[]>({
    queryKey: ['/api/crm/tasks', { companyId: company?.id }],
    enabled: isOpen && !!company?.id,
  });

  // Fetch files for this company
  const { data: files = [] } = useQuery<CrmFile[]>({
    queryKey: ['/api/crm/files', { entityType: 'company', entityId: company?.id }],
    enabled: isOpen && !!company?.id,
  });

  // Filter related entities
  const companyContacts = allContacts.filter(c => c.companyId === company?.id);
  const companyDeals = allDeals.filter(d => d.companyId === company?.id);
  
  // Get properties where company is owner
  const ownedProperties = allProperties.filter(p => p.ownerCompanyId === company?.id);
  
  // Combine linked properties with owned properties
  const allCompanyProperties = [
    ...linkedProperties.map(lp => lp.property).filter(Boolean) as Property[],
    ...ownedProperties
  ].filter((p, i, arr) => arr.findIndex(x => x.id === p.id) === i); // dedupe

  // Calculate metrics
  const totalDealValue = companyDeals.reduce((sum, d) => sum + Number(d.amount || d.value || 0), 0);
  const openDeals = companyDeals.filter(d => d.stage !== 'closed-won' && d.stage !== 'closed-lost');
  const wonDeals = companyDeals.filter(d => d.stage === 'closed-won');
  const openTasks = tasks.filter(t => t.status !== 'completed');
  const daysSinceLastContact = activities.length > 0 
    ? differenceInDays(new Date(), new Date(activities[0].createdAt as string))
    : null;
  const engagementScore = Math.min(100, (activities.length * 8) + (notes.length * 4) + (companyDeals.length * 15) + (companyContacts.length * 5));

  const filteredActivities = activityFilter === 'all' 
    ? activities 
    : activities.filter(a => a.type === activityFilter);

  // Update company mutation
  const updateMutation = useMutation({
    mutationFn: async (data: CompanyFormData) => {
      if (!company) return;
      return await apiRequest('PUT', `/api/companies/${company.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/companies'] });
      
      if (!isAutosaveRef.current) {
        toast({ title: "Company updated successfully" });
        setIsEditing(false);
      } else {
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 2000);
        isAutosaveRef.current = false;
      }
    },
    onError: (error: any) => {
      setSaveStatus('idle');
      toast({ 
        title: "Failed to update company", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  // Create note mutation
  const createNoteMutation = useMutation({
    mutationFn: async (content: string) => {
      return await apiRequest('POST', '/api/notes', {
        content,
        entityType: 'company',
        entityId: company?.id,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notes', 'company', company?.id] });
      setNewNote("");
      toast({ title: "Note added" });
    },
    onError: () => {
      toast({ title: "Error adding note", variant: "destructive" });
    },
  });

  // Create activity mutation
  const createActivityMutation = useMutation({
    mutationFn: async (data: { type: string; subject: string; description?: string }) => {
      return await apiRequest('POST', '/api/activities', {
        ...data,
        entityType: 'company',
        entityId: company?.id,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/activities', 'company', company?.id] });
      toast({ title: "Activity logged" });
    },
  });

  // Reset form when company changes
  useEffect(() => {
    if (company) {
      form.reset({
        name: company.name || '',
        industry: company.industry || '',
        size: company.size || '',
        website: company.website || '',
        phone: company.phone || '',
        address: company.address || '',
        description: company.description || '',
      });
      setIsEditing(false);
      setSaveStatus('idle');
      setActiveTab("overview");
    }
  }, [company, form]);

  // Autosave functionality
  useEffect(() => {
    if (!isEditing || !company) return;

    const subscription = form.watch(() => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
      }

      autosaveTimerRef.current = setTimeout(async () => {
        if (form.formState.isDirty && form.formState.isValid) {
          isAutosaveRef.current = true;
          setSaveStatus('saving');
          updateMutation.mutate(form.getValues());
        }
      }, 1500);
    });

    return () => {
      subscription.unsubscribe();
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
      }
    };
  }, [isEditing, company, form]);

  if (!company) {
    return null;
  }

  const handleQuickAction = (type: string) => {
    switch (type) {
      case 'email':
        toast({ title: "Opening email composer..." });
        break;
      case 'call':
        if (company.phone) {
          window.location.href = `tel:${company.phone}`;
          createActivityMutation.mutate({ type: 'call', subject: `Called ${company.name}` });
        }
        break;
      case 'note':
        setActiveTab('notes');
        break;
      case 'task':
        setActiveTab('tasks');
        break;
    }
  };

  const getIndustryCategory = (industry?: string | null): string => {
    if (!industry) return 'other';
    const normalized = industry.toLowerCase();
    if (normalized.includes('marina') || normalized.includes('boat') || normalized.includes('marine')) return 'marina';
    if (normalized.includes('real estate') || normalized.includes('property')) return 'real_estate';
    if (normalized.includes('tech') || normalized.includes('software') || normalized.includes('it')) return 'technology';
    if (normalized.includes('health') || normalized.includes('medical')) return 'healthcare';
    if (normalized.includes('finance') || normalized.includes('bank')) return 'finance';
    if (normalized.includes('retail') || normalized.includes('store')) return 'retail';
    if (normalized.includes('manufactur')) return 'manufacturing';
    if (normalized.includes('consult')) return 'consulting';
    return 'other';
  };

  const getSizeCategory = (size?: string | null): string => {
    if (!size) return 'small';
    const normalized = size.toLowerCase();
    if (normalized.includes('startup') || normalized.includes('1-10')) return 'startup';
    if (normalized.includes('small') || normalized.includes('11-50')) return 'small';
    if (normalized.includes('medium') || normalized.includes('51-200')) return 'medium';
    if (normalized.includes('large') || normalized.includes('201-1000')) return 'large';
    if (normalized.includes('enterprise') || normalized.includes('1000+')) return 'enterprise';
    return 'small';
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  };

  const industryCategory = getIndustryCategory(company.industry);
  const sizeCategory = getSizeCategory(company.size);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[1100px] max-h-[95vh] overflow-hidden flex flex-col p-0" data-testid="modal-company-detail">
        {/* Enhanced Header */}
        <div className="bg-gradient-to-r from-slate-50 to-purple-50 dark:from-slate-900 dark:to-purple-950 px-6 py-5 border-b">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-4 flex-1">
              {/* Company Avatar */}
              <div className="w-20 h-20 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center text-white text-2xl font-bold shadow-lg border-4 border-white">
                {getInitials(company.name)}
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3">
                  <h2 className="text-2xl font-bold truncate">{company.name}</h2>
                  {isEditing && (
                    <div className="flex items-center gap-1.5 text-sm">
                      {saveStatus === 'saving' && (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                          <span className="text-muted-foreground">Saving...</span>
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
                </div>

                <div className="flex items-center gap-2 mt-1 text-muted-foreground">
                  {company.industry && <span className="text-sm">{company.industry}</span>}
                  {company.industry && company.address && <span>•</span>}
                  {company.address && (
                    <span className="text-sm flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {company.address}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 mt-3 flex-wrap">
                  {company.industry && (
                    <Badge className={industryColors[industryCategory]}>
                      {company.industry}
                    </Badge>
                  )}
                  {company.size && (
                    <Badge className={sizeColors[sizeCategory]}>
                      {company.size}
                    </Badge>
                  )}
                  {allCompanyProperties.length > 0 && (
                    <Badge variant="outline" className="border-blue-500 text-blue-700 dark:text-blue-400">
                      <Anchor className="w-3 h-3 mr-1" />
                      {allCompanyProperties.length} Properties
                    </Badge>
                  )}
                  {companyContacts.length > 0 && (
                    <Badge variant="outline" className="border-green-500 text-green-700 dark:text-green-400">
                      <Users className="w-3 h-3 mr-1" />
                      {companyContacts.length} Contacts
                    </Badge>
                  )}
                </div>
              </div>
            </div>
            
            <div className="flex gap-2 items-center flex-shrink-0">
              {isEditing ? (
                <Button onClick={() => { setIsEditing(false); form.reset(); setSaveStatus('idle'); }} variant="outline" size="sm">
                  Done
                </Button>
              ) : (
                <Button onClick={() => setIsEditing(true)} variant="outline" size="sm">
                  <Edit2 className="w-4 h-4 mr-2" />
                  Edit
                </Button>
              )}
              <Button onClick={onClose} variant="ghost" size="icon" className="h-8 w-8">
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex items-center gap-2 mt-4">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="sm" onClick={() => handleQuickAction('email')} className="gap-2">
                    <Mail className="w-4 h-4" />
                    Email
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Send email</TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="sm" onClick={() => handleQuickAction('call')} disabled={!company.phone} className="gap-2">
                    <Phone className="w-4 h-4" />
                    Call
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{company.phone || 'No phone number'}</TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <Button variant="outline" size="sm" onClick={() => handleQuickAction('note')} className="gap-2">
              <FileText className="w-4 h-4" />
              Note
            </Button>

            <Button variant="outline" size="sm" onClick={() => handleQuickAction('task')} className="gap-2">
              <CheckSquare className="w-4 h-4" />
              Task
            </Button>

            {company.website && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline" size="sm" asChild className="gap-2">
                      <a href={company.website.startsWith('http') ? company.website : `https://${company.website}`} target="_blank" rel="noopener noreferrer">
                        <Globe className="w-4 h-4" />
                        Website
                      </a>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{company.website}</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        </div>

        {/* Main Content */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 overflow-hidden flex flex-col">
          <div className="border-b px-6">
            <TabsList className="h-11 bg-transparent gap-4 p-0">
              <TabsTrigger value="overview" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none">
                Overview
              </TabsTrigger>
              <TabsTrigger value="contacts" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none">
                Contacts
                {companyContacts.length > 0 && <Badge variant="secondary" className="ml-1.5 h-5 px-1.5">{companyContacts.length}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="deals" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none">
                Deals
                {companyDeals.length > 0 && <Badge variant="secondary" className="ml-1.5 h-5 px-1.5">{companyDeals.length}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="properties" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none">
                Properties
                {allCompanyProperties.length > 0 && <Badge variant="secondary" className="ml-1.5 h-5 px-1.5">{allCompanyProperties.length}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="activity" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none">
                Activity
                {activities.length > 0 && <Badge variant="secondary" className="ml-1.5 h-5 px-1.5">{activities.length}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="notes" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none">
                Notes
                {notes.length > 0 && <Badge variant="secondary" className="ml-1.5 h-5 px-1.5">{notes.length}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="tasks" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none">
                Tasks
                {openTasks.length > 0 && <Badge variant="secondary" className="ml-1.5 h-5 px-1.5">{openTasks.length}</Badge>}
              </TabsTrigger>
            </TabsList>
          </div>

          <ScrollArea className="flex-1 px-6 py-4">
            {/* Overview Tab */}
            <TabsContent value="overview" className="mt-0 space-y-6">
              {/* Portfolio Company Badge */}
              {company?.isPortfolioCompany && (
                <Card className="bg-gradient-to-r from-cyan-50 to-blue-50 dark:from-cyan-950 dark:to-blue-950 border-cyan-200 dark:border-cyan-800">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-cyan-500/20 rounded-lg">
                          <Anchor className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <Badge className="bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200">
                              Portfolio Company
                            </Badge>
                            {company.capitalPartner && (
                              <Badge variant="outline" className="text-xs">
                                {company.capitalPartner}
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            Tracked in Marinalytics for operating metrics and benchmarking
                          </p>
                        </div>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => window.location.href = '/analysis/marinalytics'}>
                        <TrendingUp className="w-4 h-4 mr-2" />
                        View Analytics
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Stats Cards */}
              <div className="grid grid-cols-4 gap-4">
                <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 border-green-200 dark:border-green-800">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-green-500/20 rounded-lg">
                        <DollarSign className="w-5 h-5 text-green-600 dark:text-green-400" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-green-700 dark:text-green-300">
                          ${(totalDealValue / 1000000).toFixed(1)}M
                        </p>
                        <p className="text-xs text-green-600 dark:text-green-400">Total Deal Value</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 border-blue-200 dark:border-blue-800">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-500/20 rounded-lg">
                        <Activity className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">{engagementScore}%</p>
                        <p className="text-xs text-blue-600 dark:text-blue-400">Engagement Score</p>
                      </div>
                    </div>
                    <Progress value={engagementScore} className="mt-2 h-1.5" />
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900 border-purple-200 dark:border-purple-800">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-purple-500/20 rounded-lg">
                        <Briefcase className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-purple-700 dark:text-purple-300">{openDeals.length}</p>
                        <p className="text-xs text-purple-600 dark:text-purple-400">Open Deals</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className={`bg-gradient-to-br ${daysSinceLastContact !== null && daysSinceLastContact > 30 ? 'from-red-50 to-red-100 dark:from-red-950 dark:to-red-900 border-red-200 dark:border-red-800' : 'from-amber-50 to-amber-100 dark:from-amber-950 dark:to-amber-900 border-amber-200 dark:border-amber-800'}`}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${daysSinceLastContact !== null && daysSinceLastContact > 30 ? 'bg-red-500/20' : 'bg-amber-500/20'}`}>
                        <Clock className={`w-5 h-5 ${daysSinceLastContact !== null && daysSinceLastContact > 30 ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400'}`} />
                      </div>
                      <div>
                        <p className={`text-2xl font-bold ${daysSinceLastContact !== null && daysSinceLastContact > 30 ? 'text-red-700 dark:text-red-300' : 'text-amber-700 dark:text-amber-300'}`}>
                          {daysSinceLastContact !== null ? `${daysSinceLastContact}d` : 'N/A'}
                        </p>
                        <p className={`text-xs ${daysSinceLastContact !== null && daysSinceLastContact > 30 ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400'}`}>Since Last Contact</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Two Column Layout */}
              <div className="grid grid-cols-3 gap-6">
                {/* Left Column - Company Details */}
                <div className="col-span-2 space-y-6">
                  <Form {...form}>
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base flex items-center gap-2">
                          <Building className="w-4 h-4" />
                          Company Information
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <FormField
                          control={form.control}
                          name="name"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs text-muted-foreground">Company Name</FormLabel>
                              <FormControl>
                                {isEditing ? (
                                  <Input {...field} className="h-9" />
                                ) : (
                                  <p className="font-medium">{field.value || '-'}</p>
                                )}
                              </FormControl>
                            </FormItem>
                          )}
                        />

                        <div className="grid grid-cols-2 gap-4">
                          <FormField
                            control={form.control}
                            name="industry"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs text-muted-foreground">Industry</FormLabel>
                                <FormControl>
                                  {isEditing ? (
                                    <Input {...field} className="h-9" />
                                  ) : (
                                    <p className="font-medium">{field.value || '-'}</p>
                                  )}
                                </FormControl>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="size"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs text-muted-foreground">Company Size</FormLabel>
                                <FormControl>
                                  {isEditing ? (
                                    <Input {...field} className="h-9" placeholder="e.g., 11-50 employees" />
                                  ) : (
                                    <p className="font-medium">{field.value || '-'}</p>
                                  )}
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        </div>

                        <Separator />

                        <div className="grid grid-cols-2 gap-4">
                          <FormField
                            control={form.control}
                            name="website"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs text-muted-foreground flex items-center gap-1.5">
                                  <Globe className="w-3 h-3" /> Website
                                </FormLabel>
                                <FormControl>
                                  {isEditing ? (
                                    <Input {...field} className="h-9" placeholder="https://..." />
                                  ) : field.value ? (
                                    <a href={field.value.startsWith('http') ? field.value : `https://${field.value}`} 
                                       target="_blank" rel="noopener noreferrer"
                                       className="font-medium text-primary hover:underline block">
                                      {field.value}
                                    </a>
                                  ) : (
                                    <p className="text-muted-foreground">-</p>
                                  )}
                                </FormControl>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="phone"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs text-muted-foreground flex items-center gap-1.5">
                                  <Phone className="w-3 h-3" /> Phone
                                </FormLabel>
                                <FormControl>
                                  {isEditing ? (
                                    <Input {...field} className="h-9" />
                                  ) : field.value ? (
                                    <a href={`tel:${field.value}`} className="font-medium text-primary hover:underline block">
                                      {field.value}
                                    </a>
                                  ) : (
                                    <p className="text-muted-foreground">-</p>
                                  )}
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        </div>

                        <FormField
                          control={form.control}
                          name="address"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs text-muted-foreground flex items-center gap-1.5">
                                <MapPin className="w-3 h-3" /> Address
                              </FormLabel>
                              <FormControl>
                                {isEditing ? (
                                  <AddressInput
                                    value={field.value || ""}
                                    onChange={(value) => field.onChange(value)}
                                    onAddressSelect={(components: AddressComponents) => {
                                      field.onChange(components.fullAddress || components.street || '');
                                    }}
                                    placeholder="Start typing an address..."
                                  />
                                ) : (
                                  <p className="font-medium">{field.value || '-'}</p>
                                )}
                              </FormControl>
                            </FormItem>
                          )}
                        />

                        <Separator />

                        <FormField
                          control={form.control}
                          name="description"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs text-muted-foreground flex items-center gap-1.5">
                                <FileText className="w-3 h-3" /> Description
                              </FormLabel>
                              <FormControl>
                                {isEditing ? (
                                  <Textarea {...field} rows={3} placeholder="About this company..." />
                                ) : (
                                  <p className="text-sm whitespace-pre-wrap">{field.value || 'No description'}</p>
                                )}
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      </CardContent>
                    </Card>
                  </Form>

                  {/* Recent Activity Preview */}
                  <Card>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base flex items-center gap-2">
                          <Activity className="w-4 h-4" />
                          Recent Activity
                        </CardTitle>
                        <Button variant="ghost" size="sm" onClick={() => setActiveTab('activity')}>
                          View All <ArrowUpRight className="w-3 h-3 ml-1" />
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {activities.length === 0 ? (
                        <div className="text-center py-6 text-muted-foreground">
                          <Activity className="w-8 h-8 mx-auto mb-2 opacity-50" />
                          <p className="text-sm">No activities recorded yet</p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {activities.slice(0, 3).map((activity) => {
                            const IconComponent = activityTypeIcons[activity.type] || activityTypeIcons.default;
                            const colorClass = activityTypeColors[activity.type] || activityTypeColors.default;
                            return (
                              <div key={activity.id} className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/50">
                                <div className={`p-1.5 rounded-lg ${colorClass}`}>
                                  <IconComponent className="w-3.5 h-3.5" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium truncate">{activity.subject || activity.type}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {activity.createdAt && formatDistanceToNow(new Date(activity.createdAt as string), { addSuffix: true })}
                                  </p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* Right Column - Sidebar */}
                <div className="space-y-6">
                  {/* Key Contacts */}
                  <Card>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base flex items-center gap-2">
                          <Users className="w-4 h-4" />
                          Key Contacts
                        </CardTitle>
                        <Badge variant="secondary">{companyContacts.length}</Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {companyContacts.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-2">No contacts</p>
                      ) : (
                        <div className="space-y-2">
                          {companyContacts.slice(0, 4).map((contact) => (
                            <div 
                              key={contact.id} 
                              className="flex items-center gap-2 p-2 rounded-lg border hover:bg-muted/50 cursor-pointer"
                              onClick={() => onContactClick?.(contact)}
                            >
                              <Avatar className="w-8 h-8">
                                <AvatarFallback className="text-xs bg-muted">
                                  {contact.firstName?.[0]}{contact.lastName?.[0]}
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{contact.firstName} {contact.lastName}</p>
                                <p className="text-xs text-muted-foreground truncate">{contact.position || contact.email}</p>
                              </div>
                              <ExternalLink className="w-3 h-3 text-muted-foreground" />
                            </div>
                          ))}
                          {companyContacts.length > 4 && (
                            <Button variant="ghost" size="sm" className="w-full" onClick={() => setActiveTab('contacts')}>
                              +{companyContacts.length - 4} more
                            </Button>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Properties Owned */}
                  <Card>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base flex items-center gap-2">
                          <Anchor className="w-4 h-4" />
                          Properties
                        </CardTitle>
                        <Badge variant="secondary">{allCompanyProperties.length}</Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {allCompanyProperties.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-2">No properties</p>
                      ) : (
                        <div className="space-y-2">
                          {allCompanyProperties.slice(0, 3).map((property) => (
                            <div 
                              key={property.id} 
                              className="flex items-center gap-2 p-2 rounded-lg border hover:bg-muted/50 cursor-pointer"
                              onClick={() => onPropertyClick?.(property)}
                            >
                              <Anchor className="w-4 h-4 text-muted-foreground" />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{property.title}</p>
                                <p className="text-xs text-muted-foreground truncate">{property.address || property.type}</p>
                              </div>
                              <ExternalLink className="w-3 h-3 text-muted-foreground" />
                            </div>
                          ))}
                          {allCompanyProperties.length > 3 && (
                            <Button variant="ghost" size="sm" className="w-full" onClick={() => setActiveTab('properties')}>
                              +{allCompanyProperties.length - 3} more
                            </Button>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Open Tasks */}
                  <Card>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base flex items-center gap-2">
                          <CheckSquare className="w-4 h-4" />
                          Open Tasks
                        </CardTitle>
                        <Badge variant={openTasks.length > 0 ? "default" : "secondary"}>
                          {openTasks.length}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {openTasks.length === 0 ? (
                        <div className="text-center py-4 text-muted-foreground">
                          <p className="text-sm">No open tasks</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {openTasks.slice(0, 3).map((task) => (
                            <div key={task.id} className="flex items-center gap-2 p-2 rounded-lg border bg-muted/30">
                              <div className={`w-2 h-2 rounded-full ${task.priority === 'high' ? 'bg-red-500' : task.priority === 'medium' ? 'bg-yellow-500' : 'bg-green-500'}`} />
                              <span className="text-sm truncate flex-1">{task.title}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </div>
            </TabsContent>

            {/* Contacts Tab */}
            <TabsContent value="contacts" className="mt-0 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Contacts at {company.name}</h3>
                <Button variant="outline" size="sm">
                  <Plus className="w-4 h-4 mr-2" /> Add Contact
                </Button>
              </div>

              {companyContacts.length === 0 ? (
                <Card>
                  <CardContent className="text-center py-12 text-muted-foreground">
                    <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p className="font-medium">No contacts</p>
                    <p className="text-sm mt-1">Add contacts to this company to track relationships</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  {companyContacts.map((contact) => (
                    <Card key={contact.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => onContactClick?.(contact)}>
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <Avatar className="w-12 h-12">
                            <AvatarFallback className="bg-gradient-to-br from-blue-500 to-blue-600 text-white">
                              {contact.firstName?.[0]}{contact.lastName?.[0]}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-semibold">{contact.firstName} {contact.lastName}</h4>
                            <p className="text-sm text-muted-foreground">{contact.position || 'No title'}</p>
                            <div className="flex items-center gap-3 mt-2 text-sm">
                              {contact.email && (
                                <a href={`mailto:${contact.email}`} className="text-primary hover:underline flex items-center gap-1" onClick={e => e.stopPropagation()}>
                                  <Mail className="w-3 h-3" /> Email
                                </a>
                              )}
                              {contact.phone && (
                                <a href={`tel:${contact.phone}`} className="text-primary hover:underline flex items-center gap-1" onClick={e => e.stopPropagation()}>
                                  <Phone className="w-3 h-3" /> Call
                                </a>
                              )}
                            </div>
                          </div>
                          <ExternalLink className="w-4 h-4 text-muted-foreground" />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* Deals Tab */}
            <TabsContent value="deals" className="mt-0 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Deals with {company.name}</h3>
                <Button variant="outline" size="sm">
                  <Plus className="w-4 h-4 mr-2" /> Add Deal
                </Button>
              </div>

              {/* Deal Summary Stats */}
              <div className="grid grid-cols-4 gap-4">
                <Card className="bg-muted/30">
                  <CardContent className="p-3 text-center">
                    <p className="text-2xl font-bold">{companyDeals.length}</p>
                    <p className="text-xs text-muted-foreground">Total Deals</p>
                  </CardContent>
                </Card>
                <Card className="bg-muted/30">
                  <CardContent className="p-3 text-center">
                    <p className="text-2xl font-bold text-green-600">${(totalDealValue / 1000000).toFixed(1)}M</p>
                    <p className="text-xs text-muted-foreground">Total Value</p>
                  </CardContent>
                </Card>
                <Card className="bg-muted/30">
                  <CardContent className="p-3 text-center">
                    <p className="text-2xl font-bold text-blue-600">{openDeals.length}</p>
                    <p className="text-xs text-muted-foreground">Open Deals</p>
                  </CardContent>
                </Card>
                <Card className="bg-muted/30">
                  <CardContent className="p-3 text-center">
                    <p className="text-2xl font-bold text-purple-600">{wonDeals.length}</p>
                    <p className="text-xs text-muted-foreground">Won Deals</p>
                  </CardContent>
                </Card>
              </div>

              {companyDeals.length === 0 ? (
                <Card>
                  <CardContent className="text-center py-12 text-muted-foreground">
                    <DollarSign className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p className="font-medium">No deals yet</p>
                    <p className="text-sm mt-1">Create a deal to track opportunities with this company</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">
                  {companyDeals.map((deal) => (
                    <Card key={deal.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => onDealClick?.(deal)}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg">
                              <DollarSign className="w-5 h-5 text-green-600 dark:text-green-400" />
                            </div>
                            <div>
                              <h4 className="font-semibold">{deal.title}</h4>
                              <p className="text-sm text-muted-foreground">{deal.marinaName || 'No marina'}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-xl font-bold text-green-600">${Number(deal.amount || deal.value || 0).toLocaleString()}</p>
                            <Badge variant="outline">{deal.stage}</Badge>
                          </div>
                        </div>
                        {deal.probability && (
                          <div className="mt-3">
                            <div className="flex justify-between text-xs text-muted-foreground mb-1">
                              <span>Probability</span>
                              <span>{deal.probability}%</span>
                            </div>
                            <Progress value={Number(deal.probability)} className="h-1.5" />
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* Properties Tab */}
            <TabsContent value="properties" className="mt-0 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Properties owned by {company.name}</h3>
                <Button variant="outline" size="sm">
                  <Plus className="w-4 h-4 mr-2" /> Link Property
                </Button>
              </div>

              {allCompanyProperties.length === 0 ? (
                <Card>
                  <CardContent className="text-center py-12 text-muted-foreground">
                    <Anchor className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p className="font-medium">No properties</p>
                    <p className="text-sm mt-1">Link properties owned or managed by this company</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  {allCompanyProperties.map((property) => (
                    <Card key={property.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => onPropertyClick?.(property)}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-3">
                            <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                              <Anchor className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                            </div>
                            <div>
                              <h4 className="font-semibold">{property.title}</h4>
                              <p className="text-sm text-muted-foreground">{property.address || 'No address'}</p>
                              {property.listingPrice && (
                                <p className="text-sm font-medium text-green-600 mt-1">
                                  ${Number(property.listingPrice).toLocaleString()}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            <Badge variant="outline">{property.type}</Badge>
                            <Badge className={property.status === 'available' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
                              {property.status}
                            </Badge>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* Activity Tab */}
            <TabsContent value="activity" className="mt-0 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Activity Timeline</h3>
                <Select value={activityFilter} onValueChange={setActivityFilter}>
                  <SelectTrigger className="w-40 h-9">
                    <Filter className="w-3 h-3 mr-2" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Activities</SelectItem>
                    <SelectItem value="email">Emails</SelectItem>
                    <SelectItem value="call">Calls</SelectItem>
                    <SelectItem value="meeting">Meetings</SelectItem>
                    <SelectItem value="note">Notes</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {filteredActivities.length === 0 ? (
                <Card>
                  <CardContent className="text-center py-12 text-muted-foreground">
                    <Activity className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p className="font-medium">No activities</p>
                    <p className="text-sm mt-1">Activities will appear here when you interact with this company</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">
                  {filteredActivities.map((activity) => {
                    const IconComponent = activityTypeIcons[activity.type] || activityTypeIcons.default;
                    const colorClass = activityTypeColors[activity.type] || activityTypeColors.default;
                    return (
                      <Card key={activity.id} className="hover:shadow-md transition-shadow">
                        <CardContent className="p-4">
                          <div className="flex items-start gap-4">
                            <div className={`p-2 rounded-lg ${colorClass} flex-shrink-0`}>
                              <IconComponent className="w-4 h-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between">
                                <p className="font-medium">{activity.subject || activity.type}</p>
                                <span className="text-xs text-muted-foreground">
                                  {activity.createdAt && format(new Date(activity.createdAt as string), "MMM dd, yyyy 'at' h:mm a")}
                                </span>
                              </div>
                              {activity.description && (
                                <p className="text-sm text-muted-foreground mt-1">{activity.description}</p>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </TabsContent>

            {/* Notes Tab */}
            <TabsContent value="notes" className="mt-0 space-y-4">
              <Card>
                <CardContent className="p-4">
                  <Textarea
                    placeholder="Add a note about this company..."
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    className="min-h-[100px] resize-none"
                  />
                  <div className="flex justify-end mt-3">
                    <Button 
                      onClick={() => newNote.trim() && createNoteMutation.mutate(newNote)} 
                      disabled={!newNote.trim() || createNoteMutation.isPending}
                      size="sm"
                    >
                      {createNoteMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
                      Add Note
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {notes.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p className="font-medium">No notes yet</p>
                  <p className="text-sm mt-1">Add your first note above</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {notes.map((note) => (
                    <Card key={note.id}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-2">
                          <span className="text-xs text-muted-foreground">
                            {note.createdAt && format(new Date(note.createdAt as string), "MMM dd, yyyy 'at' h:mm a")}
                          </span>
                          <Button variant="ghost" size="icon" className="h-6 w-6">
                            <MoreVertical className="w-3 h-3" />
                          </Button>
                        </div>
                        <p className="whitespace-pre-wrap text-sm">{note.content}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* Tasks Tab */}
            <TabsContent value="tasks" className="mt-0 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Tasks</h3>
                <Button variant="outline" size="sm">
                  <Plus className="w-4 h-4 mr-2" /> New Task
                </Button>
              </div>

              {tasks.length === 0 ? (
                <Card>
                  <CardContent className="text-center py-12 text-muted-foreground">
                    <CheckSquare className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p className="font-medium">No tasks yet</p>
                    <p className="text-sm mt-1">Create tasks to track follow-ups for this company</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-2">
                  {tasks.map((task) => (
                    <Card key={task.id} className={`${task.status === 'completed' ? 'opacity-60' : ''}`}>
                      <CardContent className="p-3 flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full border-2 ${task.status === 'completed' ? 'bg-green-500 border-green-500' : 'border-muted-foreground'}`} />
                        <div className="flex-1">
                          <p className={`font-medium ${task.status === 'completed' ? 'line-through' : ''}`}>{task.title}</p>
                          {task.dueDate && (
                            <p className="text-xs text-muted-foreground">
                              Due: {format(new Date(task.dueDate), 'MMM dd, yyyy')}
                            </p>
                          )}
                        </div>
                        <Badge variant={task.priority === 'high' ? 'destructive' : task.priority === 'medium' ? 'default' : 'secondary'} className="text-xs">
                          {task.priority}
                        </Badge>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
