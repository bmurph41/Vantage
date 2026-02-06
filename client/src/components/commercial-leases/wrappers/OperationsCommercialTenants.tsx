/**
 * OperationsCommercialTenants
 * ===========================
 * Drop-in replacement for the Operations → Commercial Tenants page.
 * Wraps the unified components with Operations context.
 * 
 * USAGE: Replace the existing CommercialTenants default export:
 * 
 *   // client/src/pages/operations/commercial-tenants/index.tsx
 *   export { default } from '@/components/commercial-leases/wrappers/OperationsCommercialTenants';
 * 
 * Or import directly in your router.
 */

import { useState } from "react";
import { LeaseContextProvider } from "../LeaseContextProvider";
import { UnifiedLeaseList } from "../UnifiedLeaseList";
import { UnifiedLeaseForm } from "../UnifiedLeaseForm";
import { UnifiedLeaseDetail } from "../UnifiedLeaseDetail";
// import { PageTour } from "@/components/onboarding/PageTour";
// Uncomment if you have tour configs:
// import { TOUR_IDS, commercialTenantsTourSteps } from "@/lib/tour-configs";

// You'll need to get orgId from your auth context. Example:
// import { useAuth } from "@/hooks/use-auth";

interface OperationsCommercialTenantsProps {
  /** If you want to pre-select a property */
  propertyId?: string;
}

export default function OperationsCommercialTenants({
  propertyId,
}: OperationsCommercialTenantsProps) {
  // TODO: Replace with your actual auth hook
  // const { user } = useAuth();
  // const orgId = user?.orgId || "";
  const orgId = ""; // ← Wire to your auth context

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
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
      mode="operations"
      orgId={orgId}
      propertyId={propertyId}
    >
      <div className="p-6 space-y-6">
        {/* Uncomment if you have tours set up:
        <PageTour tourId={TOUR_IDS.COMMERCIAL_TENANTS} steps={commercialTenantsTourSteps} />
        */}

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Commercial Tenants</h1>
            <p className="text-muted-foreground">
              Manage commercial lease abstracts for your properties
            </p>
          </div>
        </div>

        <UnifiedLeaseList
          onOpenForm={handleOpenForm}
          onOpenDetail={handleOpenDetail}
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
      </div>
    </LeaseContextProvider>
  );
}
