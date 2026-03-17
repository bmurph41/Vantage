#!/bin/bash
# =============================================================
#  PATCH: Properties — Listing Status as Primary Filter + Badge
#  Touches 2 files:
#    1. properties.tsx      — status filter expanded + prominent badge
#    2. property-record.tsx — listingStatus field + header badge
# =============================================================
set -e

echo "=== Patching properties.tsx ==="
node --input-type=module << 'JS'
import { readFileSync, writeFileSync } from 'fs';
const path = 'client/src/pages/properties.tsx';
let src = readFileSync(path, 'utf8');

if (src.includes('listingStatusColors') || src.includes('under_loi')) {
  console.log('  ✓ Already patched'); process.exit(0);
}

// 1. Add listing status color map after existing statusColors
const statusColorsAnchor = `const statusColors: Record<string, string> = {`;
// Find the full statusColors block and add listingStatusColors after it
const statusColorsEnd = src.indexOf('};', src.indexOf(statusColorsAnchor)) + 2;
const insertAfterStatusColors = `
const listingStatusColors: Record<string, string> = {
  off_market:      'bg-gray-100 text-gray-700 border-gray-300',
  on_market:       'bg-green-100 text-green-800 border-green-300',
  under_loi:       'bg-amber-100 text-amber-800 border-amber-300',
  under_contract:  'bg-blue-100 text-blue-800 border-blue-300',
  closed:          'bg-purple-100 text-purple-800 border-purple-300',
  portfolio:       'bg-teal-100 text-teal-800 border-teal-300',
  watchlist:       'bg-orange-100 text-orange-800 border-orange-300',
  // Legacy values
  available:       'bg-green-100 text-green-800 border-green-300',
  sold:            'bg-purple-100 text-purple-800 border-purple-300',
};

const listingStatusLabels: Record<string, string> = {
  off_market: 'Off Market',
  on_market: 'On Market',
  under_loi: 'Under LOI',
  under_contract: 'Under Contract',
  closed: 'Closed',
  portfolio: 'Portfolio',
  watchlist: 'Watchlist',
  available: 'Available',
  sold: 'Sold',
};

`;
src = src.slice(0, statusColorsEnd) + insertAfterStatusColors + src.slice(statusColorsEnd);

// 2. Update the status column render to use the new color map and show a prominent badge
const statusColRender = `      key: 'status',
      header: 'Status',`;
// Find and update the status column render
const statusColIdx = src.indexOf(statusColRender);
if (statusColIdx !== -1) {
  // Find the render function for status column — look for the render after sortValue
  const statusRenderAnchor = `      sortValue: (property) => property.status,`;
  const statusRenderIdx = src.indexOf(statusRenderAnchor, statusColIdx);
  if (statusRenderIdx !== -1) {
    // Find the next render: line
    const renderAnchor = `      render: (property)`;
    const renderIdx = src.indexOf(renderAnchor, statusRenderIdx);
    if (renderIdx !== -1) {
      // Find the end of this render function (next '},')
      const renderEnd = src.indexOf('\n      },', renderIdx);
      if (renderEnd !== -1) {
        const newRender = `      render: (property) => {
        const status = (property as any).listingStatus || property.status;
        return (
          <Badge
            variant="outline"
            className={\`text-xs font-medium \${listingStatusColors[status] || 'bg-gray-100 text-gray-700'}\`}
          >
            {listingStatusLabels[status] || status?.replace(/_/g, ' ') || '—'}
          </Badge>
        );
      }`;
        src = src.slice(0, renderIdx) + newRender + src.slice(renderEnd);
      }
    }
  }
}

// 3. Expand the statusFilter Select to include all listing status values
// Find the status filter Select and replace its items
const statusSelectAnchor = src.indexOf('<Select value={statusFilter}');
if (statusSelectAnchor !== -1) {
  // Find the SelectContent closing
  const selectContentEnd = src.indexOf('</Select>', statusSelectAnchor) + 9;
  const oldSelect = src.slice(statusSelectAnchor, selectContentEnd);
  const newSelect = `<Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-8 w-40 text-xs" data-testid="select-status-filter">
            <SelectValue placeholder="Listing Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="off_market">Off Market</SelectItem>
            <SelectItem value="on_market">On Market</SelectItem>
            <SelectItem value="under_loi">Under LOI</SelectItem>
            <SelectItem value="under_contract">Under Contract</SelectItem>
            <SelectItem value="closed">Closed</SelectItem>
            <SelectItem value="portfolio">Portfolio</SelectItem>
            <SelectItem value="watchlist">Watchlist</SelectItem>
          </SelectContent>
        </Select>`;
  src = src.slice(0, statusSelectAnchor) + newSelect + src.slice(selectContentEnd);
  console.log('  ✓ Expanded status filter Select');
}

// 4. Update filteredProperties matchesStatus to check listingStatus first
src = src.replace(
  `const matchesStatus = statusFilter === 'all' || property.status === statusFilter;`,
  `const matchesStatus = statusFilter === 'all' ||
        (property as any).listingStatus === statusFilter ||
        property.status === statusFilter;`
);

// 5. Update the summary stats to include listing status counts
src = src.replace(
  `const available = properties.filter(p => p.status === 'available').length;
  const underContract = properties.filter(p => p.status === 'under_contract').length;`,
  `const available = properties.filter(p => p.status === 'available' || (p as any).listingStatus === 'on_market').length;
  const underContract = properties.filter(p => p.status === 'under_contract' || (p as any).listingStatus === 'under_contract' || (p as any).listingStatus === 'under_loi').length;`
);

writeFileSync(path, src, 'utf8');
console.log('  ✓ properties.tsx patched');
JS

