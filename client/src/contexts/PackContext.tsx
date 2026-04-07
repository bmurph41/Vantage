import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'wouter';
import { Loader2, Lock, CreditCard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PaywallModal, getPackDisplayName } from '@/components/PaywallModal';

// Core packs that users purchase first
export type CorePackType = 'crm_pipeline' | 'modeling_tools' | 'analysis' | 'operations';

// Add-on packs that require core packs
export type AddonPackType = 'fund_management' | 'lp_portal' | 'prospecting' | 'analytics_pro';

export type PackType = CorePackType | AddonPackType;

interface PackInfo {
  name: string;
  description: string;
  features: string[];
  isCore?: boolean;
  monthlyPriceCents?: number;
}

interface PackWithStatus {
  packType: PackType;
  info: PackInfo;
  isActive: boolean;
  dependencies: PackType[];
  canActivate: boolean;
}

export function useActivePacks() {
  return useQuery<PackType[]>({
    queryKey: ['/api/organization/packs/active'],
    staleTime: 60 * 1000,
  });
}

export function useAllPacks() {
  return useQuery<PackWithStatus[]>({
    queryKey: ['/api/organization/packs'],
    staleTime: 60 * 1000,
  });
}

export function usePacks() {
  const { data: activePacks = [], isLoading } = useActivePacks();
  const { data: packsWithStatus = [] } = useAllPacks();

  const hasPack = (packType: PackType): boolean => {
    return activePacks.includes(packType);
  };

  return {
    activePacks,
    packsWithStatus,
    isLoading,
    hasPack,
    // Core packs
    hasCrmPipeline: activePacks.includes('crm_pipeline'),
    hasModelingTools: activePacks.includes('modeling_tools'),
    hasAnalysis: activePacks.includes('analysis'),
    hasOperations: activePacks.includes('operations'),
    // Add-on packs
    hasFundManagement: activePacks.includes('fund_management'),
    hasLpPortal: activePacks.includes('lp_portal'),
    hasProspecting: activePacks.includes('prospecting'),
    hasAnalyticsPro: activePacks.includes('analytics_pro'),
  };
}

interface RequirePackProps {
  pack: PackType | PackType[];
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function RequirePack({ pack, children, fallback = null }: RequirePackProps) {
  const { hasPack, isLoading } = usePacks();
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  
  const packArray = Array.isArray(pack) ? pack : [pack];
  const hasAllPacks = packArray.every(p => hasPack(p));
  
  if (!hasAllPacks) {
    return <>{fallback}</>;
  }
  
  return <>{children}</>;
}

interface PackGateProps {
  pack: PackType | PackType[];
  children: React.ReactNode;
  upgradeMessage?: string;
  showUpgradePrompt?: boolean;
}

export function PackGate({ pack, children, upgradeMessage, showUpgradePrompt = true }: PackGateProps) {
  const { hasPack, packsWithStatus, isLoading } = usePacks();
  const [paywallOpen, setPaywallOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const packArray = Array.isArray(pack) ? pack : [pack];
  const hasAllPacks = packArray.every(p => hasPack(p));

  if (hasAllPacks) {
    return <>{children}</>;
  }

  if (!showUpgradePrompt) {
    return null;
  }

  const missingPacks = packArray.filter(p => !hasPack(p));
  const firstMissingPack = missingPacks[0];
  const tierName = getPackDisplayName(firstMissingPack);

  return (
    <div className="flex items-center justify-center min-h-[400px] p-8">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
          <Lock className="h-8 w-8 text-primary" />
        </div>

        <div className="space-y-2">
          <h2 className="text-2xl font-bold">Upgrade to {tierName}</h2>
          <p className="text-muted-foreground">
            {upgradeMessage || `This section is available on the ${tierName} plan and above.`}
          </p>
        </div>

        <div className="space-y-3">
          <Button size="lg" className="w-full" onClick={() => setPaywallOpen(true)}>
            <CreditCard className="mr-2 h-4 w-4" />
            View {tierName} Plan
          </Button>
          <p className="text-xs text-muted-foreground">
            14-day free trial available
          </p>
        </div>
      </div>

      <PaywallModal
        open={paywallOpen}
        onOpenChange={setPaywallOpen}
        packType={firstMissingPack}
        featureName={tierName}
      />
    </div>
  );
}
