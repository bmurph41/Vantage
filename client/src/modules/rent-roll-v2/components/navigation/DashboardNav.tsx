import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { LayoutDashboard, Table2, Briefcase, Users, FileText, Calculator } from "lucide-react";

export default function DashboardNav() {
  const [location] = useLocation();

  const isExecutiveActive = location === "/rent-roll" || location === "/rent-roll/executive";
  const isProjectsActive = location.startsWith("/rent-roll/projects");
  const isPortfolioActive = location.startsWith("/rent-roll/portfolio");
  const isCohortsActive = location.startsWith("/rent-roll/cohorts");
  const isReportsActive = location.startsWith("/rent-roll/reports");
  const isScenariosActive = location.startsWith("/rent-roll/scenarios");

  return (
    <div className="flex flex-wrap gap-2">
      <Link href="/rent-roll">
        <Button
          variant="outline"
          size="sm"
          data-testid="nav-executive"
          className={`gap-1.5 border-2 ${
            isExecutiveActive
              ? "bg-primary text-primary-foreground border-primary hover:bg-primary/90"
              : "border-border hover:bg-accent"
          }`}
        >
          <LayoutDashboard className="h-4 w-4" />
          Executive
        </Button>
      </Link>
      <Link href="/rent-roll/projects">
        <Button
          variant="outline"
          size="sm"
          data-testid="nav-projects"
          className={`gap-1.5 border-2 ${
            isProjectsActive
              ? "bg-primary text-primary-foreground border-primary hover:bg-primary/90"
              : "border-border hover:bg-accent"
          }`}
        >
          <Table2 className="h-4 w-4" />
          Projects
        </Button>
      </Link>
      <Link href="/rent-roll/portfolio">
        <Button
          variant="outline"
          size="sm"
          data-testid="nav-portfolio"
          className={`gap-1.5 border-2 ${
            isPortfolioActive
              ? "bg-primary text-primary-foreground border-primary hover:bg-primary/90"
              : "border-border hover:bg-accent"
          }`}
        >
          <Briefcase className="h-4 w-4" />
          Portfolio
        </Button>
      </Link>
      <Link href="/rent-roll/cohorts">
        <Button
          variant="outline"
          size="sm"
          data-testid="nav-cohorts"
          className={`gap-1.5 border-2 ${
            isCohortsActive
              ? "bg-primary text-primary-foreground border-primary hover:bg-primary/90"
              : "border-border hover:bg-accent"
          }`}
        >
          <Users className="h-4 w-4" />
          Cohorts
        </Button>
      </Link>
      <Link href="/rent-roll/reports">
        <Button
          variant="outline"
          size="sm"
          data-testid="nav-reports"
          className={`gap-1.5 border-2 ${
            isReportsActive
              ? "bg-primary text-primary-foreground border-primary hover:bg-primary/90"
              : "border-border hover:bg-accent"
          }`}
        >
          <FileText className="h-4 w-4" />
          Reports
        </Button>
      </Link>
      <Link href="/rent-roll/scenarios">
        <Button
          variant="outline"
          size="sm"
          data-testid="nav-scenarios"
          className={`gap-1.5 border-2 ${
            isScenariosActive
              ? "bg-primary text-primary-foreground border-primary hover:bg-primary/90"
              : "border-border hover:bg-accent"
          }`}
        >
          <Calculator className="h-4 w-4" />
          Scenarios
        </Button>
      </Link>
    </div>
  );
}
