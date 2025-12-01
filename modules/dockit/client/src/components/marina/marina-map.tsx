import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { 
  Anchor, 
  MapPin, 
  Users, 
  DollarSign, 
  Calendar,
  Waves,
  Warehouse,
  Truck,
  Search,
  Filter
} from "lucide-react";
import { Input } from "@/components/ui/input";
import type { Customer, Boat, Lease } from "@shared/schema";

interface EnrichedSlip {
  id: string;
  number: string;
  type: string;
  section: string;
  maxLength: string;
  maxBeam: string;
  maxDraft: string | null;
  utilities: string[] | null;
  monthlyRate: string;
  isOccupied: boolean;
  currentBoatId: string | null;
  customer: Customer | null;
  boat: Boat | null;
  lease: Lease | null;
  paymentStatus: string | null;
  lastPaymentDate: Date | null;
  launchCount: number;
}

interface MarinaMapData {
  slips: EnrichedSlip[];
  stats: {
    totalSlips: number;
    occupiedSlips: number;
    availableSlips: number;
    occupancyRate: number;
    slipsBySection: Record<string, number>;
    slipsByType: Record<string, number>;
  };
}

interface MarinaMapProps {
  onSlipSelect: (slip: EnrichedSlip | null) => void;
  selectedSlip?: EnrichedSlip | null;
}

