/**
 * DockitAppShell - Wrapper for Dockit module pages
 * 
 * This component wraps Dockit pages within the main MarinaMatch layout,
 * providing consistent navigation and styling while allowing Dockit to
 * operate as an isolated module.
 */

import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import UnifiedSidebar from "@/components/unified-sidebar";
import {
  LayoutDashboard,
  Anchor,
  Users,
  Ship,
  Calendar,
  CreditCard,
  Warehouse,
  MessageSquare,
  FileText,
  Upload,
  Map,
  Settings,
  Receipt,
  Shield,
  ChevronRight
} from "lucide-react";

interface DockitAppShellProps {
  children: ReactNode;
  title?: string;
  description?: string;
}

const dockitNavItems = [
  { name: "Dashboard", href: "/operations/dockit", icon: LayoutDashboard },
  { name: "Launch Schedule", href: "/operations/dockit/launches", icon: Calendar },
  { name: "Customers", href: "/operations/dockit/customers", icon: Users },
  { name: "Boats", href: "/operations/dockit/boats", icon: Ship },
  { name: "Marina Map", href: "/operations/dockit/map", icon: Map },
  { name: "Slips & Leases", href: "/operations/dockit/slips", icon: Anchor },
  { name: "Reservations", href: "/operations/dockit/reservations", icon: Calendar },
  { name: "Contracts", href: "/operations/dockit/contracts", icon: FileText },
  { name: "Payments", href: "/operations/dockit/payments", icon: CreditCard },
  { name: "Inventory", href: "/operations/dockit/inventory", icon: Warehouse },
  { name: "Messages", href: "/operations/dockit/messages", icon: MessageSquare },
  { name: "Data Import", href: "/operations/dockit/imports", icon: Upload },
  { name: "Audit Trail", href: "/operations/dockit/audit", icon: Shield },
  { name: "Settings", href: "/operations/dockit/settings", icon: Settings },
];

export default function DockitAppShell({ children, title, description }: DockitAppShellProps) {
  const [location] = useLocation();

  return (
    <div className="min-h-screen bg-background">
      <UnifiedSidebar />
      
      <div className="md:pl-64">
        {/* Dockit Sub-Navigation Header */}
        <div className="border-b bg-white sticky top-0 z-30">
          <div className="container mx-auto px-4 py-2">
            {/* Breadcrumb */}
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
              <Link href="/dashboard" className="hover:text-foreground">Dashboard</Link>
              <ChevronRight className="h-4 w-4" />
              <Link href="/operations/dockit" className="hover:text-foreground">Dockit</Link>
              {title && (
                <>
                  <ChevronRight className="h-4 w-4" />
                  <span className="text-foreground font-medium">{title}</span>
                </>
              )}
            </div>
            
            {/* Title */}
            {title && (
              <div className="mb-2">
                <h1 className="text-xl font-semibold">{title}</h1>
                {description && <p className="text-sm text-muted-foreground">{description}</p>}
              </div>
            )}
            
            {/* Dockit Tab Navigation */}
            <nav className="flex overflow-x-auto gap-1" data-testid="dockit-tab-nav">
              {dockitNavItems.slice(0, 8).map((item) => {
                const isActive = location === item.href || 
                  (item.href !== "/operations/dockit" && location.startsWith(item.href));
                
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2 text-sm rounded-md whitespace-nowrap transition-colors",
                      isActive 
                        ? "bg-blue-50 text-blue-700 font-medium" 
                        : "text-muted-foreground hover:text-foreground hover:bg-gray-50"
                    )}
                    data-testid={`dockit-nav-${item.name.toLowerCase().replace(/ /g, '-')}`}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.name}
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
        
        {/* Main Content */}
        <main className="container mx-auto p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}

/**
 * Utility hook for Dockit API calls
 * Ensures all Dockit API calls use the correct prefix
 */
export function useDockitApi() {
  const API_PREFIX = "/dockit/api";
  
  const fetchDockitApi = async (endpoint: string, options?: RequestInit) => {
    const url = `${API_PREFIX}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'An error occurred' }));
      throw new Error(error.message || `Request failed: ${response.status}`);
    }
    
    return response.json();
  };
  
  return { fetchDockitApi, apiPrefix: API_PREFIX };
}
