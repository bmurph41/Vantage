import { useQuery } from "@tanstack/react-query";
import { fetchCategoryDistribution } from "../lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Link, useLocation } from "wouter";

interface SidebarProps {
  selectedCategories: string[];
  onCategoryToggle: (category: string) => void;
  onClearCategories: () => void;
  showBookmarked: boolean;
  onBookmarkedChange: (show: boolean) => void;
}

const CATEGORY_ICONS: Record<string, string> = {
  "Macro": "fas fa-chart-line",
  "M&A": "fas fa-handshake",
  "Development": "fas fa-hammer",
  "Operations": "fas fa-cogs",
  "Regulatory": "fas fa-gavel",
  "Environmental": "fas fa-leaf",
  "Technology": "fas fa-microchip",
  "Boat Show": "fas fa-calendar-alt",
  "Manufacturing": "fas fa-industry",
  "People Moves": "fas fa-users",
  "Company Earnings": "fas fa-chart-bar",
  "Awards": "fas fa-trophy",
  "Business Planning": "fas fa-briefcase",
  "General": "fas fa-newspaper"
};

const CATEGORY_COLORS: Record<string, string> = {
  "Macro": "text-yellow-600",
  "M&A": "text-orange-600",
  "Development": "text-purple-600", 
  "Operations": "text-blue-600",
  "Regulatory": "text-red-600",
  "Environmental": "text-green-700",
  "Technology": "text-indigo-600",
  "Boat Show": "text-pink-600",
  "Manufacturing": "text-slate-600",
  "People Moves": "text-teal-600",
  "Company Earnings": "text-emerald-600",
  "Awards": "text-amber-600",
  "Business Planning": "text-violet-600",
  "General": "text-gray-600"
};

export default function Sidebar({ 
  selectedCategories = [], 
  onCategoryToggle,
  onClearCategories,
  showBookmarked, 
  onBookmarkedChange 
}: SidebarProps) {
  const [location] = useLocation();
  const { data: categories = [] } = useQuery({
    queryKey: ['/api/docket/analytics/categories'],
    queryFn: fetchCategoryDistribution,
    refetchInterval: 5 * 60 * 1000,
  });

  const navigationItems = [
    {
      label: "All Articles",
      icon: "fas fa-home",
      href: "/docket",
      active: location === "/docket" && selectedCategories.length === 0 && !showBookmarked,
      testId: "nav-all-articles"
    },
    {
      label: "Market Intelligence",
      icon: "fas fa-chart-line",
      href: "/docket/market-intelligence",
      active: location === "/docket/market-intelligence",
      testId: "nav-market-intelligence"
    },
    {
      label: "M&A Spotlight",
      icon: "fas fa-handshake",
      href: "/docket/m&a-spotlight",
      active: location === "/docket/m&a-spotlight",
      testId: "nav-m&a-spotlight"
    },
    {
      label: "High Relevance",
      icon: "fas fa-star",
      href: "/docket?filter=high-relevance",
      active: false,
      testId: "nav-high-relevance"
    },
    {
      label: "Recent Updates",
      icon: "fas fa-clock",
      href: "/docket?filter=recent",
      active: false,
      testId: "nav-recent"
    },
    {
      label: "Saved Articles",
      icon: "fas fa-bookmark",
      href: "/docket/saved",
      active: location === "/docket/saved",
      testId: "nav-saved"
    }
  ];

  return (
    <div className="w-64 bg-card border-r border-border flex-shrink-0">
      <div className="p-4">
        {/* Navigation */}
        <div className="space-y-1">
          {navigationItems.map((item) => (
            <Link key={item.label} href={item.href}>
              <Button
                variant={item.active ? "default" : "ghost"}
                className="w-full justify-start"
                data-testid={item.testId}
              >
                <i className={cn(item.icon, "mr-3 text-sm")}></i>
                {item.label}
              </Button>
            </Link>
          ))}
        </div>

      </div>
    </div>
  );
}
