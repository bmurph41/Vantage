import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { useLocation, Link } from "wouter";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Loader2, Anchor, Eye, EyeOff, CheckCircle, XCircle, ArrowLeft, ShieldCheck, KeyRound, Lock, Fingerprint } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const resetPasswordSchema = z.object({
  password: z.string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number"),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>;

export default function ResetPasswordPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [resetComplete, setResetComplete] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [tokenError, setTokenError] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const resetToken = params.get("token");
    if (resetToken) {
      setToken(resetToken);
    } else {
      setTokenError(true);
    }
  }, []);

  const form = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
  });

  const password = form.watch("password");
  const passwordRequirements = [
    { met: password.length >= 8, text: "At least 8 characters" },
    { met: /[A-Z]/.test(password), text: "One uppercase letter" },
    { met: /[a-z]/.test(password), text: "One lowercase letter" },
    { met: /[0-9]/.test(password), text: "One number" },
  ];

  const metCount = passwordRequirements.filter((r) => r.met).length;
  const strengthPercent = (metCount / passwordRequirements.length) * 100;
  const strengthColor =
    metCount <= 1
      ? "bg-red-500"
      : metCount <= 2
        ? "bg-orange-500"
        : metCount <= 3
          ? "bg-yellow-500"
          : "bg-green-500";

  const resetPasswordMutation = useMutation({
    mutationFn: async (values: ResetPasswordFormValues) => {
      const response = await apiRequest("POST", "/api/auth/reset-password", {
        token,
        password: values.password,
      });
      return response.json();
    },
    onSuccess: () => {
      setResetComplete(true);
    },
    onError: (error: any) => {
      toast({
        title: "Reset failed",
        description: error.message || "Unable to reset your password. The link may have expired.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (values: ResetPasswordFormValues) => {
    resetPasswordMutation.mutate(values);
  };

  // Right panel (shared across all states)
  const rightPanel = (
    <div className="hidden lg:flex flex-1 bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 items-center justify-center p-12 relative overflow-hidden">
      <div className="absolute top-1/4 -right-20 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 -left-20 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />

      <div className="relative text-center text-white max-w-lg">
        <div className="w-20 h-20 rounded-2xl bg-white/10 backdrop-blur-sm flex items-center justify-center mx-auto mb-8">
          <ShieldCheck className="w-10 h-10 text-cyan-400" />
        </div>
        <h2 className="text-3xl font-bold mb-4">Strong Password Tips</h2>
        <p className="text-lg text-slate-300 leading-relaxed mb-10">
          A strong password is your first line of defense. Follow these tips to keep your account secure.
        </p>

        <div className="space-y-5 text-left">
          {[
            { icon: KeyRound, title: "Use a passphrase", desc: "Combine multiple random words for a memorable, strong password" },
            { icon: Fingerprint, title: "Make it unique", desc: "Never reuse passwords across different accounts or services" },
            { icon: Lock, title: "Mix character types", desc: "Include uppercase, lowercase, numbers, and special characters" },
            { icon: ShieldCheck, title: "Enable 2FA", desc: "Add two-factor authentication for an extra layer of security" },
          ].map((tip, i) => (
            <div key={i} className="flex items-start gap-4 bg-white/5 rounded-xl p-4">
              <div className="w-10 h-10 rounded-lg bg-cyan-500/20 flex items-center justify-center shrink-0">
                <tip.icon className="w-5 h-5 text-cyan-400" />
              </div>
              <div>
                <h4 className="font-semibold text-white text-sm">{tip.title}</h4>
                <p className="text-slate-400 text-sm">{tip.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  if (tokenError) {
    return (
      <div className="min-h-screen flex">
        {/* Left Panel - Token Error */}
        <div className="flex-1 flex flex-col bg-white">
          <div className="p-6 flex items-center">
            <Link href="/">
              <div className="flex items-center gap-2 cursor-pointer">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
                  <Anchor className="h-5 w-5 text-white" />
                </div>
                <span className="text-xl font-bold text-slate-800">MarinaMatch</span>
              </div>
            </Link>
          </div>

          <div className="flex-1 flex items-center justify-center px-8 pb-8">
            <div className="w-full max-w-sm text-center">
              <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-6 animate-in zoom-in-50 duration-300">
                <XCircle className="h-8 w-8 text-red-600" />
              </div>

              <h1 className="text-2xl font-bold text-slate-800 mb-2">
                Invalid Reset Link
              </h1>
              <p className="text-slate-500 mb-8">
                This password reset link is invalid or has expired. Please request a new one.
              </p>

              <div className="space-y-3">
                <Link href="/forgot-password" className="block">
                  <Button className="w-full h-12 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white font-medium shadow-lg shadow-cyan-500/25">
                    Request New Reset Link
                  </Button>
                </Link>
                <Link href="/login">
                  <Button
                    variant="ghost"
                    className="w-full h-12 text-slate-600 hover:text-cyan-600"
                  >
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to Sign In
                  </Button>
                </Link>
              </div>
            </div>
          </div>

          <div className="p-6 border-t border-slate-100 text-center text-sm text-slate-400">
            <span>&copy; 2026 MarinaMatch. All rights reserved.</span>
          </div>
        </div>

        {rightPanel}
      </div>
    );
  }

  if (resetComplete) {
    return (
      <div className="min-h-screen flex">
        {/* Left Panel - Success */}
        <div className="flex-1 flex flex-col bg-white">
          <div className="p-6 flex items-center">
            <Link href="/">
              <div className="flex items-center gap-2 cursor-pointer">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
                  <Anchor className="h-5 w-5 text-white" />
                </div>
                <span className="text-xl font-bold text-slate-800">MarinaMatch</span>
              </div>
            </Link>
          </div>

          <div className="flex-1 flex items-center justify-center px-8 pb-8">
            <div className="w-full max-w-sm text-center">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-6 animate-in zoom-in-50 duration-300">
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>

              <h1 className="text-2xl font-bold text-slate-800 mb-2">
                Password Reset Complete
              </h1>
              <p className="text-slate-500 mb-8">
                Your password has been successfully reset. You can now sign in with your new password.
              </p>

              <Link href="/login" className="block">
                <Button className="w-full h-12 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white font-medium shadow-lg shadow-cyan-500/25">
                  Sign In
                </Button>
              </Link>
            </div>
          </div>

          <div className="p-6 border-t border-slate-100 text-center text-sm text-slate-400">
            <span>&copy; 2026 MarinaMatch. All rights reserved.</span>
          </div>
        </div>

        {rightPanel}
      </div>
    );
  }

  return (
    <div className="min-h-screen flex">
      {/* Left Panel - Form */}
      <div className="flex-1 flex flex-col bg-white">
        <div className="p-6 flex items-center">
          <Link href="/">
            <div className="flex items-center gap-2 cursor-pointer">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
                <Anchor className="h-5 w-5 text-white" />
              </div>
              <span className="text-xl font-bold text-slate-800">MarinaMatch</span>
            </div>
          </Link>
        </div>

        <div className="flex-1 flex items-center justify-center px-8 pb-8">
          <div className="w-full max-w-sm">
            <h1 className="text-2xl font-bold text-slate-800 mb-2">
              Create new password
            </h1>
            <p className="text-slate-500 mb-8">
              Enter your new password below.
            </p>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-slate-700">New Password</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            {...field}
                            type={showPassword ? "text" : "password"}
                            placeholder="Enter new password"
                            autoComplete="new-password"
                            className="h-12 border-slate-200 focus:border-cyan-500 focus:ring-cyan-500 pr-12 bg-slate-50/50"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="absolute right-1 top-1/2 -translate-y-1/2 h-10 w-10 hover:bg-slate-100"
                            onClick={() => setShowPassword(!showPassword)}
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

                {/* Password strength bar */}
                {password.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500">Password strength</span>
                      <span className={
                        metCount <= 1
                          ? "text-red-600 font-medium"
                          : metCount <= 2
                            ? "text-orange-600 font-medium"
                            : metCount <= 3
                              ? "text-yellow-600 font-medium"
                              : "text-green-600 font-medium"
                      }>
                        {metCount <= 1 ? "Weak" : metCount <= 2 ? "Fair" : metCount <= 3 ? "Good" : "Strong"}
                      </span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${strengthColor}`}
                        style={{ width: `${strengthPercent}%` }}
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <p className="text-sm text-slate-500">Password requirements:</p>
                  <ul className="space-y-1.5">
                    {passwordRequirements.map((req, index) => (
                      <li key={index} className="flex items-center gap-2 text-sm">
                        {req.met ? (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        ) : (
                          <div className="h-4 w-4 rounded-full border-2 border-slate-300" />
                        )}
                        <span className={req.met ? "text-green-600" : "text-slate-500"}>
                          {req.text}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                <FormField
                  control={form.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-slate-700">Confirm New Password</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            {...field}
                            type={showConfirmPassword ? "text" : "password"}
                            placeholder="Confirm new password"
                            autoComplete="new-password"
                            className="h-12 border-slate-200 focus:border-cyan-500 focus:ring-cyan-500 pr-12 bg-slate-50/50"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="absolute right-1 top-1/2 -translate-y-1/2 h-10 w-10 hover:bg-slate-100"
                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          >
                            {showConfirmPassword ? (
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

                <Button
                  type="submit"
                  className="w-full h-12 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white font-medium shadow-lg shadow-cyan-500/25"
                  disabled={resetPasswordMutation.isPending}
                >
                  {resetPasswordMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Reset Password
                </Button>

                <Link href="/login">
                  <Button
                    type="button"
                    variant="ghost"
                    className="w-full h-12 text-slate-600 hover:text-cyan-600"
                  >
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to Sign In
                  </Button>
                </Link>
              </form>
            </Form>
          </div>
        </div>

        <div className="p-6 border-t border-slate-100 text-center text-sm text-slate-400">
          <span>&copy; 2026 MarinaMatch. All rights reserved.</span>
        </div>
      </div>

      {rightPanel}
    </div>
  );
}
