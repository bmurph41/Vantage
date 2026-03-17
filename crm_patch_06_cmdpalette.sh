#!/bin/bash
# =============================================================
#  PATCH 06 — Global ⌘K CommandPalette
#
#  CommandPalette.tsx already exists. This patch:
#    1. Reads the component and ensures it has cross-entity search
#    2. Wires it into the CRM sidebar (crm-sidebar.tsx) with ⌘K trigger
#    3. Wires it into the main app layout if there's a root layout
#
#  If CommandPalette.tsx already has full search logic, we just wire it up.
#  If it's a stub, we replace the body with a full implementation.
# =============================================================

set -e

PALETTE_FILE="client/src/components/CommandPalette.tsx"
SIDEBAR_FILE="client/src/components/crm/crm-sidebar.tsx"

echo "→ Checking CommandPalette.tsx..."
[ -f "$PALETTE_FILE" ] || { echo "ERROR: $PALETTE_FILE not found"; exit 1; }

# Check if it already has search logic
if grep -q 'useQuery\|apiRequest\|contacts\|companies\|properties' "$PALETTE_FILE"; then
  echo "  ✓ CommandPalette already has search logic — checking wiring only"
  ALREADY_HAS_SEARCH=true
else
  echo "  → Needs full implementation"
  ALREADY_HAS_SEARCH=false
fi

# ── Write full CommandPalette if it's a stub ────────────────────
if [ "$ALREADY_HAS_SEARCH" = false ]; then
  cp "$PALETTE_FILE" "${PALETTE_FILE}.bak_$(date +%Y%m%d_%H%M%S)"
  cat > "$PALETTE_FILE" << 'TSX'