echo ""
echo "=== Patching property-record.tsx ==="
node --input-type=module << 'JS'
import { readFileSync, writeFileSync } from 'fs';
const path = 'client/src/pages/property-record.tsx';
let src = readFileSync(path, 'utf8');

if (src.includes('listingStatus?: string') || src.includes('listingStatusColors')) {
  console.log('  ✓ Already patched'); process.exit(0);
}

// 1. Add listingStatus to PropertyRecord interface
const interfaceAnchor = `  rollups?: { lastActivityAt?: string; nextActivityAt?: string; openDealsCount?: number; engagementScore30d?: number };`;
const newField = `  rollups?: { lastActivityAt?: string; nextActivityAt?: string; openDealsCount?: number; engagementScore30d?: number };
  listingStatus?: string | null;
  latitude?: string | null;
  longitude?: string | null;`;
src = src.replace(interfaceAnchor, newField);

// 2. Add listing status color map after existing statusColors
const statusColorsAnchor = `const statusColors: Record<string, string> = {`;
const statusColorsEnd = src.indexOf('};', src.indexOf(statusColorsAnchor)) + 2;
const newColorMap = `
const listingStatusConfig: Record<string, { label: string; cls: string }> = {
  off_market:     { label: 'Off Market',      cls: 'bg-gray-100 text-gray-700 border-gray-300' },
  on_market:      { label: 'On Market',       cls: 'bg-green-100 text-green-800 border-green-300' },
  under_loi:      { label: 'Under LOI',       cls: 'bg-amber-100 text-amber-800 border-amber-300' },
  under_contract: { label: 'Under Contract',  cls: 'bg-blue-100 text-blue-800 border-blue-300' },
  closed:         { label: 'Closed',          cls: 'bg-purple-100 text-purple-800 border-purple-300' },
  portfolio:      { label: 'Portfolio',       cls: 'bg-teal-100 text-teal-800 border-teal-300' },
  watchlist:      { label: 'Watchlist',       cls: 'bg-orange-100 text-orange-800 border-orange-300' },
  available:      { label: 'Available',       cls: 'bg-green-100 text-green-800 border-green-300' },
  sold:           { label: 'Sold',            cls: 'bg-purple-100 text-purple-800 border-purple-300' },
};

`;
src = src.slice(0, statusColorsEnd) + newColorMap + src.slice(statusColorsEnd);

// 3. Replace the header status display to use listingStatus if available
// Current: status={property?.status ? fmtLabel(property.status) : undefined}
// New: prefer listingStatus, fall back to status
const headerStatusAnchor = `      status={property?.status ? fmtLabel(property.status) : undefined}
      statusColor={property?.status ? statusColors[property.status.toLowerCase()] || 'bg-gray-100 text-gray-700' : undefined}`;
const newHeaderStatus = `      status={(() => {
        const ls = property?.listingStatus || property?.status;
        const cfg = ls ? listingStatusConfig[ls] : null;
        return cfg ? cfg.label : ls ? fmtLabel(ls) : undefined;
      })()}
      statusColor={(() => {
        const ls = property?.listingStatus || property?.status;
        const cfg = ls ? listingStatusConfig[ls] : null;
        return cfg ? cfg.cls : ls ? statusColors[ls.toLowerCase()] || 'bg-gray-100 text-gray-700' : undefined;
      })()}`;
src = src.replace(headerStatusAnchor, newHeaderStatus);

// 4. Add listingStatus to KPI chips if not already showing asking price
const kpiAnchor = `  const kpiChips = property ? [`;
const newKpiChips = `  // Listing status chip for prominence
  const listingStatusChip = property?.listingStatus
    ? {
        label: 'Listing',
        value: listingStatusConfig[property.listingStatus]?.label || property.listingStatus.replace(/_/g, ' '),
        icon: Tag,
        color: property.listingStatus === 'on_market' ? 'text-green-600'
          : property.listingStatus === 'under_loi' ? 'text-amber-600'
          : property.listingStatus === 'under_contract' ? 'text-blue-600'
          : 'text-gray-500',
      }
    : null;

  const kpiChips = property ? [
    ...(listingStatusChip ? [listingStatusChip] : []),`;
src = src.replace(kpiAnchor, newKpiChips);

// 5. Wire latitude/longitude into the PropertyCompsPanel if it's already there
// Find PropertyCompsPanel usage and update to use property.latitude/longitude
if (src.includes('PropertyCompsPanel')) {
  // Check if it already has latitude wired up
  if (!src.includes('property.latitude')) {
    src = src.replace(
      `latitude={property.latitude ? Number(property.latitude) : null}`,
      `latitude={property.latitude ? Number(property.latitude) : null}`
    );
    // It already has the right form from patch 04, leave it
  }
  console.log('  ✓ PropertyCompsPanel already present');
}

writeFileSync(path, src, 'utf8');
console.log('  ✓ property-record.tsx patched');
JS

echo ""
echo "✅ Properties listing status patch complete."
echo ""
echo "What was added:"
echo "  • properties.tsx:"
echo "    — Status filter now shows: Off Market / On Market / Under LOI /"
echo "      Under Contract / Closed / Portfolio / Watchlist"
echo "    — Status column badge uses new color-coded listing status labels"
echo "    — filteredProperties checks listingStatus first, falls back to status"
echo ""
echo "  • property-record.tsx:"
echo "    — listingStatus field added to interface"
echo "    — Header status badge uses listingStatus with full color coding"
echo "    — Listing status appears as first KPI chip for prominence"
echo ""
echo "Restart: pkill -f 'tsx server' && npm run dev"
