import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation, Link } from "wouter";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Loader2, Anchor, Eye, EyeOff, Check, Building, Calculator, ChartLine, Briefcase, Users, Target, BarChart3, Waves } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type CorePackType = 'crm_pipeline' | 'modeling_tools' | 'analysis' | 'operations';
type AddonPackType = 'fund_management' | 'lp_portal' | 'prospecting' | 'analytics_pro';
type PackType = CorePackType | AddonPackType;

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

const PACK_ICONS: Record<PackType, typeof Briefcase> = {
  crm_pipeline: Building,
  modeling_tools: Calculator,
  analysis: ChartLine,
  operations: Anchor,
  fund_management: Briefcase,
  lp_portal: Users,
  prospecting: Target,
  analytics_pro: BarChart3,
};

const signupSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string(),
  orgName: z.string().min(2, "Company name must be at least 2 characters"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

type SignupFormValues = z.infer<typeof signupSchema>;

function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(0)}`;
}

export default function SignupPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [showPassword, setShowPassword] = useState(false);
  const [step, setStep] = useState<'account' | 'packs'>('account');
  const [selectedPacks, setSelectedPacks] = useState<PackType[]>([]);
  const [accountData, setAccountData] = useState<SignupFormValues | null>(null);

  const form = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      confirmPassword: "",
      orgName: "",
    },
  });

  const { data: availablePacks = [] } = useQuery<PackWithStatus[]>({
    queryKey: ['/api/packs/catalog'],
    enabled: step === 'packs',
  });

  const registerMutation = useMutation({
    mutationFn: async (values: SignupFormValues & { packs?: PackType[] }) => {
      const response = await apiRequest("POST", "/api/auth/register", {
        name: values.name,
        email: values.email,
        password: values.password,
        orgName: values.orgName,
      });
      return response.json();
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      queryClient.invalidateQueries({ queryKey: ["/api/bootstrap"] });
      
      if (selectedPacks.length > 0) {
        toast({
          title: "Account created!",
          description: "Setting up your packs...",
        });
        setLocation("/settings/packs?setup=true");
      } else {
        toast({
          title: "Welcome to MarinaMatch!",
          description: "Your account has been created. Start by selecting your packs.",
        });
        setLocation("/settings/packs");
      }
    },
    onError: (error: any) => {
      toast({
        title: "Registration failed",
        description: error.message || "Unable to create account. Please try again.",
        variant: "destructive",
      });
    },
  });

  const onAccountSubmit = (values: SignupFormValues) => {
    setAccountData(values);
    setStep('packs');
  };

  const onPacksSubmit = () => {
    if (!accountData) return;
    registerMutation.mutate({ ...accountData, packs: selectedPacks });
  };

  const togglePack = (packType: PackType) => {
    setSelectedPacks(prev => 
      prev.includes(packType) 
        ? prev.filter(p => p !== packType)
        : [...prev, packType]
    );
  };

  const corePacks = availablePacks.filter(p => p.info.isCore);
  const addonPacks = availablePacks.filter(p => !p.info.isCore);

  const totalMonthly = selectedPacks.reduce((sum, packType) => {
    const pack = availablePacks.find(p => p.packType === packType);
    return sum + (pack?.info.monthlyPriceCents || 0);
  }, 0);

  if (step === 'packs') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-muted py-8 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <div className="flex justify-center mb-4">
              <div className="p-3 rounded-full bg-primary/10">
                <Anchor className="h-8 w-8 text-primary" />
              </div>
            </div>
            <h1 className="text-3xl font-bold mb-2" data-testid="text-packs-title">
              Choose Your Tools
            </h1>
            <p className="text-muted-foreground" data-testid="text-packs-description">
              Select the packs you need to build your marina management platform
            </p>
          </div>

          <div className="space-y-8">
            <div>
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                Core Packs
                <Badge variant="secondary">Foundation</Badge>
              </h2>
              <div className="grid gap-4 md:grid-cols-2">
                {corePacks.map((pack) => {
                  const Icon = PACK_ICONS[pack.packType];
                  const isSelected = selectedPacks.includes(pack.packType);
                  const price = pack.info.monthlyPriceCents ? formatPrice(pack.info.monthlyPriceCents) : null;

                  return (
                    <Card
                      key={pack.packType}
                      className={`cursor-pointer transition-all ${isSelected ? 'border-primary ring-2 ring-primary/20' : 'hover:border-primary/50'}`}
                      onClick={() => togglePack(pack.packType)}
                      data-testid={`card-pack-${pack.packType}`}
                    >
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg ${isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                              <Icon className="h-5 w-5" />
                            </div>
                            <div>
                              <CardTitle className="text-lg" data-testid={`text-pack-name-${pack.packType}`}>
                                {pack.info.name}
                              </CardTitle>
                              {price && (
                                <span className="text-sm text-muted-foreground">{price}/mo</span>
                              )}
                            </div>
                          </div>
                          <Checkbox
                            checked={isSelected}
                            className="mt-1"
                            data-testid={`checkbox-pack-${pack.packType}`}
                          />
                        </div>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-muted-foreground mb-3" data-testid={`text-pack-description-${pack.packType}`}>
                          {pack.info.description}
                        </p>
                        <ul className="space-y-1">
                          {pack.info.features.slice(0, 3).map((feature, idx) => (
                            <li key={idx} className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Check className="h-3 w-3 text-primary" />
                              {feature}
                            </li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>

            {addonPacks.length > 0 && (
              <div>
                <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                  Add-On Packs
                  <Badge variant="outline">Optional</Badge>
                </h2>
                <div className="grid gap-4 md:grid-cols-2">
                  {addonPacks.map((pack) => {
                    const Icon = PACK_ICONS[pack.packType];
                    const isSelected = selectedPacks.includes(pack.packType);
                    const price = pack.info.monthlyPriceCents ? formatPrice(pack.info.monthlyPriceCents) : null;
                    const hasDependencies = pack.dependencies.every(dep => selectedPacks.includes(dep));

                    return (
                      <Card
                        key={pack.packType}
                        className={`cursor-pointer transition-all ${
                          isSelected 
                            ? 'border-primary ring-2 ring-primary/20' 
                            : hasDependencies 
                              ? 'hover:border-primary/50' 
                              : 'opacity-50'
                        }`}
                        onClick={() => hasDependencies && togglePack(pack.packType)}
                        data-testid={`card-pack-${pack.packType}`}
                      >
                        <CardHeader className="pb-2">
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-3">
                              <div className={`p-2 rounded-lg ${isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                                <Icon className="h-5 w-5" />
                              </div>
                              <div>
                                <CardTitle className="text-lg" data-testid={`text-pack-name-${pack.packType}`}>
                                  {pack.info.name}
                                </CardTitle>
                                {price && (
                                  <span className="text-sm text-muted-foreground">{price}/mo</span>
                                )}
                              </div>
                            </div>
                            <Checkbox
                              checked={isSelected}
                              disabled={!hasDependencies}
                              className="mt-1"
                              data-testid={`checkbox-pack-${pack.packType}`}
                            />
                          </div>
                        </CardHeader>
                        <CardContent>
                          <p className="text-sm text-muted-foreground mb-3" data-testid={`text-pack-description-${pack.packType}`}>
                            {pack.info.description}
                          </p>
                          {!hasDependencies && (
                            <p className="text-xs text-orange-600 dark:text-orange-400">
                              Requires: {pack.dependencies.map(d => d.replace(/_/g, ' ')).join(', ')}
                            </p>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <Separator className="my-8" />

          <div className="flex items-center justify-between">
            <div>
              <Button
                variant="outline"
                onClick={() => setStep('account')}
                data-testid="button-back"
              >
                Back
              </Button>
            </div>
            <div className="text-right">
              {selectedPacks.length > 0 && (
                <p className="text-sm text-muted-foreground mb-2">
                  {selectedPacks.length} pack{selectedPacks.length !== 1 ? 's' : ''} selected • 
                  <span className="font-semibold text-foreground ml-1">{formatPrice(totalMonthly)}/mo</span>
                </p>
              )}
              <Button
                onClick={onPacksSubmit}
                disabled={registerMutation.isPending}
                size="lg"
                data-testid="button-complete-signup"
              >
                {registerMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {selectedPacks.length > 0 ? 'Create Account & Subscribe' : 'Create Account'}
              </Button>
            </div>
          </div>

          <p className="text-center text-sm text-muted-foreground mt-6">
            You can always add or change packs later in your settings.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 -left-20 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] opacity-5">
          <Waves className="w-full h-full text-cyan-400" strokeWidth={0.5} />
        </div>
      </div>

      <div className="relative w-full max-w-md">
        <Link href="/">
          <div className="flex items-center justify-center gap-3 mb-8 cursor-pointer group">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/30 group-hover:shadow-cyan-500/50 transition-shadow">
              <Anchor className="h-7 w-7 text-white" />
            </div>
            <span className="text-2xl font-bold text-white">MarinaMatch</span>
          </div>
        </Link>

        <Card className="bg-white/95 backdrop-blur-sm border-0 shadow-2xl" data-testid="card-signup">
          <CardHeader className="space-y-1 text-center pb-2">
            <CardTitle className="text-2xl font-bold text-slate-800" data-testid="text-signup-title">
              Create Your Account
            </CardTitle>
            <CardDescription data-testid="text-signup-description">
              Get started with MarinaMatch in minutes
            </CardDescription>
          </CardHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onAccountSubmit)}>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-slate-700">Full Name</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="John Smith"
                          autoComplete="name"
                          className="h-11 border-slate-200 focus:border-cyan-500 focus:ring-cyan-500 bg-slate-50/50"
                          data-testid="input-name"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-slate-700">Email</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="email"
                          placeholder="you@company.com"
                          autoComplete="email"
                          className="h-11 border-slate-200 focus:border-cyan-500 focus:ring-cyan-500 bg-slate-50/50"
                          data-testid="input-email"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="orgName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-slate-700">Company</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="Company Name"
                          autoComplete="organization"
                          className="h-11 border-slate-200 focus:border-cyan-500 focus:ring-cyan-500 bg-slate-50/50"
                          data-testid="input-org-name"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-slate-700">Password</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            {...field}
                            type={showPassword ? "text" : "password"}
                            placeholder="At least 8 characters"
                            autoComplete="new-password"
                            className="h-11 border-slate-200 focus:border-cyan-500 focus:ring-cyan-500 pr-12 bg-slate-50/50"
                            data-testid="input-password"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="absolute right-1 top-1/2 -translate-y-1/2 h-9 w-9 hover:bg-slate-100"
                            onClick={() => setShowPassword(!showPassword)}
                            data-testid="button-toggle-password"
                          >
                            {showPassword ? (
                              <EyeOff className="h-4 w-4 text-slate-400" />
                            ) : (
                              <Eye className="h-4 w-4 text-slate-400" />
                            )}
                          </Button>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-slate-700">Confirm Password</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="password"
                          placeholder="Confirm your password"
                          autoComplete="new-password"
                          className="h-11 border-slate-200 focus:border-cyan-500 focus:ring-cyan-500 bg-slate-50/50"
                          data-testid="input-confirm-password"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
              <CardFooter className="flex flex-col space-y-4 pt-2">
                <Button
                  type="submit"
                  className="w-full h-12 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white font-medium shadow-lg shadow-cyan-500/25"
                  data-testid="button-continue"
                >
                  Continue to Pack Selection
                </Button>
                <div className="text-center text-sm text-slate-500">
                  Already have an account?{" "}
                  <Link href="/login" className="text-cyan-600 hover:text-cyan-700 font-medium" data-testid="link-login">
                    Sign in
                  </Link>
                </div>
              </CardFooter>
            </form>
          </Form>
        </Card>

        <p className="text-center text-sm text-slate-400 mt-6">
          &copy; 2026 MarinaMatch. All rights reserved.
        </p>
      </div>
    </div>
  );
}
