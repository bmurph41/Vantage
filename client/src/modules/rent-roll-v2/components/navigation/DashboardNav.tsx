import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { LayoutDashboard, Table2, Briefcase } from "lucide-react";

export default function DashboardNav() {
  const [location] = useLocation();

  const isExecutiveActive = location === "/" || location === "/executive" || location === "/executive-dashboard";
  const isProjectsActive = location.startsWith("/rent-roll") || location.startsWith("/projects");
  const isPortfolioActive = location.startsWith("/portfolio");

  return (
    <div className="flex gap-3">
      <Link href="/">
        <Button
          variant="outline"
          size="default"
          data-testid="nav-executive"
          className={`gap-2 border-2 ${
            isExecutiveActive
              ? "bg-primary text-primary-foreground border-primary hover:bg-primary/90"
              : "border-border hover:bg-accent"
          }`}
        >
          <LayoutDashboard className="h-4 w-4" />
          Executive Summary
        </Button>
      </Link>
      <Link href="/rent-roll">
        <Button
          variant="outline"
          size="default"
          data-testid="nav-projects"
          className={`gap-2 border-2 ${
            isProjectsActive
              ? "bg-primary text-primary-foreground border-primary hover:bg-primary/90"
              : "border-border hover:bg-accent"
          }`}
        >
          <Table2 className="h-4 w-4" />
          Projects
        </Button>
      </Link>
      <Link href="/portfolio">
        <Button
          variant="outline"
          size="default"
          data-testid="nav-portfolio"
          className={`gap-2 border-2 ${
            isPortfolioActive
              ? "bg-primary text-primary-foreground border-primary hover:bg-primary/90"
              : "border-border hover:bg-accent"
          }`}
        >
          <Briefcase className="h-4 w-4" />
          Portfolio
        </Button>
      </Link>
    </div>
  );
}
