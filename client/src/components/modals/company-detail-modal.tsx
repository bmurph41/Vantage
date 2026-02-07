import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { StandardDialogShell } from "@/components/ui/standard-dialog-shell";
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
import { ProspectingActivitiesSection } from "@/components/prospecting-activities-section";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  EntityAvatar, 
  ContactQuickActions, 
  StatusBadge,
  formatPhoneDisplay,
  formatCurrencyCompact 
} from "@/components/ui/enhanced-card";
import { 
  Building, Building2, Globe, MapPin, Phone, Mail, Users, Edit2, Save, X, FileText, 
  DollarSign, TrendingUp, Activity, Calendar, Clock, Check, Loader2, User,
  Plus, ExternalLink, Anchor, MessageSquare, CheckSquare, FolderOpen,
  MoreVertical, Send, Filter, ArrowUpRight, Briefcase, Target, AlertCircle,
  Link2, FolderPlus, ChevronDown, Trash2, BarChart3
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
import type { Company, Contact, Deal, Property, Activity as ActivityType, Note, CrmTask, CrmFile, SalesComp } from "@shared/schema";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";

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
  
  // Property management state
  const [showLinkPropertyDialog, setShowLinkPropertyDialog] = useState(false);
  const [showAddPropertyModal, setShowAddPropertyModal] = useState(false);
  const [isPortfolioMode, setIsPortfolioMode] = useState(false);
  const [selectedPropertyToLink, setSelectedPropertyToLink] = useState<string>("");
  const [selectedPropertyRelationship, setSelectedPropertyRelationship] = useState("owner");
  const [selectedSalesComp, setSelectedSalesComp] = useState<string>("");
  
  // Contact linking state
  const [showLinkContactDialog, setShowLinkContactDialog] = useState(false);
  const [selectedContactToLink, setSelectedContactToLink] = useState<string>("");
  const [selectedContactRole, setSelectedContactRole] = useState<string>("");
  const [contactSearchQuery, setContactSearchQuery] = useState("");
  
  // Multi-property (portfolio) state
  const [portfolioProperties, setPortfolioProperties] = useState<Array<{
    title: string;
    address: string;
    type: string;
    slips?: number;
  }>>([{ title: "", address: "", type: "marina" }]);
  const [portfolioName, setPortfolioName] = useState("");
  const [isCreatingProperties, setIsCreatingProperties] = useState(false);

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

  // Fetch company acquisitions from Sales Comps (where this company is the buyer)
  const { data: acquisitions = [] } = useQuery<any[]>({
    queryKey: ['/api/companies', company?.id, 'acquisitions'],
    enabled: isOpen && !!company?.id,
  });

  // Get the most recent acquisition for display
  const lastAcquisition = acquisitions.length > 0 ? acquisitions[0] : null;

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

  // Fetch sales comps for linking to properties
  const { data: salesComps = [] } = useQuery<SalesComp[]>({
    queryKey: ['/api/sales-comps'],
    enabled: isOpen && (showAddPropertyModal || showLinkPropertyDialog),
  });

  // Link contact to company mutation
  const linkContactMutation = useMutation({
    mutationFn: async ({ contactId, role }: { contactId: string; role?: string }) => {
      if (!company?.id) {
        throw new Error("Company ID is required");
      }
      const response = await apiRequest('POST', `/api/contacts/${contactId}/companies`, { 
        companyId: company.id, 
        role: role || null,
        isPrimary: linkedContacts.length === 0
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/companies', company?.id, 'contacts'] });
      queryClient.invalidateQueries({ queryKey: ['/api/contacts'] });
      setShowLinkContactDialog(false);
      setSelectedContactToLink("");
      setSelectedContactRole("");
      setContactSearchQuery("");
      toast({ title: "Contact linked successfully" });
    },
    onError: (error: any) => {
      console.error("Link contact error:", error);
      toast({ 
        title: "Failed to link contact", 
        description: error?.message || "An error occurred",
        variant: "destructive" 
      });
    },
  });

  // Link property to company mutation
  const linkPropertyMutation = useMutation({
    mutationFn: async ({ propertyId, relationship }: { propertyId: string; relationship: string }) => {
      if (!company?.id) {
        throw new Error("Company ID is required");
      }
      if (!propertyId) {
        throw new Error("Property ID is required");
      }
      const response = await apiRequest('POST', `/api/properties/${propertyId}/companies`, { 
        companyId: company.id, 
        relationship 
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/companies', company?.id, 'properties'] });
      queryClient.invalidateQueries({ queryKey: ['/api/properties'] });
      setShowLinkPropertyDialog(false);
      setSelectedPropertyToLink("");
      toast({ title: "Property linked successfully" });
    },
    onError: (error: any) => {
      console.error("Link property error:", error);
      toast({ 
        title: "Failed to link property", 
        description: error?.message || "An error occurred",
        variant: "destructive" 
      });
    },
  });

  // Create property mutation
  const createPropertyMutation = useMutation({
    mutationFn: async (propertyData: {
      title: string;
      address?: string;
      type?: string;
      ownerCompanyId?: string;
      salesCompId?: string;
      slips?: number;
      isPortfolio?: boolean;
      portfolioName?: string;
    }) => {
      return await apiRequest('POST', '/api/properties', propertyData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/properties'] });
      queryClient.invalidateQueries({ queryKey: ['/api/companies', company?.id, 'properties'] });
    },
    onError: () => {
      toast({ title: "Failed to create property", variant: "destructive" });
    },
  });

  // Bulk create properties (portfolio mode)
  const handleCreateProperties = async () => {
    if (!company) return;
    
    setIsCreatingProperties(true);
    
    try {
      if (isPortfolioMode) {
        // Create multiple properties as a portfolio
        const validProperties = portfolioProperties.filter(p => p.title.trim());
        if (validProperties.length === 0) {
          toast({ title: "Please add at least one property", variant: "destructive" });
          setIsCreatingProperties(false);
          return;
        }
        
        const failed: string[] = [];
        let successCount = 0;
        
        for (const prop of validProperties) {
          try {
            await createPropertyMutation.mutateAsync({
              title: prop.title,
              address: prop.address,
              type: prop.type || 'marina',
              ownerCompanyId: company.id,
              salesCompId: selectedSalesComp && selectedSalesComp !== 'none' ? selectedSalesComp : undefined,
              slips: prop.slips,
              isPortfolio: true,
              portfolioName: portfolioName || `${company.name} Portfolio`,
            });
            successCount++;
          } catch {
            failed.push(prop.title);
          }
        }
        
        if (failed.length > 0) {
          toast({ 
            title: `Partially created: ${successCount} of ${validProperties.length} properties`,
            description: `Failed: ${failed.join(', ')}`,
            variant: "destructive"
          });
        } else {
          toast({ 
            title: `Portfolio created with ${successCount} properties`,
            description: portfolioName || `${company.name} Portfolio`
          });
        }
        
        // Only close if at least one succeeded
        if (successCount > 0) {
          setShowAddPropertyModal(false);
          setIsPortfolioMode(false);
          setPortfolioProperties([{ title: "", address: "", type: "marina" }]);
          setPortfolioName("");
          setSelectedSalesComp("");
        }
      } else {
        // Create single property
        const prop = portfolioProperties[0];
        if (!prop?.title.trim()) {
          toast({ title: "Property name is required", variant: "destructive" });
          setIsCreatingProperties(false);
          return;
        }
        await createPropertyMutation.mutateAsync({
          title: prop.title,
          address: prop.address,
          type: prop.type || 'marina',
          ownerCompanyId: company.id,
          salesCompId: selectedSalesComp && selectedSalesComp !== 'none' ? selectedSalesComp : undefined,
          slips: prop.slips,
        });
        toast({ title: "Property created successfully" });
        
        // Reset state
        setShowAddPropertyModal(false);
        setIsPortfolioMode(false);
        setPortfolioProperties([{ title: "", address: "", type: "marina" }]);
        setPortfolioName("");
        setSelectedSalesComp("");
      }
    } catch (error) {
      console.error('Failed to create properties:', error);
    } finally {
      setIsCreatingProperties(false);
    }
  };

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
    <StandardDialogShell
      open={isOpen}
      onOpenChange={onClose}
      title={company?.name || "Company Details"}
      icon={Building2}
      size="lg"
      showProgressBar={true}
      className="sm:max-w-[1100px] max-h-[95vh] overflow-hidden flex flex-col p-0"
    >
      <div data-testid="modal-company-detail" className="-mx-4 -mt-4">
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
              <TabsTrigger value="prospecting" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none">
                Prospecting
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
                                  ) : (linkedProperties.length > 0 || ownedProperties.length > 0) ? (
                                    <button
                                      type="button"
                                      onClick={() => setActiveTab('properties')}
                                      className="font-medium text-primary hover:underline cursor-pointer flex items-center gap-1 text-left"
                                    >
                                      {field.value || '-'}
                                      <Anchor className="w-3 h-3" />
                                    </button>
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

                  {/* Last Acquisition */}
                  {lastAcquisition && (
                    <Card className="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950 dark:to-teal-900 border-emerald-200 dark:border-emerald-800">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-base flex items-center gap-2">
                            <TrendingUp className="w-4 h-4 text-emerald-600" />
                            Last Acquisition
                          </CardTitle>
                          <Badge variant="secondary" className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200">
                            {acquisitions.length} Total
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          <p className="font-semibold text-emerald-700 dark:text-emerald-300">{lastAcquisition.marina}</p>
                          <p className="text-sm text-muted-foreground">
                            {lastAcquisition.saleMonth && lastAcquisition.saleYear 
                              ? `${new Date(lastAcquisition.saleYear, lastAcquisition.saleMonth - 1).toLocaleString('default', { month: 'long' })} ${lastAcquisition.saleYear}`
                              : lastAcquisition.saleYear 
                              ? `${lastAcquisition.saleYear}`
                              : 'Date unknown'}
                          </p>
                          {lastAcquisition.city && lastAcquisition.state && (
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              {lastAcquisition.city}, {lastAcquisition.state}
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
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => setShowLinkContactDialog(true)}>
                    <Link2 className="w-4 h-4 mr-2" /> Link Existing
                  </Button>
                </div>
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
                    <div 
                      key={contact.id} 
                      className="relative bg-card border rounded-xl shadow-sm overflow-hidden transition-all duration-200 ease-out hover:shadow-md hover:border-primary/20 hover:-translate-y-0.5 cursor-pointer group"
                      onClick={() => onContactClick?.(contact)}
                    >
                      <div className="p-4">
                        <div className="flex items-start gap-3">
                          <EntityAvatar 
                            name={`${contact.firstName || ''} ${contact.lastName || ''}`.trim()} 
                            size="lg"
                            className="group-hover:scale-105 transition-transform duration-200"
                          />
                          <div className="flex-1 min-w-0">
                            <h4 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                              {contact.firstName} {contact.lastName}
                            </h4>
                            <p className="text-sm text-muted-foreground">{contact.position || 'No title'}</p>
                            {contact.email && (
                              <div className="flex items-center gap-1.5 mt-1.5 text-xs text-muted-foreground">
                                <Mail className="w-3 h-3" />
                                <span className="truncate">{contact.email}</span>
                              </div>
                            )}
                            {contact.phone && (
                              <div className="flex items-center gap-1.5 mt-0.5 text-xs text-muted-foreground">
                                <Phone className="w-3 h-3" />
                                <span>{formatPhoneDisplay(contact.phone)}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200" onClick={e => e.stopPropagation()}>
                        <ContactQuickActions
                          email={contact.email}
                          phone={contact.phone}
                        />
                      </div>
                    </div>
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
                <div className="flex items-center gap-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setShowLinkPropertyDialog(true)}
                  >
                    <Link2 className="w-4 h-4 mr-2" /> Link Existing
                  </Button>
                  <Button 
                    size="sm"
                    onClick={() => {
                      setIsPortfolioMode(false);
                      setPortfolioProperties([{ title: "", address: "", type: "marina" }]);
                      setShowAddPropertyModal(true);
                    }}
                  >
                    <Plus className="w-4 h-4 mr-2" /> Create New
                  </Button>
                </div>
              </div>

              {allCompanyProperties.length === 0 ? (
                <Card>
                  <CardContent className="text-center py-12 text-muted-foreground">
                    <Anchor className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p className="font-medium">No properties linked to this company yet.</p>
                    <p className="text-sm mt-1">Click the button above to link properties.</p>
                    <div className="flex items-center justify-center gap-2 mt-4">
                      <Button variant="outline" size="sm" onClick={() => setShowLinkPropertyDialog(true)}>
                        <Link2 className="w-4 h-4 mr-2" /> Link Existing
                      </Button>
                      <Button size="sm" onClick={() => {
                        setIsPortfolioMode(false);
                        setPortfolioProperties([{ title: "", address: "", type: "marina" }]);
                        setShowAddPropertyModal(true);
                      }}>
                        <Plus className="w-4 h-4 mr-2" /> Add New
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  {allCompanyProperties.map((property) => (
                    <div 
                      key={property.id} 
                      className="relative bg-card border rounded-xl shadow-sm overflow-hidden transition-all duration-200 ease-out hover:shadow-md hover:border-primary/20 hover:-translate-y-0.5 cursor-pointer group"
                      onClick={() => onPropertyClick?.(property)}
                    >
                      <div className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-3">
                            <div className="p-2.5 bg-gradient-to-br from-blue-100 to-cyan-100 dark:from-blue-900/50 dark:to-cyan-900/50 rounded-xl group-hover:scale-105 transition-transform duration-200">
                              <Anchor className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="font-semibold text-foreground group-hover:text-primary transition-colors">{property.title}</h4>
                              {property.address && (
                                <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground">
                                  <MapPin className="w-3 h-3" />
                                  <span className="truncate">{property.address}</span>
                                </div>
                              )}
                              {property.listingPrice && (
                                <p className="text-sm font-semibold text-green-600 dark:text-green-400 mt-1.5">
                                  {formatCurrencyCompact(property.listingPrice)}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-1.5 ml-2">
                            <Badge variant="outline" className="text-xs capitalize">{property.type?.replace('_', ' ')}</Badge>
                            <Badge className={property.status === 'available' ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'}>
                              {property.status?.replace('_', ' ')}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </div>
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

            <TabsContent value="prospecting" className="mt-0 space-y-4">
              <h3 className="text-lg font-semibold">Prospecting Activities</h3>
              <ProspectingActivitiesSection entityType="company" entityId={company?.id || ""} />
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </div>

      {/* Link Contact Dialog */}
      <Dialog open={showLinkContactDialog} onOpenChange={setShowLinkContactDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="w-5 h-5" />
              Link Contact
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Search Contacts</Label>
              <Input
                placeholder="Search by name or email..."
                value={contactSearchQuery}
                onChange={(e) => setContactSearchQuery(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Select Contact</Label>
              <Select value={selectedContactToLink} onValueChange={setSelectedContactToLink}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose contact" />
                </SelectTrigger>
                <SelectContent>
                  {allContacts
                    .filter(c => !linkedContacts.some(lc => lc.contactId === c.id))
                    .filter(c => 
                      !contactSearchQuery || 
                      `${c.firstName} ${c.lastName}`.toLowerCase().includes(contactSearchQuery.toLowerCase()) ||
                      c.email?.toLowerCase().includes(contactSearchQuery.toLowerCase())
                    )
                    .map(contact => (
                      <SelectItem key={contact.id} value={contact.id}>
                        {contact.firstName} {contact.lastName} {contact.email && `- ${contact.email}`}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              {allContacts.filter(c => !linkedContacts.some(lc => lc.contactId === c.id)).length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-2">
                  No available contacts to link
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Role (optional)</Label>
              <Input
                placeholder="e.g., CEO, Manager, Representative"
                value={selectedContactRole}
                onChange={(e) => setSelectedContactRole(e.target.value)}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => {
              setShowLinkContactDialog(false);
              setSelectedContactToLink("");
              setSelectedContactRole("");
              setContactSearchQuery("");
            }}>
              Cancel
            </Button>
            <Button 
              onClick={() => linkContactMutation.mutate({ 
                contactId: selectedContactToLink, 
                role: selectedContactRole || undefined
              })}
              disabled={!selectedContactToLink || linkContactMutation.isPending}
            >
              {linkContactMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Link Contact
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Link Property Dialog */}
      <Dialog open={showLinkPropertyDialog} onOpenChange={setShowLinkPropertyDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Link2 className="w-5 h-5" />
              Link Property
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Select Property</Label>
              <Select value={selectedPropertyToLink} onValueChange={setSelectedPropertyToLink}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose property" />
                </SelectTrigger>
                <SelectContent>
                  {allProperties
                    .filter(p => !allCompanyProperties.some(cp => cp.id === p.id))
                    .map(property => (
                      <SelectItem key={property.id} value={property.id}>
                        {property.title} {property.address && `- ${property.address}`}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Relationship</Label>
              <Select value={selectedPropertyRelationship} onValueChange={setSelectedPropertyRelationship}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="owner">Owner</SelectItem>
                  <SelectItem value="buyer">Buyer</SelectItem>
                  <SelectItem value="seller">Seller</SelectItem>
                  <SelectItem value="broker">Broker</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                  <SelectItem value="investor">Investor</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowLinkPropertyDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={() => linkPropertyMutation.mutate({ 
                propertyId: selectedPropertyToLink, 
                relationship: selectedPropertyRelationship 
              })}
              disabled={!selectedPropertyToLink || linkPropertyMutation.isPending}
            >
              {linkPropertyMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Link Property
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Property Modal */}
      <Dialog open={showAddPropertyModal} onOpenChange={setShowAddPropertyModal}>
        <DialogContent className="sm:max-w-[700px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {isPortfolioMode ? (
                <>
                  <FolderPlus className="w-5 h-5" />
                  Add Portfolio
                </>
              ) : (
                <>
                  <Anchor className="w-5 h-5" />
                  Add Property
                </>
              )}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            {isPortfolioMode && (
              <div className="space-y-2">
                <Label>Portfolio Name</Label>
                <Input 
                  value={portfolioName} 
                  onChange={(e) => setPortfolioName(e.target.value)}
                  placeholder="e.g., Southeast Marina Portfolio"
                />
                <p className="text-xs text-muted-foreground">
                  Properties in this portfolio will be grouped together
                </p>
              </div>
            )}

            {/* Link to Sales Comp */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4" />
                Link to Sales Comp (Optional)
              </Label>
              <Select value={selectedSalesComp} onValueChange={setSelectedSalesComp}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a sale transaction..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {salesComps.map((comp: SalesComp) => (
                    <SelectItem key={comp.id} value={comp.id}>
                      {comp.marinaName || comp.propertyName} - ${Number(comp.salePrice || 0).toLocaleString()}
                      {comp.saleDate && ` (${format(new Date(comp.saleDate), 'MMM yyyy')})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Link this property to a recorded sale in Sales Comps
              </p>
            </div>

            <Separator />

            {/* Property List */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>{isPortfolioMode ? 'Properties in Portfolio' : 'Property Details'}</Label>
                {isPortfolioMode && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setPortfolioProperties([...portfolioProperties, { title: "", address: "", type: "marina" }])}
                  >
                    <Plus className="w-4 h-4 mr-1" /> Add Property
                  </Button>
                )}
              </div>
              
              {portfolioProperties.map((prop, index) => (
                <Card key={index} className="p-4">
                  <div className="space-y-4">
                    {isPortfolioMode && portfolioProperties.length > 1 && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-muted-foreground">Property #{index + 1}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setPortfolioProperties(portfolioProperties.filter((_, i) => i !== index))}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Property Name *</Label>
                        <Input
                          value={prop.title}
                          onChange={(e) => {
                            const updated = [...portfolioProperties];
                            updated[index].title = e.target.value;
                            setPortfolioProperties(updated);
                          }}
                          placeholder="Marina name"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Type</Label>
                        <Select 
                          value={prop.type} 
                          onValueChange={(value) => {
                            const updated = [...portfolioProperties];
                            updated[index].type = value;
                            setPortfolioProperties(updated);
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="marina">Marina</SelectItem>
                            <SelectItem value="boat_yard">Boat Yard</SelectItem>
                            <SelectItem value="marina_yard">Marina & Yard</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2 col-span-2">
                        <Label>Address</Label>
                        <Input
                          value={prop.address}
                          onChange={(e) => {
                            const updated = [...portfolioProperties];
                            updated[index].address = e.target.value;
                            setPortfolioProperties(updated);
                          }}
                          placeholder="Full address"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Slips</Label>
                      <Input
                        type="number"
                        value={prop.slips || ""}
                        onChange={(e) => {
                          const updated = [...portfolioProperties];
                          updated[index].slips = parseInt(e.target.value) || undefined;
                          setPortfolioProperties(updated);
                        }}
                        placeholder="Number of slips"
                      />
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button 
              variant="outline" 
              disabled={isCreatingProperties}
              onClick={() => {
                setShowAddPropertyModal(false);
                setIsPortfolioMode(false);
                setPortfolioProperties([{ title: "", address: "", type: "marina" }]);
                setPortfolioName("");
                setSelectedSalesComp("");
              }}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleCreateProperties}
              disabled={isCreatingProperties}
            >
              {isCreatingProperties && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {isPortfolioMode ? `Create Portfolio (${portfolioProperties.filter(p => p.title.trim()).length} properties)` : 'Create Property'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </StandardDialogShell>
  );
}
