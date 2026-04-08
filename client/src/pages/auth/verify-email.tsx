import { useEffect, useState } from "react";
import { useLocation, useParams, Link } from "wouter";
import { Loader2, Anchor, CheckCircle, XCircle, Mail, ShieldCheck, Bell, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function VerifyEmailPage() {
  const [, setLocation] = useLocation();
  const params = useParams<{ token: string }>();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const verifyEmail = async () => {
      try {
        const response = await fetch(`/api/auth/verify-email/${params.token}`);
        const data = await response.json();

        if (response.ok && data.success) {
          setStatus("success");
        } else {
          setStatus("error");
          setErrorMessage(data.error || "Invalid or expired verification link");
        }
      } catch (error) {
        setStatus("error");
        setErrorMessage("Verification failed. Please try again.");
      }
    };

    if (params.token) {
      verifyEmail();
    }
  }, [params.token]);

  return (
    <div className="min-h-screen flex">
      {/* Left Panel - Verification Status */}
      <div className="flex-1 flex flex-col bg-white">
        <div className="p-6 flex items-center">
          <Link href="/">
            <div className="flex items-center gap-2 cursor-pointer">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
                <Anchor className="h-5 w-5 text-white" />
              </div>
              <span className="text-xl font-bold text-slate-800">Vantage</span>
            </div>
          </Link>
        </div>

        <div className="flex-1 flex items-center justify-center px-8 pb-8">
          <div className="w-full max-w-sm text-center">
            {status === "loading" && (
              <>
                <div className="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center mx-auto mb-6">
                  <Loader2 className="h-8 w-8 animate-spin text-cyan-600" />
                </div>
                <h1 className="text-2xl font-bold text-slate-800 mb-2">
                  Verifying your email...
                </h1>
                <p className="text-slate-500">
                  Please wait while we confirm your email address.
                </p>
              </>
            )}

            {status === "success" && (
              <>
                <div className="relative w-16 h-16 mx-auto mb-6">
                  <div className="absolute inset-0 rounded-full bg-green-100 animate-in zoom-in-50 duration-300" />
                  <div className="absolute inset-0 rounded-full bg-green-200/50 animate-ping" style={{ animationDuration: "2s", animationIterationCount: "3" }} />
                  <div className="relative w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
                    <CheckCircle className="h-8 w-8 text-green-600" />
                  </div>
                </div>

                <h1 className="text-2xl font-bold text-slate-800 mb-2">
                  Email Verified!
                </h1>
                <p className="text-slate-500 mb-8">
                  Your email has been successfully verified. You now have full access to all platform features.
                </p>

                <Button
                  onClick={() => setLocation("/")}
                  className="w-full h-12 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white font-medium shadow-lg shadow-cyan-500/25"
                >
                  Go to Dashboard
                </Button>
              </>
            )}

            {status === "error" && (
              <>
                <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-6 animate-in zoom-in-50 duration-300">
                  <XCircle className="h-8 w-8 text-red-600" />
                </div>

                <h1 className="text-2xl font-bold text-slate-800 mb-2">
                  Verification Failed
                </h1>
                <p className="text-slate-500 mb-2">{errorMessage}</p>
                <p className="text-sm text-slate-400 mb-8">
                  You may need to request a new verification email from your account settings.
                </p>

                <div className="space-y-3">
                  <Link href="/login">
                    <Button className="w-full h-12 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white font-medium shadow-lg shadow-cyan-500/25">
                      Back to Login
                    </Button>
                  </Link>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="p-6 border-t border-slate-100 text-center text-sm text-slate-400">
          <span>&copy; 2026 Vantage. All rights reserved.</span>
        </div>
      </div>

      {/* Right Panel - Feature Panel */}
      <div className="hidden lg:flex flex-1 bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 items-center justify-center p-12 relative overflow-hidden">
        <div className="absolute top-1/4 -right-20 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 -left-20 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />

        <div className="relative text-center text-white max-w-lg">
          <div className="w-20 h-20 rounded-2xl bg-white/10 backdrop-blur-sm flex items-center justify-center mx-auto mb-8">
            <Mail className="w-10 h-10 text-cyan-400" />
          </div>
          <h2 className="text-3xl font-bold mb-4">Email Verification</h2>
          <p className="text-lg text-slate-300 leading-relaxed mb-10">
            Verifying your email unlocks the full power of Vantage and keeps your account secure.
          </p>

          <div className="space-y-5 text-left">
            {[
              { icon: ShieldCheck, title: "Enhanced security", desc: "Verified accounts are protected with our full security suite" },
              { icon: Bell, title: "Real-time notifications", desc: "Receive deal alerts, updates, and important communications" },
              { icon: BarChart3, title: "Full platform access", desc: "Unlock analytics, reporting, and collaboration features" },
              { icon: Mail, title: "Team invitations", desc: "Invite colleagues and manage your organization" },
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-4 bg-white/5 rounded-xl p-4">
                <div className="w-10 h-10 rounded-lg bg-cyan-500/20 flex items-center justify-center shrink-0">
                  <item.icon className="w-5 h-5 text-cyan-400" />
                </div>
                <div>
                  <h4 className="font-semibold text-white text-sm">{item.title}</h4>
                  <p className="text-slate-400 text-sm">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
