import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

export default function LoginPage() {
  const [, setLocation] = useLocation();
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (isAuthenticated) {
      setLocation("/");
    }
  }, [isAuthenticated, setLocation]);

  const handleLogin = () => {
    window.location.href = "/api/login";
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" data-testid="loader-auth" />
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-3">
          <CardTitle className="text-2xl text-center">
            Welcome to MarinaMatch
          </CardTitle>
          <CardDescription className="text-center">
            Comprehensive rent roll analysis for marina operators and PE firms
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>
              MarinaMatch provides institutional-grade lease management and financial analytics:
            </p>
            <ul className="space-y-1 pl-4">
              <li>• Executive dashboards with KPIs and revenue trends</li>
              <li>• Multi-project portfolio management</li>
              <li>• Excel-parity rent roll analysis with as-of date support</li>
              <li>• Bulk import with manual column mapping</li>
              <li>• Organization-level data isolation and role-based access</li>
            </ul>
          </div>
          <Button 
            className="w-full" 
            size="lg"
            onClick={handleLogin}
            data-testid="button-login"
          >
            Sign in with Replit
          </Button>
          <p className="text-xs text-center text-muted-foreground">
            Supports Google, GitHub, X, Apple, and email/password authentication
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
