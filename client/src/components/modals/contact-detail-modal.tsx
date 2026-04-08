import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { StandardDialogShell } from "@/components/ui/standard-dialog-shell";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ProspectingActivitiesSection } from "@/components/prospecting-activities-section";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { 
  User, Building, Mail, Phone, MapPin, Star, 
  Edit, X, Clock, Save, Check, Loader2, Briefcase, Home, DollarSign, Thermometer,
  Calendar, FileText, CheckSquare, MessageSquare, Video, Send, Plus, ExternalLink,
  TrendingUp, Activity, Target, AlertCircle, MoreVertical, Trash2, Eye, Download,
  Link as LinkIcon, Users, FolderOpen, Pencil, ArrowUpRight, Filter, Search, Anchor
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { format, formatDistanceToNow, differenceInDays } from "date-fns";
import { AddressInput, type AddressComponents } from "@/components/address-input";
import { ContactEngagementCard } from "@/components/crm/ContactEngagementCard";
import type { Contact, Company, Deal, Property, Activity as ActivityType, Note, CrmTask, CrmFile } from "@shared/schema";
import { getPositionLabel, CONTACT_POSITION_OPTIONS } from "@shared/crm-constants";

interface ContactDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  contact: Contact | null;
  onCompanyClick?: (company: Company) => void;
  onPropertyClick?: (property: Property) => void;
  onDealClick?: (deal: Deal) => void;
}

const contactTagColors = {
  lead: 'bg-blue-500 text-white',
  seller: 'bg-purple-500 text-white',
  competitor: 'bg-slate-500 text-white',
  broker: 'bg-emerald-500 text-white',
  vendor: 'bg-amber-500 text-white',
  insurance: 'bg-indigo-500 text-white',
  lender: 'bg-cyan-500 text-white',
  attorney: 'bg-rose-500 text-white',
  other: 'bg-gray-500 text-white'
};

const capitalizeFirst = (str: string | null | undefined) => {
  if (!str) return null;
  return str.charAt(0).toUpperCase() + str.slice(1);
};

const leadStatusColors = {
  none: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
  new: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  contacted: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  qualified: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  unqualified: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  converted: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
};

const contactFormSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Invalid email address"),
  phone: z.string().optional(),
  position: z.string().optional(),
  address: z.string().optional(),
  unit: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zipCode: z.string().optional(),
  company: z.string().optional(),
  role: z.string().optional(),
  contactType: z.string(),
  leadScore: z.string(),
  onDealTeam: z.boolean(),
  dealTeamNotes: z.string().optional(),
});

type ContactFormData = z.infer<typeof contactFormSchema>;

type ContactCompanyWithCompany = {
  id: string;
  contactId: string;
  companyId: string;
  role?: string | null;
  isPrimary: boolean;
  company?: Company | null;
};

type ContactPropertyWithProperty = {
  id: string;
  contactId: string;
  propertyId: string;
  relationship?: string | null;
  property?: Property | null;
};

