import { useEffect, useState } from "react";
import { useLocation, useParams, Link } from "wouter";
import { Loader2, Anchor, CheckCircle, XCircle, Mail } from "lucide-react";
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
      <div className="flex-1 flex flex-col bg-white">
        <div className="p-6 flex items-center">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-[#1E4FAB] flex items-center justify-center">
              <Anchor className="h-4 w-4 text-white" />
            </div>
            <span className="text-xl font-bold text-[#343E5C]">MarinaMatch</span>
          </div>
        </div>

        <div className="flex-1 flex items-center justify-center px-8 pb-8">
          <div className="w-full max-w-sm text-center">
            {status === "loading" && (
              <>
                <Loader2 className="h-12 w-12 animate-spin text-[#1E4FAB] mx-auto mb-6" />
                <h1 className="text-xl font-semibold text-[#343E5C] mb-2">
                  Verifying your email...
                </h1>
                <p className="text-gray-500">
                  Please wait while we confirm your email address.
                </p>
              </>
            )}

            {status === "success" && (
              <>
                <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-6">
                  <CheckCircle className="h-8 w-8 text-green-600" />
                </div>
                <h1 className="text-xl font-semibold text-[#343E5C] mb-2">
                  Email verified!
                </h1>
                <p className="text-gray-500 mb-6">
                  Your email has been successfully verified. You can now access all features.
                </p>
                <Button
                  onClick={() => setLocation("/")}
                  className="w-full bg-[#1E4FAB] hover:bg-[#1a4294]"
                >
                  Go to Dashboard
                </Button>
              </>
            )}

            {status === "error" && (
              <>
                <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-6">
                  <XCircle className="h-8 w-8 text-red-600" />
                </div>
                <h1 className="text-xl font-semibold text-[#343E5C] mb-2">
                  Verification failed
                </h1>
                <p className="text-gray-500 mb-6">{errorMessage}</p>
                <div className="space-y-3">
                  <Link href="/login">
                    <Button className="w-full bg-[#1E4FAB] hover:bg-[#1a4294]">
                      Back to login
                    </Button>
                  </Link>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="p-6 border-t border-gray-100 text-center text-sm text-gray-500">
          <span>&copy; 2026 MarinaMatch. All rights reserved.</span>
        </div>
      </div>

      <div className="hidden lg:flex flex-1 bg-gradient-to-br from-[#1E4FAB] to-[#152d6b] items-center justify-center p-12">
        <div className="text-center text-white max-w-lg">
          <div className="w-20 h-20 rounded-full bg-white/20 flex items-center justify-center mx-auto mb-6">
            <Mail className="w-10 h-10 text-white" />
          </div>
          <h2 className="text-2xl font-bold mb-4">Email Verification</h2>
          <p className="text-lg text-white/95 leading-relaxed">
            Verifying your email helps us keep your account secure and enables all platform features.
          </p>
        </div>
      </div>
    </div>
  );
}