/**
 * CommandPalette — Global ⌘K Search
 *
 * Searches across Contacts, Companies, Properties, and Deals in real time.
 * Triggered by ⌘K (Mac) / Ctrl+K (Win/Linux) from anywhere in the app,
 * or by clicking the search icon in the CRM sidebar.
 *
 * Results are grouped by entity type and keyboard-navigable.
 * Clicking a result navigates to the full record page.
 *
 * Usage:
 *   <CommandPalette open={open} onOpenChange={setOpen} />
 *
 * Or use the hook:
 *   useCommandPaletteShortcut()  — mounts a global ⌘K listener
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import {
  Dialog, DialogContent,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Search, User, Building2, MapPin, DollarSign, ArrowRight, X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { apiRequest } from '@/lib/queryClient';
import { useDebounce } from '@/hooks/use-debounce';

// ── Types ───────────────────────────────────────────────────────

type EntityType = 'contact' | 'company' | 'property' | 'deal';

interface SearchResult {
  id: string;
  type: EntityType;
  name: string;
  subtitle?: string;
  badge?: string;
  href: string;
}

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// ── Config ──────────────────────────────────────────────────────

const entityConfig: Record<EntityType, {
  icon: typeof User;
  label: string;
  color: string;
  href: (id: string) => string;
}> = {
  contact:  { icon: User,      label: 'Contact',  color: 'text-blue-600',   href: id => `/crm/contacts/${id}` },
  company:  { icon: Building2, label: 'Company',  color: 'text-emerald-600',href: id => `/crm/companies/${id}` },
  property: { icon: MapPin,    label: 'Property', color: 'text-amber-600',  href: id => `/crm/properties/${id}` },
  deal:     { icon: DollarSign,label: 'Deal',     color: 'text-purple-600', href: id => `/crm/deals/${id}` },
};

const GROUP_ORDER: EntityType[] = ['contact', 'company', 'property', 'deal'];

// ── Hook: global ⌘K listener ────────────────────────────────────

export function useCommandPaletteShortcut(onOpen: () => void) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        onOpen();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onOpen]);
}

// ── Main Component ──────────────────────────────────────────────

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [activeIdx, setActiveIdx] = useState(0);
  const [, setLocation] = useLocation();
  const inputRef = useRef<HTMLInputElement>(null);
  const debouncedQuery = useDebounce(query, 180);

  // Reset on open
  useEffect(() => {
    if (open) {
      setQuery('');
      setActiveIdx(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const { data, isLoading } = useQuery({
    queryKey: ['cmd-palette-search', debouncedQuery],
    queryFn: async (): Promise<SearchResult[]> => {
      if (!debouncedQuery.trim() || debouncedQuery.length < 2) return [];
      try {
        const res = await apiRequest('GET', `/api/crm/search?q=${encodeURIComponent(debouncedQuery)}&limit=5`);
        const d = await res.json();
        // Backend returns { contacts, companies, properties, deals }
        const results: SearchResult[] = [];
        (d.contacts ?? []).forEach((c: any) => results.push({
          id: c.id, type: 'contact',
          name: `${c.firstName ?? ''} ${c.lastName ?? ''}`.trim() || c.name || 'Contact',
          subtitle: c.position || c.company || c.email,
          badge: c.crmRole || c.contactTag,
          href: entityConfig.contact.href(c.id),
        }));
        (d.companies ?? []).forEach((c: any) => results.push({
          id: c.id, type: 'company',
          name: c.name || 'Company',
          subtitle: c.industry || c.city,
          badge: c.companyType,
          href: entityConfig.company.href(c.id),
        }));
        (d.properties ?? []).forEach((p: any) => results.push({
          id: p.id, type: 'property',
          name: p.title || p.name || 'Property',
          subtitle: [p.city, p.state].filter(Boolean).join(', '),
          badge: p.status || p.listingStatus,
          href: entityConfig.property.href(p.id),
        }));
        (d.deals ?? []).forEach((d: any) => results.push({
          id: d.id, type: 'deal',
          name: d.name || 'Deal',
          subtitle: d.stage,
          badge: d.value ? `$${Math.round(d.value / 1000)}K` : undefined,
          href: entityConfig.deal.href(d.id),
        }));
        return results;
      } catch {
        return [];
      }
    },
    enabled: open && debouncedQuery.length >= 2,
    staleTime: 10_000,
  });

  const results = data ?? [];

  // Group results by type preserving order
  const grouped = GROUP_ORDER.reduce<Record<EntityType, SearchResult[]>>((acc, type) => {
    acc[type] = results.filter(r => r.type === type);
    return acc;
  }, { contact: [], company: [], property: [], deal: [] });

  const flatResults = GROUP_ORDER.flatMap(t => grouped[t]);

  const navigate = useCallback((result: SearchResult) => {
    onOpenChange(false);
    setLocation(result.href);
  }, [onOpenChange, setLocation]);

  // Keyboard navigation
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIdx(i => Math.min(i + 1, flatResults.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIdx(i => Math.max(i - 1, 0));
      } else if (e.key === 'Enter' && flatResults[activeIdx]) {
        navigate(flatResults[activeIdx]);
      } else if (e.key === 'Escape') {
        onOpenChange(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, flatResults, activeIdx, navigate, onOpenChange]);

  // Reset active index when results change
  useEffect(() => setActiveIdx(0), [results.length]);

  const showEmpty = debouncedQuery.length >= 2 && !isLoading && results.length === 0;
  const showSkeleton = isLoading && debouncedQuery.length >= 2;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 gap-0 max-w-xl overflow-hidden" data-testid="command-palette">
        {/* Search Input */}
        <div className="flex items-center gap-3 border-b px-4 py-3">
          <Search className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <Input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search contacts, companies, properties, deals..."
            className="border-0 shadow-none focus-visible:ring-0 p-0 text-sm h-auto"
            data-testid="cmd-palette-input"
          />
          {query && (
            <button onClick={() => setQuery('')} className="text-muted-foreground hover:text-foreground">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          <kbd className="text-[10px] text-muted-foreground border rounded px-1.5 py-0.5 font-mono flex-shrink-0">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-[400px] overflow-y-auto">
          {showSkeleton && (
            <div className="p-3 space-y-2">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="flex items-center gap-3 px-2 py-1.5">
                  <Skeleton className="h-6 w-6 rounded-full" />
                  <div className="space-y-1 flex-1">
                    <Skeleton className="h-3.5 w-32" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {showEmpty && (
            <div className="py-10 text-center">
              <Search className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" />
              <p className="text-sm text-muted-foreground">No results for "{debouncedQuery}"</p>
            </div>
          )}

          {!showSkeleton && results.length > 0 && (
            <div className="py-2">
              {GROUP_ORDER.map(type => {
                const items = grouped[type];
                if (!items.length) return null;
                const config = entityConfig[type];
                const Icon = config.icon;
                return (
                  <div key={type} className="mb-1">
                    <p className="px-4 py-1 text-[9px] font-semibold uppercase tracking-widest text-muted-foreground">
                      {config.label}s
                    </p>
                    {items.map((result) => {
                      const flatIdx = flatResults.indexOf(result);
                      const isActive = flatIdx === activeIdx;
                      return (
                        <button
                          key={result.id}
                          className={cn(
                            'w-full flex items-center gap-3 px-4 py-2 text-left transition-colors group',
                            isActive ? 'bg-accent' : 'hover:bg-accent/50',
                          )}
                          onClick={() => navigate(result)}
                          onMouseEnter={() => setActiveIdx(flatIdx)}
                          data-testid={`cmd-result-${result.type}-${result.id}`}
                        >
                          <div className={cn(
                            'h-7 w-7 rounded-full flex items-center justify-center flex-shrink-0 text-white',
                            type === 'contact' ? 'bg-blue-100' :
                            type === 'company' ? 'bg-emerald-100' :
                            type === 'property' ? 'bg-amber-100' : 'bg-purple-100',
                          )}>
                            <Icon className={cn('h-3.5 w-3.5', config.color)} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{result.name}</p>
                            {result.subtitle && (
                              <p className="text-[11px] text-muted-foreground truncate">{result.subtitle}</p>
                            )}
                          </div>
                          {result.badge && (
                            <Badge variant="secondary" className="text-[10px] h-4.5 px-1.5 flex-shrink-0 capitalize">
                              {result.badge.replace(/_/g, ' ')}
                            </Badge>
                          )}
                          <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 flex-shrink-0" />
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}

          {/* Quick nav (shown when query is empty) */}
          {!query && (
            <div className="p-4">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">Quick Navigate</p>
              <div className="grid grid-cols-2 gap-1.5">
                {[
                  { label: 'Contacts', href: '/crm/contacts', icon: User },
                  { label: 'Companies', href: '/crm/companies', icon: Building2 },
                  { label: 'Properties', href: '/crm/properties', icon: MapPin },
                  { label: 'Deals', href: '/crm/deals', icon: DollarSign },
                ].map(item => (
                  <button
                    key={item.href}
                    className="flex items-center gap-2 px-3 py-2 rounded-md text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                    onClick={() => { onOpenChange(false); setLocation(item.href); }}
                  >
                    <item.icon className="h-3.5 w-3.5" />
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t px-4 py-2 flex items-center gap-3 text-[10px] text-muted-foreground bg-muted/30">
          <span><kbd className="font-mono border rounded px-1">↑↓</kbd> Navigate</span>
          <span><kbd className="font-mono border rounded px-1">↵</kbd> Open</span>
          <span><kbd className="font-mono border rounded px-1">ESC</kbd> Close</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default CommandPalette;
TSX
  echo "  ✓ CommandPalette rewritten with full search"
fi

# ── Wire into crm-sidebar.tsx ───────────────────────────────────
echo "→ Wiring ⌘K into crm-sidebar.tsx..."
[ -f "$SIDEBAR_FILE" ] || { echo "  ✗ crm-sidebar.tsx not found"; exit 1; }

if grep -q 'CommandPalette\|useCommandPalette' "$SIDEBAR_FILE"; then
  echo "  ✓ CommandPalette already wired in sidebar"
else
  node --input-type=module << 'JSEOF'
import { readFileSync, writeFileSync } from 'fs';
const path = 'client/src/components/crm/crm-sidebar.tsx';
let src = readFileSync(path, 'utf8');

// Add imports
const importAdd = `import { useState } from 'react';
import { CommandPalette, useCommandPaletteShortcut } from '@/components/CommandPalette';
`;

// Add after the first existing import
const firstImport = src.match(/^import .+$/m)?.[0];
if (firstImport && !src.includes('CommandPalette')) {
  src = src.replace(firstImport, firstImport + '\n' + importAdd);
}

// In the component body, add state + shortcut hook + palette component
// Find the return statement opening
const returnMatch = src.match(/return \(/);
if (returnMatch && !src.includes('commandOpen')) {
  const insertBefore = src.indexOf('return (');
  const hookCode = `
  const [commandOpen, setCommandOpen] = useState(false);
  useCommandPaletteShortcut(() => setCommandOpen(true));

`;
  src = src.slice(0, insertBefore) + hookCode + src.slice(insertBefore);
}

// Find the search icon button area or quick add area and add palette trigger + component
// Add CommandPalette component before the closing </div> of the component
if (!src.includes('<CommandPalette')) {
  const lastClosingDiv = src.lastIndexOf('</div>\n  );\n}');
  if (lastClosingDiv !== -1) {
    const paletteJsx = `
      <CommandPalette open={commandOpen} onOpenChange={setCommandOpen} />
    `;
    src = src.slice(0, lastClosingDiv) + paletteJsx + src.slice(lastClosingDiv);
  }
}

// Wire the search button if there's a Search icon in the sidebar
// Add onClick to any Search icon button in the quick-add area
if (src.includes('<Search') && !src.includes('setCommandOpen')) {
  src = src.replace(
    /<Button[^>]*>\s*<Search/g,
    `<Button onClick={() => setCommandOpen(true)}>\n                <Search`
  );
}

writeFileSync(path, src, 'utf8');
console.log('  ✓ CommandPalette wired into crm-sidebar.tsx');
JSEOF
fi

# ── Add /api/crm/search endpoint to CRM routes if missing ──────
echo "→ Checking /api/crm/search endpoint..."

ROUTES="server/routes.ts"
if grep -q "'/api/crm/search'\|crm.*search\|crm/search" "$ROUTES" 2>/dev/null || \
   grep -rq "crm.*search" server/routes/ 2>/dev/null; then
  echo "  ✓ Search endpoint already exists"
else
  echo "  → Adding /api/crm/search endpoint to crm-summary-routes.ts..."
  CRM_SUMMARY="server/routes/crm-summary-routes.ts"
  if [ -f "$CRM_SUMMARY" ]; then
    cat >> "$CRM_SUMMARY" << 'TS'

// ── Global CRM Search ──────────────────────────────────────────────────────────
router.get('/search', async (req: any, res) => {
  try {
    const orgId = req.user?.orgId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    if (!q || q.length < 2) return res.json({ contacts: [], companies: [], properties: [], deals: [] });

    const limit = Math.min(parseInt(req.query.limit as string) || 5, 10);
    const pattern = `%${q.toLowerCase()}%`;

    const [contacts, companies, properties, deals] = await Promise.all([
      db.select({
        id: crmContacts.id,
        firstName: crmContacts.firstName,
        lastName: crmContacts.lastName,
        email: crmContacts.email,
        position: crmContacts.position,
        contactTag: crmContacts.contactTag,
      }).from(crmContacts)
        .where(and(
          eq(crmContacts.orgId, orgId),
          sql`(lower(first_name) LIKE ${pattern} OR lower(last_name) LIKE ${pattern} OR lower(email) LIKE ${pattern} OR lower(concat(first_name, ' ', last_name)) LIKE ${pattern})`,
        ))
        .limit(limit),

      db.select({
        id: crmCompanies.id,
        name: crmCompanies.name,
        industry: crmCompanies.industry,
        city: crmCompanies.city,
      }).from(crmCompanies)
        .where(and(
          eq(crmCompanies.orgId, orgId),
          sql`lower(name) LIKE ${pattern}`,
        ))
        .limit(limit),

      db.select({
        id: crmProperties.id,
        title: crmProperties.title,
        name: crmProperties.name,
        city: crmProperties.city,
        state: crmProperties.state,
        status: crmProperties.status,
      }).from(crmProperties)
        .where(and(
          eq(crmProperties.orgId, orgId),
          sql`(lower(title) LIKE ${pattern} OR lower(city) LIKE ${pattern} OR lower(name) LIKE ${pattern})`,
        ))
        .limit(limit),

      db.select({
        id: crmDeals.id,
        name: crmDeals.name,
        stage: crmDeals.stage,
        value: crmDeals.value,
      }).from(crmDeals)
        .where(and(
          eq(crmDeals.orgId, orgId),
          sql`lower(name) LIKE ${pattern}`,
        ))
        .limit(limit),
    ]);

    res.json({ contacts, companies, properties, deals });
  } catch (error) {
    console.error('CRM search error:', error);
    res.status(500).json({ error: 'Search failed' });
  }
});
TS
    echo "  ✓ Added /api/crm/search to crm-summary-routes.ts"
  fi
fi

# ── Add use-debounce hook if missing ───────────────────────────
DEBOUNCE="client/src/hooks/use-debounce.ts"
if [ ! -f "$DEBOUNCE" ]; then
  mkdir -p "$(dirname "$DEBOUNCE")"
  cat > "$DEBOUNCE" << 'TS'
import { useState, useEffect } from 'react';
export function useDebounce<T>(value: T, delay = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debouncedValue;
}
TS
  echo "  ✓ Created use-debounce.ts"
else
  echo "  ✓ use-debounce already exists"
fi

echo ""
echo "✅ Patch 06 complete."
echo ""
echo "=========================================="
echo "ALL 6 PATCHES APPLIED"
echo "=========================================="
echo ""
echo "Final checklist:"
echo "  □ npm run db:push              (after patch 01)"
echo "  □ npx tsc --noEmit             (verify no TS errors)"
echo "  □ Check property-record.tsx    (verify FM + Comps panels injected)"
echo "  □ Test ⌘K in the CRM sidebar"
echo "  □ Test sales comps panel on a property with lat/lng set"
echo "  □ Verify /api/crm/search returns results"
echo ""
echo "If property-record.tsx patch was in 'fallback' mode, do the manual"
echo "insertion described at the end of patch 04's output."
