import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { 
  Briefcase,
  FileText, 
  Users, 
  AlertTriangle, 
  ChevronLeft,
  LayoutDashboard,
  TrendingUp
} from "lucide-react";
import { PortfolioProvider } from "@/contexts/ProjectContext";
import UserMenu from "@/components/navigation/UserMenu";

interface PortfolioLayoutProps {
  children: React.ReactNode;
}

export default function PortfolioLayout({ children }: PortfolioLayoutProps) {
  const [location] = useLocation();

  const navItems = [
    { path: "/portfolio", label: "Overview", icon: Briefcase, exact: true },
    { path: "/portfolio/reports", label: "Reports", icon: FileText },
    { path: "/portfolio/cohorts", label: "Cohorts", icon: Users },
    { path: "/portfolio/data-quality", label: "Data Quality", icon: AlertTriangle },
  ];

  const isActive = (path: string, exact?: boolean) => {
    if (exact) {
      return location === path;
    }
    return location.startsWith(path);
  };

  return (
    <PortfolioProvider>
      <div className="min-h-screen bg-background">
        <header className="border-b bg-card">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Link href="/">
                  <Button variant="ghost" size="sm" className="gap-2" data-testid="btn-back-to-dashboard">
                    <ChevronLeft className="h-4 w-4" />
                    Dashboard
                  </Button>
                </Link>
                <div className="h-6 w-px bg-border" />
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-muted-foreground" />
                  <h1 className="text-lg font-semibold" data-testid="text-portfolio-title">
                    Portfolio Analysis
                  </h1>
                </div>
              </div>
              <UserMenu />
            </div>
          </div>
        </header>
        {/* Section navigation - below header border for cleaner look */}
        <div className="bg-card border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3">
            <nav className="flex gap-2" data-testid="portfolio-section-nav">
              {navItems.map((item) => (
                <Link key={item.path} href={item.path}>
                  <Button
                    variant="outline"
                    size="sm"
                    data-testid={`nav-portfolio-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
                    className={`gap-2 border-2 ${
                      isActive(item.path, item.exact)
                        ? "bg-primary text-primary-foreground border-primary hover:bg-primary/90"
                        : "border-border hover:bg-accent"
                    }`}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.label}
                  </Button>
                </Link>
              ))}
            </nav>
          </div>
        </div>
        <main>
          {children}
        </main>
      </div>
    </PortfolioProvider>
  );
}
