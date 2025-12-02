import { useQuery } from '@tanstack/react-query';
import { Link } from 'wouter';
import { Loader2 } from 'lucide-react';

export type PackType = 'fund_management' | 'lp_portal' | 'prospecting' | 'analytics_pro';

interface PackInfo {
  name: string;
  description: string;
  features: string[];
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
  const packNames = missingPacks.map(p => {
    const packInfo = packsWithStatus.find(ps => ps.packType === p);
    return packInfo?.info.name || p.replace(/_/g, ' ');
  }).join(', ');
  
  return (
    <div className="p-8 m-6 border rounded-lg bg-muted/50 text-center">
      <div className="text-lg font-semibold mb-2">Premium Feature</div>
      <p className="text-muted-foreground mb-4 max-w-md mx-auto">
        {upgradeMessage || `This feature requires the ${packNames} add-on pack.`}
      </p>
      <Link 
        href="/settings/packs" 
        className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
      >
        View Available Add-ons
      </Link>
    </div>
  );
}
