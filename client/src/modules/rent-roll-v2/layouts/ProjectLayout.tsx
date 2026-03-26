import { Link, useLocation, useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ChevronLeft,
  Ship,
  Box,
  Building,
  Building2,
  Store,
  Factory,
  Hotel,
  Home,
  Tent,
  Table2,
  FileText,
  Calculator,
  Users,
  AlertTriangle,
  type LucideIcon,
} from "lucide-react";
import { ProjectProvider } from "../contexts/ProjectContext";
import UserMenu from "../components/navigation/UserMenu";

interface ProjectDetails {
  id: string;
  name: string;
  projectType: "OWNED" | "DEAL";
  description?: string;
  assetClass?: string;
}

const assetClassIcons: Record<string, LucideIcon> = {
  marina: Ship,
  self_storage: Box,
  multifamily: Building2,
  retail: Store,
  office: Building,
  industrial: Factory,
  hotel: Hotel,
  str: Home,
  rv_park: Tent,
  mobile_home: Home,
};

interface ProjectLayoutProps {
  children: React.ReactNode;
}

export default function ProjectLayout({ children }: ProjectLayoutProps) {
  const params = useParams();
  const projectId = params.id as string;
  const [location] = useLocation();

  const { data: project, isLoading } = useQuery<ProjectDetails>({
    queryKey: ["/api/rent-roll/locations", projectId],
    enabled: !!projectId,
  });

  const navItems = [
    { path: `/rent-roll/projects/${projectId}`, label: "Rent Roll", icon: Table2, exact: true },
    { path: `/rent-roll/projects/${projectId}/reports`, label: "Reports", icon: FileText },
    { path: `/rent-roll/projects/${projectId}/scenarios`, label: "Scenarios", icon: Calculator },
    { path: `/rent-roll/projects/${projectId}/cohorts`, label: "Cohorts", icon: Users },
    { path: `/rent-roll/projects/${projectId}/data-quality`, label: "Data Quality", icon: AlertTriangle },
  ];

  const isActive = (path: string, exact?: boolean) => {
    if (exact) {
      return location === path;
    }
    return location.startsWith(path);
  };

  return (
    <ProjectProvider projectId={projectId}>
      <div className="min-h-screen bg-background">
        <header className="border-b bg-card">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Link href="/rent-roll/projects">
                  <Button variant="ghost" size="sm" className="gap-2" data-testid="btn-back-to-projects">
                    <ChevronLeft className="h-4 w-4" />
                    Projects
                  </Button>
                </Link>
                <div className="h-6 w-px bg-border" />
                {isLoading ? (
                  <Skeleton className="h-6 w-48" />
                ) : (
                  <div className="flex items-center gap-2">
                    {(() => { const Icon = assetClassIcons[project?.assetClass || 'marina'] || Building2; return <Icon className="h-5 w-5 text-muted-foreground" />; })()}
                    <h1 className="text-lg font-semibold" data-testid="text-project-name">
                      {project?.name || "Project"}
                    </h1>
                    {project?.projectType && (
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        project.projectType === "OWNED" 
                          ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300" 
                          : "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300"
                      }`}>
                        {project.projectType}
                      </span>
                    )}
                  </div>
                )}
              </div>
              <UserMenu />
            </div>
          </div>
        </header>
        {/* Section navigation - below header border for cleaner look */}
        <div className="bg-card border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3">
            <nav className="flex gap-2" data-testid="project-section-nav">
              {navItems.map((item) => (
                <Link key={item.path} href={item.path}>
                  <Button
                    variant="outline"
                    size="sm"
                    data-testid={`nav-project-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
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
    </ProjectProvider>
  );
}
