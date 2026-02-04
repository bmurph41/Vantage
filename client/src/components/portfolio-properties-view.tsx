import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { 
  Building2, 
  Plus, 
  MapPin, 
  CheckCircle2, 
  AlertCircle, 
  Clock,
  ChevronRight,
  Trash2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AddressAutocompleteInput, type NormalizedAddress } from "@/components/ui/address-autocomplete-input";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { Project, CrmProperty, DDTask } from "@shared/schema";

interface PortfolioPropertiesViewProps {
  portfolioId: string;
  portfolioName: string;
}

interface ChildProject extends Project {
  tasks?: DDTask[];
  completionPct?: number;
}

export function PortfolioPropertiesView({ portfolioId, portfolioName }: PortfolioPropertiesViewProps) {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [addMethod, setAddMethod] = useState<"existing" | "new">("existing");
  const [selectedPropertyId, setSelectedPropertyId] = useState("");
  const [newPropertyName, setNewPropertyName] = useState("");
  const [addressInputValue, setAddressInputValue] = useState("");
  const [addressData, setAddressData] = useState<NormalizedAddress | null>(null);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: childrenData, isLoading: childrenLoading } = useQuery<{ children: ChildProject[] }>({
    queryKey: [`/api/dd/projects/${portfolioId}/children`],
  });
  const children = childrenData?.children || [];

  const { data: propertiesResponse } = useQuery<{ properties: CrmProperty[] }>({
    queryKey: ["/api/crm/properties"],
    enabled: isAddDialogOpen,
  });
  const properties = propertiesResponse?.properties || [];

  const childProjectIds = children.map(c => c.propertyId).filter(Boolean);
  const availableProperties = properties.filter(p => !childProjectIds.includes(p.id));

  const { data: tasksData } = useQuery<Record<string, DDTask[]>>({
    queryKey: ["portfolio-tasks", portfolioId, children.map(c => c.id).join(",")],
    queryFn: async () => {
      const tasksMap: Record<string, DDTask[]> = {};
      await Promise.all(
        children.map(async (child) => {
          try {
            const res = await fetch(`/api/dd/projects/${child.id}/tasks`);
            if (res.ok) {
              tasksMap[child.id] = await res.json();
            }
          } catch (e) {
            tasksMap[child.id] = [];
          }
        })
      );
      return tasksMap;
    },
    enabled: children.length > 0,
  });

  const addPropertyMutation = useMutation({
    mutationFn: async () => {
      const body: any = {};
      
      if (addMethod === "existing" && selectedPropertyId) {
        body.propertyId = selectedPropertyId;
        const property = properties.find(p => p.id === selectedPropertyId);
        body.name = property?.title || "Property DD";
        body.city = property?.city;
        body.state = property?.state;
      } else if (addMethod === "new" && addressData) {
        body.name = newPropertyName || addressData.name || "New Property DD";
        body.address = addressData.line1 || addressData.formattedAddress;
        body.city = addressData.city;
        body.state = addressData.state;
        body.zipCode = addressData.postalCode;
        body.placeId = addressData.placeId;
        if (addressData.lat && addressData.lng) {
          body.coordinates = { lat: addressData.lat, lng: addressData.lng };
        }
      }
      
      const response = await apiRequest("POST", `/api/dd/projects/${portfolioId}/add-property`, body);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/dd/projects/${portfolioId}/children`] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/properties"] });
      toast({
        title: "Property added",
        description: "Property has been added to the portfolio.",
      });
      setIsAddDialogOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      toast({
        title: "Error adding property",
        description: error.message || "Something went wrong",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setAddMethod("existing");
    setSelectedPropertyId("");
    setNewPropertyName("");
    setAddressInputValue("");
    setAddressData(null);
  };

  const handleAddressSelect = (addr: NormalizedAddress) => {
    setAddressData(addr);
    setAddressInputValue(addr.formattedAddress || "");
    if (!newPropertyName && addr.name) {
      setNewPropertyName(addr.name);
    }
  };

  const getProjectStats = (projectId: string) => {
    const tasks = tasksData?.[projectId] || [];
    const total = tasks.length;
    const completed = tasks.filter(t => t.status === "completed").length;
    const overdue = tasks.filter(t => {
      if (t.status === "completed" || !t.deadline) return false;
      return new Date(t.deadline) < new Date();
    }).length;
    const completionPct = total > 0 ? Math.round((completed / total) * 100) : 0;
    
    return { total, completed, overdue, completionPct };
  };

  const overallStats = children.reduce(
    (acc, child) => {
      const stats = getProjectStats(child.id);
      return {
        totalTasks: acc.totalTasks + stats.total,
        completedTasks: acc.completedTasks + stats.completed,
        overdueTasks: acc.overdueTasks + stats.overdue,
      };
    },
    { totalTasks: 0, completedTasks: 0, overdueTasks: 0 }
  );

  const overallPct = overallStats.totalTasks > 0 
    ? Math.round((overallStats.completedTasks / overallStats.totalTasks) * 100) 
    : 0;

  if (childrenLoading) {
    return (
      <div className="space-y-4">
        <div className="animate-pulse">
          <div className="h-32 bg-muted rounded-lg mb-4"></div>
          <div className="h-24 bg-muted rounded-lg mb-2"></div>
          <div className="h-24 bg-muted rounded-lg"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Portfolio Overview</CardTitle>
            <Badge variant="secondary">{children.length} Properties</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold">{children.length}</div>
              <div className="text-sm text-muted-foreground">Properties</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{overallStats.completedTasks}</div>
              <div className="text-sm text-muted-foreground">Tasks Complete</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{overallStats.totalTasks - overallStats.completedTasks}</div>
              <div className="text-sm text-muted-foreground">Tasks Remaining</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">{overallStats.overdueTasks}</div>
              <div className="text-sm text-muted-foreground">Overdue</div>
            </div>
          </div>
          <div className="mt-4">
            <div className="flex justify-between text-sm mb-1">
              <span>Overall Progress</span>
              <span>{overallPct}%</span>
            </div>
            <Progress value={overallPct} className="h-2" />
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Properties in Portfolio</h3>
        <Button onClick={() => setIsAddDialogOpen(true)} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Add Property
        </Button>
      </div>

      {children.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="font-semibold mb-2">No Properties Yet</h3>
            <p className="text-muted-foreground mb-4">
              Add properties to this portfolio to track their due diligence separately.
            </p>
            <Button onClick={() => setIsAddDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add First Property
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {children.map((child) => {
            const stats = getProjectStats(child.id);
            return (
              <Link key={child.id} href={`/dd/projects/${child.id}`}>
                <Card className="hover:border-primary/50 transition-colors cursor-pointer">
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                          <Building2 className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <h4 className="font-semibold">{child.name}</h4>
                          {(child.city || child.state) && (
                            <div className="flex items-center gap-1 text-sm text-muted-foreground">
                              <MapPin className="h-3 w-3" />
                              {[child.city, child.state].filter(Boolean).join(", ")}
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-6">
                        <div className="flex items-center gap-4 text-sm">
                          <div className="flex items-center gap-1">
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                            <span>{stats.completed}/{stats.total}</span>
                          </div>
                          {stats.overdue > 0 && (
                            <div className="flex items-center gap-1 text-red-600">
                              <AlertCircle className="h-4 w-4" />
                              <span>{stats.overdue} overdue</span>
                            </div>
                          )}
                        </div>
                        
                        <div className="w-32">
                          <div className="flex justify-between text-xs mb-1">
                            <span>{stats.completionPct}%</span>
                          </div>
                          <Progress value={stats.completionPct} className="h-1.5" />
                        </div>
                        
                        <ChevronRight className="h-5 w-5 text-muted-foreground" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}

      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Add Property to Portfolio</DialogTitle>
            <DialogDescription>
              Link an existing CRM property or add a new one to "{portfolioName}".
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Property Source</Label>
              <Select value={addMethod} onValueChange={(v) => setAddMethod(v as "existing" | "new")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="existing">Link Existing Property</SelectItem>
                  <SelectItem value="new">Add New Property</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {addMethod === "existing" ? (
              <div className="space-y-2">
                <Label>Select Property</Label>
                <Select value={selectedPropertyId} onValueChange={setSelectedPropertyId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a property..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableProperties.length === 0 ? (
                      <div className="p-2 text-sm text-muted-foreground text-center">
                        No available properties
                      </div>
                    ) : (
                      availableProperties.map((property) => (
                        <SelectItem key={property.id} value={property.id}>
                          {property.title} {property.city ? `- ${property.city}, ${property.state}` : ''}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label>Property Name</Label>
                  <Input 
                    value={newPropertyName}
                    onChange={(e) => setNewPropertyName(e.target.value)}
                    placeholder="e.g. Sunset Marina"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Address</Label>
                  <AddressAutocompleteInput
                    value={addressInputValue}
                    onChangeText={setAddressInputValue}
                    onSelectAddress={handleAddressSelect}
                    placeholder="Search for an address..."
                    searchType="establishment"
                  />
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={() => addPropertyMutation.mutate()}
              disabled={
                addPropertyMutation.isPending || 
                (addMethod === "existing" && !selectedPropertyId) ||
                (addMethod === "new" && !addressData)
              }
            >
              {addPropertyMutation.isPending ? "Adding..." : "Add Property"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
