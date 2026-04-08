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
import { Loader2, Anchor, Mail, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const magicLinkSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
});

type MagicLinkFormValues = z.infer<typeof magicLinkSchema>;

export default function MagicLinkPage() {
  const { toast } = useToast();
  const [emailSent, setEmailSent] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState("");

  const form = useForm<MagicLinkFormValues>({
    resolver: zodResolver(magicLinkSchema),
    defaultValues: {
      email: "",
    },
  });

  const magicLinkMutation = useMutation({
    mutationFn: async (values: MagicLinkFormValues) => {
      const response = await apiRequest("POST", "/api/auth/magic-link", values);
      return response.json();
    },
    onSuccess: (data, variables) => {
      setSubmittedEmail(variables.email);
      setEmailSent(true);
      toast({
        title: "Check your email",
        description: "We've sent you a login link.",
      });
    },
    onError: () => {
      setSubmittedEmail(form.getValues().email);
      setEmailSent(true);
    },
  });

  const onSubmit = (values: MagicLinkFormValues) => {
    magicLinkMutation.mutate(values);
  };

  if (emailSent) {
    return (
      <div className="min-h-screen flex">
        <div className="flex-1 flex flex-col bg-white">
          <div className="p-6 flex items-center">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-[#1E4FAB] flex items-center justify-center">
                <Anchor className="h-4 w-4 text-white" />
              </div>
              <span className="text-xl font-bold text-[#343E5C]">Vantage</span>
            </div>
          </div>

          <div className="flex-1 flex items-center justify-center px-8 pb-8">
            <div className="w-full max-w-sm text-center">
              <div className="w-16 h-16 rounded-full bg-[#1E4FAB]/10 flex items-center justify-center mx-auto mb-6">
                <CheckCircle className="h-8 w-8 text-[#1E4FAB]" />
              </div>
              
              <h1 className="text-xl font-semibold text-[#343E5C] mb-2">
                Check your email
              </h1>
              <p className="text-gray-500 mb-6">
                We've sent a login link to <strong>{submittedEmail}</strong>. 
                Click the link in your email to sign in.
              </p>
              
              <div className="space-y-3">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    setEmailSent(false);
                    form.reset();
                  }}
                >
                  Use a different email
                </Button>
                <Link href="/login">
                  <Button variant="ghost" className="w-full text-[#343E5C]">
                    Back to login
                  </Button>
                </Link>
              </div>
            </div>
          </div>

          <div className="p-6 border-t border-gray-100 flex items-center justify-between text-sm text-gray-500">
            <div className="flex items-center gap-4">
              <a href="#" className="hover:text-[#343E5C]">Help</a>
              <a href="#" className="hover:text-[#343E5C]">Privacy Policy</a>
            </div>
            <span>&copy; 2026 Vantage. All rights reserved.</span>
          </div>
        </div>

        <div className="hidden lg:flex flex-1 bg-gradient-to-br from-[#1E4FAB] to-[#152d6b] items-center justify-center p-12">
          <div className="text-center text-white max-w-lg">
            <div className="w-20 h-20 rounded-full bg-white/20 flex items-center justify-center mx-auto mb-6">
              <Mail className="w-10 h-10 text-white" />
            </div>
            <h2 className="text-2xl font-bold mb-4">Password-Free Login</h2>
            <p className="text-lg text-white/95 leading-relaxed">
              No need to remember passwords. Just enter your email and click the secure link we send you.
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
            <div className="w-8 h-8 rounded-full bg-[#1E4FAB] flex items-center justify-center">
              <Anchor className="h-4 w-4 text-white" />
            </div>
            <span className="text-xl font-bold text-[#343E5C]">Vantage</span>
          </div>
        </div>

        <div className="flex-1 flex items-center justify-center px-8 pb-8">
          <div className="w-full max-w-sm">
            <h1 className="text-xl font-semibold text-[#343E5C] mb-2">
              Password-free login
            </h1>
            <p className="text-gray-500 mb-6">
              Enter your email and we'll send you a secure login link.
            </p>

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
                          className="h-11 border-gray-200 focus:border-[#1E4FAB] focus:ring-[#1E4FAB]"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  className="w-full h-11 bg-[#1E4FAB] hover:bg-[#1a4294] text-white font-medium"
                  disabled={magicLinkMutation.isPending}
                >
                  {magicLinkMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Send Login Link
                </Button>

                <div className="text-center">
                  <Link href="/login" className="text-sm text-[#343E5C] hover:text-[#1E4FAB]">
                    Back to login with password
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
          <span>&copy; 2026 Vantage. All rights reserved.</span>
        </div>
      </div>

      <div className="hidden lg:flex flex-1 bg-gradient-to-br from-[#1E4FAB] to-[#152d6b] items-center justify-center p-12">
        <div className="text-center text-white max-w-lg">
          <div className="w-20 h-20 rounded-full bg-white/20 flex items-center justify-center mx-auto mb-6">
            <Mail className="w-10 h-10 text-white" />
          </div>
          <h2 className="text-2xl font-bold mb-4">Password-Free Login</h2>
          <p className="text-lg text-white/95 leading-relaxed">
            No need to remember passwords. Just enter your email and click the secure link we send you.
          </p>
        </div>
      </div>
    </div>
  );
}
