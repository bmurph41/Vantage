import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Circle, ArrowRight, Building2, Users, Briefcase, Settings, BarChart3, Upload, Sparkles, X } from "lucide-react";

export default function OnboardingWizardPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [, setLocation] = useLocation();
  const [step, setStep] = useState(0);
  const [orgName, setOrgName] = useState("");
  const [invites, setInvites] = useState([{ email: "", role: "editor" }]);

  const { data: status, isLoading } = useQuery<any>({
    queryKey: ["/api/onboarding/status"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/onboarding/status");
      return res.json();
    },
  });

  const setupOrg = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/onboarding/setup-org", data);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/onboarding"] });
      setStep(1);
      toast({ title: "Organization set up" });
    },
  });

  const inviteTeam = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/onboarding/invite-team", data);
      return res.json();
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["/api/onboarding"] });
      setStep(2);
      toast({ title: `${data.invited} invites sent` });
    },
  });

  const dismiss = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/onboarding/dismiss");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/onboarding"] });
      setLocation("/dashboard");
    },
  });

  const completeStep = useMutation({
    mutationFn: async (stepKey: string) => {
      const res = await apiRequest("POST", "/api/onboarding/complete-step", { step: stepKey });
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/onboarding"] }),
  });

  if (isLoading) return <div className="flex items-center justify-center h-screen">Loading...</div>;
  if (status?.isOnboardingComplete) {
    setLocation("/dashboard");
    return null;
  }

  const checklist = status?.checklist || [];

  const stepIcons: Record<string, any> = {
    org_profile: Building2, invite_team: Users, first_deal: Briefcase,
    connect_integration: Settings, activate_pack: Sparkles,
    explore_modeling: BarChart3, upload_comps: Upload,
  };

  const stepLinks: Record<string, string> = {
    first_deal: "/crm/deals", connect_integration: "/operations/integrations",
    activate_pack: "/settings/packs", explore_modeling: "/modeling/projects",
    upload_comps: "/analysis/sales-comps",
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center p-6">
      <div className="w-full max-w-2xl">
        {/* Progress bar */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-2xl font-bold">Welcome to MarinaMatch</h1>
            <Button variant="ghost" size="sm" onClick={() => dismiss.mutate()}>
              <X className="h-4 w-4 mr-1" /> Skip setup
            </Button>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div className="h-2 rounded-full bg-blue-600 transition-all" style={{ width: `${status?.progressPct || 0}%` }} />
          </div>
          <p className="text-sm text-muted-foreground mt-1">{status?.completedCount || 0} of {status?.totalSteps || 0} steps complete</p>
        </div>

        {/* Step 0: Org Setup */}
        {step === 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Building2 className="h-5 w-5" />Set Up Your Organization</CardTitle>
              <CardDescription>Tell us about your team so we can customize your experience</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Organization Name</Label>
                <Input value={orgName} onChange={(e) => setOrgName(e.target.value)} placeholder="Acme Capital Partners" />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setStep(1)}>Skip</Button>
                <Button onClick={() => setupOrg.mutate({ name: orgName })} disabled={!orgName || setupOrg.isPending}>
                  Continue <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 1: Invite Team */}
        {step === 1 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" />Invite Your Team</CardTitle>
              <CardDescription>Add team members to collaborate on deals and models</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {invites.map((inv, i) => (
                <div key={i} className="flex gap-2">
                  <Input placeholder="email@example.com" value={inv.email} onChange={(e) => {
                    const updated = [...invites];
                    updated[i] = { ...inv, email: e.target.value };
                    setInvites(updated);
                  }} className="flex-1" />
                  {i > 0 && <Button variant="ghost" size="sm" onClick={() => setInvites(invites.filter((_, j) => j !== i))}><X className="h-4 w-4" /></Button>}
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={() => setInvites([...invites, { email: "", role: "editor" }])}>+ Add another</Button>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setStep(2)}>Skip</Button>
                <Button onClick={() => inviteTeam.mutate({ invites: invites.filter((i) => i.email) })} disabled={inviteTeam.isPending}>
                  Send Invites <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Checklist */}
        {step >= 2 && (
          <Card>
            <CardHeader>
              <CardTitle>Getting Started Checklist</CardTitle>
              <CardDescription>Complete these steps to get the most out of MarinaMatch</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {checklist.map((item: any) => {
                const Icon = stepIcons[item.key] || Circle;
                const link = stepLinks[item.key];
                return (
                  <div key={item.key} className={`flex items-center justify-between p-3 rounded-lg border ${item.completed ? "bg-green-50 border-green-200" : "hover:bg-muted"}`}>
                    <div className="flex items-center gap-3">
                      {item.completed
                        ? <CheckCircle className="h-5 w-5 text-green-600" />
                        : <Icon className="h-5 w-5 text-muted-foreground" />}
                      <span className={item.completed ? "text-green-800 line-through" : ""}>{item.label}</span>
                    </div>
                    {!item.completed && link && (
                      <Button size="sm" variant="outline" onClick={() => {
                        completeStep.mutate(item.key);
                        setLocation(link);
                      }}>
                        Go <ArrowRight className="h-3 w-3 ml-1" />
                      </Button>
                    )}
                    {item.completed && <Badge variant="default">Done</Badge>}
                  </div>
                );
              })}

              <div className="flex justify-end pt-4">
                <Button onClick={() => { dismiss.mutate(); }}>
                  Go to Dashboard <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
