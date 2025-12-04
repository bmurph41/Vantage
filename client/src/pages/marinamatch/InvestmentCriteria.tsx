import { useState } from "react";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Investment Criteria Profile</DialogTitle>
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

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Profile Name</FormLabel>
              <FormControl>
                <Input placeholder="e.g., Gulf Coast Full-Service" {...field} />
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
                <Input placeholder="Optional description..." {...field} />
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
                  <Switch checked={field.value} onCheckedChange={field.onChange} />
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
                  <Switch checked={field.value} onCheckedChange={field.onChange} />
                </FormControl>
                <FormLabel className="!mt-0">Set as Default</FormLabel>
              </FormItem>
            )}
          />
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={isLoading}>
            {isLoading && <RefreshCw className="h-4 w-4 mr-2 animate-spin" />}
            Create Profile
          </Button>
        </DialogFooter>
      </form>
    </Form>
  );
}
