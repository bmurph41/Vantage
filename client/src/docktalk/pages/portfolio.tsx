import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Building2, Plus, Trash2, FileText, Bell, BellOff, ChevronDown, ChevronRight,
  Link2, Unlink, Search, CheckCircle2, AlertCircle, Loader2, Pencil, Settings2,
  Globe, MapPin, Tag, Info, X, Settings
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { queryClient } from "@/lib/queryClient";

const COMPANY_TYPES = [
  { value: "marina_owner_operator", label: "Marina Owner-Operator" },
  { value: "boat_dealer", label: "Boat Dealer" },
  { value: "marine_services", label: "Marine Services" },
  { value: "yacht_club", label: "Yacht Club" },
  { value: "boatyard", label: "Boatyard" },
  { value: "marine_retail", label: "Marine Retail" },
  { value: "marine_finance", label: "Marine Finance" },
  { value: "other", label: "Other" },
];

const RELATIONSHIP_STAGES = [
  { 
    value: "tracking", 
    label: "Tracking",
    description: "Passively monitoring this company for news and developments. No active engagement or outreach."
  },
  { 
    value: "interested", 
    label: "Interested",
    description: "Identified as a potential target. Initial research phase before formal outreach."
  },
  { 
    value: "in_pipeline", 
    label: "In Pipeline",
    description: "Active deal in progress. Engaged in discussions, due diligence, or negotiations."
  },
  { 
    value: "portfolio_holding", 
    label: "Portfolio Holding",
    description: "Currently owned asset in your investment portfolio. Active management and monitoring."
  },
  { 
    value: "exited", 
    label: "Exited",
    description: "Previously owned asset that has been sold or divested. Historical tracking only."
  },
];

const DEFAULT_GEOGRAPHY_REGIONS = [
  "Northeast", "Southeast", "Gulf Coast", "Great Lakes", "Pacific Northwest",
  "California", "Florida", "Texas", "Mid-Atlantic", "New England"
];

const ALERT_FREQUENCIES = [
  { value: "none", label: "None" },
  { value: "immediate", label: "Immediate" },
  { value: "daily", label: "Daily Digest" },
  { value: "weekly", label: "Weekly Summary" },
];

const ALERT_SENSITIVITIES = [
  { value: "all_mentions", label: "All Mentions" },
  { value: "headlines_only", label: "Headlines Only" },
  { value: "high_relevance", label: "High Relevance" },
];

interface PortfolioCompany {
  id: string;
  companyName: string;
  aliases: string[] | null;
  sector: string | null;
  region: string | null;
  notes: string | null;
  isActive: boolean;
  crmCompanyId: string | null;
  crmLinkStatus: string | null;
  companyType: string | null;
  relationshipStage: string | null;
  geographyFocus: string[] | null;
  website: string | null;
  parentCompany: string | null;
  watchKeywords: string[] | null;
  excludedTerms: string[] | null;
  alertFrequency: string | null;
  alertChannels: string[] | null;
  alertSensitivity: string | null;
  lastAlertSent: string | null;
  createdAt: string;
  updatedAt: string;
}

interface CrmCompanyMatch {
  id: string;
  name: string;
  domain: string | null;
  industry: string | null;
  website: string | null;
  matchScore: number;
  matchReason: string;
}

interface MatchResult {
  exactMatch: CrmCompanyMatch | null;
  suggestions: CrmCompanyMatch[];
}

interface Article {
  id: number;
  title: string;
  source: string;
  url: string;
  publishedAt: string;
  categories: string[];
}

const getStageColor = (stage: string | null) => {
  switch (stage) {
    case "tracking": return "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300";
    case "interested": return "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300";
    case "in_pipeline": return "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300";
    case "portfolio_holding": return "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300";
    case "exited": return "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300";
    default: return "bg-slate-100 text-slate-700";
  }
};

const getTypeLabel = (type: string | null) => {
  const found = COMPANY_TYPES.find(t => t.value === type);
  return found?.label || type || "";
};

const getStageLabel = (stage: string | null) => {
  const found = RELATIONSHIP_STAGES.find(s => s.value === stage);
  return found?.label || stage || "";
};

