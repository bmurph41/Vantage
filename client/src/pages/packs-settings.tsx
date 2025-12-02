import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Check, Lock, Briefcase, Users, Target, BarChart3 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type PackType = 'fund_management' | 'lp_portal' | 'prospecting' | 'analytics_pro';

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

const PACK_ICONS: Record<PackType, typeof Briefcase> = {
  fund_management: Briefcase,
  lp_portal: Users,
  prospecting: Target,
  analytics_pro: BarChart3,
};

export default function PacksSettingsPage() {
  const { toast } = useToast();

  const { data: packs = [], isLoading } = useQuery<PackWithStatus[]>({
    queryKey: ['/api/organization/packs'],
    staleTime: 60 * 1000,
  });

  const activateMutation = useMutation({
    mutationFn: async ({ packType, isTrial }: { packType: PackType; isTrial?: boolean }) => {
      await apiRequest('POST', `/api/organization/packs/${packType}/activate`, { isTrial });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/organization/packs'] });
      queryClient.invalidateQueries({ queryKey: ['/api/bootstrap'] });
      toast({
        title: "Pack Activated",
        description: `The ${variables.packType.replace(/_/g, ' ')} pack has been activated.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Activation Failed",
        description: error.message || "Failed to activate pack. Please try again.",
        variant: "destructive",
      });
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: async (packType: PackType) => {
      await apiRequest('POST', `/api/organization/packs/${packType}/deactivate`);
    },
    onSuccess: (_, packType) => {
      queryClient.invalidateQueries({ queryKey: ['/api/organization/packs'] });
      queryClient.invalidateQueries({ queryKey: ['/api/bootstrap'] });
      toast({
        title: "Pack Deactivated",
        description: `The ${packType.replace(/_/g, ' ')} pack has been deactivated.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Deactivation Failed",
        description: error.message || "Failed to deactivate pack. Please try again.",
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2" data-testid="text-page-title">Add-on Packs</h1>
        <p className="text-muted-foreground" data-testid="text-page-description">
          Extend your MarinaMatch platform with powerful add-on packs. Each pack unlocks premium features designed for PE firms and marina operators.
        </p>
      </div>

      <div className="grid gap-6">
        {packs.map((pack) => {
          const Icon = PACK_ICONS[pack.packType];
          const isPending = activateMutation.isPending || deactivateMutation.isPending;
          
          return (
            <Card key={pack.packType} className={pack.isActive ? "border-primary" : ""} data-testid={`card-pack-${pack.packType}`}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${pack.isActive ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                      <Icon className="h-6 w-6" />
                    </div>
                    <div>
                      <CardTitle className="flex items-center gap-2" data-testid={`text-pack-name-${pack.packType}`}>
                        {pack.info.name}
                        {pack.isActive && (
                          <Badge variant="default" className="ml-2" data-testid={`badge-active-${pack.packType}`}>
                            <Check className="h-3 w-3 mr-1" />
                            Active
                          </Badge>
                        )}
                      </CardTitle>
                      <CardDescription className="mt-1" data-testid={`text-pack-description-${pack.packType}`}>
                        {pack.info.description}
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {pack.isActive ? (
                      <Button
                        variant="outline"
                        onClick={() => deactivateMutation.mutate(pack.packType)}
                        disabled={isPending}
                        data-testid={`button-deactivate-${pack.packType}`}
                      >
                        {deactivateMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : null}
                        Deactivate
                      </Button>
                    ) : pack.canActivate ? (
                      <>
                        <Button
                          variant="outline"
                          onClick={() => activateMutation.mutate({ packType: pack.packType, isTrial: true })}
                          disabled={isPending}
                          data-testid={`button-trial-${pack.packType}`}
                        >
                          Start Trial
                        </Button>
                        <Button
                          onClick={() => activateMutation.mutate({ packType: pack.packType })}
                          disabled={isPending}
                          data-testid={`button-activate-${pack.packType}`}
                        >
                          {activateMutation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          ) : null}
                          Activate
                        </Button>
                      </>
                    ) : (
                      <Button disabled variant="outline" data-testid={`button-locked-${pack.packType}`}>
                        <Lock className="h-4 w-4 mr-2" />
                        Requires {pack.dependencies.map(d => d.replace(/_/g, ' ')).join(', ')}
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <h4 className="font-medium text-sm">Features included:</h4>
                  <ul className="grid gap-2 sm:grid-cols-2">
                    {pack.info.features.map((feature, idx) => (
                      <li key={idx} className="flex items-center gap-2 text-sm text-muted-foreground" data-testid={`text-feature-${pack.packType}-${idx}`}>
                        <Check className={`h-4 w-4 ${pack.isActive ? 'text-primary' : 'text-muted-foreground'}`} />
                        {feature}
                      </li>
                    ))}
                  </ul>
                </div>
                {pack.dependencies.length > 0 && !pack.isActive && (
                  <div className="mt-4 p-3 bg-muted rounded-lg" data-testid={`text-dependency-notice-${pack.packType}`}>
                    <p className="text-sm text-muted-foreground">
                      <Lock className="h-4 w-4 inline mr-2" />
                      This pack requires the{' '}
                      <strong>{pack.dependencies.map(d => d.replace(/_/g, ' ')).join(' and ')}</strong>{' '}
                      pack{pack.dependencies.length > 1 ? 's' : ''} to be active first.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
