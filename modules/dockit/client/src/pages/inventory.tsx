import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Sidebar from "@/components/layout/sidebar";
import TopBar from "@/components/layout/top-bar";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, Warehouse, Map, Filter } from "lucide-react";
import type { Slip, Boat, Customer } from "@shared/schema";

export default function Inventory() {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const { data: slips = [], isLoading: slipsLoading } = useQuery<Slip[]>({
    queryKey: ['/api/slips'],
  });

  const { data: boats = [] } = useQuery<Boat[]>({
    queryKey: ['/api/boats'],
  });

  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ['/api/customers'],
  });

  // Filter slips based on search and filters
  const filteredSlips = slips.filter(slip => {
    const matchesSearch = slip.number.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         slip.section.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === "all" || slip.type === filterType;
    const matchesStatus = filterStatus === "all" || 
                         (filterStatus === "occupied" && slip.isOccupied) ||
                         (filterStatus === "available" && !slip.isOccupied);
    
    return matchesSearch && matchesType && matchesStatus;
  });

  const getSlipTypeLabel = (type: string) => {
    switch (type) {
      case 'wet':
        return 'Wet Slip';
      case 'dry_stack':
        return 'Dry Stack';
      case 'trailer':
        return 'Trailer';
      default:
        return type;
    }
  };

  const getStatusBadge = (isOccupied: boolean) => {
    return isOccupied ? (
      <Badge variant="destructive">Occupied</Badge>
    ) : (
      <Badge className="bg-accent text-accent-foreground">Available</Badge>
    );
  };

  const getBoatInfo = (boatId: string | null) => {
    if (!boatId) return null;
    const boat = boats.find(b => b.id === boatId);
    if (!boat) return "Unknown Boat";
    return `${boat.year} ${boat.make} ${boat.model}`;
  };

  const getCustomerName = (boatId: string | null) => {
    if (!boatId) return null;
    const boat = boats.find(b => b.id === boatId);
    if (!boat) return null;
    const customer = customers.find(c => c.id === boat.customerId);
    if (!customer) return "Unknown Customer";
    return `${customer.firstName} ${customer.lastName}`;
  };

  // Calculate inventory statistics
  const inventoryStats = {
    totalSlips: slips.length,
    occupiedSlips: slips.filter(s => s.isOccupied).length,
    availableSlips: slips.filter(s => !s.isOccupied).length,
    wetSlips: slips.filter(s => s.type === 'wet').length,
    dryStorage: slips.filter(s => s.type === 'dry_stack').length,
    trailerStorage: slips.filter(s => s.type === 'trailer').length,
  };

  if (slipsLoading) {
    return (
      <div className="flex h-screen bg-background">
        <Sidebar />
        <main className="flex-1 overflow-auto">
          <TopBar />
          <div className="p-6">
            <div className="animate-pulse space-y-4">
              <div className="h-8 bg-muted rounded w-64" />
              <div className="grid gap-4">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="h-32 bg-muted rounded-lg" />
                ))}
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      
      <main className="flex-1 overflow-auto">
        <TopBar />
        
        <div className="p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Marina Inventory</h1>
              <p className="text-muted-foreground">Manage slips, dry storage racks, and marina capacity</p>
            </div>
            <div className="flex space-x-2">
              <Button variant="outline" data-testid="button-view-map">
                <Map size={16} className="mr-2" />
                View Map
              </Button>
              <Button data-testid="button-add-slip">
                <Plus size={16} className="mr-2" />
                Add Slip
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <Card data-testid="total-slips">
              <CardContent className="p-6">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-chart-1 rounded-lg flex items-center justify-center">
                    <Warehouse className="text-white" size={20} />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Slips</p>
                    <p className="text-2xl font-bold">{inventoryStats.totalSlips}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card data-testid="occupied-slips">
              <CardContent className="p-6">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-destructive rounded-lg flex items-center justify-center">
                    <Warehouse className="text-white" size={20} />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Occupied</p>
                    <p className="text-2xl font-bold">{inventoryStats.occupiedSlips}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card data-testid="available-slips">
              <CardContent className="p-6">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-accent rounded-lg flex items-center justify-center">
                    <Warehouse className="text-white" size={20} />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Available</p>
                    <p className="text-2xl font-bold">{inventoryStats.availableSlips}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card data-testid="occupancy-rate">
              <CardContent className="p-6">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-chart-4 rounded-lg flex items-center justify-center">
                    <Warehouse className="text-white" size={20} />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Occupancy Rate</p>
                    <p className="text-2xl font-bold">
                      {inventoryStats.totalSlips > 0 
                        ? Math.round((inventoryStats.occupiedSlips / inventoryStats.totalSlips) * 100)
                        : 0}%
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Slip Inventory</h3>
                <div className="flex items-center space-x-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" size={16} />
                    <Input
                      type="search"
                      placeholder="Search slips..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10 w-64"
                      data-testid="search-slips"
                    />
                  </div>
                  <Select value={filterType} onValueChange={setFilterType}>
                    <SelectTrigger className="w-32" data-testid="filter-type">
                      <SelectValue placeholder="Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      <SelectItem value="wet">Wet Slip</SelectItem>
                      <SelectItem value="dry_stack">Dry Stack</SelectItem>
                      <SelectItem value="trailer">Trailer</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={filterStatus} onValueChange={setFilterStatus}>
                    <SelectTrigger className="w-32" data-testid="filter-status">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="available">Available</SelectItem>
                      <SelectItem value="occupied">Occupied</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            
            <CardContent>
              {filteredSlips.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  {searchTerm || filterType !== "all" || filterStatus !== "all" ? (
                    <div>
                      <Filter size={48} className="mx-auto mb-4 opacity-50" />
                      <p className="text-lg">No slips match your filters</p>
                      <p>Try adjusting your search terms or filters</p>
                    </div>
                  ) : (
                    <div>
                      <Warehouse size={48} className="mx-auto mb-4 opacity-50" />
                      <p className="text-lg">No slips configured</p>
                      <p>Click "Add Slip" to get started</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredSlips.map((slip) => (
                    <div
                      key={slip.id}
                      className="flex items-center justify-between p-4 border border-border rounded-lg hover:bg-muted/50 transition-colors"
                      data-testid={`slip-${slip.id}`}
                    >
                      <div className="flex items-center space-x-4">
                        <div className="text-center">
                          <p className="font-medium text-lg">{slip.number}</p>
                          <p className="text-sm text-muted-foreground">Section {slip.section}</p>
                        </div>
                        <div className="border-r border-border h-12" />
                        <div>
                          <div className="flex items-center space-x-2 mb-1">
                            <Badge variant="outline">{getSlipTypeLabel(slip.type)}</Badge>
                            {getStatusBadge(slip.isOccupied || false)}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {slip.maxLength}" × {slip.maxBeam}"
                            {slip.maxDraft && ` × ${slip.maxDraft}" draft`}
                          </p>
                          {slip.utilities && slip.utilities.length > 0 && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Utilities: {slip.utilities.join(", ")}
                            </p>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-6">
                        <div className="text-center">
                          <p className="text-sm text-muted-foreground">Monthly Rate</p>
                          <p className="font-medium">${slip.monthlyRate}</p>
                        </div>
                        {slip.isOccupied && slip.currentBoatId && (
                          <div className="text-right">
                            <p className="font-medium">{getCustomerName(slip.currentBoatId)}</p>
                            <p className="text-sm text-muted-foreground">{getBoatInfo(slip.currentBoatId)}</p>
                          </div>
                        )}
                        <Button variant="outline" size="sm" data-testid={`button-edit-${slip.id}`}>
                          Edit
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
