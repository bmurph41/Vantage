import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

export default function OrgSetupPage() {
  const [, setLocation] = useLocation();
  const { isAuthenticated, isLoading } = useAuth();
  const { toast } = useToast();
  const [orgName, setOrgName] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" data-testid="loader-auth" />
      </div>
    );
  }

  if (!isAuthenticated) {
    setLocation("/login");
    return null;
  }

  const handleCreateOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!orgName.trim()) {
      toast({
        title: "Organization name required",
        description: "Please enter a name for your organization",
        variant: "destructive",
      });
      return;
    }

    setIsCreating(true);
    try {
      await apiRequest("POST", "/api/organizations", { name: orgName.trim() });

      toast({
        title: "Organization created",
        description: `${orgName} has been created successfully`,
      });

      await queryClient.invalidateQueries({ queryKey: ["/api/organizations"] });
      setLocation("/");
    } catch (error: any) {
      console.error("Failed to create organization:", error);
      toast({
        title: "Failed to create organization",
        description: error.message || "An error occurred",
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-3">
          <CardTitle className="text-2xl text-center">
            Create Your Organization
          </CardTitle>
          <CardDescription className="text-center">
            Set up your organization to start managing marina projects
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreateOrg} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="org-name">Organization Name</Label>
              <Input
                id="org-name"
                placeholder="e.g., Acme Marina Holdings"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                disabled={isCreating}
                data-testid="input-org-name"
              />
              <p className="text-xs text-muted-foreground">
                This will be your primary organization. You can create additional organizations later.
              </p>
            </div>
            <Button 
              type="submit" 
              className="w-full" 
              size="lg"
              disabled={isCreating}
              data-testid="button-create-org"
            >
              {isCreating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Organization"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