export default function MarinaMap({ onSlipSelect, selectedSlip }: MarinaMapProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<"all" | "occupied" | "vacant">("all");
  const [activeStorageType, setActiveStorageType] = useState<"wet" | "dry_stack" | "trailer">("wet");

  const { data: mapData, isLoading, error } = useQuery<MarinaMapData>({
    queryKey: ["/api/marina/map-data"],
  });

  const getSlipStatusColor = (slip: EnrichedSlip) => {
    if (!slip.isOccupied) return "bg-green-500 hover:bg-green-600";
    if (slip.paymentStatus === "overdue") return "bg-red-600 hover:bg-red-700";
    if (slip.paymentStatus === "pending") return "bg-yellow-500 hover:bg-yellow-600";
    return "bg-blue-500 hover:bg-blue-600";
  };

  const getSlipStatusText = (slip: EnrichedSlip) => {
    if (!slip.isOccupied) return "Available";
    if (slip.paymentStatus === "overdue") return "Overdue";
    if (slip.paymentStatus === "pending") return "Payment Due";
    return "Occupied";
  };

  const filteredSlips = mapData?.slips.filter((slip) => {
    const matchesSearch = !searchTerm || 
      slip.number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      slip.customer?.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      slip.customer?.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      slip.boat?.name.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesFilter = filterType === "all" || 
      (filterType === "occupied" && slip.isOccupied) ||
      (filterType === "vacant" && !slip.isOccupied);

    const matchesType = slip.type === activeStorageType;

    return matchesSearch && matchesFilter && matchesType;
  }) || [];

  const slipsBySection = filteredSlips.reduce((acc, slip) => {
    if (!acc[slip.section]) acc[slip.section] = [];
    acc[slip.section].push(slip);
    return acc;
  }, {} as Record<string, EnrichedSlip[]>);

  const getStorageIcon = (type: string) => {
    switch (type) {
      case "wet": return <Waves className="w-4 h-4" />;
      case "dry_stack": return <Warehouse className="w-4 h-4" />;
      case "trailer": return <Truck className="w-4 h-4" />;
      default: return <Anchor className="w-4 h-4" />;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96" data-testid="loading-marina-map">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-96" data-testid="error-marina-map">
        <div className="text-center">
          <p className="text-destructive mb-4">Failed to load marina map data</p>
          <Button onClick={() => window.location.reload()} data-testid="button-retry">
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="container-marina-map">
      {/* Header with Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card data-testid="card-total-slips">
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <MapPin className="w-5 h-5 text-primary" />
              <div>
                <p className="text-sm text-muted-foreground">Total Slips</p>
                <p className="text-2xl font-bold" data-testid="text-total-slips">{mapData?.stats.totalSlips || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-occupied-slips">
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Users className="w-5 h-5 text-blue-500" />
              <div>
                <p className="text-sm text-muted-foreground">Occupied</p>
                <p className="text-2xl font-bold text-blue-500" data-testid="text-occupied-slips">{mapData?.stats.occupiedSlips || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-available-slips">
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Calendar className="w-5 h-5 text-green-500" />
              <div>
                <p className="text-sm text-muted-foreground">Available</p>
                <p className="text-2xl font-bold text-green-500" data-testid="text-available-slips">{mapData?.stats.availableSlips || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-occupancy-rate">
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <DollarSign className="w-5 h-5 text-primary" />
              <div>
                <p className="text-sm text-muted-foreground">Occupancy Rate</p>
                <p className="text-2xl font-bold" data-testid="text-occupancy-rate">{mapData?.stats.occupancyRate || 0}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Storage Type Tabs */}
      <Tabs value={activeStorageType} onValueChange={(value) => setActiveStorageType(value as "wet" | "dry_stack" | "trailer")} className="w-full">
        <TabsList className="grid w-full grid-cols-3" data-testid="tabs-storage-types">
          <TabsTrigger value="wet" className="flex items-center space-x-2" data-testid="tab-wet-slips">
            <Waves className="w-4 h-4" />
            <span>Wet Slips</span>
          </TabsTrigger>
          <TabsTrigger value="dry_stack" className="flex items-center space-x-2" data-testid="tab-dry-stack">
            <Warehouse className="w-4 h-4" />
            <span>Dry Stack</span>
          </TabsTrigger>
          <TabsTrigger value="trailer" className="flex items-center space-x-2" data-testid="tab-trailer">
            <Truck className="w-4 h-4" />
            <span>Trailer Storage</span>
          </TabsTrigger>
        </TabsList>

        {/* Search and Filter Controls */}
        <div className="flex flex-col sm:flex-row gap-4 mt-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Search by slip number, customer name, or boat name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
              data-testid="input-search-slips"
            />
          </div>
          <div className="flex gap-2">
            <Button
              variant={filterType === "all" ? "default" : "outline"}
              onClick={() => setFilterType("all")}
              data-testid="button-filter-all"
            >
              All
            </Button>
            <Button
              variant={filterType === "occupied" ? "default" : "outline"}
              onClick={() => setFilterType("occupied")}
              data-testid="button-filter-occupied"
            >
              Occupied
            </Button>
            <Button
              variant={filterType === "vacant" ? "default" : "outline"}
              onClick={() => setFilterType("vacant")}
              data-testid="button-filter-vacant"
            >
              Vacant
            </Button>
          </div>
        </div>

        <TabsContent value="wet" className="mt-6">
          <MarinaSection
            title="Wet Slips"
            slipsBySection={slipsBySection}
            onSlipSelect={onSlipSelect}
            selectedSlip={selectedSlip}
            getSlipStatusColor={getSlipStatusColor}
            getSlipStatusText={getSlipStatusText}
          />
        </TabsContent>

        <TabsContent value="dry_stack" className="mt-6">
          <MarinaSection
            title="Dry Stack Storage"
            slipsBySection={slipsBySection}
            onSlipSelect={onSlipSelect}
            selectedSlip={selectedSlip}
            getSlipStatusColor={getSlipStatusColor}
            getSlipStatusText={getSlipStatusText}
          />
        </TabsContent>

        <TabsContent value="trailer" className="mt-6">
          <MarinaSection
            title="Trailer Storage"
            slipsBySection={slipsBySection}
            onSlipSelect={onSlipSelect}
            selectedSlip={selectedSlip}
            getSlipStatusColor={getSlipStatusColor}
            getSlipStatusText={getSlipStatusText}
          />
        </TabsContent>
      </Tabs>

      {/* Legend */}
      <Card data-testid="card-legend">
        <CardHeader>
          <CardTitle className="text-lg">Legend</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 bg-green-500 rounded"></div>
              <span className="text-sm">Available</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 bg-blue-500 rounded"></div>
              <span className="text-sm">Occupied</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 bg-yellow-500 rounded"></div>
              <span className="text-sm">Payment Due</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 bg-red-600 rounded"></div>
              <span className="text-sm">Payment Overdue</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

interface MarinaSectionProps {
  title: string;
  slipsBySection: Record<string, EnrichedSlip[]>;
  onSlipSelect: (slip: EnrichedSlip | null) => void;
  selectedSlip?: EnrichedSlip | null;
  getSlipStatusColor: (slip: EnrichedSlip) => string;
  getSlipStatusText: (slip: EnrichedSlip) => string;
}

function MarinaSection({ 
  title, 
  slipsBySection, 
  onSlipSelect, 
  selectedSlip, 
  getSlipStatusColor, 
  getSlipStatusText 
}: MarinaSectionProps) {
  return (
    <div className="space-y-6" data-testid={`section-${title.toLowerCase().replace(/\s+/g, '-')}`}>
      <h3 className="text-xl font-semibold">{title}</h3>
      
      {Object.keys(slipsBySection).length === 0 ? (
        <div className="text-center py-12 text-muted-foreground" data-testid="text-no-slips">
          No slips found for the current filters
        </div>
      ) : (
        Object.entries(slipsBySection).map(([section, sectionSlips]) => (
          <Card key={section} data-testid={`card-section-${section}`}>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <span>Section {section}</span>
                <Badge variant="secondary" data-testid={`badge-section-count-${section}`}>
                  {sectionSlips.length} slips
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3">
                {sectionSlips.map((slip) => (
                  <Button
                    key={slip.id}
                    variant="outline"
                    className={cn(
                      "h-16 p-2 flex flex-col items-center justify-center relative transition-all duration-200",
                      getSlipStatusColor(slip),
                      "text-white border-none",
                      selectedSlip?.id === slip.id && "ring-2 ring-ring ring-offset-2"
                    )}
                    onClick={() => onSlipSelect(slip)}
                    data-testid={`button-slip-${slip.number}`}
                  >
                    <span className="font-medium text-xs">{slip.number}</span>
                    <span className="text-xs opacity-90">{getSlipStatusText(slip)}</span>
                    {slip.isOccupied && slip.boat && (
                      <div className="absolute top-1 right-1 w-2 h-2 bg-white rounded-full opacity-75"></div>
                    )}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}