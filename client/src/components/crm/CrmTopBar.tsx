import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { SmartSearch } from "@/components/crm/panels/smart-search";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CrmTopBarProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  filters?: React.ReactNode;
  className?: string;
}

export function CrmTopBar({ title, subtitle, actions, filters, className }: CrmTopBarProps) {
  const [, setLocation] = useLocation();
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        e.stopImmediatePropagation();
        setSearchOpen((v) => !v);
      }
    };
    document.addEventListener("keydown", down, { capture: true });
    return () => document.removeEventListener("keydown", down, { capture: true });
  }, []);

  const handleSearchSelect = (result: { type: string; id: string }) => {
    const routes: Record<string, string> = {
      contact: `/crm/contacts/${result.id}`,
      company: `/crm/companies/${result.id}`,
      deal: `/crm/deals/${result.id}`,
      property: `/crm/properties/${result.id}`,
    };
    const route = routes[result.type];
    if (route) setLocation(route);
  };

  return (
    <div className={cn("flex-shrink-0 bg-white border-b border-gray-200", className)}>
      <div className="px-3 md:px-6 py-3 md:py-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="min-w-0">
            <h1 className="text-lg md:text-xl font-semibold text-gray-900 truncate">{title}</h1>
            {subtitle && <p className="text-xs md:text-sm text-gray-500 mt-0.5">{subtitle}</p>}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSearchOpen(true)}
              className="hidden md:flex items-center gap-2 w-52 justify-start text-gray-400 font-normal"
            >
              <Search className="h-3.5 w-3.5" />
              <span className="text-sm">Search CRM…</span>
              <kbd className="ml-auto pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border border-gray-200 bg-gray-100 px-1.5 font-mono text-[10px] font-medium text-gray-500">
                ⌘K
              </kbd>
            </Button>
            <Button variant="ghost" size="icon" onClick={() => setSearchOpen(true)} className="md:hidden">
              <Search className="h-4 w-4" />
            </Button>
            <SmartSearch
              onResultSelect={handleSearchSelect}
              open={searchOpen}
              onOpenChange={setSearchOpen}
            />
            {actions && <div className="flex items-center gap-2 overflow-x-auto">{actions}</div>}
          </div>
        </div>
        {filters && <div className="mt-3 md:mt-4 flex items-center gap-2 md:gap-3 overflow-x-auto pb-1">{filters}</div>}
      </div>
    </div>
  );
}
