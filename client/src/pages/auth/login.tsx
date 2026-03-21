import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { useLocation, Link } from "wouter";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Loader2, Anchor, Eye, EyeOff, Shield, BarChart3, Globe, Users, ChevronRight, Lock, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(1, "Password is required"),
  rememberMe: z.boolean().optional(),
});

type LoginFormValues = z.infer<typeof loginSchema>;

const mfaSchema = z.object({
  token: z.string().length(6, "Please enter a 6-digit code"),
});

type MfaFormValues = z.infer<typeof mfaSchema>;

const featureHighlights = [
  {
    icon: BarChart3,
    title: "Deal Pipeline Analytics",
    description: "Track every acquisition from LOI to close with real-time dashboards and AI-powered forecasting.",
  },
  {
    icon: Globe,
    title: "Nationwide Marina Database",
    description: "Access comprehensive data on 12,000+ marinas with financials, occupancy rates, and market comps.",
  },
  {
    icon: Shield,
    title: "Due Diligence Automation",
    description: "Streamline environmental, legal, and financial due diligence with intelligent document analysis.",
  },
  {
    icon: Sparkles,
    title: "AI-Powered Valuations",
    description: "Generate institutional-quality valuations using comparable sales, DCF models, and market data.",
  },
];

function PasswordStrengthDots({ password }: { password: string }) {
  const getStrength = (pw: string): number => {
    if (!pw) return 0;
    let score = 0;
    if (pw.length >= 1) score++;
    if (pw.length >= 6) score++;
    if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
    if (/\d/.test(pw)) score++;
    if (/[^A-Za-z0-9]/.test(pw)) score++;
    return Math.min(score, 5);
  };

  const strength = getStrength(password);
  const colors = [
    "bg-slate-200",
    "bg-red-400",
    "bg-orange-400",
    "bg-yellow-400",
    "bg-cyan-400",
    "bg-emerald-400",
  ];

  return (
    <div className="flex items-center gap-1.5 mt-2">
      {[1, 2, 3, 4, 5].map((level) => (
        <div
          key={level}
          className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
            strength >= level ? colors[strength] : "bg-slate-100"
          }`}
        />
      ))}
      {password.length > 0 && (
        <span className="text-[11px] text-slate-400 ml-1.5 transition-opacity duration-300">
          {strength <= 1 ? "Weak" : strength <= 2 ? "Fair" : strength <= 3 ? "Good" : strength <= 4 ? "Strong" : "Excellent"}
        </span>
      )}
    </div>
  );
}

function RightPanel() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setIsTransitioning(true);
      setTimeout(() => {
        setActiveIndex((prev) => (prev + 1) % featureHighlights.length);
        setIsTransitioning(false);
      }, 400);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const current = featureHighlights[activeIndex];
  const Icon = current.icon;

  return (
    <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden flex-col justify-between">
      {/* Animated gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-cyan-950 to-blue-950" />
      <div
        className="absolute inset-0 opacity-30"
        style={{
          background: "radial-gradient(ellipse at 30% 20%, rgba(6,182,212,0.4) 0%, transparent 50%), radial-gradient(ellipse at 70% 80%, rgba(59,130,246,0.3) 0%, transparent 50%)",
          animation: "pulse 8s ease-in-out infinite",
        }}
      />
      {/* Decorative grid pattern */}
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: "linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />
      {/* Floating orbs */}
      <div className="absolute top-20 right-16 w-72 h-72 bg-cyan-500/10 rounded-full blur-3xl" style={{ animation: "float 12s ease-in-out infinite" }} />
      <div className="absolute bottom-32 left-12 w-56 h-56 bg-blue-500/10 rounded-full blur-3xl" style={{ animation: "float 10s ease-in-out infinite reverse" }} />

      <div className="relative z-10 flex flex-col justify-between h-full p-12">
        {/* Top section */}
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-sm border border-white/10 text-cyan-300 text-xs font-medium mb-8">
            <Users className="h-3.5 w-3.5" />
            Trusted by 200+ marina operators
          </div>
        </div>

        {/* Center feature showcase */}
        <div className="flex-1 flex flex-col justify-center">
          <div
            className={`transition-all duration-400 ${
              isTransitioning ? "opacity-0 translate-y-4" : "opacity-100 translate-y-0"
            }`}
          >
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-400/20 to-blue-500/20 border border-cyan-400/20 flex items-center justify-center mb-6 backdrop-blur-sm">
              <Icon className="h-7 w-7 text-cyan-300" />
            </div>
            <h2 className="text-3xl font-bold text-white mb-3 leading-tight">
              {current.title}
            </h2>
            <p className="text-lg text-slate-300 leading-relaxed max-w-md">
              {current.description}
            </p>
          </div>

          {/* Progress dots */}
          <div className="flex items-center gap-2.5 mt-10">
            {featureHighlights.map((_, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setIsTransitioning(true);
                  setTimeout(() => {
                    setActiveIndex(idx);
                    setIsTransitioning(false);
                  }, 300);
                }}
                className={`h-1.5 rounded-full transition-all duration-500 ${
                  idx === activeIndex
                    ? "w-8 bg-cyan-400"
                    : "w-1.5 bg-white/20 hover:bg-white/40"
                }`}
              />
            ))}
          </div>
        </div>

        {/* Bottom testimonial */}
        <div className="mt-auto pt-8 border-t border-white/10">
          <blockquote className="text-slate-300 text-sm leading-relaxed italic">
            "MarinaMatch transformed how we evaluate acquisitions. We closed 3 deals in our first quarter, each one fully underwritten through the platform."
          </blockquote>
          <div className="flex items-center gap-3 mt-4">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center text-white text-xs font-bold">
              JK
            </div>
            <div>
              <p className="text-white text-sm font-medium">James Kirkland</p>
              <p className="text-slate-400 text-xs">Managing Partner, Coastal Acquisitions</p>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-20px); }
        }
      `}</style>
    </div>
  );
}

export default function LoginPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [showPassword, setShowPassword] = useState(false);
  const [mfaRequired, setMfaRequired] = useState(false);
  const [mfaData, setMfaData] = useState<{ userId: string; mfaToken: string } | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(timer);
  }, []);

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
      rememberMe: false,
    },
  });

  const mfaForm = useForm<MfaFormValues>({
    resolver: zodResolver(mfaSchema),
    defaultValues: {
      token: "",
    },
  });

  const loginMutation = useMutation({
    mutationFn: async (values: LoginFormValues) => {
      const response = await apiRequest("POST", "/api/auth/login", values);
      return response.json();
    },
    onSuccess: (data) => {
      if (data.requiresMfa) {
        setMfaRequired(true);
        setMfaData({ userId: data.userId, mfaToken: data.mfaToken });
      } else {
        queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
        queryClient.invalidateQueries({ queryKey: ["/api/bootstrap"] });
        queryClient.invalidateQueries({ queryKey: ["/api/organization/packs"] });
        toast({
          title: "Welcome back!",
          description: "You have successfully logged in.",
        });
        setLocation("/");
      }
    },
    onError: (error: any) => {
      toast({
        title: "Login failed",
        description: error.message || "Invalid email or password. Please try again.",
        variant: "destructive",
      });
    },
  });

  const mfaMutation = useMutation({
    mutationFn: async (values: MfaFormValues) => {
      const response = await apiRequest("POST", "/api/auth/mfa/verify", {
        userId: mfaData?.userId,
        token: values.token,
        mfaToken: mfaData?.mfaToken,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      queryClient.invalidateQueries({ queryKey: ["/api/bootstrap"] });
      queryClient.invalidateQueries({ queryKey: ["/api/organization/packs"] });
      toast({
        title: "Welcome back!",
        description: "You have successfully logged in.",
      });
      setLocation("/");
    },
    onError: (error: any) => {
      toast({
        title: "Verification failed",
        description: error.message || "Invalid verification code. Please try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (values: LoginFormValues) => {
    loginMutation.mutate(values);
  };

  const onMfaSubmit = (values: MfaFormValues) => {
    mfaMutation.mutate(values);
  };

  const watchedPassword = form.watch("password");

  if (mfaRequired) {
    return (
      <div className="min-h-screen flex">
        {/* Left panel - MFA form */}
        <div className="w-full lg:w-1/2 flex flex-col bg-white">
          <div className="flex-1 flex flex-col justify-center px-6 sm:px-12 lg:px-16 xl:px-20">
            <div className="w-full max-w-[420px] mx-auto">
              {/* Logo */}
              <Link href="/">
                <div className="flex items-center gap-3 mb-12 cursor-pointer group">
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20 group-hover:shadow-cyan-500/40 transition-shadow duration-300">
                    <Anchor className="h-6 w-6 text-white" />
                  </div>
                  <span className="text-xl font-bold text-slate-800">MarinaMatch</span>
                </div>
              </Link>

              <div
                className={`transition-all duration-500 ${
                  mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
                }`}
              >
                <div className="w-12 h-12 rounded-xl bg-cyan-50 flex items-center justify-center mb-6">
                  <Lock className="h-6 w-6 text-cyan-600" />
                </div>

                <h1 className="text-2xl font-bold text-slate-800 mb-2" data-testid="text-mfa-title">
                  Two-Factor Authentication
                </h1>
                <p className="text-slate-500 mb-8" data-testid="text-mfa-description">
                  Enter the 6-digit code from your authenticator app
                </p>

                <Form {...mfaForm}>
                  <form onSubmit={mfaForm.handleSubmit(onMfaSubmit)} className="space-y-6">
                    <FormField
                      control={mfaForm.control}
                      name="token"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-slate-700 text-sm font-medium">Verification Code</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              placeholder="000000"
                              maxLength={6}
                              className="text-center text-2xl tracking-[0.3em] h-14 border-slate-200 focus:border-cyan-500 focus:ring-cyan-500/20 rounded-xl bg-slate-50/50"
                              data-testid="input-mfa-code"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <Button
                      type="submit"
                      className="w-full h-12 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white font-medium shadow-lg shadow-cyan-500/25 rounded-xl transition-all duration-200 hover:shadow-cyan-500/40"
                      disabled={mfaMutation.isPending}
                      data-testid="button-verify-mfa"
                    >
                      {mfaMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Verify Code
                    </Button>

                    <Button
                      type="button"
                      variant="ghost"
                      className="w-full text-slate-500 hover:text-cyan-600 hover:bg-cyan-50/50 rounded-xl"
                      onClick={() => {
                        setMfaRequired(false);
                        setMfaData(null);
                      }}
                      data-testid="button-back-login"
                    >
                      Back to Login
                    </Button>
                  </form>
                </Form>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 sm:px-12 lg:px-16 xl:px-20 py-6 border-t border-slate-100">
            <div className="w-full max-w-[420px] mx-auto flex items-center justify-between text-xs text-slate-400">
              <span>&copy; 2026 MarinaMatch</span>
              <div className="flex items-center gap-4">
                <a href="/terms" className="hover:text-slate-600 transition-colors">Terms</a>
                <a href="/privacy" className="hover:text-slate-600 transition-colors">Privacy</a>
              </div>
            </div>
          </div>
        </div>

        {/* Right panel */}
        <RightPanel />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex">
      {/* Left panel - Login form */}
      <div className="w-full lg:w-1/2 flex flex-col bg-white">
        <div className="flex-1 flex flex-col justify-center px-6 sm:px-12 lg:px-16 xl:px-20">
          <div className="w-full max-w-[420px] mx-auto">
            {/* Logo */}
            <Link href="/">
              <div className="flex items-center gap-3 mb-12 cursor-pointer group">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20 group-hover:shadow-cyan-500/40 transition-shadow duration-300">
                  <Anchor className="h-6 w-6 text-white" />
                </div>
                <span className="text-xl font-bold text-slate-800">MarinaMatch</span>
              </div>
            </Link>

            <div
              className={`transition-all duration-500 ${
                mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
              }`}
            >
              <h1 className="text-2xl font-bold text-slate-800 mb-1" data-testid="text-login-title">
                Welcome back
              </h1>
              <p className="text-slate-500 mb-8">
                Sign in to your MarinaMatch account
              </p>

              {/* SSO Button */}
              <Link href="/sso">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full h-12 border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300 rounded-xl mb-6 font-medium transition-all duration-200"
                >
                  <Shield className="mr-2 h-4 w-4 text-slate-500" />
                  Sign in with SSO
                </Button>
              </Link>

              <div className="relative mb-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="px-4 bg-white text-slate-400 uppercase tracking-wider">or continue with email</span>
                </div>
              </div>

              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-slate-700 text-sm font-medium">Email</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            type="email"
                            placeholder="you@company.com"
                            autoComplete="email"
                            className="h-12 border-slate-200 focus:border-cyan-500 focus:ring-cyan-500/20 rounded-xl bg-slate-50/50"
                            data-testid="input-email"
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
                        <FormLabel className="text-slate-700 text-sm font-medium">Password</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input
                              {...field}
                              type={showPassword ? "text" : "password"}
                              placeholder="Enter your password"
                              autoComplete="current-password"
                              className="h-12 border-slate-200 focus:border-cyan-500 focus:ring-cyan-500/20 pr-12 rounded-xl bg-slate-50/50"
                              data-testid="input-password"
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="absolute right-1 top-1/2 -translate-y-1/2 h-10 w-10 hover:bg-slate-100 rounded-lg"
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
                        <PasswordStrengthDots password={watchedPassword || ""} />
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex items-center justify-between">
                    <FormField
                      control={form.control}
                      name="rememberMe"
                      render={({ field }) => (
                        <FormItem className="flex items-center space-x-2 space-y-0">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              className="border-slate-300 data-[state=checked]:bg-cyan-500 data-[state=checked]:border-cyan-500 rounded"
                            />
                          </FormControl>
                          <FormLabel className="text-sm text-slate-600 font-normal cursor-pointer">
                            Remember me
                          </FormLabel>
                        </FormItem>
                      )}
                    />
                    <Link
                      href="/forgot-password"
                      className="text-sm text-cyan-600 hover:text-cyan-700 font-medium transition-colors"
                      data-testid="link-forgot-password"
                    >
                      Forgot password?
                    </Link>
                  </div>

                  <Button
                    type="submit"
                    className="w-full h-12 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white font-medium shadow-lg shadow-cyan-500/25 rounded-xl transition-all duration-200 hover:shadow-cyan-500/40"
                    disabled={loginMutation.isPending}
                    data-testid="button-login"
                  >
                    {loginMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Sign In
                    <ChevronRight className="ml-1 h-4 w-4" />
                  </Button>

                  <div className="relative my-6">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-slate-200" />
                    </div>
                    <div className="relative flex justify-center text-xs">
                      <span className="px-4 bg-white text-slate-400">or</span>
                    </div>
                  </div>

                  <Link href="/magic-link">
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full h-12 border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-cyan-300 rounded-xl transition-all duration-200"
                    >
                      Sign in with Magic Link
                    </Button>
                  </Link>
                </form>
              </Form>

              <p className="text-center text-sm text-slate-500 mt-8">
                Don't have an account?{" "}
                <Link href="/signup" className="text-cyan-600 hover:text-cyan-700 font-medium transition-colors" data-testid="link-signup">
                  Create one
                </Link>
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 sm:px-12 lg:px-16 xl:px-20 py-6 border-t border-slate-100">
          <div className="w-full max-w-[420px] mx-auto flex items-center justify-between text-xs text-slate-400">
            <span>&copy; 2026 MarinaMatch. All rights reserved.</span>
            <div className="flex items-center gap-4">
              <a href="/terms" className="hover:text-slate-600 transition-colors">Terms</a>
              <a href="/privacy" className="hover:text-slate-600 transition-colors">Privacy</a>
            </div>
          </div>
        </div>
      </div>

      {/* Right panel - Feature showcase */}
      <RightPanel />
    </div>
  );
}
