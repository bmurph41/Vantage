import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  LayoutDashboard, Users, Handshake, Building2, MoreHorizontal,
  Bell, ChevronRight, Calculator, BarChart3, FileText, DollarSign,
  Target, Shield, Plug, Anchor, Briefcase, Megaphone, X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { UserMenu } from "@/components/layout/UserMenu";

type BootstrapData = {
  persona: any;
  features: any[];
  activePacks: string[];
  pendingCounts: {
    properties: number;
    contacts: number;
    companies: number;
  };
};

const PAGE_TITLES: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/crm": "CRM",
  "/pipeline": "Pipeline",
  "/operations": "Operations",
  "/portfolio": "Portfolio",
  "/analysis": "Market Intelligence",
  "/modeling": "Analysis",
  "/vdr": "Data Room",
  "/dd": "Due Diligence",
  "/workspaces": "Deal Workspace",
  "/admin": "Admin",
  "/settings": "Settings",
  "/prospecting": "Prospecting",
  "/marketing": "Marketing",
  "/rent-roll": "Rent Roll",
  "/docket": "The Docket",
  "/vantage": "Vantage",
  "/document-studio": "Document Studio",
  "/om": "OM Builder",
  "/broker": "Broker",
  "/document-intelligence": "Document Intelligence",
  "/calendar-settings": "Calendar Settings",
  "/import-contacts": "Import Contacts",
  "/import-history": "Import History",
};

function usePageTitle(location: string): string {
  for (const [prefix, title] of Object.entries(PAGE_TITLES)) {
    if (location === prefix || location.startsWith(prefix + "/") || location.startsWith(prefix + "?")) {
      return title;
    }
  }
  return "Vantage";
}

const MORE_SECTIONS = [
  {
    label: "Deal Workspace",
    icon: Briefcase,
    items: [
      { name: "Deals", href: "/crm/deals" },
      { name: "Due Diligence", href: "/dd/projects" },
      { name: "Data Room", href: "/vdr" },
    ],
  },
  {
    label: "Analysis",
    icon: Calculator,
    items: [
      { name: "Financial Model", href: "/modeling/projects" },
      { name: "Pipeline Returns", href: "/modeling/returns-valuation" },
      { name: "Debt Scenarios", href: "/modeling/scenarios" },
      { name: "Exit Strategies", href: "/modeling/exit-strategies" },
      { name: "Document Intelligence", href: "/document-intelligence" },
    ],
  },
  {
    label: "Market Intelligence",
    icon: BarChart3,
    items: [
      { name: "Analysis Hub", href: "/analysis/hub" },
      { name: "Sales Comps", href: "/analysis/sales-comps" },
      { name: "Rate Comps", href: "/analysis/rate-comps" },
      { name: "Demographics", href: "/analysis/demographics" },
      { name: "Capital Markets", href: "/analysis/benchmarks" },
    ],
  },
  {
    label: "Prospecting & Marketing",
    icon: Megaphone,
    items: [
      { name: "Prospecting", href: "/prospecting" },
      { name: "Marketing Hub", href: "/marketing" },
      { name: "Campaigns", href: "/prospecting/campaigns" },
    ],
  },
  {
    label: "Documents",
    icon: FileText,
    items: [
      { name: "Document Studio", href: "/document-studio" },
      { name: "Template Gallery", href: "/document-studio/templates" },
    ],
  },
  {
    label: "Fund Management",
    icon: DollarSign,
    items: [
      { name: "Fund Dashboard", href: "/modeling/funds" },
      { name: "LP Portal", href: "/modeling/lp-portal" },
    ],
  },
  {
    label: "Network",
    icon: Target,
    items: [
      { name: "Vantage", href: "/vantage" },
      { name: "The Docket", href: "/docket" },
      { name: "Broker Directory", href: "/broker" },
    ],
  },
  {
    label: "Platform",
    icon: Plug,
    items: [
      { name: "Integrations", href: "/settings/integrations" },
      { name: "Settings", href: "/settings" },
    ],
  },
];

function MoreSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [location] = useLocation();
  const { user } = useAuth();

  const isActive = (href: string) =>
    location === href || location.startsWith(href + "/") || location.startsWith(href + "?");

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="bottom" className="h-[100dvh] flex flex-col p-0" aria-describedby={undefined}>
        <SheetHeader className="px-4 pt-4 pb-2 border-b border-border flex-shrink-0">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-base font-semibold">More</SheetTitle>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-accent transition-colors touch-manipulation"
              aria-label="Close"
            >
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto py-2">
          {MORE_SECTIONS.map((section) => {
            const Icon = section.icon;
            return (
              <div key={section.label} className="mb-1">
                <div className="flex items-center gap-2 px-4 py-2">
                  <Icon className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                    {section.label}
                  </span>
                </div>
                {section.items.map((item) => (
                  <Link key={item.name} href={item.href} onClick={onClose}>
                    <div
                      className={cn(
                        "flex items-center justify-between px-6 py-3 transition-colors touch-manipulation active:bg-accent/80",
                        isActive(item.href)
                          ? "bg-primary/10 text-primary font-medium"
                          : "text-foreground hover:bg-accent"
                      )}
                      style={{ minHeight: 44 }}
                    >
                      <span className="text-sm">{item.name}</span>
                      {isActive(item.href) && <ChevronRight className="w-3.5 h-3.5 text-primary" />}
                    </div>
                  </Link>
                ))}
              </div>
            );
          })}

          {user?.role === "owner" && (
            <div className="mb-1">
              <div className="flex items-center gap-2 px-4 py-2">
                <Shield className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Admin
                </span>
              </div>
              {[
                { name: "Customers", href: "/admin/customers" },
                { name: "Organizations", href: "/admin/organizations" },
                { name: "Data Sources", href: "/admin/data-sources" },
              ].map((item) => (
                <Link key={item.name} href={item.href} onClick={onClose}>
                  <div
                    className={cn(
                      "flex items-center justify-between px-6 py-3 transition-colors touch-manipulation active:bg-accent/80",
                      isActive(item.href)
                        ? "bg-primary/10 text-primary font-medium"
                        : "text-foreground hover:bg-accent"
                    )}
                    style={{ minHeight: 44 }}
                  >
                    <span className="text-sm">{item.name}</span>
                    {isActive(item.href) && <ChevronRight className="w-3.5 h-3.5 text-primary" />}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {user && (
          <div className="border-t border-border px-4 py-3 flex-shrink-0 safe-area-bottom">
            <UserMenu
              user={{
                id: user.id,
                name: user.name || user.email?.split("@")[0] || "User",
                email: user.email || "",
                avatarUrl: user.avatarUrl,
                orgId: user.orgId,
                ssoProvider: user.ssoProvider,
              }}
            />
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

export function MobileTopHeader() {
  const [location] = useLocation();
  const { user } = useAuth();
  const pageTitle = usePageTitle(location);

  const { data: bootstrapData } = useQuery<BootstrapData>({
    queryKey: ["/api/bootstrap"],
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const totalPending =
    (bootstrapData?.pendingCounts?.properties || 0) +
    (bootstrapData?.pendingCounts?.contacts || 0) +
    (bootstrapData?.pendingCounts?.companies || 0);

  const initials = user?.name
    ? user.name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)
    : user?.email?.[0]?.toUpperCase() || "U";

  return (
    <header className="fixed top-0 left-0 right-0 z-40 md:hidden bg-sidebar border-b border-sidebar-border shadow-sm safe-area-top">
      <div className="flex items-center justify-between px-4 h-12">
        {/* Left: page title */}
        <span className="text-[15px] font-semibold text-sidebar-foreground truncate max-w-[200px]">
          {pageTitle}
        </span>

        {/* Right: notification bell + avatar */}
        <div className="flex items-center gap-0.5">
          <button
            className="relative flex items-center justify-center rounded-lg hover:bg-sidebar-accent transition-colors touch-manipulation"
            style={{ minWidth: 44, minHeight: 44 }}
            aria-label="Notifications"
          >
            <Bell className="w-[18px] h-[18px] text-sidebar-foreground/70" />
            {totalPending > 0 && (
              <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-destructive rounded-full text-[9px] font-bold text-white flex items-center justify-center leading-none">
                {totalPending > 9 ? "9+" : totalPending}
              </span>
            )}
          </button>

          <button
            className="flex items-center justify-center rounded-lg hover:bg-sidebar-accent transition-colors touch-manipulation"
            style={{ minWidth: 44, minHeight: 44 }}
            aria-label="Account"
          >
            <Avatar className="w-7 h-7">
              {user?.avatarUrl && <AvatarImage src={user.avatarUrl} alt={user.name || "User"} />}
              <AvatarFallback className="text-[11px] font-semibold bg-primary text-primary-foreground">
                {initials}
              </AvatarFallback>
            </Avatar>
          </button>
        </div>
      </div>
    </header>
  );
}

const BOTTOM_TABS = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
    matchPrefixes: ["/dashboard"],
  },
  {
    label: "CRM",
    href: "/crm",
    icon: Users,
    matchPrefixes: ["/crm"],
  },
  {
    label: "Pipeline",
    href: "/pipeline/deal-board",
    icon: Handshake,
    matchPrefixes: ["/pipeline"],
  },
  {
    label: "Operations",
    href: "/portfolio",
    icon: Building2,
    matchPrefixes: ["/operations", "/portfolio", "/rent-roll"],
  },
];

export function MobileBottomNav() {
  const [location] = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);

  const isTabActive = (prefixes: string[]) =>
    prefixes.some(
      (p) => location === p || location.startsWith(p + "/") || location.startsWith(p + "?")
    );

  const moreActive =
    !isTabActive(BOTTOM_TABS.flatMap((t) => t.matchPrefixes)) &&
    location !== "/dashboard";

  return (
    <>
      <nav
        className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-sidebar border-t border-sidebar-border safe-area-bottom"
        data-testid="mobile-bottom-nav"
      >
        <div className="flex items-stretch h-16">
          {BOTTOM_TABS.map((tab) => {
            const active = isTabActive(tab.matchPrefixes);
            const Icon = tab.icon;
            return (
              <Link key={tab.label} href={tab.href} className="flex-1">
                <div
                  className={cn(
                    "relative flex flex-col items-center justify-center h-full gap-1 transition-colors touch-manipulation active:bg-sidebar-accent/50",
                    active
                      ? "text-primary"
                      : "text-sidebar-foreground/60 hover:text-sidebar-foreground"
                  )}
                  style={{ minWidth: 44 }}
                  data-testid={`tab-${tab.label.toLowerCase()}`}
                >
                  <Icon className={cn("w-5 h-5", active && "text-primary")} />
                  <span className={cn("text-[10px] font-medium leading-none", active && "text-primary")}>
                    {tab.label}
                  </span>
                  {active && (
                    <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-primary rounded-b-full" />
                  )}
                </div>
              </Link>
            );
          })}

          <button
            onClick={() => setMoreOpen(true)}
            className={cn(
              "flex-1 flex flex-col items-center justify-center gap-1 transition-colors touch-manipulation active:bg-sidebar-accent/50",
              moreActive
                ? "text-primary"
                : "text-sidebar-foreground/60 hover:text-sidebar-foreground"
            )}
            style={{ minWidth: 44 }}
            data-testid="tab-more"
            aria-label="More navigation options"
          >
            <MoreHorizontal className={cn("w-5 h-5", moreActive && "text-primary")} />
            <span className={cn("text-[10px] font-medium leading-none", moreActive && "text-primary")}>
              More
            </span>
          </button>
        </div>
      </nav>

      <MoreSheet open={moreOpen} onClose={() => setMoreOpen(false)} />
    </>
  );
}
