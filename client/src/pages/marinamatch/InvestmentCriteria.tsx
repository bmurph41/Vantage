import { useState, useCallback, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { 
  Plus, Edit, Trash2, MapPin, DollarSign, Building2, Ruler, 
  Wallet, Users, Wrench, Star, RefreshCw, Check, X
} from "lucide-react";
import { useForm } from "react-hook-form";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

function formatCurrency(value: string | number | undefined): string {
  if (value === undefined || value === "" || value === null) return "";
  const numValue = typeof value === "string" ? parseFloat(value.replace(/[^0-9.-]/g, "")) : value;
  if (isNaN(numValue)) return "";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(numValue);
}

function parseCurrency(value: string): number | undefined {
  if (!value) return undefined;
  const cleaned = value.replace(/[^0-9.-]/g, "");
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? undefined : parsed;
}

function formatPercentage(value: string | number | undefined): string {
  if (value === undefined || value === "" || value === null) return "";
  const numValue = typeof value === "string" ? parseFloat(value.replace(/[^0-9.-]/g, "")) : value;
  if (isNaN(numValue)) return "";
  return `${numValue.toFixed(2)}%`;
}

function parsePercentage(value: string): number | undefined {
  if (!value) return undefined;
  const cleaned = value.replace(/[^0-9.-]/g, "");
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? undefined : parsed;
}

function CurrencyInput({ value, onChange, placeholder, ...props }: {
  value: string | number | undefined;
  onChange: (value: number | undefined) => void;
  placeholder?: string;
  [key: string]: any;
}) {
  const [localValue, setLocalValue] = useState<string>("");
  const [isEditing, setIsEditing] = useState(false);
  const lastSyncedValue = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (!isEditing && value !== lastSyncedValue.current) {
      lastSyncedValue.current = typeof value === "number" ? value : undefined;
      setLocalValue(formatCurrency(value));
    }
  }, [value, isEditing]);

  return (
    <Input
      {...props}
      value={localValue}
      onChange={(e) => setLocalValue(e.target.value)}
      onFocus={() => {
        setIsEditing(true);
        const numValue = typeof value === "number" ? value : parseCurrency(String(value));
        setLocalValue(numValue !== undefined ? String(numValue) : "");
      }}
      onBlur={() => {
        setIsEditing(false);
        const trimmed = localValue.trim();
        if (trimmed === "" || trimmed === "$") {
          lastSyncedValue.current = undefined;
          onChange(undefined);
          setLocalValue("");
        } else {
          const parsed = parseCurrency(localValue);
          lastSyncedValue.current = parsed;
          onChange(parsed);
          setLocalValue(formatCurrency(parsed));
        }
      }}
      placeholder={placeholder || "$0"}
    />
  );
}

function PercentageInput({ value, onChange, placeholder, ...props }: {
  value: string | number | undefined;
  onChange: (value: number | undefined) => void;
  placeholder?: string;
  [key: string]: any;
}) {
  const [localValue, setLocalValue] = useState<string>("");
  const [isEditing, setIsEditing] = useState(false);
  const lastSyncedValue = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (!isEditing && value !== lastSyncedValue.current) {
      lastSyncedValue.current = typeof value === "number" ? value : undefined;
      setLocalValue(formatPercentage(value));
    }
  }, [value, isEditing]);

  return (
    <Input
      {...props}
      value={localValue}
      onChange={(e) => setLocalValue(e.target.value)}
      onFocus={() => {
        setIsEditing(true);
        const numValue = typeof value === "number" ? value : parsePercentage(String(value));
        setLocalValue(numValue !== undefined ? String(numValue) : "");
      }}
      onBlur={() => {
        setIsEditing(false);
        const trimmed = localValue.trim();
        if (trimmed === "" || trimmed === "%") {
          lastSyncedValue.current = undefined;
          onChange(undefined);
          setLocalValue("");
        } else {
          const parsed = parsePercentage(localValue);
          lastSyncedValue.current = parsed;
          onChange(parsed);
          setLocalValue(formatPercentage(parsed));
        }
      }}
      placeholder={placeholder || "0.00%"}
    />
  );
}

