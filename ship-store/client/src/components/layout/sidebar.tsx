import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";

const navigation = [
  { name: "Dashboard", href: "/", icon: "fas fa-chart-line" },
  { name: "Point of Sale", href: "/pos", icon: "fas fa-cash-register" },
  { name: "Inventory", href: "/inventory", icon: "fas fa-boxes" },
  { name: "Reports", href: "/reports", icon: "fas fa-chart-bar" },
  { name: "Transactions", href: "/transactions", icon: "fas fa-receipt" },
  { name: "Audit Trail", href: "/audit", icon: "fas fa-shield-alt" },
  { name: "Settings", href: "/settings", icon: "fas fa-cog" },
];

export default function Sidebar() {
  const [location] = useLocation();

  return (
    <div className="w-64 bg-card border-r border-border flex flex-col">
      <div className="p-6 border-b border-border">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <i className="fas fa-ship text-primary-foreground text-sm"></i>
          </div>
          <h1 className="text-xl font-bold">Ship Store</h1>
        </div>
      </div>
      
      <nav className="flex-1 p-4 space-y-2">
        {navigation.map((item) => {
          const isActive = location === item.href;
          return (
            <Link 
              key={item.href} 
              href={item.href}
              className={cn(
                "w-full flex items-center space-x-3 p-3 rounded-lg text-left transition-colors",
                isActive 
                  ? "bg-primary text-primary-foreground" 
                  : "hover:bg-secondary text-foreground"
              )}
              data-testid={`nav-${item.name.toLowerCase().replace(/\s+/g, '-')}`}
            >
              <i className={`${item.icon} w-5`}></i>
              <span>{item.name}</span>
            </Link>
          );
        })}
      </nav>
      
      <div className="p-4 border-t border-border">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-muted rounded-full flex items-center justify-center">
            <i className="fas fa-user text-muted-foreground text-sm"></i>
          </div>
          <div>
            <p className="text-sm font-medium">Store Manager</p>
            <p className="text-xs text-muted-foreground">manager@shipstore.com</p>
          </div>
        </div>
      </div>
    </div>
  );
}
