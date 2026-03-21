import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Loader2, Anchor, Mail, ArrowLeft, CheckCircle, Lock, ShieldCheck, KeyRound, Info } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const forgotPasswordSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
});

type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>;

export default function ForgotPasswordPage() {
  const { toast } = useToast();
  const [emailSent, setEmailSent] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState("");

  const form = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: "",
    },
  });

  const forgotPasswordMutation = useMutation({
    mutationFn: async (values: ForgotPasswordFormValues) => {
      const response = await apiRequest("POST", "/api/auth/forgot-password", values);
      return response.json();
    },
    onSuccess: () => {
      setEmailSent(true);
      setSubmittedEmail(form.getValues("email"));
    },
    onError: (error: any) => {
      toast({
        title: "Request failed",
        description: error.message || "Unable to process your request. Please try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (values: ForgotPasswordFormValues) => {
    forgotPasswordMutation.mutate(values);
  };

  if (emailSent) {
    return (
      <div className="min-h-screen flex">
        {/* Left Panel - Success State */}
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
                Check Your Email
              </h1>
              <p className="text-slate-500 mb-2">
                We've sent password reset instructions to:
              </p>
              <p className="font-medium text-slate-800 mb-6">{submittedEmail}</p>

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-8 text-left">
                <div className="flex gap-2">
                  <Info className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                  <p className="text-sm text-amber-800">
                    Don't see the email? Check your spam or junk folder. The reset link will expire in 1 hour.
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <Button
                  variant="outline"
                  className="w-full h-12 border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-cyan-300"
                  onClick={() => {
                    setEmailSent(false);
                    form.reset();
                  }}
                >
                  Try a different email
                </Button>
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

        {/* Right Panel - Feature Panel */}
        <div className="hidden lg:flex flex-1 bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 items-center justify-center p-12 relative overflow-hidden">
          <div className="absolute top-1/4 -right-20 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 -left-20 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />

          <div className="relative text-center text-white max-w-lg">
            <div className="w-20 h-20 rounded-2xl bg-white/10 backdrop-blur-sm flex items-center justify-center mx-auto mb-8">
              <ShieldCheck className="w-10 h-10 text-cyan-400" />
            </div>
            <h2 className="text-3xl font-bold mb-4">Account Security</h2>
            <p className="text-lg text-slate-300 leading-relaxed mb-10">
              Your account security is our priority. The password reset process is fast, secure, and easy.
            </p>

            <div className="space-y-5 text-left">
              {[
                { icon: Mail, title: "Check your inbox", desc: "We'll send a secure, one-time reset link to your email" },
                { icon: KeyRound, title: "Create a new password", desc: "Choose a strong password that you haven't used before" },
                { icon: Lock, title: "Stay protected", desc: "Enable two-factor authentication for extra security" },
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
              Reset your password
            </h1>
            <p className="text-slate-500 mb-8">
              Enter your email address and we'll send you instructions to reset your password.
            </p>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-slate-700">Email Address</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                          <Input
                            {...field}
                            type="email"
                            placeholder="you@example.com"
                            autoComplete="email"
                            className="h-12 pl-10 border-slate-200 focus:border-cyan-500 focus:ring-cyan-500 bg-slate-50/50"
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  className="w-full h-12 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white font-medium shadow-lg shadow-cyan-500/25"
                  disabled={forgotPasswordMutation.isPending}
                >
                  {forgotPasswordMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Send Reset Instructions
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

      {/* Right Panel - Feature Panel */}
      <div className="hidden lg:flex flex-1 bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 items-center justify-center p-12 relative overflow-hidden">
        <div className="absolute top-1/4 -right-20 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 -left-20 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />

        <div className="relative text-center text-white max-w-lg">
          <div className="w-20 h-20 rounded-2xl bg-white/10 backdrop-blur-sm flex items-center justify-center mx-auto mb-8">
            <ShieldCheck className="w-10 h-10 text-cyan-400" />
          </div>
          <h2 className="text-3xl font-bold mb-4">Account Security</h2>
          <p className="text-lg text-slate-300 leading-relaxed mb-10">
            Your account security is our priority. The password reset process is fast, secure, and easy.
          </p>

          <div className="space-y-5 text-left">
            {[
              { icon: Mail, title: "Check your inbox", desc: "We'll send a secure, one-time reset link to your email" },
              { icon: KeyRound, title: "Create a new password", desc: "Choose a strong password that you haven't used before" },
              { icon: Lock, title: "Stay protected", desc: "Enable two-factor authentication for extra security" },
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
    </div>
  );
}
