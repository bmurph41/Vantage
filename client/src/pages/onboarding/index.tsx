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
import { CheckCircle, Circle, ArrowRight, Building2, Users, Briefcase, Settings, BarChart3, Upload, Sparkles, X, Layers, TrendingUp, Home, Tag } from "lucide-react";
import { AssetClassPicker } from "@/components/AssetClassPicker";
import { ASSET_CLASS_TIERS, USER_ROLES, getAssetClassTier } from "@shared/billing-constants";
import { cn } from "@/lib/utils";

// Steps: 0 = Org Name, 1 = Asset Classes + Role, 2 = Invite Team, 3 = Checklist
const WIZARD_STEPS = [
  { label: "Organization", icon: Building2 },
  { label: "Asset Focus",  icon: Layers },
  { label: "Team",         icon: Users },
  { label: "Get Started",  icon: Sparkles },
];

const ROLE_ICONS: Record<string, React.ElementType> = {
  owner: Home,
  broker: Tag,
  investor: TrendingUp,
};

export default function OnboardingWizardPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [, setLocation] = useLocation();
  const [step, setStep] = useState(0);
  const [orgName, setOrgName] = useState("");
  const [selectedAssetClasses, setSelectedAssetClasses] = useState<string[]>([]);
  const [selectedRole, setSelectedRole] = useState<string>("");
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

  const saveAssetClasses = useMutation({
    mutationFn: async (data: { assetClasses: string[]; userRole: string }) => {
      const res = await apiRequest("POST", "/api/onboarding/set-asset-classes", data);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/onboarding"] });
      qc.invalidateQueries({ queryKey: ["/api/orgs/me/entitlements"] });
      setStep(2);
      toast({ title: "Asset focus saved" });
    },
    onError: (e: any) => toast({ title: "Failed to save", description: e.message, variant: "destructive" }),
  });

  const inviteTeam = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/onboarding/invite-team", data);
      return res.json();
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["/api/onboarding"] });
      setStep(3);
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

  if (isLoading) return <div className="flex items-center justify-center h-screen">Loading…</div>;
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

  // Compute current pricing tier from selection
  const assetCount = selectedAssetClasses.length;
  const currentTierDef = assetCount > 0 ? getAssetClassTier(assetCount) : null;

  const canContinueStep1 = selectedRole !== "" && selectedAssetClasses.length > 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-2xl font-bold">Welcome to Vantage</h1>
            <Button variant="ghost" size="sm" onClick={() => dismiss.mutate()} disabled={dismiss.isPending}>
              <X className="h-4 w-4 mr-1" /> Skip setup
            </Button>
          </div>

          {/* Step indicators */}
          <div className="flex items-center gap-1 mb-3">
            {WIZARD_STEPS.map((s, i) => (
              <div key={i} className="flex items-center gap-1 flex-1">
                <div className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-semibold border-2 transition-colors ${
                  i < step ? "bg-blue-600 border-blue-600 text-white"
                  : i === step ? "border-blue-600 text-blue-600 bg-white"
                  : "border-gray-200 text-gray-400 bg-white"
                }`}>
                  {i < step ? <CheckCircle className="h-4 w-4" /> : i + 1}
                </div>
                <span className={`hidden sm:block text-xs font-medium truncate ${i === step ? "text-blue-600" : i < step ? "text-green-600" : "text-muted-foreground"}`}>
                  {s.label}
                </span>
                {i < WIZARD_STEPS.length - 1 && (
                  <div className={`flex-1 h-0.5 rounded ${i < step ? "bg-blue-600" : "bg-gray-200"}`} />
                )}
              </div>
            ))}
          </div>

          {/* Progress bar */}
          <div className="w-full bg-gray-200 rounded-full h-1.5">
            <div className="h-1.5 rounded-full bg-blue-600 transition-all" style={{ width: `${status?.progressPct || 0}%` }} />
          </div>
          <p className="text-xs text-muted-foreground mt-1">{status?.completedCount || 0} of {status?.totalSteps || 0} checklist steps complete</p>
        </div>

        {/* Step 0: Org Name */}
        {step === 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Building2 className="h-5 w-5" />Set Up Your Organization</CardTitle>
              <CardDescription>Tell us your firm name so we can personalize your workspace</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Organization Name</Label>
                <Input
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  placeholder="Acme Capital Partners"
                  className="mt-1"
                  onKeyDown={(e) => e.key === "Enter" && orgName && setupOrg.mutate({ name: orgName })}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setStep(1)}>Skip</Button>
                <Button
                  onClick={() => setupOrg.mutate({ name: orgName })}
                  disabled={!orgName || setupOrg.isPending}
                >
                  Continue <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 1: Role + Asset Class Selection */}
        {step === 1 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Layers className="h-5 w-5" />Your focus areas</CardTitle>
              <CardDescription>
                Tell us your role and the asset classes you work with. This tailors your platform,
                tools, and financial templates — and determines your subscription tier. You can add more at any time.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Role selector */}
              <div>
                <p className="text-sm font-medium mb-3">What best describes your primary role?</p>
                <div className="grid grid-cols-3 gap-3">
                  {USER_ROLES.map((role) => {
                    const Icon = ROLE_ICONS[role.key] ?? Briefcase;
                    const isSelected = selectedRole === role.key;
                    return (
                      <button
                        key={role.key}
                        type="button"
                        onClick={() => setSelectedRole(role.key)}
                        className={cn(
                          "flex flex-col items-center gap-2 p-4 rounded-xl border-2 text-center transition-all",
                          isSelected
                            ? "border-blue-600 bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 shadow-sm"
                            : "border-border bg-background hover:bg-muted hover:border-muted-foreground/30"
                        )}
                      >
                        <Icon className={cn("h-6 w-6", isSelected ? "text-blue-600" : "text-muted-foreground")} />
                        <div>
                          <p className="text-sm font-semibold leading-tight">{role.label}</p>
                          <p className="text-xs text-muted-foreground mt-0.5 leading-tight">{role.description}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
                {!selectedRole && (
                  <p className="text-xs text-muted-foreground mt-2">Select your role to continue</p>
                )}
              </div>

              {/* Asset class grid */}
              <div>
                <p className="text-sm font-medium mb-3">Which asset classes do you work with?</p>
                <AssetClassPicker
                  selected={selectedAssetClasses}
                  onChange={setSelectedAssetClasses}
                />
              </div>

              {/* Live pricing summary */}
              {assetCount > 0 && currentTierDef && (
                <div className={cn(
                  "rounded-lg border-2 p-4 transition-all",
                  currentTierDef.key === "essentials" && "border-blue-200 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-800",
                  currentTierDef.key === "professional" && "border-purple-200 bg-purple-50 dark:bg-purple-950/20 dark:border-purple-800",
                  currentTierDef.key === "enterprise" && "border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800",
                )}>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-bold">{assetCount} {assetCount === 1 ? "class" : "classes"} selected</span>
                        <Badge
                          variant="secondary"
                          className={cn(
                            "text-xs",
                            currentTierDef.key === "essentials" && "bg-blue-100 text-blue-700",
                            currentTierDef.key === "professional" && "bg-purple-100 text-purple-700",
                            currentTierDef.key === "enterprise" && "bg-amber-100 text-amber-700",
                          )}
                        >
                          {currentTierDef.name} tier
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{currentTierDef.description}</p>
                    </div>
                    <div className="text-right">
                      {currentTierDef.priceMonthly === 0 ? (
                        <p className="text-lg font-bold text-green-600">Included</p>
                      ) : (
                        <>
                          <p className="text-lg font-bold">+${currentTierDef.priceMonthly}<span className="text-sm font-normal text-muted-foreground">/mo</span></p>
                          <p className="text-xs text-muted-foreground">${currentTierDef.priceAnnual}/mo billed annually</p>
                        </>
                      )}
                    </div>
                  </div>
                  {/* Tier progression hint */}
                  <div className="mt-3 pt-3 border-t border-current/10 flex gap-2">
                    {ASSET_CLASS_TIERS.map((t) => (
                      <div key={t.key} className={cn(
                        "flex-1 h-1.5 rounded-full transition-all",
                        t.key === currentTierDef.key ? "bg-current opacity-70" : "bg-current opacity-20",
                      )} />
                    ))}
                  </div>
                  <div className="flex justify-between mt-1">
                    {ASSET_CLASS_TIERS.map((t) => (
                      <p key={t.key} className={cn(
                        "text-xs",
                        t.key === currentTierDef.key ? "font-semibold" : "text-muted-foreground opacity-60"
                      )}>
                        {t.name}
                      </p>
                    ))}
                  </div>
                </div>
              )}

              {assetCount === 0 && (
                <p className="text-sm text-muted-foreground">Select at least one asset class to continue, or skip to use the full platform.</p>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setStep(2)} disabled={!selectedRole}>Skip</Button>
                <Button
                  onClick={() => saveAssetClasses.mutate({ assetClasses: selectedAssetClasses, userRole: selectedRole })}
                  disabled={saveAssetClasses.isPending || !canContinueStep1}
                >
                  {saveAssetClasses.isPending ? "Saving…" : "Continue"}
                  <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Invite Team */}
        {step === 2 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" />Invite Your Team</CardTitle>
              <CardDescription>Add colleagues to collaborate on deals, models, and due diligence</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {invites.map((inv, i) => (
                <div key={i} className="flex gap-2">
                  <Input
                    placeholder="colleague@example.com"
                    value={inv.email}
                    onChange={(e) => {
                      const updated = [...invites];
                      updated[i] = { ...inv, email: e.target.value };
                      setInvites(updated);
                    }}
                    className="flex-1"
                  />
                  {i > 0 && (
                    <Button variant="ghost" size="sm" onClick={() => setInvites(invites.filter((_, j) => j !== i))}>
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={() => setInvites([...invites, { email: "", role: "editor" }])}>
                + Add another
              </Button>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setStep(3)}>Skip</Button>
                <Button
                  onClick={() => inviteTeam.mutate({ invites: invites.filter((i) => i.email) })}
                  disabled={inviteTeam.isPending || invites.every((i) => !i.email)}
                >
                  Send Invites <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 3: Checklist */}
        {step >= 3 && (
          <Card>
            <CardHeader>
              <CardTitle>You're ready to go!</CardTitle>
              <CardDescription>Complete these steps to get the most out of the platform</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {checklist.map((item: any) => {
                const Icon = stepIcons[item.key] || Circle;
                const link = stepLinks[item.key];
                return (
                  <div
                    key={item.key}
                    className={`flex items-center justify-between p-3 rounded-lg border ${
                      item.completed ? "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800" : "hover:bg-muted"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {item.completed
                        ? <CheckCircle className="h-5 w-5 text-green-600" />
                        : <Icon className="h-5 w-5 text-muted-foreground" />}
                      <span className={item.completed ? "text-green-800 dark:text-green-400 line-through" : ""}>
                        {item.label}
                      </span>
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
                <Button onClick={() => dismiss.mutate()} disabled={dismiss.isPending}>
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
