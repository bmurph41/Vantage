import { useState, useEffect, type ReactNode } from "react";
import { Loader2, Lock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { fetchFeatureFlags, type FeatureFlags } from "@/config/featureFlags";

interface FeatureGateProps {
  flag: keyof FeatureFlags;
  children: ReactNode;
  fallback?: ReactNode;
}

export function FeatureGate({ flag, children, fallback }: FeatureGateProps) {
  const [flags, setFlags] = useState<FeatureFlags | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchFeatureFlags().then(f => {
      setFlags(f);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!flags || !flags[flag]) {
    if (fallback) return <>{fallback}</>;
    
    return (
      <div className="container mx-auto py-12">
        <Card className="max-w-lg mx-auto">
          <CardContent className="pt-6 text-center">
            <Lock className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">Feature Not Available</h2>
            <p className="text-muted-foreground">
              This feature is not enabled for your organization.
              Contact your administrator to enable this feature.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}
