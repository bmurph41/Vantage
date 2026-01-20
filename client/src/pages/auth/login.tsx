import { useState } from "react";
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
import { Loader2, Anchor, Eye, EyeOff, Waves } from "lucide-react";
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

export default function LoginPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [showPassword, setShowPassword] = useState(false);
  const [mfaRequired, setMfaRequired] = useState(false);
  const [mfaData, setMfaData] = useState<{ userId: string; mfaToken: string } | null>(null);

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

  if (mfaRequired) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-1/4 -left-20 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
        </div>
        
        <Card className="relative w-full max-w-md bg-white/95 backdrop-blur-sm border-0 shadow-2xl">
          <CardContent className="p-8">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center">
                <Anchor className="h-5 w-5 text-white" />
              </div>
              <span className="text-xl font-bold text-slate-800">MarinaMatch</span>
            </div>

            <h1 className="text-2xl font-bold text-slate-800 mb-2" data-testid="text-mfa-title">
              Two-Factor Authentication
            </h1>
            <p className="text-slate-500 mb-6" data-testid="text-mfa-description">
              Enter the 6-digit code from your authenticator app
            </p>

            <Form {...mfaForm}>
              <form onSubmit={mfaForm.handleSubmit(onMfaSubmit)} className="space-y-5">
                <FormField
                  control={mfaForm.control}
                  name="token"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-slate-700">Verification Code</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="000000"
                          maxLength={6}
                          className="text-center text-2xl tracking-widest h-14 border-slate-200 focus:border-cyan-500 focus:ring-cyan-500"
                          data-testid="input-mfa-code"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  className="w-full h-12 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white font-medium shadow-lg shadow-cyan-500/25"
                  disabled={mfaMutation.isPending}
                  data-testid="button-verify-mfa"
                >
                  {mfaMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Verify Code
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  className="w-full text-slate-600 hover:text-cyan-600"
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
          </CardContent>
        </Card>
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

        <Card className="bg-white/95 backdrop-blur-sm border-0 shadow-2xl">
          <CardContent className="p-8">
            <div className="text-center mb-6">
              <h1 className="text-2xl font-bold text-slate-800 mb-1" data-testid="text-login-title">
                Welcome back
              </h1>
              <p className="text-slate-500">
                Sign in to your MarinaMatch account
              </p>
            </div>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
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
                          className="h-12 border-slate-200 focus:border-cyan-500 focus:ring-cyan-500 bg-slate-50/50"
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
                      <FormLabel className="text-slate-700">Password</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            {...field}
                            type={showPassword ? "text" : "password"}
                            placeholder="Enter your password"
                            autoComplete="current-password"
                            className="h-12 border-slate-200 focus:border-cyan-500 focus:ring-cyan-500 pr-12 bg-slate-50/50"
                            data-testid="input-password"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="absolute right-1 top-1/2 -translate-y-1/2 h-10 w-10 hover:bg-slate-100"
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
                            className="border-slate-300 data-[state=checked]:bg-cyan-500 data-[state=checked]:border-cyan-500"
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
                    className="text-sm text-cyan-600 hover:text-cyan-700 font-medium"
                    data-testid="link-forgot-password"
                  >
                    Forgot password?
                  </Link>
                </div>

                <Button
                  type="submit"
                  className="w-full h-12 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white font-medium shadow-lg shadow-cyan-500/25"
                  disabled={loginMutation.isPending}
                  data-testid="button-login"
                >
                  {loginMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Sign In
                </Button>

                <div className="relative my-6">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-slate-200" />
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-4 bg-white text-slate-400">or</span>
                  </div>
                </div>

                <Link href="/magic-link">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full h-12 border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-cyan-300"
                  >
                    Sign in with Magic Link
                  </Button>
                </Link>
              </form>
            </Form>

            <p className="text-center text-sm text-slate-500 mt-6">
              Don't have an account?{" "}
              <Link href="/signup" className="text-cyan-600 hover:text-cyan-700 font-medium" data-testid="link-signup">
                Create one
              </Link>
            </p>
          </CardContent>
        </Card>

        <p className="text-center text-sm text-slate-400 mt-6">
          &copy; 2026 MarinaMatch. All rights reserved.
        </p>
      </div>
    </div>
  );
}
