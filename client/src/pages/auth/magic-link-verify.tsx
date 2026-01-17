import { useEffect, useState } from "react";
import { useLocation, useParams } from "wouter";
import { Loader2, Anchor, CheckCircle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { queryClient } from "@/lib/queryClient";

export default function MagicLinkVerifyPage() {
  const [, setLocation] = useLocation();
  const params = useParams<{ token: string }>();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const verifyToken = async () => {
      try {
        const response = await fetch(`/api/auth/magic-link/verify/${params.token}`);
        const data = await response.json();

        if (response.ok && data.success) {
          setStatus("success");
          queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
          queryClient.invalidateQueries({ queryKey: ["/api/bootstrap"] });
          setTimeout(() => {
            setLocation(data.redirectTo || "/");
          }, 2000);
        } else {
          setStatus("error");
          setErrorMessage(data.error || "Invalid or expired link");
        }
      } catch (error) {
        setStatus("error");
        setErrorMessage("Verification failed. Please try again.");
      }
    };

    if (params.token) {
      verifyToken();
    }
  }, [params.token, setLocation]);

  return (
    <div className="min-h-screen flex">
      <div className="flex-1 flex flex-col bg-white">
        <div className="p-6 flex items-center">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-[#29C2AF] flex items-center justify-center">
              <Anchor className="h-4 w-4 text-white" />
            </div>
            <span className="text-xl font-bold text-[#343E5C]">MarinaMatch</span>
          </div>
        </div>

        <div className="flex-1 flex items-center justify-center px-8 pb-8">
          <div className="w-full max-w-sm text-center">
            {status === "loading" && (
              <>
                <Loader2 className="h-12 w-12 animate-spin text-[#29C2AF] mx-auto mb-6" />
                <h1 className="text-xl font-semibold text-[#343E5C] mb-2">
                  Verifying your login...
                </h1>
                <p className="text-gray-500">
                  Please wait while we log you in securely.
                </p>
              </>
            )}

            {status === "success" && (
              <>
                <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-6">
                  <CheckCircle className="h-8 w-8 text-green-600" />
                </div>
                <h1 className="text-xl font-semibold text-[#343E5C] mb-2">
                  Login successful!
                </h1>
                <p className="text-gray-500">
                  Redirecting you to the dashboard...
                </p>
              </>
            )}

            {status === "error" && (
              <>
                <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-6">
                  <XCircle className="h-8 w-8 text-red-600" />
                </div>
                <h1 className="text-xl font-semibold text-[#343E5C] mb-2">
                  Link expired or invalid
                </h1>
                <p className="text-gray-500 mb-6">{errorMessage}</p>
                <div className="space-y-3">
                  <Button
                    onClick={() => setLocation("/magic-link")}
                    className="w-full bg-[#29C2AF] hover:bg-[#24B09E]"
                  >
                    Request a new link
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setLocation("/login")}
                    className="w-full"
                  >
                    Back to login
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="p-6 border-t border-gray-100 text-center text-sm text-gray-500">
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
            The smart way to manage marina acquisitions, track due diligence, and close deals faster.
          </p>
        </div>
      </div>
    </div>
  );
}