interface CriteriaProfile {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  isDefault: boolean;
  minMatchScoreAlert: number;
  locationWeight: number;
  financialWeight: number;
  operationalWeight: number;
  sizeWeight: number;
  capitalWeight: number;
  involvementWeight: number;
  capexWeight: number;
  createdAt: string;
  criteria?: {
    location?: any;
    financial?: any;
    operational?: any;
    size?: any;
    capital?: any;
    involvement?: any;
    capex?: any;
  };
}

const US_STATES = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
  "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
  "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
  "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
  "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY"
];

const MARINA_TYPES = ["full_service", "dry_stack", "mixed", "yacht_club", "marina", "boatyard"];
const PROPERTY_TYPES = ["marina", "boatyard", "yacht_club", "rv_park"];
const INVOLVEMENT_LEVELS = ["passive", "semi_active", "active", "operator"];
const MAINTENANCE_TOLERANCE = ["none", "minimal", "moderate", "significant"];

export function InvestmentCriteriaTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedProfile, setSelectedProfile] = useState<CriteriaProfile | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [editingCriteriaTab, setEditingCriteriaTab] = useState("location");

  const { data: profiles, isLoading: profilesLoading } = useQuery<CriteriaProfile[]>({
    queryKey: ["/api/marinamatch/intel/criteria-profiles"],
  });

  const { data: profileDetail, isLoading: detailLoading } = useQuery<CriteriaProfile>({
    queryKey: ["/api/marinamatch/intel/criteria-profiles", selectedProfile?.id],
    enabled: !!selectedProfile?.id,
  });

  const createProfileMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("/api/marinamatch/intel/criteria-profiles", {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      toast({ title: "Profile created successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/marinamatch/intel/criteria-profiles"] });
      setIsCreating(false);
    },
    onError: (error: any) => {
      toast({ title: "Failed to create profile", description: error.message, variant: "destructive" });
    },
  });

  const updateProfileMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      return apiRequest(`/api/marinamatch/intel/criteria-profiles/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      toast({ title: "Profile updated successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/marinamatch/intel/criteria-profiles"] });
    },
    onError: (error: any) => {
      toast({ title: "Failed to update profile", description: error.message, variant: "destructive" });
    },
  });

  const deleteProfileMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest(`/api/marinamatch/intel/criteria-profiles/${id}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      toast({ title: "Profile deleted" });
      queryClient.invalidateQueries({ queryKey: ["/api/marinamatch/intel/criteria-profiles"] });
      setSelectedProfile(null);
    },
    onError: (error: any) => {
      toast({ title: "Failed to delete profile", description: error.message, variant: "destructive" });
    },
  });

  const rescoreListingsMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("/api/marinamatch/intel/bulk-rescore", {
        method: "POST",
      });
    },
    onSuccess: (data: any) => {
      toast({ 
        title: "Listings rescored", 
        description: `${data.rescored} listings have been rescored against your criteria.` 
      });
      queryClient.invalidateQueries({ queryKey: ["/api/marinamatch/intel/listings"] });
    },
    onError: (error: any) => {
      toast({ title: "Failed to rescore", description: error.message, variant: "destructive" });
    },
  });

  const getTotalWeight = (profile: CriteriaProfile | null) => {
    if (!profile) return 100;
    return (
      (profile.locationWeight || 0) +
      (profile.financialWeight || 0) +
      (profile.operationalWeight || 0) +
      (profile.sizeWeight || 0) +
      (profile.capitalWeight || 0) +
      (profile.involvementWeight || 0) +
      (profile.capexWeight || 0)
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Investment Criteria Profiles</h2>
          <p className="text-muted-foreground">
            Configure your investment criteria to automatically score and rank marina listings
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline"
            onClick={() => rescoreListingsMutation.mutate()}
            disabled={rescoreListingsMutation.isPending}
            data-testid="button-rescore-listings"
          >
            {rescoreListingsMutation.isPending ? (
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Rescore All Listings
          </Button>
          <Button onClick={() => setIsCreating(true)} data-testid="button-create-profile">
            <Plus className="h-4 w-4 mr-2" />
            New Profile
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-lg">Profiles</CardTitle>
            <CardDescription>Select a profile to configure</CardDescription>
          </CardHeader>
          <CardContent>
            {profilesLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map(i => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : profiles?.length === 0 ? (
              <p className="text-muted-foreground text-center py-6">
                No profiles yet. Create your first investment criteria profile.
              </p>
            ) : (
              <ScrollArea className="h-[400px]">
                <div className="space-y-2">
                  {profiles?.map((profile) => (
                    <div
                      key={profile.id}
                      className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                        selectedProfile?.id === profile.id
                          ? "border-primary bg-primary/5"
                          : "hover:bg-muted/50"
                      }`}
                      onClick={() => setSelectedProfile(profile)}
                      data-testid={`profile-card-${profile.id}`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-medium">{profile.name}</h4>
                          {profile.description && (
                            <p className="text-sm text-muted-foreground truncate max-w-[200px]">
                              {profile.description}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {profile.isDefault && (
                            <Badge variant="secondary">Default</Badge>
                          )}
                          {profile.isActive ? (
                            <Badge variant="outline" className="text-green-600">Active</Badge>
                          ) : (
                            <Badge variant="outline" className="text-muted-foreground">Inactive</Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">
                  {selectedProfile ? selectedProfile.name : "Select a Profile"}
                </CardTitle>
                <CardDescription>
                  {selectedProfile
                    ? "Configure category weights and criteria details"
                    : "Choose a profile from the list to edit its criteria"
                  }
                </CardDescription>
              </div>
              {selectedProfile && (
                <div className="flex gap-2">
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => {
                      if (confirm("Are you sure you want to delete this profile?")) {
                        deleteProfileMutation.mutate(selectedProfile.id);
                      }
                    }}
                    data-testid="button-delete-profile"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {!selectedProfile ? (
              <p className="text-muted-foreground text-center py-12">
                Select a profile to view and edit its investment criteria
              </p>
            ) : detailLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-32 w-full" />
                <Skeleton className="h-48 w-full" />
              </div>
            ) : (
              <div className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium">Category Weights</h4>
                    <span className={`text-sm ${getTotalWeight(profileDetail || selectedProfile) === 100 ? 'text-green-600' : 'text-orange-600'}`}>
                      Total: {getTotalWeight(profileDetail || selectedProfile)}%
                    </span>
                  </div>
                  
                  <div className="space-y-4">
                    {[
                      { key: "locationWeight", label: "Location", icon: MapPin, color: "bg-blue-500" },
                      { key: "financialWeight", label: "Financial", icon: DollarSign, color: "bg-green-500" },
                      { key: "operationalWeight", label: "Operational", icon: Building2, color: "bg-purple-500" },
                      { key: "sizeWeight", label: "Size", icon: Ruler, color: "bg-orange-500" },
                      { key: "capitalWeight", label: "Capital", icon: Wallet, color: "bg-cyan-500" },
                      { key: "involvementWeight", label: "Involvement", icon: Users, color: "bg-pink-500" },
                      { key: "capexWeight", label: "CapEx", icon: Wrench, color: "bg-yellow-500" },
                    ].map(({ key, label, icon: Icon, color }) => {
                      const value = (profileDetail || selectedProfile)?.[key as keyof CriteriaProfile] as number || 0;
                      return (
                        <div key={key} className="space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className={`p-1 rounded ${color}`}>
                                <Icon className="h-3 w-3 text-white" />
                              </div>
                              <span className="text-sm font-medium">{label}</span>
                            </div>
                            <span className="text-sm text-muted-foreground">{value}%</span>
                          </div>
                          <Slider
                            value={[value]}
                            max={50}
                            step={5}
                            onValueChange={([newValue]) => {
                              updateProfileMutation.mutate({
                                id: selectedProfile.id,
                                data: { [key]: newValue },
                              });
                            }}
                            className="w-full"
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>

                <Separator />

                <div className="space-y-4">
                  <h4 className="font-medium">Profile Settings</h4>
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Active</Label>
                      <p className="text-sm text-muted-foreground">
                        Active profiles are used for scoring new listings
                      </p>
                    </div>
                    <Switch
                      checked={profileDetail?.isActive ?? selectedProfile.isActive}
                      onCheckedChange={(checked) => {
                        updateProfileMutation.mutate({
                          id: selectedProfile.id,
                          data: { isActive: checked },
                        });
                      }}
                      data-testid="switch-profile-active"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Alert Threshold</Label>
                      <p className="text-sm text-muted-foreground">
                        Minimum match score to trigger alerts
                      </p>
                    </div>
                    <Select
                      value={String(profileDetail?.minMatchScoreAlert ?? selectedProfile.minMatchScoreAlert ?? 70)}
                      onValueChange={(value) => {
                        updateProfileMutation.mutate({
                          id: selectedProfile.id,
                          data: { minMatchScoreAlert: parseInt(value) },
                        });
                      }}
                    >
                      <SelectTrigger className="w-[100px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="50">50%</SelectItem>
                        <SelectItem value="60">60%</SelectItem>
                        <SelectItem value="70">70%</SelectItem>
                        <SelectItem value="80">80%</SelectItem>
                        <SelectItem value="90">90%</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={isCreating} onOpenChange={setIsCreating}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create Investment Criteria Profile</DialogTitle>
            <DialogDescription>
              Define your investment criteria to automatically score and match marina listings
            </DialogDescription>
          </DialogHeader>
          <CreateProfileForm
            onSubmit={(data) => createProfileMutation.mutate(data)}
            isLoading={createProfileMutation.isPending}
            onCancel={() => setIsCreating(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CreateProfileForm({
  onSubmit,
  isLoading,
  onCancel,
}: {
  onSubmit: (data: any) => void;
  isLoading: boolean;
  onCancel: () => void;
}) {
  const [activeTab, setActiveTab] = useState("basic");
  const [criteria, setCriteria] = useState({
    financial: {
      minAskingPrice: undefined as number | undefined,
      maxAskingPrice: undefined as number | undefined,
      minGrossRevenue: undefined as number | undefined,
      maxGrossRevenue: undefined as number | undefined,
      minNoi: undefined as number | undefined,
      maxNoi: undefined as number | undefined,
      minCapRate: undefined as number | undefined,
      maxCapRate: undefined as number | undefined,
      minPricePerSlip: undefined as number | undefined,
      maxPricePerSlip: undefined as number | undefined,
    },
    size: {
      minTotalSlips: undefined as number | undefined,
      maxTotalSlips: undefined as number | undefined,
      minWetSlips: undefined as number | undefined,
      maxWetSlips: undefined as number | undefined,
      minAcreage: undefined as number | undefined,
      maxAcreage: undefined as number | undefined,
    },
    capital: {
      totalCapitalAvailable: undefined as number | undefined,
      maxEquityPerDeal: undefined as number | undefined,
      targetLtvRatio: undefined as number | undefined,
      minCashOnCashReturn: undefined as number | undefined,
      minIrrTarget: undefined as number | undefined,
      targetHoldPeriod: undefined as number | undefined,
    },
    operational: {
      minOccupancyRate: undefined as number | undefined,
      requireFuelDock: false,
      requireShipStore: false,
      requireRepairShop: false,
      requireDryStorage: false,
    },
  });

  const form = useForm({
    defaultValues: {
      name: "",
      description: "",
      isActive: true,
      isDefault: false,
      locationWeight: 20,
      financialWeight: 25,
      operationalWeight: 15,
      sizeWeight: 15,
      capitalWeight: 10,
      involvementWeight: 5,
      capexWeight: 10,
    },
  });

  const handleSubmit = (formData: any) => {
    const financialEntries = Object.entries(criteria.financial).filter(([_, v]) => v !== undefined && v !== null);
    const sizeEntries = Object.entries(criteria.size).filter(([_, v]) => v !== undefined && v !== null);
    const capitalEntries = Object.entries(criteria.capital).filter(([_, v]) => v !== undefined && v !== null);
    
    const cleanedCriteria: any = {};
    
    if (financialEntries.length > 0) {
      cleanedCriteria.financial = Object.fromEntries(financialEntries);
    }
    if (sizeEntries.length > 0) {
      cleanedCriteria.size = Object.fromEntries(sizeEntries);
    }
    if (capitalEntries.length > 0) {
      cleanedCriteria.capital = Object.fromEntries(capitalEntries);
    }
    cleanedCriteria.operational = criteria.operational;

    const payload = {
      ...formData,
      criteria: cleanedCriteria,
    };
    
    console.log("[Investment Criteria] Submitting profile with criteria:", JSON.stringify(payload, null, 2));
    onSubmit(payload);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="basic">Basic</TabsTrigger>
            <TabsTrigger value="financial">Financial</TabsTrigger>
            <TabsTrigger value="size">Size</TabsTrigger>
            <TabsTrigger value="capital">Capital</TabsTrigger>
          </TabsList>

          <ScrollArea className="h-[350px] mt-4">
            <TabsContent value="basic" className="space-y-4 pr-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Profile Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Gulf Coast Full-Service" {...field} data-testid="input-profile-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Input placeholder="Optional description..." {...field} data-testid="input-profile-description" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex items-center gap-4">
                <FormField
                  control={form.control}
                  name="isActive"
                  render={({ field }) => (
                    <FormItem className="flex items-center gap-2">
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-profile-active-new" />
                      </FormControl>
                      <FormLabel className="!mt-0">Active</FormLabel>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="isDefault"
                  render={({ field }) => (
                    <FormItem className="flex items-center gap-2">
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-profile-default" />
                      </FormControl>
                      <FormLabel className="!mt-0">Set as Default</FormLabel>
                    </FormItem>
                  )}
                />
              </div>
            </TabsContent>

            <TabsContent value="financial" className="space-y-4 pr-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Min Asking Price</Label>
                  <CurrencyInput
                    value={criteria.financial.minAskingPrice}
                    onChange={(val) => setCriteria(prev => ({ ...prev, financial: { ...prev.financial, minAskingPrice: val } }))}
                    placeholder="$1,000,000"
                    data-testid="input-min-asking-price"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Max Asking Price</Label>
                  <CurrencyInput
                    value={criteria.financial.maxAskingPrice}
                    onChange={(val) => setCriteria(prev => ({ ...prev, financial: { ...prev.financial, maxAskingPrice: val } }))}
                    placeholder="$50,000,000"
                    data-testid="input-max-asking-price"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Min Gross Revenue</Label>
                  <CurrencyInput
                    value={criteria.financial.minGrossRevenue}
                    onChange={(val) => setCriteria(prev => ({ ...prev, financial: { ...prev.financial, minGrossRevenue: val } }))}
                    placeholder="$500,000"
                    data-testid="input-min-gross-revenue"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Max Gross Revenue</Label>
                  <CurrencyInput
                    value={criteria.financial.maxGrossRevenue}
                    onChange={(val) => setCriteria(prev => ({ ...prev, financial: { ...prev.financial, maxGrossRevenue: val } }))}
                    placeholder="$10,000,000"
                    data-testid="input-max-gross-revenue"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Min NOI</Label>
                  <CurrencyInput
                    value={criteria.financial.minNoi}
                    onChange={(val) => setCriteria(prev => ({ ...prev, financial: { ...prev.financial, minNoi: val } }))}
                    placeholder="$250,000"
                    data-testid="input-min-noi"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Max NOI</Label>
                  <CurrencyInput
                    value={criteria.financial.maxNoi}
                    onChange={(val) => setCriteria(prev => ({ ...prev, financial: { ...prev.financial, maxNoi: val } }))}
                    placeholder="$5,000,000"
                    data-testid="input-max-noi"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Min Cap Rate</Label>
                  <PercentageInput
                    value={criteria.financial.minCapRate}
                    onChange={(val) => setCriteria(prev => ({ ...prev, financial: { ...prev.financial, minCapRate: val } }))}
                    placeholder="6.00%"
                    data-testid="input-min-cap-rate"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Max Cap Rate</Label>
                  <PercentageInput
                    value={criteria.financial.maxCapRate}
                    onChange={(val) => setCriteria(prev => ({ ...prev, financial: { ...prev.financial, maxCapRate: val } }))}
                    placeholder="12.00%"
                    data-testid="input-max-cap-rate"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Min Price Per Slip</Label>
                  <CurrencyInput
                    value={criteria.financial.minPricePerSlip}
                    onChange={(val) => setCriteria(prev => ({ ...prev, financial: { ...prev.financial, minPricePerSlip: val } }))}
                    placeholder="$25,000"
                    data-testid="input-min-price-per-slip"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Max Price Per Slip</Label>
                  <CurrencyInput
                    value={criteria.financial.maxPricePerSlip}
                    onChange={(val) => setCriteria(prev => ({ ...prev, financial: { ...prev.financial, maxPricePerSlip: val } }))}
                    placeholder="$150,000"
                    data-testid="input-max-price-per-slip"
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="size" className="space-y-4 pr-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Min Total Slips</Label>
                  <Input
                    type="number"
                    value={criteria.size.minTotalSlips || ""}
                    onChange={(e) => setCriteria(prev => ({ ...prev, size: { ...prev.size, minTotalSlips: e.target.value ? parseInt(e.target.value) : undefined } }))}
                    placeholder="25"
                    data-testid="input-min-total-slips"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Max Total Slips</Label>
                  <Input
                    type="number"
                    value={criteria.size.maxTotalSlips || ""}
                    onChange={(e) => setCriteria(prev => ({ ...prev, size: { ...prev.size, maxTotalSlips: e.target.value ? parseInt(e.target.value) : undefined } }))}
                    placeholder="500"
                    data-testid="input-max-total-slips"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Min Wet Slips</Label>
                  <Input
                    type="number"
                    value={criteria.size.minWetSlips || ""}
                    onChange={(e) => setCriteria(prev => ({ ...prev, size: { ...prev.size, minWetSlips: e.target.value ? parseInt(e.target.value) : undefined } }))}
                    placeholder="20"
                    data-testid="input-min-wet-slips"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Max Wet Slips</Label>
                  <Input
                    type="number"
                    value={criteria.size.maxWetSlips || ""}
                    onChange={(e) => setCriteria(prev => ({ ...prev, size: { ...prev.size, maxWetSlips: e.target.value ? parseInt(e.target.value) : undefined } }))}
                    placeholder="300"
                    data-testid="input-max-wet-slips"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Min Acreage</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={criteria.size.minAcreage || ""}
                    onChange={(e) => setCriteria(prev => ({ ...prev, size: { ...prev.size, minAcreage: e.target.value ? parseFloat(e.target.value) : undefined } }))}
                    placeholder="1.0"
                    data-testid="input-min-acreage"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Max Acreage</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={criteria.size.maxAcreage || ""}
                    onChange={(e) => setCriteria(prev => ({ ...prev, size: { ...prev.size, maxAcreage: e.target.value ? parseFloat(e.target.value) : undefined } }))}
                    placeholder="50.0"
                    data-testid="input-max-acreage"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">Min Occupancy Rate</Label>
                <PercentageInput
                  value={criteria.operational.minOccupancyRate}
                  onChange={(val) => setCriteria(prev => ({ ...prev, operational: { ...prev.operational, minOccupancyRate: val } }))}
                  placeholder="75.00%"
                  data-testid="input-min-occupancy-rate"
                />
              </div>

              <div className="space-y-3 pt-2">
                <Label className="text-sm font-medium">Required Amenities</Label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { key: "requireFuelDock", label: "Fuel Dock" },
                    { key: "requireShipStore", label: "Ship Store" },
                    { key: "requireRepairShop", label: "Repair Shop" },
                    { key: "requireDryStorage", label: "Dry Storage" },
                  ].map(({ key, label }) => (
                    <div key={key} className="flex items-center gap-2">
                      <Switch
                        checked={criteria.operational[key as keyof typeof criteria.operational] as boolean}
                        onCheckedChange={(checked) => setCriteria(prev => ({ ...prev, operational: { ...prev.operational, [key]: checked } }))}
                        data-testid={`switch-${key}`}
                      />
                      <Label className="text-sm">{label}</Label>
                    </div>
                  ))}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="capital" className="space-y-4 pr-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Total Capital Available</Label>
                  <CurrencyInput
                    value={criteria.capital.totalCapitalAvailable}
                    onChange={(val) => setCriteria(prev => ({ ...prev, capital: { ...prev.capital, totalCapitalAvailable: val } }))}
                    placeholder="$10,000,000"
                    data-testid="input-total-capital"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Max Equity Per Deal</Label>
                  <CurrencyInput
                    value={criteria.capital.maxEquityPerDeal}
                    onChange={(val) => setCriteria(prev => ({ ...prev, capital: { ...prev.capital, maxEquityPerDeal: val } }))}
                    placeholder="$5,000,000"
                    data-testid="input-max-equity-per-deal"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Target LTV Ratio</Label>
                  <PercentageInput
                    value={criteria.capital.targetLtvRatio}
                    onChange={(val) => setCriteria(prev => ({ ...prev, capital: { ...prev.capital, targetLtvRatio: val } }))}
                    placeholder="65.00%"
                    data-testid="input-target-ltv"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Target Hold Period (years)</Label>
                  <Input
                    type="number"
                    value={criteria.capital.targetHoldPeriod || ""}
                    onChange={(e) => setCriteria(prev => ({ ...prev, capital: { ...prev.capital, targetHoldPeriod: e.target.value ? parseInt(e.target.value) : undefined } }))}
                    placeholder="5"
                    data-testid="input-hold-period"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Min Cash-on-Cash Return</Label>
                  <PercentageInput
                    value={criteria.capital.minCashOnCashReturn}
                    onChange={(val) => setCriteria(prev => ({ ...prev, capital: { ...prev.capital, minCashOnCashReturn: val } }))}
                    placeholder="8.00%"
                    data-testid="input-min-coc"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Min IRR Target</Label>
                  <PercentageInput
                    value={criteria.capital.minIrrTarget}
                    onChange={(val) => setCriteria(prev => ({ ...prev, capital: { ...prev.capital, minIrrTarget: val } }))}
                    placeholder="15.00%"
                    data-testid="input-min-irr"
                  />
                </div>
              </div>
            </TabsContent>
          </ScrollArea>
        </Tabs>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel} data-testid="button-cancel-create">
            Cancel
          </Button>
          <Button type="submit" disabled={isLoading} data-testid="button-submit-create">
            {isLoading && <RefreshCw className="h-4 w-4 mr-2 animate-spin" />}
            Create Profile
          </Button>
        </DialogFooter>
      </form>
    </Form>
  );
}
