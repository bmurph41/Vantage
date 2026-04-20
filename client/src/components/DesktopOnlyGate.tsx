import { useState, useEffect } from "react";
import { Monitor, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DesktopOnlyGateProps {
  children: React.ReactNode;
  featureName?: string;
}

export function DesktopOnlyGate({ children, featureName = "This tool" }: DesktopOnlyGateProps) {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.innerWidth < 768;
  });

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  if (!isMobile) return <>{children}</>;

  const currentUrl = typeof window !== "undefined" ? window.location.href : "";
  const mailtoHref = `mailto:?subject=Open%20this%20link%20on%20desktop&body=Here%27s%20the%20link%20to%20open%20on%20your%20desktop%3A%0A%0A${encodeURIComponent(currentUrl)}`;

  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[60vh] px-6 py-12 text-center">
      <div className="rounded-2xl border bg-card p-8 shadow-sm max-w-sm w-full">
        <div className="flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mx-auto mb-5">
          <Monitor className="h-8 w-8 text-primary" />
        </div>
        <h2 className="text-xl font-semibold mb-2">Desktop Required</h2>
        <p className="text-sm text-muted-foreground mb-6">
          {featureName} is designed for desktop use and requires a larger screen.
          Please open it on a laptop or desktop computer for the full experience.
        </p>
        <Button asChild variant="outline" className="w-full">
          <a href={mailtoHref}>
            <ExternalLink className="h-4 w-4 mr-2" />
            Email this link to yourself
          </a>
        </Button>
      </div>
    </div>
  );
}