export default function ContactDetailModal({ isOpen, onClose, contact, onCompanyClick, onPropertyClick, onDealClick }: ContactDetailModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("overview");
  const [isEditing, setIsEditing] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [newNote, setNewNote] = useState("");
  const [activityFilter, setActivityFilter] = useState<string>("all");
  const [showTimelineNote, setShowTimelineNote] = useState(false);
  const [timelineNoteContent, setTimelineNoteContent] = useState("");
  const isAutosaveRef = useRef(false);
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Link Company/Property state
  const [showLinkCompanyDialog, setShowLinkCompanyDialog] = useState(false);
  const [showLinkPropertyDialog, setShowLinkPropertyDialog] = useState(false);
  const [companySearch, setCompanySearch] = useState("");
  const [propertySearch, setPropertySearch] = useState("");
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);
  const [linkRole, setLinkRole] = useState("");
  const [linkRelationship, setLinkRelationship] = useState("");

  const form = useForm<ContactFormData>({
    resolver: zodResolver(contactFormSchema),
    mode: 'onChange',
    defaultValues: {
      firstName: contact?.firstName || '',
      lastName: contact?.lastName || '',
      email: contact?.email || '',
      phone: contact?.phone || '',
      position: contact?.position || '',
      address: contact?.address || '',
      unit: contact?.unit || '',
      city: contact?.city || '',
      state: contact?.state || '',
      zipCode: contact?.zipCode || '',
      company: contact?.company || '',
      role: contact?.role || '',
      contactType: contact?.contactType || 'prospect',
      leadScore: contact?.leadScore || 'new',
      onDealTeam: contact?.onDealTeam || false,
      dealTeamNotes: contact?.dealTeamNotes || '',
    },
  });

  // Fetch linked companies
  const { data: linkedCompanies = [] } = useQuery<ContactCompanyWithCompany[]>({
    queryKey: [`/api/contacts/${contact?.id}/companies`],
    enabled: isOpen && !!contact?.id,
  });

  // Fetch linked properties
  const { data: linkedProperties = [] } = useQuery<ContactPropertyWithProperty[]>({
    queryKey: [`/api/contacts/${contact?.id}/properties`],
    enabled: isOpen && !!contact?.id,
  });

  // Fetch deals associated with this contact
  const { data: allDeals = [] } = useQuery<Deal[]>({
    queryKey: ['/api/deals'],
    enabled: isOpen,
  });

  // Fetch activities
  const { data: activities = [] } = useQuery<ActivityType[]>({
    queryKey: ['/api/activities', 'contact', contact?.id],
    enabled: isOpen && !!contact?.id,
  });

  // Fetch notes
  const { data: notes = [] } = useQuery<Note[]>({
    queryKey: ['/api/notes', 'contact', contact?.id],
    enabled: isOpen && !!contact?.id,
  });

  // Fetch tasks for this contact
  const { data: tasks = [] } = useQuery<CrmTask[]>({
    queryKey: ['/api/crm/tasks', { contactId: contact?.id }],
    enabled: isOpen && !!contact?.id,
  });

  // Fetch files for this contact
  const { data: files = [] } = useQuery<CrmFile[]>({
    queryKey: ['/api/crm/files', { entityType: 'contact', entityId: contact?.id }],
    enabled: isOpen && !!contact?.id,
  });

  // Fetch DD projects where contact is team member
  const { data: ddProjects = [] } = useQuery<any[]>({
    queryKey: ['/api/dd/projects', { contactId: contact?.id }],
    enabled: isOpen && !!contact?.id,
  });

  // Fetch brokered transactions (where this contact is the agent on a sales comp)
  const { data: brokeredComps = [] } = useQuery<any[]>({
    queryKey: ['/api/contacts', contact?.id, 'brokered-comps'],
    enabled: isOpen && !!contact?.id,
  });

  // Fetch all companies for linking
  const { data: allCompanies = [] } = useQuery<Company[]>({
    queryKey: ['/api/companies'],
    enabled: isOpen && showLinkCompanyDialog,
  });

  // Fetch all properties for linking
  const { data: allProperties = [] } = useQuery<Property[]>({
    queryKey: ['/api/properties'],
    enabled: isOpen && showLinkPropertyDialog,
  });

  // Filter companies for search
  const filteredCompanies = allCompanies.filter(c => 
    c.name?.toLowerCase().includes(companySearch.toLowerCase()) &&
    !linkedCompanies.some(lc => lc.companyId === c.id)
  );

  // Filter properties for search
  const filteredProperties = allProperties.filter(p => 
    p.name?.toLowerCase().includes(propertySearch.toLowerCase()) &&
    !linkedProperties.some(lp => lp.propertyId === p.id)
  );

  // Link company mutation
  const linkCompanyMutation = useMutation({
    mutationFn: async (data: { companyId: string; role?: string }) => {
      const res = await apiRequest('POST', `/api/contacts/${contact?.id}/companies`, {
        companyId: data.companyId,
        role: data.role,
        isPrimary: linkedCompanies.length === 0,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/contacts/${contact?.id}/companies`] });
      setShowLinkCompanyDialog(false);
      setSelectedCompanyId(null);
      setCompanySearch("");
      setLinkRole("");
      toast({ title: "Company linked", description: "Company has been linked to this contact." });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to link company", variant: "destructive" });
    },
  });

  // Link property mutation
  const linkPropertyMutation = useMutation({
    mutationFn: async (data: { propertyId: string; relationship?: string }) => {
      const res = await apiRequest('POST', `/api/contacts/${contact?.id}/properties`, {
        propertyId: data.propertyId,
        relationship: data.relationship,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/contacts/${contact?.id}/properties`] });
      setShowLinkPropertyDialog(false);
      setSelectedPropertyId(null);
      setPropertySearch("");
      setLinkRelationship("");
      toast({ title: "Property linked", description: "Property has been linked to this contact." });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to link property", variant: "destructive" });
    },
  });

  // Fetch related contacts (same company)
  const primaryCompanyId = linkedCompanies.find(c => c.isPrimary)?.companyId || linkedCompanies[0]?.companyId;
  const { data: relatedContacts = [] } = useQuery<Contact[]>({
    queryKey: ['/api/companies', primaryCompanyId, 'contacts'],
    enabled: isOpen && !!primaryCompanyId,
  });

  // Update contact mutation
  const updateContactMutation = useMutation({
    mutationFn: async (data: ContactFormData) => {
      if (!contact) return;
      return await apiRequest('PATCH', `/api/contacts/${contact.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/contacts'] });
      
      if (!isAutosaveRef.current) {
        toast({ title: "Success", description: "Contact updated successfully" });
        setIsEditing(false);
      } else {
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 2000);
        isAutosaveRef.current = false;
      }
    },
    onError: () => {
      if (!isAutosaveRef.current) {
        toast({ title: "Error", description: "Failed to update contact", variant: "destructive" });
      } else {
        setSaveStatus('idle');
        isAutosaveRef.current = false;
      }
    },
  });

  // Create note mutation
  const createNoteMutation = useMutation({
    mutationFn: async (content: string) => {
      return await apiRequest('POST', '/api/crm/notes', {
        content,
        entityType: 'contact',
        entityId: contact?.id,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notes', 'contact', contact?.id] });
      queryClient.invalidateQueries({ queryKey: [`/api/crm/timeline/contact/${contact?.id}`] });
      setNewNote("");
      toast({ title: "Note added" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to add note", variant: "destructive" });
    },
  });

  // Create activity mutation
  const createActivityMutation = useMutation({
    mutationFn: async (data: { type: string; subject: string; description?: string }) => {
      return await apiRequest('POST', '/api/activities', {
        ...data,
        entityType: 'contact',
        entityId: contact?.id,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/activities', 'contact', contact?.id] });
      toast({ title: "Activity logged" });
    },
  });

  const onSubmit = (data: ContactFormData) => {
    isAutosaveRef.current = false;
    updateContactMutation.mutate(data);
  };

  const autoSave = (data: ContactFormData) => {
    isAutosaveRef.current = true;
    setSaveStatus('saving');
    updateContactMutation.mutate(data);
  };

  // Reset form when contact changes
  useEffect(() => {
    if (contact) {
      form.reset({
        firstName: contact.firstName,
        lastName: contact.lastName,
        email: contact.email,
        phone: contact.phone || '',
        position: contact.position || '',
        address: contact.address || '',
        unit: contact.unit || '',
        city: contact.city || '',
        state: contact.state || '',
        zipCode: contact.zipCode || '',
        company: contact.company || '',
        role: contact.role || '',
        contactType: contact.contactType || 'prospect',
        leadScore: contact.leadScore || 'new',
        onDealTeam: contact.onDealTeam || false,
        dealTeamNotes: contact.dealTeamNotes || '',
      });
      setIsEditing(false);
      setSaveStatus('idle');
      setActiveTab("overview");
    }
  }, [contact]);

  // Autosave on form changes when editing
  useEffect(() => {
    if (!isEditing) return;

    const subscription = form.watch(() => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
      }

      autosaveTimerRef.current = setTimeout(() => {
        const formData = form.getValues();
        const isValid = form.formState.isValid;
        
        if (isValid) {
          autoSave(formData);
        }
      }, 1500);
    });

    return () => {
      subscription.unsubscribe();
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
      }
    };
  }, [isEditing]);

  if (!contact) {
    return null;
  }

  const contactDeals = allDeals.filter(d => d.contactId === contact.id);
  const totalDealValue = contactDeals.reduce((sum, d) => sum + Number(d.amount || 0), 0);
  const openTasks = tasks.filter(t => t.status !== 'completed');
  const daysSinceLastContact = activities.length > 0 
    ? differenceInDays(new Date(), new Date(activities[0].createdAt as string))
    : null;
  const engagementScore = Math.min(100, (activities.length * 10) + (notes.length * 5) + (contactDeals.length * 20));

  const filteredActivities = activityFilter === 'all' 
    ? activities 
    : activities.filter(a => a.type === activityFilter);

  const getInitials = (firstName: string, lastName: string) => {
    return `${(firstName || 'U')[0]}${(lastName || 'K')[0]}`.toUpperCase();
  };

  const handleQuickAction = (type: string) => {
    switch (type) {
      case 'email':
        window.location.href = `mailto:${contact.email}`;
        createActivityMutation.mutate({ type: 'email', subject: `Email to ${contact.firstName}` });
        break;
      case 'call':
        if (contact.phone) {
          window.location.href = `tel:${contact.phone}`;
          createActivityMutation.mutate({ type: 'call', subject: `Called ${contact.firstName}` });
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

  const activityTypeIcons: Record<string, any> = {
    email: Mail,
    call: Phone,
    meeting: Calendar,
    note: FileText,
    task: CheckSquare,
    default: Activity,
  };

  const activityTypeColors: Record<string, string> = {
    email: 'text-blue-600 bg-blue-100',
    call: 'text-green-600 bg-green-100',
    meeting: 'text-purple-600 bg-purple-100',
    note: 'text-yellow-600 bg-yellow-100',
    task: 'text-orange-600 bg-orange-100',
    default: 'text-gray-600 bg-gray-100',
  };

  const contactName = contact ? `${contact.firstName} ${contact.lastName}`.trim() : "Contact Details";

  return (
    <StandardDialogShell
      open={isOpen}
      onOpenChange={onClose}
      title={contactName || "Contact Details"}
      icon={User}
      size="lg"
      showProgressBar={true}
      className="sm:max-w-[1100px] max-h-[95vh] overflow-hidden flex flex-col p-0"
    >
      <div data-testid="modal-contact-detail" className="-mt-4">
        {/* Enhanced Header */}
        <div className="bg-gradient-to-r from-slate-50 to-blue-50 dark:from-slate-900 dark:to-blue-950 px-6 py-5 border-b">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-4 flex-1">
              {/* Contact Avatar with photo support */}
              <div className="relative">
                {contact.photoDataUrl ? (
                  <Avatar className="w-20 h-20 border-4 border-white shadow-lg">
                    <AvatarImage src={contact.photoDataUrl} alt={`${contact.firstName} ${contact.lastName}`} />
                    <AvatarFallback className="bg-gradient-to-br from-blue-500 to-blue-600 text-white text-xl font-bold">
                      {getInitials(form.watch('firstName'), form.watch('lastName'))}
                    </AvatarFallback>
                  </Avatar>
                ) : (
                  <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white text-2xl font-bold shadow-lg border-4 border-white">
                    {getInitials(form.watch('firstName'), form.watch('lastName'))}
                  </div>
                )}
                {contact.contactTag === 'lead' && contact.leadStatus === 'qualified' && (
                  <div className="absolute -bottom-1 -right-1 bg-green-500 rounded-full p-1">
                    <Check className="w-3 h-3 text-white" />
                  </div>
                )}
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3">
                  <h3 className="text-2xl font-bold truncate">
                    {form.watch('firstName')} {form.watch('lastName')}
                  </h3>
                  {isEditing && (
                    <div className="flex items-center gap-1.5 text-sm" data-testid="text-save-status">
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
                  {form.watch('position') && (
                    <span className="text-sm">{getPositionLabel(form.watch('position'))}</span>
                  )}
                  {form.watch('position') && form.watch('company') && <span>•</span>}
                  {form.watch('company') && (
                    <span className="text-sm font-medium text-foreground">{form.watch('company')}</span>
                  )}
                </div>

                <div className="flex items-center gap-2 mt-3 flex-wrap">
                  {contact?.contactTag && (
                    <Badge className={contactTagColors[contact.contactTag as keyof typeof contactTagColors] || 'bg-gray-500 text-white'}>
                      {contact.contactTag.charAt(0).toUpperCase() + contact.contactTag.slice(1)}
                    </Badge>
                  )}
                  {contact?.contactTag === 'lead' && contact?.leadStatus && (
                    <Badge className={`flex items-center gap-1 ${leadStatusColors[contact.leadStatus as keyof typeof leadStatusColors]}`}>
                      <Thermometer className="h-3 w-3" />
                      {contact.leadStatus.charAt(0).toUpperCase() + contact.leadStatus.slice(1)}
                    </Badge>
                  )}
                  {form.watch('onDealTeam') && (
                    <Badge variant="outline" className="border-blue-500 text-blue-700 dark:text-blue-400">
                      <Users className="w-3 h-3 mr-1" />
                      Deal Team
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
                  <Edit className="w-4 h-4 mr-2" />
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
                <TooltipContent>Send email to {contact.email}</TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="sm" onClick={() => handleQuickAction('call')} disabled={!contact.phone} className="gap-2">
                    <Phone className="w-4 h-4" />
                    Call
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{contact.phone || 'No phone number'}</TooltipContent>
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

            <Button variant="outline" size="sm" className="gap-2">
              <Calendar className="w-4 h-4" />
              Schedule
            </Button>
          </div>
        </div>

        {/* Main Content */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 overflow-hidden flex flex-col">
          <div className="border-b px-6">
            <TabsList className="h-11 bg-transparent gap-4 p-0">
              <TabsTrigger value="overview" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none">
                Overview
              </TabsTrigger>
              <TabsTrigger value="activity" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none">
                Activity
                {activities.length > 0 && <Badge variant="secondary" className="ml-1.5 h-5 px-1.5">{activities.length}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="deals" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none">
                Deals
                {contactDeals.length > 0 && <Badge variant="secondary" className="ml-1.5 h-5 px-1.5">{contactDeals.length}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="tasks" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none">
                Tasks
                {openTasks.length > 0 && <Badge variant="secondary" className="ml-1.5 h-5 px-1.5">{openTasks.length}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="notes" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none">
                Notes
                {notes.length > 0 && <Badge variant="secondary" className="ml-1.5 h-5 px-1.5">{notes.length}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="files" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none">
                Files
                {files.length > 0 && <Badge variant="secondary" className="ml-1.5 h-5 px-1.5">{files.length}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="connections" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none">
                Connections
              </TabsTrigger>
              <TabsTrigger value="prospecting" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none">
                Prospecting
              </TabsTrigger>
            </TabsList>
          </div>

          <ScrollArea className="flex-1 px-6 py-4">
            {/* Overview Tab */}
            <TabsContent value="overview" className="mt-0 space-y-6">
              {/* Stats Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
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

                <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 border-green-200 dark:border-green-800">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-green-500/20 rounded-lg">
                        <DollarSign className="w-5 h-5 text-green-600 dark:text-green-400" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-green-700 dark:text-green-300">${(totalDealValue / 1000000).toFixed(1)}M</p>
                        <p className="text-xs text-green-600 dark:text-green-400">Deal Value</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900 border-purple-200 dark:border-purple-800">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-purple-500/20 rounded-lg">
                        <MessageSquare className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-purple-700 dark:text-purple-300">{activities.length}</p>
                        <p className="text-xs text-purple-600 dark:text-purple-400">Total Interactions</p>
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
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Left Column - Contact Details */}
                <div className="col-span-2 space-y-6">
                  {/* Contact Information Card */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <User className="w-4 h-4" />
                        Contact Information
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">First Name</Label>
                          {isEditing ? (
                            <Input {...form.register('firstName')} className="h-9" />
                          ) : (
                            <p className="font-medium">{form.watch('firstName')}</p>
                          )}
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Last Name</Label>
                          {isEditing ? (
                            <Input {...form.register('lastName')} className="h-9" />
                          ) : (
                            <p className="font-medium">{form.watch('lastName')}</p>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                            <Mail className="w-3 h-3" /> Email
                          </Label>
                          {isEditing ? (
                            <Input {...form.register('email')} type="email" className="h-9" />
                          ) : (
                            <a href={`mailto:${form.watch('email')}`} className="font-medium text-primary hover:underline block">
                              {form.watch('email')}
                            </a>
                          )}
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                            <Phone className="w-3 h-3" /> Phone
                          </Label>
                          {isEditing ? (
                            <Input {...form.register('phone')} className="h-9" />
                          ) : (
                            <a href={`tel:${form.watch('phone')}`} className="font-medium text-primary hover:underline block">
                              {form.watch('phone') || '-'}
                            </a>
                          )}
                        </div>
                      </div>

                      <Separator />

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                            <Building className="w-3 h-3" /> Company
                          </Label>
                          {isEditing ? (
                            <Input {...form.register('company')} className="h-9" />
                          ) : (
                            <p className="font-medium">{form.watch('company') || '-'}</p>
                          )}
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                            <Briefcase className="w-3 h-3" /> Position
                          </Label>
                          {isEditing ? (
                            <Select 
                              value={form.watch('position') || ''} 
                              onValueChange={(value) => form.setValue('position', value, { shouldDirty: true })}
                            >
                              <SelectTrigger className="h-9">
                                <SelectValue placeholder="Select position" />
                              </SelectTrigger>
                              <SelectContent>
                                {CONTACT_POSITION_OPTIONS.map((option) => (
                                  <SelectItem key={option.value} value={option.value}>
                                    {option.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <p className="font-medium">{getPositionLabel(form.watch('position')) || '-'}</p>
                          )}
                        </div>
                      </div>

                      <Separator />

                      <div className="space-y-3">
                        <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                          <MapPin className="w-3 h-3" /> Address
                        </Label>
                        {isEditing ? (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="col-span-2">
                              <AddressInput
                                value={form.watch('address') || ""}
                                onChange={(value) => form.setValue('address', value, { shouldDirty: true })}
                                onAddressSelect={(components: AddressComponents) => {
                                  form.setValue('address', components.streetAddress || components.fullAddress || '', { shouldDirty: true });
                                  if (components.city) form.setValue('city', components.city, { shouldDirty: true });
                                  if (components.state) form.setValue('state', components.state, { shouldDirty: true });
                                  if (components.zipCode) form.setValue('zipCode', components.zipCode, { shouldDirty: true });
                                }}
                                placeholder="Street address..."
                              />
                            </div>
                            <Input {...form.register('city')} placeholder="City" className="h-9" />
                            <div className="flex gap-2">
                              <Input {...form.register('state')} placeholder="State" className="h-9 w-20" />
                              <Input {...form.register('zipCode')} placeholder="ZIP" className="h-9 flex-1" />
                            </div>
                          </div>
                        ) : (
                          <div className="text-sm">
                            {form.watch('address') || form.watch('city') || form.watch('state') ? (
                              <>
                                {form.watch('address') && <p>{form.watch('address')}</p>}
                                {(form.watch('city') || form.watch('state') || form.watch('zipCode')) && (
                                  <p className="text-muted-foreground">
                                    {[form.watch('city'), form.watch('state')].filter(Boolean).join(', ')} {form.watch('zipCode')}
                                  </p>
                                )}
                              </>
                            ) : (
                              <p className="text-muted-foreground">No address</p>
                            )}
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>

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
                  {/* Brokered Transactions */}
                  {brokeredComps.length > 0 && (
                    <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-900 border-blue-200 dark:border-blue-800">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-base flex items-center gap-2">
                            <Anchor className="w-4 h-4 text-blue-600" />
                            Brokered Transactions
                          </CardTitle>
                          <Badge variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                            {brokeredComps.length} Total
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          {brokeredComps.slice(0, 5).map((comp: any) => (
                            <div key={comp.id} className="flex items-start justify-between p-2 rounded-lg border border-blue-200/50 dark:border-blue-700/50 bg-white/50 dark:bg-blue-950/50">
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-sm text-blue-800 dark:text-blue-200 truncate">{comp.marina || 'Unnamed Property'}</p>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  {comp.city && comp.state ? `${comp.city}, ${comp.state}` : comp.state || ''}
                                  {(comp.city || comp.state) && comp.saleYear ? ' · ' : ''}
                                  {comp.saleMonth && comp.saleYear 
                                    ? `${new Date(comp.saleYear, comp.saleMonth - 1).toLocaleString('default', { month: 'short' })} ${comp.saleYear}`
                                    : comp.saleYear ? `${comp.saleYear}` : ''}
                                </p>
                                {comp.brokerage && (
                                  <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                                    <Building className="w-3 h-3" /> {comp.brokerage}
                                  </p>
                                )}
                              </div>
                              {comp.salePrice && (
                                <Badge variant="outline" className="ml-2 text-xs whitespace-nowrap border-blue-300 dark:border-blue-600">
                                  ${Number(comp.salePrice).toLocaleString()}
                                </Badge>
                              )}
                            </div>
                          ))}
                          {brokeredComps.length > 5 && (
                            <p className="text-xs text-center text-muted-foreground">
                              +{brokeredComps.length - 5} more transactions
                            </p>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  )}

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
                          <Button variant="link" size="sm" className="mt-1" onClick={() => setActiveTab('tasks')}>
                            <Plus className="w-3 h-3 mr-1" /> Add Task
                          </Button>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {openTasks.slice(0, 3).map((task) => (
                            <div key={task.id} className="flex items-center gap-2 p-2 rounded-lg border bg-muted/30">
                              <div className={`w-2 h-2 rounded-full ${task.priority === 'high' ? 'bg-red-500' : task.priority === 'medium' ? 'bg-yellow-500' : 'bg-green-500'}`} />
                              <span className="text-sm truncate flex-1">{task.title}</span>
                            </div>
                          ))}
                          {openTasks.length > 3 && (
                            <Button variant="ghost" size="sm" className="w-full" onClick={() => setActiveTab('tasks')}>
                              +{openTasks.length - 3} more
                            </Button>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Linked Companies */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Building className="w-4 h-4" />
                        Companies
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {linkedCompanies.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-2">No linked companies</p>
                      ) : (
                        <div className="space-y-2">
                          {linkedCompanies.map((link) => (
                            <div key={link.id} className="flex items-center gap-2 p-2 rounded-lg border hover:bg-muted/50 cursor-pointer">
                              <Building className="w-4 h-4 text-muted-foreground" />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{link.company?.name || 'Unknown'}</p>
                                {link.role && <p className="text-xs text-muted-foreground">{link.role}</p>}
                              </div>
                              {link.isPrimary && <Badge variant="outline" className="text-xs">Primary</Badge>}
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Engagement Score Card */}
                  <ContactEngagementCard contactId={contact.id} />

                  {/* Related Contacts */}
                  {relatedContacts.length > 1 && (
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base flex items-center gap-2">
                          <Users className="w-4 h-4" />
                          Same Company
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {relatedContacts.filter(c => c.id !== contact.id).slice(0, 3).map((relatedContact) => (
                            <div key={relatedContact.id} className="flex items-center gap-2 p-2 rounded-lg border hover:bg-muted/50 cursor-pointer">
                              <Avatar className="w-6 h-6">
                                <AvatarFallback className="text-xs bg-muted">
                                  {getInitials(relatedContact.firstName, relatedContact.lastName)}
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{relatedContact.firstName} {relatedContact.lastName}</p>
                                {relatedContact.position && <p className="text-xs text-muted-foreground truncate">{relatedContact.position}</p>}
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </div>
            </TabsContent>

            {/* Activity Tab */}
            <TabsContent value="activity" className="mt-0 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Activity Timeline</h3>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs gap-1"
                    onClick={() => setShowTimelineNote(!showTimelineNote)}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add Note
                  </Button>
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
              </div>

              {showTimelineNote && (
                <div className="space-y-2 border rounded-lg p-3 bg-muted/30">
                  <Textarea
                    placeholder="Write a note..."
                    value={timelineNoteContent}
                    onChange={(e) => setTimelineNoteContent(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                        e.preventDefault();
                        if (timelineNoteContent.trim()) {
                          createNoteMutation.mutate(timelineNoteContent.trim());
                          setTimelineNoteContent('');
                          setShowTimelineNote(false);
                        }
                      }
                      if (e.key === 'Escape') {
                        setShowTimelineNote(false);
                        setTimelineNoteContent('');
                      }
                    }}
                    rows={3}
                    className="resize-none text-sm"
                    autoFocus
                  />
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Ctrl+Enter to save · Esc to cancel</span>
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => { setShowTimelineNote(false); setTimelineNoteContent(''); }}>Cancel</Button>
                      <Button
                        size="sm"
                        className="h-7 text-xs gap-1"
                        disabled={!timelineNoteContent.trim() || createNoteMutation.isPending}
                        onClick={() => {
                          if (timelineNoteContent.trim()) {
                            createNoteMutation.mutate(timelineNoteContent.trim());
                            setTimelineNoteContent('');
                            setShowTimelineNote(false);
                          }
                        }}
                      >
                        {createNoteMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                        Save Note
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {filteredActivities.length === 0 ? (
                <Card>
                  <CardContent className="text-center py-12 text-muted-foreground">
                    <Activity className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p className="font-medium">No activities {activityFilter !== 'all' ? `of type "${activityFilter}"` : ''}</p>
                    <p className="text-sm mt-1">Activities will appear here when you interact with this contact</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">
                  {filteredActivities.map((activity, index) => {
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

            {/* Deals Tab */}
            <TabsContent value="deals" className="mt-0 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Associated Deals</h3>
                <Button variant="outline" size="sm">
                  <Plus className="w-4 h-4 mr-2" /> Add Deal
                </Button>
              </div>

              {contactDeals.length === 0 ? (
                <Card>
                  <CardContent className="text-center py-12 text-muted-foreground">
                    <DollarSign className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p className="font-medium">No deals associated</p>
                    <p className="text-sm mt-1">Create a deal to track opportunities with this contact</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {contactDeals.map((deal) => (
                    <Card key={deal.id} className="hover:shadow-md transition-shadow cursor-pointer">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div>
                            <h4 className="font-semibold">{deal.title}</h4>
                            <p className="text-2xl font-bold text-green-600 mt-1">
                              ${Number(deal.amount || 0).toLocaleString()}
                            </p>
                          </div>
                          <Badge variant={deal.priority === 'high' ? 'destructive' : deal.priority === 'medium' ? 'default' : 'secondary'}>
                            {deal.priority || 'medium'}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 mt-3">
                          <div className="flex-1 bg-muted rounded-full h-2">
                            <div className="bg-primary rounded-full h-2" style={{ width: `${Math.min(100, Number(deal.probability || 50))}%` }} />
                          </div>
                          <span className="text-xs text-muted-foreground">{deal.probability || 50}%</span>
                        </div>
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
                    <p className="text-sm mt-1">Create tasks to track follow-ups with this contact</p>
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

            {/* Notes Tab */}
            <TabsContent value="notes" className="mt-0 space-y-4">
              <Card>
                <CardContent className="p-4">
                  <Textarea
                    placeholder="Add a note about this contact..."
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

            {/* Files Tab */}
            <TabsContent value="files" className="mt-0 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Files & Attachments</h3>
                <Button variant="outline" size="sm">
                  <Plus className="w-4 h-4 mr-2" /> Upload File
                </Button>
              </div>

              {files.length === 0 ? (
                <Card>
                  <CardContent className="text-center py-12 text-muted-foreground">
                    <FolderOpen className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p className="font-medium">No files attached</p>
                    <p className="text-sm mt-1">Upload documents, contracts, or other files related to this contact</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {files.map((file) => (
                    <Card key={file.id} className="hover:shadow-md transition-shadow">
                      <CardContent className="p-3 flex items-center gap-3">
                        <div className="p-2 bg-muted rounded-lg">
                          <FileText className="w-5 h-5 text-muted-foreground" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate text-sm">{file.fileName}</p>
                          <p className="text-xs text-muted-foreground">
                            {file.createdAt && format(new Date(file.createdAt as string), 'MMM dd, yyyy')}
                          </p>
                        </div>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <Download className="w-4 h-4" />
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* Connections Tab */}
            <TabsContent value="connections" className="mt-0 space-y-6">
              {/* Companies */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Building className="w-4 h-4" />
                      Linked Companies
                    </CardTitle>
                    <Button variant="outline" size="sm" onClick={() => setShowLinkCompanyDialog(true)}>
                      <Plus className="w-4 h-4 mr-2" /> Link Company
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {linkedCompanies.length === 0 ? (
                    <p className="text-center text-muted-foreground py-4">No companies linked</p>
                  ) : (
                    <div className="space-y-2">
                      {linkedCompanies.map((link) => (
                        <div key={link.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50">
                          <div className="flex items-center gap-3">
                            <Building className="w-5 h-5 text-muted-foreground" />
                            <div>
                              <p className="font-medium">{link.company?.name || 'Unknown Company'}</p>
                              {link.role && <p className="text-sm text-muted-foreground">{link.role}</p>}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {link.isPrimary && <Badge variant="outline">Primary</Badge>}
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <ExternalLink className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Properties */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Anchor className="w-4 h-4" />
                      Linked Properties
                    </CardTitle>
                    <Button variant="outline" size="sm" onClick={() => setShowLinkPropertyDialog(true)}>
                      <Plus className="w-4 h-4 mr-2" /> Link Property
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {linkedProperties.length === 0 ? (
                    <p className="text-center text-muted-foreground py-4">No properties linked</p>
                  ) : (
                    <div className="space-y-2">
                      {linkedProperties.map((link) => (
                        <div key={link.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50">
                          <div className="flex items-center gap-3">
                            <Anchor className="w-5 h-5 text-muted-foreground" />
                            <div>
                              <p className="font-medium">{link.property?.title || 'Unknown Property'}</p>
                              {link.relationship && <p className="text-sm text-muted-foreground">{link.relationship}</p>}
                            </div>
                          </div>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <ExternalLink className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Due Diligence Projects */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <FolderOpen className="w-4 h-4" />
                    Due Diligence Projects
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {ddProjects.length === 0 ? (
                    <p className="text-center text-muted-foreground py-4">Not assigned to any DD projects</p>
                  ) : (
                    <div className="space-y-2">
                      {ddProjects.map((project: any) => (
                        <div key={project.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50">
                          <div className="flex items-center gap-3">
                            <FolderOpen className="w-5 h-5 text-muted-foreground" />
                            <div>
                              <p className="font-medium">{project.name}</p>
                              <p className="text-sm text-muted-foreground">{project.status}</p>
                            </div>
                          </div>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <ExternalLink className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="prospecting" className="mt-0 space-y-4">
              <h3 className="text-lg font-semibold">Prospecting Activities</h3>
              <ProspectingActivitiesSection entityType="contact" entityId={contact?.id || ""} />
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </div>

      {/* Link Company Dialog */}
      <Dialog open={showLinkCompanyDialog} onOpenChange={setShowLinkCompanyDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building className="w-5 h-5" />
              Link Company
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Search Company</Label>
              <Input
                placeholder="Type to search..."
                value={companySearch}
                onChange={(e) => setCompanySearch(e.target.value)}
                className="mt-1"
              />
            </div>
            {companySearch && (
              <div className="border rounded-lg max-h-40 overflow-y-auto">
                {filteredCompanies.length > 0 ? (
                  filteredCompanies.slice(0, 10).map((company) => (
                    <div
                      key={company.id}
                      className={`px-3 py-2 cursor-pointer hover:bg-muted ${selectedCompanyId === company.id ? 'bg-blue-100 dark:bg-blue-900 border-l-2 border-blue-500' : ''}`}
                      onClick={() => setSelectedCompanyId(company.id)}
                    >
                      <p className="font-medium">{company.name}</p>
                      {company.city && <p className="text-xs text-muted-foreground">{company.city}, {company.state}</p>}
                    </div>
                  ))
                ) : (
                  <p className="px-3 py-4 text-center text-sm text-muted-foreground">No matching companies found</p>
                )}
              </div>
            )}
            {selectedCompanyId && (
              <div>
                <Label>Role at Company (optional)</Label>
                <Input
                  placeholder="e.g. Owner, Manager"
                  value={linkRole}
                  onChange={(e) => setLinkRole(e.target.value)}
                  className="mt-1"
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowLinkCompanyDialog(false);
              setSelectedCompanyId(null);
              setCompanySearch("");
              setLinkRole("");
            }}>
              Cancel
            </Button>
            <Button
              onClick={() => selectedCompanyId && linkCompanyMutation.mutate({ companyId: selectedCompanyId, role: linkRole || undefined })}
              disabled={!selectedCompanyId || linkCompanyMutation.isPending}
            >
              {linkCompanyMutation.isPending ? "Linking..." : "Link Company"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Link Property Dialog */}
      <Dialog open={showLinkPropertyDialog} onOpenChange={setShowLinkPropertyDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Anchor className="w-5 h-5" />
              Link Property
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Search Property</Label>
              <Input
                placeholder="Type to search..."
                value={propertySearch}
                onChange={(e) => setPropertySearch(e.target.value)}
                className="mt-1"
              />
            </div>
            {propertySearch && (
              <div className="border rounded-lg max-h-40 overflow-y-auto">
                {filteredProperties.length > 0 ? (
                  filteredProperties.slice(0, 10).map((property) => (
                    <div
                      key={property.id}
                      className={`px-3 py-2 cursor-pointer hover:bg-muted ${selectedPropertyId === property.id ? 'bg-blue-100 dark:bg-blue-900 border-l-2 border-blue-500' : ''}`}
                      onClick={() => setSelectedPropertyId(property.id)}
                    >
                      <p className="font-medium">{property.name}</p>
                      {(property.city || property.state) && (
                        <p className="text-xs text-muted-foreground">{[property.city, property.state].filter(Boolean).join(", ")}</p>
                      )}
                    </div>
                  ))
                ) : (
                  <p className="px-3 py-4 text-center text-sm text-muted-foreground">No matching properties found</p>
                )}
              </div>
            )}
            {selectedPropertyId && (
              <div>
                <Label>Relationship (optional)</Label>
                <Input
                  placeholder="e.g. Owner, Interested Buyer"
                  value={linkRelationship}
                  onChange={(e) => setLinkRelationship(e.target.value)}
                  className="mt-1"
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowLinkPropertyDialog(false);
              setSelectedPropertyId(null);
              setPropertySearch("");
              setLinkRelationship("");
            }}>
              Cancel
            </Button>
            <Button
              onClick={() => selectedPropertyId && linkPropertyMutation.mutate({ propertyId: selectedPropertyId, relationship: linkRelationship || undefined })}
              disabled={!selectedPropertyId || linkPropertyMutation.isPending}
            >
              {linkPropertyMutation.isPending ? "Linking..." : "Link Property"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </StandardDialogShell>
  );
}
