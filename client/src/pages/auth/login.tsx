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
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Loader2, Anchor, Eye, EyeOff } from "lucide-react";
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
      <div className="min-h-screen flex">
        <div className="flex-1 flex items-center justify-center bg-white p-8">
          <div className="w-full max-w-sm">
            <div className="flex items-center gap-2 mb-8">
              <div className="w-8 h-8 rounded-full bg-[#29C2AF] flex items-center justify-center">
                <Anchor className="h-4 w-4 text-white" />
              </div>
              <span className="text-xl font-bold text-[#343E5C]">MarinaMatch</span>
            </div>

            <h1 className="text-xl font-semibold text-[#343E5C] mb-2" data-testid="text-mfa-title">
              Two-Factor Authentication
            </h1>
            <p className="text-sm text-gray-500 mb-6" data-testid="text-mfa-description">
              Enter the 6-digit code from your authenticator app
            </p>

            <Form {...mfaForm}>
              <form onSubmit={mfaForm.handleSubmit(onMfaSubmit)} className="space-y-4">
                <FormField
                  control={mfaForm.control}
                  name="token"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[#343E5C] text-sm">Verification Code</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="000000"
                          maxLength={6}
                          className="text-center text-2xl tracking-widest h-12 border-gray-200 focus:border-[#29C2AF] focus:ring-[#29C2AF]"
                          data-testid="input-mfa-code"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  className="w-full h-11 bg-[#29C2AF] hover:bg-[#24B09E] text-white font-medium"
                  disabled={mfaMutation.isPending}
                  data-testid="button-verify-mfa"
                >
                  {mfaMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Verify
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  className="w-full text-[#343E5C] hover:text-[#29C2AF]"
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

        <div className="hidden lg:flex flex-1 bg-gradient-to-br from-[#29C2AF] to-[#1E8A7D] items-center justify-center p-12">
          <div className="text-center text-white">
            <div className="w-48 h-48 mx-auto mb-8 bg-white/10 rounded-2xl flex items-center justify-center backdrop-blur-sm">
              <div className="w-32 h-32 rounded-xl bg-white/20 flex items-center justify-center">
                <Anchor className="w-16 h-16 text-white" />
              </div>
            </div>
            <h2 className="text-2xl font-bold mb-4">MarinaMatch</h2>
            <p className="text-white/90 max-w-md">
              The smart way to manage marina acquisitions, track due diligence, and close deals faster.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex">
      <div className="flex-1 flex flex-col bg-white">
        <div className="p-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-[#29C2AF] flex items-center justify-center">
              <Anchor className="h-4 w-4 text-white" />
            </div>
            <span className="text-xl font-bold text-[#343E5C]">MarinaMatch</span>
          </div>
          <select className="text-sm text-gray-500 border-none bg-transparent cursor-pointer">
            <option>English</option>
          </select>
        </div>

        <div className="flex-1 flex items-center justify-center px-8 pb-8">
          <div className="w-full max-w-sm">
            <div className="flex items-center justify-between mb-6">
              <h1 className="text-xl font-semibold text-[#343E5C]" data-testid="text-login-title">
                Log in
              </h1>
              <span className="text-sm text-gray-500">
                or{" "}
                <Link href="/signup" className="text-[#343E5C] hover:text-[#29C2AF] font-medium" data-testid="link-signup">
                  create an account
                </Link>
              </span>
            </div>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[#343E5C] text-sm">Email</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="email"
                          placeholder="example@email.com"
                          autoComplete="email"
                          className="h-11 border-gray-200 focus:border-[#29C2AF] focus:ring-[#29C2AF]"
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
                      <FormLabel className="text-[#343E5C] text-sm">Password</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            {...field}
                            type={showPassword ? "text" : "password"}
                            placeholder="Enter your password"
                            autoComplete="current-password"
                            className="h-11 border-gray-200 focus:border-[#29C2AF] focus:ring-[#29C2AF] pr-10"
                            data-testid="input-password"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                            onClick={() => setShowPassword(!showPassword)}
                            data-testid="button-toggle-password"
                          >
                            {showPassword ? (
                              <EyeOff className="h-4 w-4 text-gray-400" />
                            ) : (
                              <Eye className="h-4 w-4 text-gray-400" />
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
                  name="rememberMe"
                  render={({ field }) => (
                    <FormItem className="flex items-center space-x-2 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          className="border-gray-300 data-[state=checked]:bg-[#29C2AF] data-[state=checked]:border-[#29C2AF]"
                        />
                      </FormControl>
                      <FormLabel className="text-sm text-gray-600 font-normal cursor-pointer">
                        Remember me
                      </FormLabel>
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  className="w-full h-11 bg-[#29C2AF] hover:bg-[#24B09E] text-white font-medium"
                  disabled={loginMutation.isPending}
                  data-testid="button-login"
                >
                  {loginMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Log In
                </Button>

                <div className="flex items-center justify-between text-sm">
                  <Link 
                    href="/magic-link" 
                    className="text-[#29C2AF] hover:underline"
                  >
                    Password-free log in
                  </Link>
                  <Link 
                    href="/forgot-password" 
                    className="text-[#343E5C] hover:text-[#29C2AF]"
                    data-testid="link-forgot-password"
                  >
                    Recover account
                  </Link>
                </div>
              </form>
            </Form>
          </div>
        </div>

        <div className="p-6 border-t border-gray-100 flex items-center justify-between text-sm text-gray-500">
          <div className="flex items-center gap-4">
            <a href="#" className="hover:text-[#343E5C]">Help</a>
            <a href="#" className="hover:text-[#343E5C]">Privacy Policy</a>
          </div>
          <span>&copy; 2026 MarinaMatch. All rights reserved.</span>
        </div>
      </div>

      <div className="hidden lg:flex flex-1 bg-gradient-to-br from-[#29C2AF] to-[#1E8A7D] items-center justify-center p-12">
        <div className="text-center text-white max-w-lg">
          <div className="w-80 h-48 mx-auto mb-8 bg-white rounded-lg shadow-2xl flex items-center justify-center">
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-[#29C2AF] flex items-center justify-center mx-auto mb-3">
                <Anchor className="w-6 h-6 text-white" />
              </div>
              <span className="text-2xl font-bold text-[#343E5C]">MarinaMatch</span>
            </div>
          </div>
          <p className="text-lg text-white/95 leading-relaxed">
            The smart way to manage marina acquisitions, track due diligence, analyze deals, and close transactions faster.
          </p>
        </div>
      </div>
    </div>
  );
}