export default function PortfolioCompaniesPage() {
  const { toast } = useToast();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [expandedCompany, setExpandedCompany] = useState<string | null>(null);
  
  const [showMatchDialog, setShowMatchDialog] = useState(false);
  const [matchResults, setMatchResults] = useState<MatchResult | null>(null);
  const [isCheckingMatches, setIsCheckingMatches] = useState(false);
  const [pendingCompanyData, setPendingCompanyData] = useState<any>(null);
  
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [linkingCompanyId, setLinkingCompanyId] = useState<string | null>(null);
  const [crmSearchQuery, setCrmSearchQuery] = useState("");

  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<PortfolioCompany | null>(null);

  const [alertDialogOpen, setAlertDialogOpen] = useState(false);
  const [alertCompany, setAlertCompany] = useState<PortfolioCompany | null>(null);

  const [geographySettingsOpen, setGeographySettingsOpen] = useState(false);
  const [newRegionInput, setNewRegionInput] = useState("");

  const [formData, setFormData] = useState({
    companyName: "",
    aliases: "",
    sector: "",
    region: "",
    notes: "",
    companyType: "",
    relationshipStage: "tracking",
    geographyFocus: [] as string[],
    website: "",
    parentCompany: "",
    watchKeywords: "",
    excludedTerms: "",
  });

  const [alertFormData, setAlertFormData] = useState({
    alertFrequency: "daily",
    alertChannels: ["in_app"] as string[],
    alertSensitivity: "all_mentions",
  });

  const { data: companies = [], isLoading } = useQuery<PortfolioCompany[]>({
    queryKey: ['/api/docktalk/portfolio-companies'],
  });

  const { data: companyArticles = [] } = useQuery<Article[]>({
    queryKey: ['/api/docktalk/portfolio-companies', expandedCompany, 'articles'],
    queryFn: async () => {
      if (!expandedCompany) return [];
      const response = await fetch(`/api/docktalk/portfolio-companies/${expandedCompany}/articles?limit=20`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch articles');
      return response.json();
    },
    enabled: !!expandedCompany,
  });

  const { data: crmSearchResults = [] } = useQuery<CrmCompanyMatch[]>({
    queryKey: ['/api/docktalk/crm-companies/search', crmSearchQuery],
    queryFn: async () => {
      if (!crmSearchQuery || crmSearchQuery.length < 2) return [];
      const response = await fetch(`/api/docktalk/crm-companies/search?q=${encodeURIComponent(crmSearchQuery)}`, {
        credentials: 'include',
      });
      if (!response.ok) return [];
      return response.json();
    },
    enabled: crmSearchQuery.length >= 2,
  });

  const { data: userPreferences } = useQuery<{ customGeographyRegions?: string[] }>({
    queryKey: ['/api/docktalk/user-preferences'],
    queryFn: async () => {
      const response = await fetch('/api/docktalk/user-preferences', {
        credentials: 'include',
      });
      if (!response.ok) return { customGeographyRegions: [] };
      return response.json();
    },
  });

  const customRegions = userPreferences?.customGeographyRegions || [];
  const allGeographyRegions = [...DEFAULT_GEOGRAPHY_REGIONS, ...customRegions.filter(r => !DEFAULT_GEOGRAPHY_REGIONS.includes(r))];

  const saveCustomRegionsMutation = useMutation({
    mutationFn: async (regions: string[]) => {
      const response = await fetch('/api/docktalk/user-preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customGeographyRegions: regions }),
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to save custom regions');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/docktalk/user-preferences'] });
      toast({
        title: "Regions Updated",
        description: "Your custom geography regions have been saved.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save custom regions",
        variant: "destructive",
      });
    },
  });

  const addCustomRegion = () => {
    const trimmed = newRegionInput.trim();
    if (!trimmed) return;
    if (allGeographyRegions.includes(trimmed)) {
      toast({
        title: "Region Exists",
        description: "This region already exists in the list.",
        variant: "destructive",
      });
      return;
    }
    const newRegions = [...customRegions, trimmed];
    saveCustomRegionsMutation.mutate(newRegions);
    setNewRegionInput("");
  };

  const removeCustomRegion = (region: string) => {
    const newRegions = customRegions.filter(r => r !== region);
    saveCustomRegionsMutation.mutate(newRegions);
    setFormData(prev => ({
      ...prev,
      geographyFocus: prev.geographyFocus.filter(g => g !== region)
    }));
  };

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch('/api/docktalk/portfolio-companies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        credentials: 'include',
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create portfolio company');
      }
      return response.json();
    },
    onSuccess: (newCompany) => {
      queryClient.invalidateQueries({ queryKey: ['/api/docktalk/portfolio-companies'] });
      setIsAddDialogOpen(false);
      setShowMatchDialog(false);
      resetForm();
      toast({
        title: "Company Added to Watchlist",
        description: "Company has been added to your watchlist.",
      });
      return newCompany;
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const linkMutation = useMutation({
    mutationFn: async ({ portfolioId, crmCompanyId }: { portfolioId: string; crmCompanyId: string }) => {
      const response = await fetch(`/api/docktalk/portfolio-companies/${portfolioId}/link-crm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ crmCompanyId }),
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to link to CRM company');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/docktalk/portfolio-companies'] });
      setLinkDialogOpen(false);
      setLinkingCompanyId(null);
      setCrmSearchQuery("");
      toast({
        title: "Companies Linked",
        description: "Portfolio company is now linked to the CRM company.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to link companies",
        variant: "destructive",
      });
    },
  });

  const unlinkMutation = useMutation({
    mutationFn: async (portfolioId: string) => {
      const response = await fetch(`/api/docktalk/portfolio-companies/${portfolioId}/unlink-crm`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to unlink from CRM company');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/docktalk/portfolio-companies'] });
      toast({
        title: "Companies Unlinked",
        description: "Portfolio company has been unlinked from CRM.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to unlink companies",
        variant: "destructive",
      });
    },
  });

  const createCrmMutation = useMutation({
    mutationFn: async ({ portfolioId, crmData }: { portfolioId: string; crmData: any }) => {
      const response = await fetch(`/api/docktalk/portfolio-companies/${portfolioId}/create-crm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(crmData),
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to create CRM company');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/docktalk/portfolio-companies'] });
      setShowMatchDialog(false);
      toast({
        title: "CRM Company Created",
        description: "New CRM company created and linked to portfolio.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create CRM company",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const response = await fetch(`/api/docktalk/portfolio-companies/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to update portfolio company');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/docktalk/portfolio-companies'] });
      setEditDialogOpen(false);
      setEditingCompany(null);
      setAlertDialogOpen(false);
      setAlertCompany(null);
      toast({
        title: "Company Updated",
        description: "Portfolio company has been updated.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update portfolio company",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/docktalk/portfolio-companies/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to delete portfolio company');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/docktalk/portfolio-companies'] });
      toast({
        title: "Company Removed",
        description: "Portfolio company has been removed from tracking.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to remove portfolio company",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setFormData({
      companyName: "",
      aliases: "",
      sector: "",
      region: "",
      notes: "",
      companyType: "",
      relationshipStage: "tracking",
      geographyFocus: [],
      website: "",
      parentCompany: "",
      watchKeywords: "",
      excludedTerms: "",
    });
    setPendingCompanyData(null);
    setMatchResults(null);
  };

  const openEditDialog = (company: PortfolioCompany) => {
    setEditingCompany(company);
    setFormData({
      companyName: company.companyName,
      aliases: (company.aliases || []).join(", "),
      sector: company.sector || "",
      region: company.region || "",
      notes: company.notes || "",
      companyType: company.companyType || "",
      relationshipStage: company.relationshipStage || "tracking",
      geographyFocus: company.geographyFocus || [],
      website: company.website || "",
      parentCompany: company.parentCompany || "",
      watchKeywords: (company.watchKeywords || []).join(", "),
      excludedTerms: (company.excludedTerms || []).join(", "),
    });
    setEditDialogOpen(true);
  };

  const openAlertDialog = (company: PortfolioCompany) => {
    setAlertCompany(company);
    setAlertFormData({
      alertFrequency: company.alertFrequency || "daily",
      alertChannels: company.alertChannels || ["in_app"],
      alertSensitivity: company.alertSensitivity || "all_mentions",
    });
    setAlertDialogOpen(true);
  };

  const handleSaveEdit = () => {
    if (!editingCompany) return;

    const aliasesArray = formData.aliases.split(',').map(a => a.trim()).filter(Boolean);
    const watchKeywordsArray = formData.watchKeywords.split(',').map(k => k.trim()).filter(Boolean);
    const excludedTermsArray = formData.excludedTerms.split(',').map(t => t.trim()).filter(Boolean);

    updateMutation.mutate({
      id: editingCompany.id,
      data: {
        companyName: formData.companyName.trim(),
        aliases: aliasesArray.length > 0 ? aliasesArray : null,
        sector: formData.sector.trim() || null,
        region: formData.region.trim() || null,
        notes: formData.notes.trim() || null,
        companyType: formData.companyType || null,
        relationshipStage: formData.relationshipStage || null,
        geographyFocus: formData.geographyFocus.length > 0 ? formData.geographyFocus : null,
        website: formData.website.trim() || null,
        parentCompany: formData.parentCompany.trim() || null,
        watchKeywords: watchKeywordsArray.length > 0 ? watchKeywordsArray : null,
        excludedTerms: excludedTermsArray.length > 0 ? excludedTermsArray : null,
      },
    });
  };

  const handleSaveAlertSettings = () => {
    if (!alertCompany) return;

    updateMutation.mutate({
      id: alertCompany.id,
      data: {
        isActive: alertFormData.alertFrequency !== "none",
        alertFrequency: alertFormData.alertFrequency,
        alertChannels: alertFormData.alertChannels,
        alertSensitivity: alertFormData.alertSensitivity,
      },
    });
  };

  const prepareCompanyData = () => {
    const aliasesArray = formData.aliases.split(',').map(a => a.trim()).filter(Boolean);
    const watchKeywordsArray = formData.watchKeywords.split(',').map(k => k.trim()).filter(Boolean);
    const excludedTermsArray = formData.excludedTerms.split(',').map(t => t.trim()).filter(Boolean);

    return {
      companyName: formData.companyName.trim(),
      aliases: aliasesArray.length > 0 ? aliasesArray : undefined,
      sector: formData.sector.trim() || undefined,
      region: formData.region.trim() || undefined,
      notes: formData.notes.trim() || undefined,
      companyType: formData.companyType || undefined,
      relationshipStage: formData.relationshipStage || undefined,
      geographyFocus: formData.geographyFocus.length > 0 ? formData.geographyFocus : undefined,
      website: formData.website.trim() || undefined,
      parentCompany: formData.parentCompany.trim() || undefined,
      watchKeywords: watchKeywordsArray.length > 0 ? watchKeywordsArray : undefined,
      excludedTerms: excludedTermsArray.length > 0 ? excludedTermsArray : undefined,
    };
  };

  const checkForMatches = async () => {
    if (!formData.companyName.trim()) {
      toast({
        title: "Validation Error",
        description: "Company name is required",
        variant: "destructive",
      });
      return;
    }

    setIsCheckingMatches(true);
    
    try {
      const response = await fetch('/api/docktalk/portfolio-companies/match-suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyName: formData.companyName.trim() }),
        credentials: 'include',
      });
      
      if (!response.ok) throw new Error('Failed to check for matches');
      
      const matches: MatchResult = await response.json();
      const companyData = prepareCompanyData();
      
      setPendingCompanyData(companyData);
      
      if (matches.exactMatch || matches.suggestions.length > 0) {
        setMatchResults(matches);
        setShowMatchDialog(true);
        setIsAddDialogOpen(false);
      } else {
        createMutation.mutate(companyData);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to check for matching companies",
        variant: "destructive",
      });
    } finally {
      setIsCheckingMatches(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    checkForMatches();
  };

  const handleLinkAndCreate = async (crmCompanyId: string) => {
    const result = await createMutation.mutateAsync(pendingCompanyData);
    if (result?.id) {
      await linkMutation.mutateAsync({ portfolioId: result.id, crmCompanyId });
    }
    setShowMatchDialog(false);
    resetForm();
  };

  const handleCreateWithNewCrm = async () => {
    const result = await createMutation.mutateAsync(pendingCompanyData);
    if (result?.id) {
      await createCrmMutation.mutateAsync({
        portfolioId: result.id,
        crmData: {
          name: pendingCompanyData.companyName,
          industry: pendingCompanyData.sector,
        },
      });
    }
    setShowMatchDialog(false);
    resetForm();
  };

  const handleCreateWithoutLink = () => {
    createMutation.mutate(pendingCompanyData);
    setShowMatchDialog(false);
    resetForm();
  };

  const handleDelete = (company: PortfolioCompany) => {
    if (window.confirm(`Are you sure you want to remove ${company.companyName} from your watchlist?`)) {
      deleteMutation.mutate(company.id);
    }
  };

  const toggleGeography = (region: string) => {
    setFormData(prev => ({
      ...prev,
      geographyFocus: prev.geographyFocus.includes(region)
        ? prev.geographyFocus.filter(r => r !== region)
        : [...prev.geographyFocus, region]
    }));
  };

  const toggleAlertChannel = (channel: string) => {
    setAlertFormData(prev => ({
      ...prev,
      alertChannels: prev.alertChannels.includes(channel)
        ? prev.alertChannels.filter(c => c !== channel)
        : [...prev.alertChannels, channel]
    }));
  };

  return (
    <div className="container mx-auto py-6 px-6 max-w-7xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
            <Building2 className="h-8 w-8 text-primary" />
            Watchlist
          </h1>
          <p className="text-muted-foreground mt-2">
            Track marina companies and receive alerts when they appear in news
          </p>
        </div>

        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-portfolio-company">
              <Plus className="h-4 w-4 mr-2" />
              Add Company
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[700px] max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add Company to Watchlist</DialogTitle>
              <DialogDescription>
                Add a marina company to your watchlist. We'll check if it matches any existing CRM companies.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit}>
              <Tabs defaultValue="basic" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="basic">Basic Info</TabsTrigger>
                  <TabsTrigger value="classification">Classification</TabsTrigger>
                  <TabsTrigger value="monitoring">Monitoring</TabsTrigger>
                </TabsList>

                <TabsContent value="basic" className="space-y-4 pt-4">
                  <div className="grid gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="companyName">
                        Company Name <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="companyName"
                        data-testid="input-company-name"
                        placeholder="e.g., Safe Harbor Marinas"
                        value={formData.companyName}
                        onChange={(e) => setFormData(prev => ({ ...prev, companyName: e.target.value }))}
                        required
                      />
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="aliases">Aliases (comma-separated)</Label>
                      <Input
                        id="aliases"
                        data-testid="input-aliases"
                        placeholder="e.g., Safe Harbor, SHM"
                        value={formData.aliases}
                        onChange={(e) => setFormData(prev => ({ ...prev, aliases: e.target.value }))}
                      />
                      <p className="text-xs text-muted-foreground">
                        Add alternative names or abbreviations to improve article matching
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label htmlFor="website">Website</Label>
                        <Input
                          id="website"
                          data-testid="input-website"
                          placeholder="e.g., safeharbor.com"
                          value={formData.website}
                          onChange={(e) => setFormData(prev => ({ ...prev, website: e.target.value }))}
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="parentCompany">Parent Company</Label>
                        <Input
                          id="parentCompany"
                          data-testid="input-parent-company"
                          placeholder="e.g., Sun Communities"
                          value={formData.parentCompany}
                          onChange={(e) => setFormData(prev => ({ ...prev, parentCompany: e.target.value }))}
                        />
                      </div>
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="notes">Notes</Label>
                      <Textarea
                        id="notes"
                        data-testid="input-notes"
                        placeholder="Internal notes about this portfolio company..."
                        value={formData.notes}
                        onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                        rows={3}
                      />
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="classification" className="space-y-4 pt-4">
                  <div className="grid gap-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label>Company Type</Label>
                        <Select 
                          value={formData.companyType} 
                          onValueChange={(v) => setFormData(prev => ({ ...prev, companyType: v }))}
                        >
                          <SelectTrigger data-testid="select-company-type">
                            <SelectValue placeholder="Select type..." />
                          </SelectTrigger>
                          <SelectContent>
                            {COMPANY_TYPES.map(type => (
                              <SelectItem key={type.value} value={type.value}>
                                {type.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid gap-2">
                        <Label>Relationship Stage</Label>
                        <Select 
                          value={formData.relationshipStage} 
                          onValueChange={(v) => setFormData(prev => ({ ...prev, relationshipStage: v }))}
                        >
                          <SelectTrigger data-testid="select-relationship-stage">
                            <SelectValue placeholder="Select stage..." />
                          </SelectTrigger>
                          <SelectContent>
                            <TooltipProvider delayDuration={200}>
                              {RELATIONSHIP_STAGES.map(stage => (
                                <Tooltip key={stage.value}>
                                  <TooltipTrigger asChild>
                                    <div className="relative">
                                      <SelectItem value={stage.value} className="pr-8">
                                        <span className="flex items-center gap-2">
                                          {stage.label}
                                          <Info className="h-3.5 w-3.5 text-muted-foreground" />
                                        </span>
                                      </SelectItem>
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent side="right" className="max-w-[250px]">
                                    <p className="text-sm">{stage.description}</p>
                                  </TooltipContent>
                                </Tooltip>
                              ))}
                            </TooltipProvider>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="grid gap-2">
                      <div className="flex items-center justify-between">
                        <Label>Geography Focus</Label>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setGeographySettingsOpen(true)}
                          className="h-7 px-2 text-xs"
                        >
                          <Settings className="h-3.5 w-3.5 mr-1" />
                          Manage Regions
                        </Button>
                      </div>
                      <div className="flex flex-wrap gap-2 p-3 border rounded-md max-h-[200px] overflow-y-auto">
                        {allGeographyRegions.map(region => (
                          <div key={region} className="flex items-center space-x-2">
                            <Checkbox
                              id={`geo-${region}`}
                              checked={formData.geographyFocus.includes(region)}
                              onCheckedChange={() => toggleGeography(region)}
                            />
                            <Label htmlFor={`geo-${region}`} className="text-sm cursor-pointer flex items-center gap-1">
                              {region}
                              {customRegions.includes(region) && (
                                <span className="text-xs text-muted-foreground">(custom)</span>
                              )}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label htmlFor="sector">Sector (legacy)</Label>
                        <Input
                          id="sector"
                          data-testid="input-sector"
                          placeholder="e.g., Marina Operations"
                          value={formData.sector}
                          onChange={(e) => setFormData(prev => ({ ...prev, sector: e.target.value }))}
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="region">Region (legacy)</Label>
                        <Input
                          id="region"
                          data-testid="input-region"
                          placeholder="e.g., US Southeast"
                          value={formData.region}
                          onChange={(e) => setFormData(prev => ({ ...prev, region: e.target.value }))}
                        />
                      </div>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="monitoring" className="space-y-4 pt-4">
                  <div className="grid gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="watchKeywords">Watch Keywords (comma-separated)</Label>
                      <Input
                        id="watchKeywords"
                        data-testid="input-watch-keywords"
                        placeholder="e.g., acquisition, expansion, partnership"
                        value={formData.watchKeywords}
                        onChange={(e) => setFormData(prev => ({ ...prev, watchKeywords: e.target.value }))}
                      />
                      <p className="text-xs text-muted-foreground">
                        Additional keywords to match in articles beyond the company name
                      </p>
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="excludedTerms">Excluded Terms (comma-separated)</Label>
                      <Input
                        id="excludedTerms"
                        data-testid="input-excluded-terms"
                        placeholder="e.g., restaurant, hotel"
                        value={formData.excludedTerms}
                        onChange={(e) => setFormData(prev => ({ ...prev, excludedTerms: e.target.value }))}
                      />
                      <p className="text-xs text-muted-foreground">
                        Terms to filter out from article matching to reduce noise
                      </p>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>

              <DialogFooter className="mt-6">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsAddDialogOpen(false);
                    resetForm();
                  }}
                  data-testid="button-cancel-add"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending || isCheckingMatches}
                  data-testid="button-submit-add"
                >
                  {isCheckingMatches ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Checking...
                    </>
                  ) : createMutation.isPending ? "Adding..." : "Add Company"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* CRM Match Dialog */}
      <Dialog open={showMatchDialog} onOpenChange={setShowMatchDialog}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-amber-500" />
              Similar CRM Companies Found
            </DialogTitle>
            <DialogDescription>
              We found companies in your CRM that may match "{pendingCompanyData?.companyName}". Would you like to link them?
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4 max-h-[400px] overflow-y-auto">
            {matchResults?.exactMatch && (
              <div className="border-2 border-green-500/50 rounded-lg p-4 bg-green-50/50 dark:bg-green-950/20">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      <span className="font-semibold text-green-700 dark:text-green-400">Exact Match</span>
                      <Badge variant="secondary" className="text-xs">
                        {matchResults.exactMatch.matchScore}% match
                      </Badge>
                    </div>
                    <h4 className="font-medium text-foreground">{matchResults.exactMatch.name}</h4>
                    <p className="text-sm text-muted-foreground">
                      {matchResults.exactMatch.industry || 'No industry'} 
                      {matchResults.exactMatch.domain && ` • ${matchResults.exactMatch.domain}`}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {matchResults.exactMatch.matchReason}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => handleLinkAndCreate(matchResults.exactMatch!.id)}
                    disabled={createMutation.isPending || linkMutation.isPending}
                    data-testid="button-link-exact-match"
                  >
                    <Link2 className="h-4 w-4 mr-1" />
                    Link
                  </Button>
                </div>
              </div>
            )}

            {matchResults?.suggestions.map((match) => (
              <div key={match.id} className="border rounded-lg p-4 hover:bg-muted/50 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className="text-xs">
                        {match.matchScore}% match
                      </Badge>
                    </div>
                    <h4 className="font-medium text-foreground">{match.name}</h4>
                    <p className="text-sm text-muted-foreground">
                      {match.industry || 'No industry'} 
                      {match.domain && ` • ${match.domain}`}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {match.matchReason}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleLinkAndCreate(match.id)}
                    disabled={createMutation.isPending || linkMutation.isPending}
                    data-testid={`button-link-suggestion-${match.id}`}
                  >
                    <Link2 className="h-4 w-4 mr-1" />
                    Link
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={handleCreateWithoutLink}
              disabled={createMutation.isPending}
              className="w-full sm:w-auto"
              data-testid="button-create-without-link"
            >
              Skip - Don't Link
            </Button>
            <Button
              onClick={handleCreateWithNewCrm}
              disabled={createMutation.isPending || createCrmMutation.isPending}
              className="w-full sm:w-auto"
              data-testid="button-create-new-crm"
            >
              <Plus className="h-4 w-4 mr-1" />
              Create New CRM Company
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Link Existing Company Dialog */}
      <Dialog open={linkDialogOpen} onOpenChange={(open) => {
        setLinkDialogOpen(open);
        if (!open) {
          setLinkingCompanyId(null);
          setCrmSearchQuery("");
        }
      }}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Link to CRM Company</DialogTitle>
            <DialogDescription>
              Search for a CRM company to link with this portfolio company.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search CRM companies..."
                value={crmSearchQuery}
                onChange={(e) => setCrmSearchQuery(e.target.value)}
                className="pl-10"
                data-testid="input-crm-search"
              />
            </div>
            
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {crmSearchResults.length === 0 && crmSearchQuery.length >= 2 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No matching CRM companies found
                </p>
              )}
              {crmSearchResults.map((company) => (
                <div 
                  key={company.id} 
                  className="border rounded-lg p-3 hover:bg-muted/50 cursor-pointer transition-colors"
                  onClick={() => {
                    if (linkingCompanyId) {
                      linkMutation.mutate({ portfolioId: linkingCompanyId, crmCompanyId: company.id });
                    }
                  }}
                  data-testid={`crm-search-result-${company.id}`}
                >
                  <h4 className="font-medium text-foreground">{company.name}</h4>
                  <p className="text-sm text-muted-foreground">
                    {company.industry || 'No industry'} 
                    {company.domain && ` • ${company.domain}`}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setLinkDialogOpen(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Company Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={(open) => {
        setEditDialogOpen(open);
        if (!open) {
          setEditingCompany(null);
          resetForm();
        }
      }}>
        <DialogContent className="sm:max-w-[700px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Company</DialogTitle>
            <DialogDescription>
              Update the details and classification for {editingCompany?.companyName}
            </DialogDescription>
          </DialogHeader>
          
          <Tabs defaultValue="basic" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="basic">Basic Info</TabsTrigger>
              <TabsTrigger value="classification">Classification</TabsTrigger>
              <TabsTrigger value="monitoring">Monitoring</TabsTrigger>
            </TabsList>

            <TabsContent value="basic" className="space-y-4 pt-4">
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="edit-companyName">Company Name</Label>
                  <Input
                    id="edit-companyName"
                    value={formData.companyName}
                    onChange={(e) => setFormData(prev => ({ ...prev, companyName: e.target.value }))}
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="edit-aliases">Aliases (comma-separated)</Label>
                  <Input
                    id="edit-aliases"
                    value={formData.aliases}
                    onChange={(e) => setFormData(prev => ({ ...prev, aliases: e.target.value }))}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="edit-website">Website</Label>
                    <Input
                      id="edit-website"
                      value={formData.website}
                      onChange={(e) => setFormData(prev => ({ ...prev, website: e.target.value }))}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="edit-parentCompany">Parent Company</Label>
                    <Input
                      id="edit-parentCompany"
                      value={formData.parentCompany}
                      onChange={(e) => setFormData(prev => ({ ...prev, parentCompany: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="edit-notes">Notes</Label>
                  <Textarea
                    id="edit-notes"
                    value={formData.notes}
                    onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                    rows={3}
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="classification" className="space-y-4 pt-4">
              <div className="grid gap-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label>Company Type</Label>
                    <Select 
                      value={formData.companyType} 
                      onValueChange={(v) => setFormData(prev => ({ ...prev, companyType: v }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select type..." />
                      </SelectTrigger>
                      <SelectContent>
                        {COMPANY_TYPES.map(type => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label>Relationship Stage</Label>
                    <Select 
                      value={formData.relationshipStage} 
                      onValueChange={(v) => setFormData(prev => ({ ...prev, relationshipStage: v }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select stage..." />
                      </SelectTrigger>
                      <SelectContent>
                        <TooltipProvider delayDuration={200}>
                          {RELATIONSHIP_STAGES.map(stage => (
                            <Tooltip key={stage.value}>
                              <TooltipTrigger asChild>
                                <div className="relative">
                                  <SelectItem value={stage.value} className="pr-8">
                                    <span className="flex items-center gap-2">
                                      {stage.label}
                                      <Info className="h-3.5 w-3.5 text-muted-foreground" />
                                    </span>
                                  </SelectItem>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent side="right" className="max-w-[250px]">
                                <p className="text-sm">{stage.description}</p>
                              </TooltipContent>
                            </Tooltip>
                          ))}
                        </TooltipProvider>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid gap-2">
                  <div className="flex items-center justify-between">
                    <Label>Geography Focus</Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setGeographySettingsOpen(true)}
                      className="h-7 px-2 text-xs"
                    >
                      <Settings className="h-3.5 w-3.5 mr-1" />
                      Manage Regions
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2 p-3 border rounded-md max-h-[200px] overflow-y-auto">
                    {allGeographyRegions.map(region => (
                      <div key={region} className="flex items-center space-x-2">
                        <Checkbox
                          id={`edit-geo-${region}`}
                          checked={formData.geographyFocus.includes(region)}
                          onCheckedChange={() => toggleGeography(region)}
                        />
                        <Label htmlFor={`edit-geo-${region}`} className="text-sm cursor-pointer flex items-center gap-1">
                          {region}
                          {customRegions.includes(region) && (
                            <span className="text-xs text-muted-foreground">(custom)</span>
                          )}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="monitoring" className="space-y-4 pt-4">
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="edit-watchKeywords">Watch Keywords (comma-separated)</Label>
                  <Input
                    id="edit-watchKeywords"
                    value={formData.watchKeywords}
                    onChange={(e) => setFormData(prev => ({ ...prev, watchKeywords: e.target.value }))}
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="edit-excludedTerms">Excluded Terms (comma-separated)</Label>
                  <Input
                    id="edit-excludedTerms"
                    value={formData.excludedTerms}
                    onChange={(e) => setFormData(prev => ({ ...prev, excludedTerms: e.target.value }))}
                  />
                </div>
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter className="mt-6">
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Alert Configuration Dialog */}
      <Dialog open={alertDialogOpen} onOpenChange={(open) => {
        setAlertDialogOpen(open);
        if (!open) setAlertCompany(null);
      }}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings2 className="h-5 w-5" />
              Alert Settings
            </DialogTitle>
            <DialogDescription>
              Configure how you receive alerts for {alertCompany?.companyName}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            <div className="space-y-2">
              <Label>Alert Frequency</Label>
              <Select 
                value={alertFormData.alertFrequency} 
                onValueChange={(v) => setAlertFormData(prev => ({ ...prev, alertFrequency: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ALERT_FREQUENCIES.map(freq => (
                    <SelectItem key={freq.value} value={freq.value}>
                      {freq.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                How often you want to receive notifications about this company
              </p>
            </div>

            <div className="space-y-2">
              <Label>Notification Channels</Label>
              <div className="flex flex-col gap-3 p-3 border rounded-md">
                <div className="flex items-center space-x-3">
                  <Checkbox
                    id="channel-in_app"
                    checked={alertFormData.alertChannels.includes("in_app")}
                    onCheckedChange={() => toggleAlertChannel("in_app")}
                  />
                  <Label htmlFor="channel-in_app" className="cursor-pointer">
                    In-App Notifications
                  </Label>
                </div>
                <div className="flex items-center space-x-3">
                  <Checkbox
                    id="channel-email"
                    checked={alertFormData.alertChannels.includes("email")}
                    onCheckedChange={() => toggleAlertChannel("email")}
                  />
                  <Label htmlFor="channel-email" className="cursor-pointer">
                    Email Notifications
                  </Label>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Alert Sensitivity</Label>
              <Select 
                value={alertFormData.alertSensitivity} 
                onValueChange={(v) => setAlertFormData(prev => ({ ...prev, alertSensitivity: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ALERT_SENSITIVITIES.map(sens => (
                    <SelectItem key={sens.value} value={sens.value}>
                      {sens.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                All mentions includes any article text, headlines only catches major news
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAlertDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveAlertSettings} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? "Saving..." : "Save Settings"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Geography Settings Dialog */}
      <Dialog open={geographySettingsOpen} onOpenChange={setGeographySettingsOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Manage Geography Regions
            </DialogTitle>
            <DialogDescription>
              Add custom geography regions for classifying portfolio companies. These regions will be available across all your companies.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Add Custom Region</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="e.g., Caribbean, Pacific Islands..."
                  value={newRegionInput}
                  onChange={(e) => setNewRegionInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addCustomRegion();
                    }
                  }}
                />
                <Button 
                  onClick={addCustomRegion}
                  disabled={!newRegionInput.trim() || saveCustomRegionsMutation.isPending}
                >
                  {saveCustomRegionsMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Default Regions</Label>
              <div className="flex flex-wrap gap-2 p-3 border rounded-md bg-muted/30">
                {DEFAULT_GEOGRAPHY_REGIONS.map(region => (
                  <Badge key={region} variant="secondary" className="text-xs">
                    {region}
                  </Badge>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                These default regions cannot be removed.
              </p>
            </div>

            {customRegions.length > 0 && (
              <div className="space-y-2">
                <Label>Your Custom Regions</Label>
                <div className="flex flex-wrap gap-2 p-3 border rounded-md">
                  {customRegions.map(region => (
                    <Badge 
                      key={region} 
                      variant="outline" 
                      className="text-xs flex items-center gap-1 pr-1"
                    >
                      {region}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-4 w-4 p-0 hover:bg-destructive/20"
                        onClick={() => removeCustomRegion(region)}
                        disabled={saveCustomRegionsMutation.isPending}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setGeographySettingsOpen(false)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      ) : companies.length === 0 ? (
        <Card>
          <CardHeader className="text-center py-12">
            <div className="flex justify-center mb-4">
              <Building2 className="h-16 w-16 text-muted-foreground/50" />
            </div>
            <CardTitle className="text-2xl">Your Watchlist is Empty</CardTitle>
            <p className="text-muted-foreground text-base mt-2">
              Start tracking marina companies to receive automated alerts when they appear in industry news.
            </p>
            <div className="mt-6">
              <Button onClick={() => setIsAddDialogOpen(true)} data-testid="button-add-first-company">
                <Plus className="h-4 w-4 mr-2" />
                Add Your First Company
              </Button>
            </div>
          </CardHeader>
        </Card>
      ) : (
        <div className="space-y-4">
          {companies.map((company) => (
            <Card key={company.id} data-testid={`card-company-${company.id}`}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-xl flex items-center gap-2 flex-wrap">
                      <Building2 className="h-5 w-5 text-primary" />
                      {company.companyName}
                      {company.crmCompanyId && (
                        <Badge variant="secondary" className="text-xs" data-testid={`badge-crm-linked-${company.id}`}>
                          <Link2 className="h-3 w-3 mr-1" />
                          CRM Linked
                        </Badge>
                      )}
                      {company.relationshipStage && (
                        <Badge className={`text-xs ${getStageColor(company.relationshipStage)}`}>
                          {getStageLabel(company.relationshipStage)}
                        </Badge>
                      )}
                    </CardTitle>
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      {company.companyType && (
                        <Badge variant="outline" className="text-xs">
                          <Tag className="h-3 w-3 mr-1" />
                          {getTypeLabel(company.companyType)}
                        </Badge>
                      )}
                      {company.geographyFocus && company.geographyFocus.length > 0 && (
                        <Badge variant="outline" className="text-xs">
                          <MapPin className="h-3 w-3 mr-1" />
                          {company.geographyFocus.slice(0, 2).join(", ")}
                          {company.geographyFocus.length > 2 && ` +${company.geographyFocus.length - 2}`}
                        </Badge>
                      )}
                      {company.website && (
                        <Badge variant="outline" className="text-xs">
                          <Globe className="h-3 w-3 mr-1" />
                          {company.website}
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEditDialog(company)}
                      data-testid={`button-edit-${company.id}`}
                    >
                      <Pencil className="h-4 w-4 text-muted-foreground" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openAlertDialog(company)}
                      data-testid={`button-alert-settings-${company.id}`}
                    >
                      {company.isActive ? (
                        <Bell className="h-4 w-4 text-primary" />
                      ) : (
                        <BellOff className="h-4 w-4 text-muted-foreground" />
                      )}
                    </Button>
                    {company.crmCompanyId ? (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => unlinkMutation.mutate(company.id)}
                        disabled={unlinkMutation.isPending}
                        data-testid={`button-unlink-${company.id}`}
                      >
                        <Unlink className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    ) : (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setLinkingCompanyId(company.id);
                          setLinkDialogOpen(true);
                        }}
                        data-testid={`button-link-${company.id}`}
                      >
                        <Link2 className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(company)}
                      disabled={deleteMutation.isPending}
                      data-testid={`button-delete-${company.id}`}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-3">
                {company.aliases && company.aliases.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">Aliases:</p>
                    <div className="flex flex-wrap gap-2">
                      {company.aliases.map((alias, idx) => (
                        <Badge key={idx} variant="outline" className="text-xs" data-testid={`badge-alias-${company.id}-${idx}`}>
                          {alias}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {company.parentCompany && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">Parent Company:</p>
                    <p className="text-sm text-foreground">{company.parentCompany}</p>
                  </div>
                )}

                {company.notes && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">Notes:</p>
                    <p className="text-sm text-foreground" data-testid={`text-notes-${company.id}`}>
                      {company.notes}
                    </p>
                  </div>
                )}

                {(company.watchKeywords?.length || company.excludedTerms?.length) && (
                  <div className="flex gap-4">
                    {company.watchKeywords && company.watchKeywords.length > 0 && (
                      <div className="flex-1">
                        <p className="text-sm font-medium text-muted-foreground mb-1">Watch Keywords:</p>
                        <div className="flex flex-wrap gap-1">
                          {company.watchKeywords.map((kw, idx) => (
                            <Badge key={idx} variant="secondary" className="text-xs">
                              {kw}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    {company.excludedTerms && company.excludedTerms.length > 0 && (
                      <div className="flex-1">
                        <p className="text-sm font-medium text-muted-foreground mb-1">Excluded Terms:</p>
                        <div className="flex flex-wrap gap-1">
                          {company.excludedTerms.map((term, idx) => (
                            <Badge key={idx} variant="outline" className="text-xs text-muted-foreground">
                              -{term}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="border-t pt-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setExpandedCompany(expandedCompany === company.id ? null : company.id)}
                    className="w-full justify-start text-sm font-medium text-muted-foreground hover:text-foreground"
                    data-testid={`button-toggle-articles-${company.id}`}
                  >
                    {expandedCompany === company.id ? (
                      <ChevronDown className="h-4 w-4 mr-2" />
                    ) : (
                      <ChevronRight className="h-4 w-4 mr-2" />
                    )}
                    <FileText className="h-4 w-4 mr-2" />
                    Related Articles ({expandedCompany === company.id ? companyArticles.length : '...'})
                  </Button>

                  {expandedCompany === company.id && (
                    <div className="mt-3 space-y-2" data-testid={`articles-list-${company.id}`}>
                      {companyArticles.length === 0 ? (
                        <p className="text-sm text-muted-foreground px-4 py-2">
                          No articles mentioning this company yet
                        </p>
                      ) : (
                        companyArticles.map((article) => (
                          <a
                            key={article.id}
                            href={article.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block p-3 rounded-md border hover:bg-muted/50 transition-colors"
                            data-testid={`article-${article.id}`}
                          >
                            <h4 className="text-sm font-medium text-foreground line-clamp-2">
                              {article.title}
                            </h4>
                            <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                              <span>{article.source}</span>
                              <span>•</span>
                              <span>{new Date(article.publishedAt).toLocaleDateString()}</span>
                              {article.categories.length > 0 && (
                                <>
                                  <span>•</span>
                                  <span>{article.categories[0]}</span>
                                </>
                              )}
                            </div>
                          </a>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {companies.length > 0 && (
        <div className="mt-8 p-4 bg-muted/50 rounded-lg border">
          <div className="flex items-start gap-3">
            <Bell className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
            <div>
              <h3 className="font-semibold text-sm">Alert Notifications</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Click the bell icon on any company to configure alert frequency, channels, and sensitivity. 
                You'll receive notifications when tracked companies appear in Docket articles.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
