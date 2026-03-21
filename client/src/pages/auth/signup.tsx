import { useState, useMemo } from "react";
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Loader2, Anchor, Eye, EyeOff, Check, Building, Calculator, ChartLine, Briefcase,
  Users, Target, BarChart3, Waves, Info, Shield, Crown, TrendingUp, Search, ClipboardCheck,
  LineChart, Home, Warehouse, Hotel, Truck, Building2, Store, ShoppingBag, Factory,
  ChevronRight, Sparkles, Lock, Globe, Zap, ArrowRight, ArrowLeft,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// --- Existing types (unchanged) ---
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
  dataBenchmarkingConsent: z.boolean().default(true),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

type SignupFormValues = z.infer<typeof signupSchema>;

function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(0)}`;
}

// --- New: Role definitions ---
type RoleType = 'owner_operator' | 'investor' | 'broker' | 'appraiser' | 'analyst';

interface RoleOption {
  id: RoleType;
  label: string;
  description: string;
  icon: typeof Briefcase;
}

const ROLES: RoleOption[] = [
  { id: 'owner_operator', label: 'Owner/Operator', description: 'I own or manage properties and need day-to-day operational tools', icon: Crown },
  { id: 'investor', label: 'Investor', description: 'I evaluate and fund deals, and need portfolio analytics and LP management', icon: TrendingUp },
  { id: 'broker', label: 'Broker', description: 'I source, market, and close transactions for clients', icon: Search },
  { id: 'appraiser', label: 'Appraiser', description: 'I produce valuations and need comps, models, and report generation', icon: ClipboardCheck },
  { id: 'analyst', label: 'Analyst', description: 'I build models, run scenarios, and produce investment memos', icon: LineChart },
];

// --- New: Asset class definitions ---
interface AssetClassOption {
  id: string;
  label: string;
  icon: typeof Building;
}

const ASSET_CLASSES: AssetClassOption[] = [
  { id: 'marina', label: 'Marina', icon: Anchor },
  { id: 'multifamily', label: 'Multifamily', icon: Building },
  { id: 'self_storage', label: 'Self Storage', icon: Warehouse },
  { id: 'hotel_hospitality', label: 'Hotel/Hospitality', icon: Hotel },
  { id: 'rv_park', label: 'RV Park', icon: Truck },
  { id: 'mobile_home', label: 'Mobile Home', icon: Home },
  { id: 'mixed_use', label: 'Mixed Use', icon: Building2 },
  { id: 'industrial', label: 'Industrial', icon: Factory },
  { id: 'office', label: 'Office', icon: Briefcase },
  { id: 'retail', label: 'Retail', icon: Store },
  { id: 'sfr', label: 'SFR', icon: ShoppingBag },
];

// --- Step type ---
type StepId = 'account' | 'role' | 'assets' | 'packs';

const STEPS: { id: StepId; label: string; number: number }[] = [
  { id: 'account', label: 'Account', number: 1 },
  { id: 'role', label: 'Your Role', number: 2 },
  { id: 'assets', label: 'Asset Focus', number: 3 },
  { id: 'packs', label: 'Choose Packs', number: 4 },
];

// --- Password strength ---
function getPasswordStrength(password: string): { score: number; label: string; color: string } {
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^a-zA-Z0-9]/.test(password)) score++;

  if (score <= 1) return { score, label: 'Weak', color: 'bg-red-500' };
  if (score <= 2) return { score, label: 'Fair', color: 'bg-orange-500' };
  if (score <= 3) return { score, label: 'Good', color: 'bg-yellow-500' };
  if (score <= 4) return { score, label: 'Strong', color: 'bg-lime-500' };
  return { score, label: 'Excellent', color: 'bg-green-500' };
}

// --- Right-panel contextual content ---
function RightPanelContent({ step }: { step: StepId }) {
  if (step === 'account') {
    const features = [
      { icon: Shield, title: 'Bank-Grade Security', desc: 'SOC 2 Type II compliant with end-to-end encryption' },
      { icon: Zap, title: 'Instant Setup', desc: 'Your workspace is ready in under 60 seconds' },
      { icon: Globe, title: 'Multi-Tenant Platform', desc: 'Collaborate across teams with role-based access' },
      { icon: Lock, title: 'Your Data, Your Control', desc: 'Full data export and deletion at any time' },
    ];
    return (
      <div className="flex flex-col justify-center h-full px-12 py-16">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-white mb-3">Start your journey</h2>
          <p className="text-cyan-100/80 text-lg">Join hundreds of firms already using MarinaMatch to close deals faster.</p>
        </div>
        <div className="space-y-6">
          {features.map((f, i) => (
            <div key={i} className="flex items-start gap-4 group">
              <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center shrink-0 group-hover:bg-white/20 transition-colors">
                <f.icon className="h-5 w-5 text-cyan-300" />
              </div>
              <div>
                <p className="text-white font-medium">{f.title}</p>
                <p className="text-cyan-100/60 text-sm">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (step === 'role') {
    return (
      <div className="flex flex-col justify-center h-full px-10 py-16">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center mb-6 shadow-lg shadow-cyan-500/30">
          <Users className="h-7 w-7 text-white" />
        </div>
        <h2 className="text-2xl font-bold text-slate-800 mb-3">Personalized for you</h2>
        <p className="text-slate-500 mb-8 leading-relaxed">
          Your role helps us tailor dashboards, default views, and recommended packs so you see what matters most from day one.
        </p>
        <div className="space-y-3">
          {['Custom dashboard layout', 'Role-specific quick actions', 'Recommended pack bundles', 'Tailored onboarding flow'].map((item, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="w-6 h-6 rounded-full bg-cyan-50 flex items-center justify-center">
                <Check className="h-3.5 w-3.5 text-cyan-600" />
              </div>
              <span className="text-slate-600 text-sm">{item}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (step === 'assets') {
    return (
      <div className="flex flex-col justify-center h-full px-10 py-16">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center mb-6 shadow-lg shadow-cyan-500/30">
          <Building className="h-7 w-7 text-white" />
        </div>
        <h2 className="text-2xl font-bold text-slate-800 mb-3">Multi-asset intelligence</h2>
        <p className="text-slate-500 mb-8 leading-relaxed">
          Select the asset classes you work with and we will pre-load relevant comps, valuation templates, and industry benchmarks.
        </p>
        <div className="space-y-3">
          {['Pre-loaded valuation templates', 'Industry-specific benchmarks', 'Curated comp databases', 'Sector-tuned AI models'].map((item, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="w-6 h-6 rounded-full bg-cyan-50 flex items-center justify-center">
                <Sparkles className="h-3.5 w-3.5 text-cyan-600" />
              </div>
              <span className="text-slate-600 text-sm">{item}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // packs
  return (
    <div className="flex flex-col justify-center h-full px-10 py-16">
      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center mb-6 shadow-lg shadow-cyan-500/30">
        <Briefcase className="h-7 w-7 text-white" />
      </div>
      <h2 className="text-2xl font-bold text-slate-800 mb-3">Build your toolkit</h2>
      <p className="text-slate-500 mb-8 leading-relaxed">
        Mix and match packs to create the perfect workspace. Start lean and add more as you grow -- you can change packs anytime.
      </p>
      <div className="space-y-3">
        {['No lock-in, cancel anytime', 'Add or remove packs instantly', '14-day free trial on all packs', 'Volume discounts available'].map((item, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="w-6 h-6 rounded-full bg-cyan-50 flex items-center justify-center">
              <Check className="h-3.5 w-3.5 text-cyan-600" />
            </div>
            <span className="text-slate-600 text-sm">{item}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// --- Step indicator ---
function StepIndicator({ currentStep }: { currentStep: StepId }) {
  const currentIndex = STEPS.findIndex(s => s.id === currentStep);

  return (
    <div className="flex items-center justify-center gap-1 sm:gap-2 w-full max-w-2xl mx-auto">
      {STEPS.map((s, i) => {
        const isCompleted = i < currentIndex;
        const isCurrent = s.id === currentStep;
        return (
          <div key={s.id} className="flex items-center gap-1 sm:gap-2">
            {i > 0 && (
              <div className={`hidden sm:block w-8 md:w-12 h-0.5 rounded-full transition-colors ${isCompleted ? 'bg-cyan-500' : 'bg-slate-200'}`} />
            )}
            <div className="flex items-center gap-1.5">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 transition-all ${
                isCompleted
                  ? 'bg-cyan-500 text-white'
                  : isCurrent
                    ? 'bg-cyan-500 text-white ring-4 ring-cyan-500/20'
                    : 'bg-slate-100 text-slate-400 border border-slate-200'
              }`}>
                {isCompleted ? <Check className="h-3.5 w-3.5" /> : s.number}
              </div>
              <span className={`hidden sm:inline text-xs font-medium ${isCurrent ? 'text-slate-800' : isCompleted ? 'text-cyan-600' : 'text-slate-400'}`}>
                {s.label}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function SignupPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [showPassword, setShowPassword] = useState(false);
  const [step, setStep] = useState<StepId>('account');
  const [selectedPacks, setSelectedPacks] = useState<PackType[]>([]);
  const [accountData, setAccountData] = useState<SignupFormValues | null>(null);
  const [selectedRole, setSelectedRole] = useState<RoleType | null>(null);
  const [selectedAssets, setSelectedAssets] = useState<string[]>([]);

  const form = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      confirmPassword: "",
      orgName: "",
      dataBenchmarkingConsent: true,
    },
  });

  const watchedPassword = form.watch('password');
  const passwordStrength = useMemo(() => getPasswordStrength(watchedPassword || ''), [watchedPassword]);

  const { data: availablePacks = [] } = useQuery<PackWithStatus[]>({
    queryKey: ['/api/packs/catalog'],
    enabled: step === 'packs',
  });

  const registerMutation = useMutation({
    mutationFn: async (values: SignupFormValues & { packs?: PackType[]; role?: RoleType | null; assetClassInterests?: string[] }) => {
      const response = await apiRequest("POST", "/api/auth/register", {
        name: values.name,
        email: values.email,
        password: values.password,
        orgName: values.orgName,
        dataBenchmarkingConsent: values.dataBenchmarkingConsent,
        role: values.role,
        assetClassInterests: values.assetClassInterests,
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
    setStep('role');
  };

  const onRoleSubmit = () => {
    setStep('assets');
  };

  const onAssetsSubmit = () => {
    setStep('packs');
  };

  const onPacksSubmit = () => {
    if (!accountData) return;
    registerMutation.mutate({
      ...accountData,
      packs: selectedPacks,
      role: selectedRole,
      assetClassInterests: selectedAssets,
    });
  };

  const togglePack = (packType: PackType) => {
    setSelectedPacks(prev =>
      prev.includes(packType)
        ? prev.filter(p => p !== packType)
        : [...prev, packType]
    );
  };

  const toggleAsset = (assetId: string) => {
    setSelectedAssets(prev =>
      prev.includes(assetId)
        ? prev.filter(a => a !== assetId)
        : [...prev, assetId]
    );
  };

  const corePacks = availablePacks.filter(p => p.info.isCore);
  const addonPacks = availablePacks.filter(p => !p.info.isCore);

  const totalMonthly = selectedPacks.reduce((sum, packType) => {
    const pack = availablePacks.find(p => p.packType === packType);
    return sum + (pack?.info.monthlyPriceCents || 0);
  }, 0);

  // ==================== STEP 1: ACCOUNT (split-panel, dark gradient) ====================
  if (step === 'account') {
    return (
      <div className="min-h-screen flex bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        {/* Background decorations */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 -left-20 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] opacity-5">
            <Waves className="w-full h-full text-cyan-400" strokeWidth={0.5} />
          </div>
        </div>

        {/* Left: Form */}
        <div className="relative w-full lg:w-1/2 flex flex-col items-center justify-center p-6 sm:p-10">
          <div className="w-full max-w-md">
            <Link href="/">
              <div className="flex items-center gap-3 mb-8 cursor-pointer group">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/30 group-hover:shadow-cyan-500/50 transition-shadow">
                  <Anchor className="h-7 w-7 text-white" />
                </div>
                <span className="text-2xl font-bold text-white">MarinaMatch</span>
              </div>
            </Link>

            {/* Step indicator (small, subtle for step 1) */}
            <div className="mb-6">
              <div className="flex items-center gap-2">
                {STEPS.map((s, i) => (
                  <div key={s.id} className="flex items-center gap-2">
                    {i > 0 && <div className={`w-6 h-0.5 rounded-full ${i === 0 ? 'bg-cyan-400' : 'bg-white/20'}`} />}
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-semibold ${
                      s.id === 'account' ? 'bg-cyan-500 text-white' : 'bg-white/10 text-white/40'
                    }`}>
                      {s.number}
                    </div>
                  </div>
                ))}
              </div>
            </div>

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
                          {/* Password strength meter */}
                          {watchedPassword && watchedPassword.length > 0 && (
                            <div className="mt-2 space-y-1">
                              <div className="flex gap-1">
                                {[1, 2, 3, 4, 5].map((level) => (
                                  <div
                                    key={level}
                                    className={`h-1.5 flex-1 rounded-full transition-colors ${
                                      level <= passwordStrength.score ? passwordStrength.color : 'bg-slate-100'
                                    }`}
                                  />
                                ))}
                              </div>
                              <p className={`text-xs ${
                                passwordStrength.score <= 1 ? 'text-red-500' :
                                passwordStrength.score <= 2 ? 'text-orange-500' :
                                passwordStrength.score <= 3 ? 'text-yellow-600' :
                                'text-green-600'
                              }`}>
                                {passwordStrength.label}
                              </p>
                            </div>
                          )}
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
                    <div className="w-full space-y-2 p-4 bg-slate-50/50 rounded-lg border border-slate-200">
                      <div className="flex items-center gap-2">
                        <Shield className="h-4 w-4 text-cyan-600" />
                        <span className="text-sm font-medium text-slate-700">Data privacy & benchmarking</span>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="h-4 w-4 text-slate-400 cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">
                              <p>We only use de-identified, aggregated stats (e.g., averages, ranges) and enforce minimum cohort sizes to prevent identifying any one marina.</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                      <p className="text-xs text-slate-500 leading-relaxed">
                        MarinaMatch uses aggregated, de-identified platform data to improve analytics and produce industry benchmarks. Your marina's identity and raw financial files are never shared or sold.
                      </p>
                      <a href="/benchmarking" target="_blank" rel="noopener noreferrer" className="text-xs text-cyan-600 hover:underline inline-flex items-center gap-1">
                        Learn how benchmarking works
                      </a>
                      <p className="text-xs text-slate-400 mt-1">
                        By continuing, you agree to our <a href="/terms" target="_blank" className="text-cyan-600 hover:underline">Terms of Service</a> and <a href="/privacy" target="_blank" className="text-cyan-600 hover:underline">Privacy Policy</a>.
                      </p>
                    </div>
                    <Button
                      type="submit"
                      className="w-full h-12 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white font-medium shadow-lg shadow-cyan-500/25"
                      data-testid="button-continue"
                    >
                      Continue
                      <ArrowRight className="ml-2 h-4 w-4" />
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

        {/* Right: Feature showcase (hidden on mobile) */}
        <div className="hidden lg:flex w-1/2 relative">
          <div className="absolute inset-0 bg-gradient-to-br from-slate-800/50 to-slate-900/50" />
          <div className="relative w-full">
            <RightPanelContent step="account" />
          </div>
        </div>
      </div>
    );
  }

  // ==================== STEPS 2-4: Light background with split layout ====================
  const renderStepContent = () => {
    // --- STEP 2: Role selection ---
    if (step === 'role') {
      return (
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-slate-800 mb-1" data-testid="text-role-title">What best describes you?</h2>
            <p className="text-slate-500">This helps us personalize your experience</p>
          </div>

          <div className="space-y-3">
            {ROLES.map((role) => {
              const isSelected = selectedRole === role.id;
              const Icon = role.icon;
              return (
                <div
                  key={role.id}
                  onClick={() => setSelectedRole(role.id)}
                  className={`flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                    isSelected
                      ? 'border-cyan-500 bg-cyan-50/50 shadow-sm shadow-cyan-500/10'
                      : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
                  }`}
                  data-testid={`role-${role.id}`}
                >
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                    isSelected ? 'bg-cyan-500 text-white' : 'bg-slate-100 text-slate-500'
                  }`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`font-semibold ${isSelected ? 'text-cyan-700' : 'text-slate-700'}`}>{role.label}</p>
                    <p className="text-sm text-slate-500 leading-snug">{role.description}</p>
                  </div>
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                    isSelected ? 'border-cyan-500 bg-cyan-500' : 'border-slate-300'
                  }`}>
                    {isSelected && <Check className="h-3 w-3 text-white" />}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between pt-4">
            <Button
              variant="outline"
              onClick={() => setStep('account')}
              className="gap-2"
              data-testid="button-back"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            <Button
              onClick={onRoleSubmit}
              disabled={!selectedRole}
              className="gap-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white shadow-lg shadow-cyan-500/25"
              data-testid="button-continue-role"
            >
              Continue
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      );
    }

    // --- STEP 3: Asset class selection ---
    if (step === 'assets') {
      return (
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-slate-800 mb-1" data-testid="text-assets-title">Which asset classes interest you?</h2>
            <p className="text-slate-500">Select all that apply -- you can update these later</p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {ASSET_CLASSES.map((asset) => {
              const isSelected = selectedAssets.includes(asset.id);
              const Icon = asset.icon;
              return (
                <div
                  key={asset.id}
                  onClick={() => toggleAsset(asset.id)}
                  className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 cursor-pointer transition-all text-center ${
                    isSelected
                      ? 'border-cyan-500 bg-cyan-50/50 shadow-sm shadow-cyan-500/10'
                      : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
                  }`}
                  data-testid={`asset-${asset.id}`}
                >
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
                    isSelected ? 'bg-cyan-500 text-white' : 'bg-slate-100 text-slate-500'
                  }`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <span className={`text-sm font-medium ${isSelected ? 'text-cyan-700' : 'text-slate-600'}`}>
                    {asset.label}
                  </span>
                  {isSelected && (
                    <div className="w-5 h-5 rounded-full bg-cyan-500 flex items-center justify-center absolute -top-1 -right-1">
                      <Check className="h-3 w-3 text-white" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {selectedAssets.length > 0 && (
            <p className="text-sm text-slate-500">
              {selectedAssets.length} asset class{selectedAssets.length !== 1 ? 'es' : ''} selected
            </p>
          )}

          <div className="flex items-center justify-between pt-4">
            <Button
              variant="outline"
              onClick={() => setStep('role')}
              className="gap-2"
              data-testid="button-back"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                onClick={onAssetsSubmit}
                className="text-slate-500"
                data-testid="button-skip-assets"
              >
                Skip for now
              </Button>
              <Button
                onClick={onAssetsSubmit}
                disabled={selectedAssets.length === 0}
                className="gap-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white shadow-lg shadow-cyan-500/25"
                data-testid="button-continue-assets"
              >
                Continue
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      );
    }

    // --- STEP 4: Pack selection ---
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 mb-1" data-testid="text-packs-title">Choose Your Tools</h2>
          <p className="text-slate-500" data-testid="text-packs-description">
            Select the packs you need to build your marina management platform
          </p>
        </div>

        <div className="space-y-8">
          <div>
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
              Core Packs
              <Badge variant="secondary">Foundation</Badge>
            </h3>
            <div className="grid gap-3 md:grid-cols-2">
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
              <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                Add-On Packs
                <Badge variant="outline">Optional</Badge>
              </h3>
              <div className="grid gap-3 md:grid-cols-2">
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

        <Separator />

        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            onClick={() => setStep('assets')}
            className="gap-2"
            data-testid="button-back"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
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
              className="gap-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white shadow-lg shadow-cyan-500/25"
              data-testid="button-complete-signup"
            >
              {registerMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {selectedPacks.length > 0 ? 'Create Account & Subscribe' : 'Create Account'}
            </Button>
          </div>
        </div>

        <p className="text-center text-sm text-muted-foreground">
          You can always add or change packs later in your settings.
        </p>
      </div>
    );
  };

  // Steps 2-4 shared layout: white background, step bar at top, split panel
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Top bar with step indicator */}
      <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b border-slate-200/60">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/">
            <div className="flex items-center gap-2.5 cursor-pointer">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center">
                <Anchor className="h-5 w-5 text-white" />
              </div>
              <span className="text-lg font-bold text-slate-800 hidden sm:inline">MarinaMatch</span>
            </div>
          </Link>
          <StepIndicator currentStep={step} />
          <div className="w-20" /> {/* Spacer for centering */}
        </div>
      </div>

      {/* Content area: split panel */}
      <div className="max-w-6xl mx-auto flex min-h-[calc(100vh-73px)]">
        {/* Left: Step form content */}
        <div className="w-full lg:w-3/5 px-6 sm:px-10 lg:px-14 py-10">
          {renderStepContent()}
        </div>

        {/* Right: Contextual sidebar (hidden on mobile) */}
        <div className="hidden lg:block w-2/5 border-l border-slate-100 bg-slate-50/50">
          <RightPanelContent step={step} />
        </div>
      </div>
    </div>
  );
}
