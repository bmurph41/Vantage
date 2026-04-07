import { Suspense, useCallback, useEffect } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { AuthProvider } from "@/contexts/AuthContext";
import { SettingsProvider } from "@/contexts/SettingsContext";
import { ThemeProvider } from "@/contexts/ThemeProvider";
import { ProspectingActivityProvider } from "@/contexts/ProspectingActivityContext";
import { GoogleMapsProvider } from "@/lib/google-maps-provider";
import Router from "./Router";

function PageLoader() {
  return (
    <div className="flex items-center justify-center h-full min-h-[200px]">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}

function GlobalQueryErrorHandler() {
  const { toast } = useToast();
  const handleQueryError = useCallback(
    (e: Event) => {
      const { message } = (e as CustomEvent<{ message: string }>).detail;
      toast({
        title: "Failed to load data",
        description: message,
        variant: "destructive",
      });
    },
    [toast],
  );

  useEffect(() => {
    window.addEventListener("query-error", handleQueryError);
    return () => window.removeEventListener("query-error", handleQueryError);
  }, [handleQueryError]);

  return null;
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="system">
        <QueryClientProvider client={queryClient}>
          <GoogleMapsProvider>
            <SettingsProvider>
              <AuthProvider>
                <ProspectingActivityProvider>
                  <TooltipProvider>
                    <Toaster />
                    <GlobalQueryErrorHandler />
                    <Suspense fallback={<PageLoader />}>
                      <Router />
                    </Suspense>
                  </TooltipProvider>
                </ProspectingActivityProvider>
              </AuthProvider>
            </SettingsProvider>
          </GoogleMapsProvider>
        </QueryClientProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
