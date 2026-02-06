/**
 * ValuatorCommercialTenants
 * =========================
 * Drop-in replacement for the Valuator → Commercial Tenants tab.
 * Wraps the unified components with Valuator context.
 * 
 * USAGE: Replace the existing ValuatorCommercialTenantsTab:
 * 
 *   // In your valuator workspace page:
 *   import ValuatorCommercialTenants from '@/components/commercial-leases/wrappers/ValuatorCommercialTenants';
 *   <ValuatorCommercialTenants projectId={projectId} projectName={projectName} />
 */

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Building2 } from "lucide-react";
import { LeaseContextProvider } from "../LeaseContextProvider";
import { UnifiedLeaseList } from "../UnifiedLeaseList";
import { UnifiedLeaseForm } from "../UnifiedLeaseForm";
import { UnifiedLeaseDetail } from "../UnifiedLeaseDetail";
import { ConnectDialog } from "../ConnectDialog";

// You'll need to get orgId from your auth context. Example:
// import { useAuth } from "@/hooks/use-auth";

interface ValuatorCommercialTenantsProps {
  projectId: string;
  projectName?: string;
  /** If this project is linked to an Operations property */
  propertyId?: string;
}

export default function ValuatorCommercialTenants({
  projectId,
  projectName,
  propertyId,
}: ValuatorCommercialTenantsProps) {
  // TODO: Replace with your actual auth hook
  // const { user } = useAuth();
  // const orgId = user?.orgId || "";
  const orgId = ""; // ← Wire to your auth context

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isConnectOpen, setIsConnectOpen] = useState(false);
  const [editingLease, setEditingLease] = useState<any>(null);
  const [selectedLease, setSelectedLease] = useState<any>(null);

  const handleOpenForm = (lease?: any) => {
    setEditingLease(lease || null);
    setIsFormOpen(true);
  };

  const handleOpenDetail = (lease: any) => {
    setSelectedLease(lease);
    setIsDetailOpen(true);
  };

  const handleEditFromDetail = (lease: any) => {
    setIsDetailOpen(false);
    setTimeout(() => handleOpenForm(lease), 150);
  };

  return (
    <LeaseContextProvider
      mode="valuator"
      orgId={orgId}
      projectId={projectId}
      propertyId={propertyId}
    >
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Commercial Tenants
            </h3>
            <p className="text-sm text-muted-foreground">
              Model base rent, escalations, recoveries, and percentage rent
              {projectName ? ` for ${projectName}` : ""}
            </p>
          </div>
          <Badge variant="outline">Modeling</Badge>
        </div>

        <UnifiedLeaseList
          onOpenForm={handleOpenForm}
          onOpenDetail={handleOpenDetail}
          onOpenConnect={() => setIsConnectOpen(true)}
        />

        <UnifiedLeaseForm
          open={isFormOpen}
          onOpenChange={setIsFormOpen}
          editingLease={editingLease}
        />

        <UnifiedLeaseDetail
          open={isDetailOpen}
          onOpenChange={setIsDetailOpen}
          lease={selectedLease}
          onEdit={handleEditFromDetail}
        />

        <ConnectDialog
          open={isConnectOpen}
          onOpenChange={setIsConnectOpen}
          propertyId={propertyId}
        />
      </div>
    </LeaseContextProvider>
  );
}
