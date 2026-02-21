import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { HelpCircle, PlayCircle, RotateCcw, BookOpen, Video, Rocket } from "lucide-react";
import { TOUR_IDS, type TourId } from "@/lib/tour-configs";

const routeToTourMap: Record<string, TourId> = {
  "/dashboard": TOUR_IDS.DASHBOARD,
  "/deals": TOUR_IDS.CRM_DEALS,
  "/crm/contacts": TOUR_IDS.CRM_CONTACTS,
  "/crm/companies": TOUR_IDS.CRM_COMPANIES,
  "/crm/properties": TOUR_IDS.CRM_PROPERTIES,
  "/projects": TOUR_IDS.DUE_DILIGENCE,
  "/analysis/docktalk": TOUR_IDS.DOCKTALK,
  "/rent-roll": TOUR_IDS.RENT_ROLL,
  "/modeling": TOUR_IDS.VALUATOR,
  "/operations/fuel": TOUR_IDS.FUEL_SALES,
  "/operations/ship-store": TOUR_IDS.SHIP_STORE,
  "/operations/commercial-tenants": TOUR_IDS.COMMERCIAL_TENANTS,
  "/vdr": TOUR_IDS.VDR,
  "/portfolio": TOUR_IDS.PORTFOLIO,
  "/analysis/sales-comps": TOUR_IDS.SALES_COMPS,
  "/workspaces": TOUR_IDS.DEAL_WORKSPACE,
};

function getTourIdForRoute(path: string): TourId | null {
  const exactMatch = routeToTourMap[path];
  if (exactMatch) return exactMatch;

  for (const [route, tourId] of Object.entries(routeToTourMap)) {
    if (path.startsWith(route)) {
      return tourId;
    }
  }
  return null;
}

export function HelpMenu() {
  const [location, navigate] = useLocation();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);

  const currentTourId = getTourIdForRoute(location);

  const resetCurrentTourMutation = useMutation({
    mutationFn: async (tourId: string) => {
      return apiRequest("DELETE", `/api/tour-progress/${tourId}`);
    },
    onSuccess: (_, tourId) => {
      queryClient.setQueryData(["/api/tour-progress", tourId], { completed: false });
      queryClient.invalidateQueries({ queryKey: ["/api/tour-progress"] });
      setIsOpen(false);
      window.location.reload();
    },
  });

  const resetAllToursMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("DELETE", "/api/tour-progress");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tour-progress"] });
      setIsOpen(false);
    },
  });

  const showQuickStartMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("DELETE", "/api/tour-progress/quick-start-guide");
    },
    onSuccess: () => {
      queryClient.setQueryData(["/api/tour-progress", "quick-start-guide"], { completed: false });
      queryClient.invalidateQueries({ queryKey: ["/api/tour-progress"] });
      setIsOpen(false);
      navigate("/dashboard");
    },
  });

  const handleRestartPageTour = () => {
    if (currentTourId) {
      resetCurrentTourMutation.mutate(currentTourId);
    }
  };

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-9 w-9">
          <HelpCircle className="h-5 w-5 text-gray-600" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Help & Guides</DropdownMenuLabel>
        <DropdownMenuSeparator />

        <DropdownMenuItem
          onClick={() => showQuickStartMutation.mutate()}
          disabled={showQuickStartMutation.isPending}
        >
          <Rocket className="h-4 w-4 mr-2 text-blue-600" />
          Quick Start Guide
        </DropdownMenuItem>
        
        {currentTourId && (
          <DropdownMenuItem 
            onClick={handleRestartPageTour}
            disabled={resetCurrentTourMutation.isPending}
          >
            <PlayCircle className="h-4 w-4 mr-2 text-[#1E4FAB]" />
            Show Page Tour
          </DropdownMenuItem>
        )}

        <DropdownMenuItem 
          onClick={() => resetAllToursMutation.mutate()}
          disabled={resetAllToursMutation.isPending}
        >
          <RotateCcw className="h-4 w-4 mr-2" />
          Reset All Tours
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem>
          <BookOpen className="h-4 w-4 mr-2" />
          Documentation
        </DropdownMenuItem>

        <DropdownMenuItem>
          <Video className="h-4 w-4 mr-2" />
          Video Tutorials
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
