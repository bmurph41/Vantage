import { Link, useLocation } from "wouter";
import { 
  Anchor, 
  BarChart3, 
  Calendar, 
  CreditCard, 
  DollarSign, 
  MessageSquare, 
  Plug, 
  Gauge, 
  Upload,
  Users, 
  Warehouse,
  Map,
  Shield,
  Building2,
  FileSignature,
  History,
  Code
} from "lucide-react";
import { cn } from "@/lib/utils";

const navigationItems = [
  { path: "/", label: "Dashboard", icon: Gauge },
  { path: "/portfolio", label: "Portfolio", icon: Building2 },
  { path: "/marina-map", label: "Marina Map", icon: Map },
  { path: "/launch-scheduling", label: "Launch Scheduling", icon: Calendar },
  { path: "/customers", label: "Customer Management", icon: Users },
  { path: "/inventory", label: "Inventory", icon: Warehouse },
  { path: "/financial-reports", label: "Financial Reports", icon: BarChart3 },
  { path: "/rent-roll", label: "Rent Roll", icon: CreditCard },
  { path: "/contracts", label: "Contracts", icon: FileSignature },
  { path: "/audit-trail", label: "Audit Trail", icon: History },
  { path: "/api-docs", label: "API Docs", icon: Code },
  { path: "/users", label: "User Management", icon: Shield },
  { path: "/integrations", label: "Integrations", icon: Plug },
  { path: "/communications", label: "Communications", icon: MessageSquare },
  { path: "/imports", label: "Data Import", icon: Upload },
];

export default function Sidebar() {
  const [location] = useLocation();

  return (
    <aside className="w-72 bg-sidebar border-r border-sidebar-border shadow-sm">
      <div className="p-6 border-b border-sidebar-border">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-sidebar-primary rounded-lg flex items-center justify-center">
            <Anchor className="text-sidebar-primary-foreground" size={20} />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-sidebar-foreground">Marina Manager</h1>
            <p className="text-sm text-muted-foreground">SpeedyDock Integration</p>
          </div>
        </div>
      </div>

      <nav className="p-4 space-y-1">
        {navigationItems.map((item) => {
          const Icon = item.icon;
          const isActive = location === item.path;
          
          return (
            <Link key={item.path} href={item.path} data-testid={`nav-link-${item.path.replace('/', '') || 'dashboard'}`}>
              <div className={cn(
                "sidebar-item p-3 rounded-lg cursor-pointer transition-colors duration-200 flex items-center space-x-3",
                isActive ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent"
              )}>
                <Icon size={18} className={isActive ? "text-sidebar-primary" : "text-muted-foreground"} />
                <span className={cn("font-medium", isActive && "text-sidebar-primary")}>
                  {item.label}
                </span>
              </div>
            </Link>
          );
        })}
      </nav>

      <div className="absolute bottom-4 left-4 right-4">
        <div className="bg-muted rounded-lg p-4">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-accent rounded-full flex items-center justify-center">
              <div className="w-2 h-2 bg-accent-foreground rounded-full status-indicator" />
            </div>
            <div>
              <p className="text-sm font-medium">All Systems Online</p>
              <p className="text-xs text-muted-foreground">Last sync: 2 min ago</p>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
