import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { LeaseContextProvider } from "../LeaseContextProvider";
import { UnifiedLeaseList } from "../UnifiedLeaseList";
import { UnifiedLeaseForm } from "../UnifiedLeaseForm";
import { UnifiedLeaseDetail } from "../UnifiedLeaseDetail";

interface OperationsCommercialTenantsProps {
  propertyId?: string;
}

export default function OperationsCommercialTenants({
  propertyId,
}: OperationsCommercialTenantsProps) {
  const { user } = useAuth();
  const orgId = user?.orgId || "";

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
