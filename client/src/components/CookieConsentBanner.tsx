import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { useAuth } from "@/contexts/AuthContext";

const STORAGE_KEY = "vantage_cookie_consent";

export function CookieConsentBanner() {
  const { user, isLoading } = useAuth();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isLoading) return;
    if (user) return;
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      setVisible(true);
    }
  }, [user, isLoading]);

  const dismiss = (accepted: boolean) => {
    localStorage.setItem(STORAGE_KEY, accepted ? "accepted" : "declined");
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 sm:p-6">
      <div className="max-w-4xl mx-auto bg-card border border-border rounded-xl shadow-xl flex flex-col sm:flex-row items-start sm:items-center gap-4 p-4 sm:p-5">
        <div className="flex-1 text-sm text-muted-foreground leading-relaxed">
          We use cookies to keep you signed in and to improve your experience. By using Vantage, you agree to our{" "}
          <Link href="/privacy" className="text-primary hover:underline font-medium">
            Privacy Policy
          </Link>
          {" "}and{" "}
          <Link href="/terms" className="text-primary hover:underline font-medium">
            Terms of Service
          </Link>
          .
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            size="sm"
            variant="outline"
            onClick={() => dismiss(false)}
            className="text-xs h-8"
          >
            Decline
          </Button>
          <Button
            size="sm"
            onClick={() => dismiss(true)}
            className="text-xs h-8"
          >
            Accept
          </Button>
          <button
            onClick={() => dismiss(false)}
            className="ml-1 text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
