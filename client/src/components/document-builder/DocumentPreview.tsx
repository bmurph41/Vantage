/**
 * DocumentPreview Component
 * Renders a live preview of the document with all sections and content blocks
 */

import * as React from 'react';
import { cn } from '@/lib/utils';
import { useDocumentBuilderStore } from '@/stores/document-builder-store';
import {
  MetricTile,
  MetricGrid,
  DataTable,
  PropertyCard,
  ChartPlaceholder,
  MapPlaceholder,
  TextBlock,
  BulletList,
  HighlightBox,
  SectionDivider,
  MarinaMetrics,
  InvestmentMetrics,
} from './ContentBlocks';
import { CompletionIndicator } from './CompletionIndicator';
import type { DocumentSection, SectionDefinition } from '@shared/document-builder/types';
import {
  Building2,
  BarChart3,
  FileText,
  MapPin,
  DollarSign,
  TrendingUp,
  Users,
  Shield,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  ZoomIn,
  ZoomOut,
  Maximize2,
} from 'lucide-react';

// =============================================================================
// Types
// =============================================================================

export interface DocumentPreviewProps {
  className?: string;
  scale?: number;
  showPageBreaks?: boolean;
  showSectionLabels?: boolean;
  showEmptySections?: boolean;
  interactive?: boolean;
  onSectionClick?: (sectionId: number) => void;
}

interface SectionRendererProps {
  section: DocumentSection;
  definition: SectionDefinition | null;
  isSelected?: boolean;
  showLabel?: boolean;
  showEmpty?: boolean;
  onClick?: () => void;
}

// =============================================================================
// Section Icon Mapping
// =============================================================================

const SECTION_ICONS: Record<string, React.ReactNode> = {
  cover: <Building2 className="w-5 h-5" />,
  executive_summary: <FileText className="w-5 h-5" />,
  investment_highlights: <TrendingUp className="w-5 h-5" />,
  property_overview: <Building2 className="w-5 h-5" />,
  location_analysis: <MapPin className="w-5 h-5" />,
  market_overview: <BarChart3 className="w-5 h-5" />,
  financial_summary: <DollarSign className="w-5 h-5" />,
  rent_roll_summary: <Users className="w-5 h-5" />,
  underwriting_assumptions: <TrendingUp className="w-5 h-5" />,
  risk_assessment: <Shield className="w-5 h-5" />,
  due_diligence_checklist: <AlertTriangle className="w-5 h-5" />,
};

// =============================================================================
// Section Renderer Component
// =============================================================================

function SectionRenderer({
  section,
  definition,
  isSelected,
  showLabel,
  showEmpty,
  onClick,
}: SectionRendererProps) {
  const { content, dataBindings, media, enabled, customTitle } = section;
  const sectionTitle = customTitle || definition?.title || section.sectionKey;

  // Check if section has content
  const hasContent = Object.keys(content || {}).length > 0 ||
    Object.keys(dataBindings || {}).length > 0 ||
    Object.keys(media || {}).length > 0;

  if (!enabled) return null;
  if (!hasContent && !showEmpty) return null;

  // Get resolved values from bindings
  const getValue = (key: string): any => {
    if (content?.[key] !== undefined) return content[key];
    if (dataBindings?.[key]?.resolvedValue !== undefined) return dataBindings[key].resolvedValue;
    return null;
  };

  const getMedia = (key: string): string | null => {
    return media?.[key]?.url || null;
  };

  // Render section content based on section key
  const renderSectionContent = () => {
    switch (section.sectionKey) {
      case 'cover':
        return <CoverSection section={section} getValue={getValue} getMedia={getMedia} />;
      case 'executive_summary':
        return <ExecutiveSummarySection section={section} getValue={getValue} />;
      case 'investment_highlights':
        return <InvestmentHighlightsSection section={section} getValue={getValue} />;
      case 'property_overview':
        return <PropertyOverviewSection section={section} getValue={getValue} getMedia={getMedia} />;
      case 'location_analysis':
        return <LocationAnalysisSection section={section} getValue={getValue} getMedia={getMedia} />;
      case 'market_overview':
        return <MarketOverviewSection section={section} getValue={getValue} />;
      case 'financial_summary':
        return <FinancialSummarySection section={section} getValue={getValue} />;
      case 'rent_roll_summary':
        return <RentRollSummarySection section={section} getValue={getValue} />;
      case 'underwriting_assumptions':
        return <UnderwritingSection section={section} getValue={getValue} />;
      case 'risk_assessment':
        return <RiskAssessmentSection section={section} getValue={getValue} />;
      default:
        return <GenericSection section={section} getValue={getValue} getMedia={getMedia} />;
    }
  };

  return (
    <div
      className={cn(
        'relative group',
        isSelected && 'ring-2 ring-primary ring-offset-2',
        onClick && 'cursor-pointer hover:ring-1 hover:ring-primary/50'
      )}
      onClick={onClick}
    >
      {showLabel && (
        <div className="absolute -top-8 left-0 flex items-center gap-2 px-2 py-1 bg-primary text-primary-foreground text-xs rounded-t z-10 opacity-0 group-hover:opacity-100 transition-opacity">
          {SECTION_ICONS[section.sectionKey]}
          <span>{sectionTitle}</span>
          {!hasContent && <span className="text-primary-foreground/60">(Empty)</span>}
        </div>
      )}
      
      {hasContent ? (
        renderSectionContent()
      ) : (
        <div className="p-8 border-2 border-dashed border-muted-foreground/30 rounded-lg text-center text-muted-foreground">
          <p className="font-medium">{sectionTitle}</p>
          <p className="text-sm mt-1">No content yet. Add data bindings or generate with AI.</p>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Section-Specific Components
// =============================================================================

interface SectionProps {
  section: DocumentSection;
  getValue: (key: string) => any;
  getMedia?: (key: string) => string | null;
}

function CoverSection({ section, getValue, getMedia }: SectionProps) {
  const propertyName = getValue('propertyName') || 'Property Name';
  const location = getValue('location') || getValue('city') || 'Location';
  const heroImage = getMedia?.('hero_image');
  const companyLogo = getMedia?.('company_logo');
  const tagline = getValue('tagline');

  return (
    <div className="relative aspect-[8.5/11] bg-gradient-to-br from-slate-900 to-slate-800 text-white overflow-hidden rounded-lg">
      {/* Background Image */}
      {heroImage && (
        <div className="absolute inset-0">
          <img src={heroImage} alt={propertyName} className="w-full h-full object-cover opacity-50" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30" />
        </div>
      )}

      {/* Logo */}
      {companyLogo && (
        <div className="absolute top-8 right-8">
          <img src={companyLogo} alt="Company Logo" className="h-12 w-auto" />
        </div>
      )}

      {/* Content */}
      <div className="absolute bottom-0 left-0 right-0 p-12">
        <p className="text-sm uppercase tracking-widest text-white/60 mb-2">Offering Memorandum</p>
        <h1 className="text-5xl font-bold tracking-tight mb-4">{propertyName}</h1>
        <div className="flex items-center gap-2 text-xl text-white/80">
          <MapPin className="w-5 h-5" />
          <span>{location}</span>
        </div>
        {tagline && <p className="mt-4 text-lg text-white/70">{tagline}</p>}
      </div>
    </div>
  );
}

function ExecutiveSummarySection({ section, getValue }: SectionProps) {
  const summary = getValue('executive_summary') || getValue('summary');
  const propertyName = getValue('propertyName');
  const askingPrice = getValue('askingPrice');
  const capRate = getValue('capRate');
  const noi = getValue('noi');

  return (
    <div className="space-y-6">
      <SectionDivider title="Executive Summary" icon={<FileText className="w-6 h-6" />} />
      
      {summary && <TextBlock content={summary} variant="lead" />}

      {(askingPrice || capRate || noi) && (
        <MetricGrid
          metrics={[
            ...(askingPrice ? [{ label: 'Asking Price', value: askingPrice, format: 'currency' as const, variant: 'primary' as const }] : []),
            ...(noi ? [{ label: 'NOI', value: noi, format: 'currency' as const }] : []),
            ...(capRate ? [{ label: 'Cap Rate', value: capRate, format: 'percent' as const }] : []),
          ]}
          columns={3}
        />
      )}
    </div>
  );
}

function InvestmentHighlightsSection({ section, getValue }: SectionProps) {
  const highlights = getValue('highlights') || getValue('investment_highlights') || [];
  const highlightsList = Array.isArray(highlights) ? highlights : [highlights].filter(Boolean);

  return (
    <div className="space-y-6">
      <SectionDivider title="Investment Highlights" icon={<TrendingUp className="w-6 h-6" />} />
      
      {highlightsList.length > 0 ? (
        <BulletList items={highlightsList} variant="check" columns={2} />
      ) : (
        <div className="text-muted-foreground text-center py-8">
          <p>No investment highlights added yet.</p>
        </div>
      )}
    </div>
  );
}

function PropertyOverviewSection({ section, getValue, getMedia }: SectionProps) {
  const propertyName = getValue('propertyName');
  const address = getValue('address');
  const city = getValue('city');
  const state = getValue('state');
  const description = getValue('description') || getValue('property_description');
  const totalSlips = getValue('totalSlips');
  const wetSlips = getValue('wetSlips');
  const dryStorage = getValue('dryStorage') || getValue('drySlips');
  const occupancy = getValue('occupancy');
  const amenities = getValue('amenities') || [];
  const propertyImage = getMedia?.('property_photo') || getMedia?.('aerial_photo');

  return (
    <div className="space-y-6">
      <SectionDivider title="Property Overview" icon={<Building2 className="w-6 h-6" />} />

      <div className="grid md:grid-cols-2 gap-6">
        {/* Property Image */}
        <div className="aspect-video bg-muted rounded-lg overflow-hidden">
          {propertyImage ? (
            <img src={propertyImage} alt={propertyName || 'Property'} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground">
              <Building2 className="w-12 h-12" />
            </div>
          )}
        </div>

        {/* Property Details */}
        <div className="space-y-4">
          <div>
            <h3 className="font-semibold text-lg">{propertyName || 'Property Name'}</h3>
            <p className="text-muted-foreground">
              {[address, city, state].filter(Boolean).join(', ') || 'Location not specified'}
            </p>
          </div>

          {description && <TextBlock content={description} />}

          {(amenities.length > 0) && (
            <div>
              <p className="font-medium text-sm mb-2">Amenities</p>
              <div className="flex flex-wrap gap-2">
                {amenities.map((amenity: string, idx: number) => (
                  <span key={idx} className="px-2 py-1 bg-muted rounded text-sm">{amenity}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Marina Metrics */}
      {(totalSlips || occupancy) && (
        <MarinaMetrics
          totalSlips={totalSlips || 0}
          wetSlips={wetSlips}
          dryStorage={dryStorage}
          occupancy={occupancy || 0}
        />
      )}
    </div>
  );
}

function LocationAnalysisSection({ section, getValue, getMedia }: SectionProps) {
  const location = getValue('location') || getValue('city');
  const locationDescription = getValue('location_description') || getValue('location_analysis');
  const mapImage = getMedia?.('location_map');
  const nearbyAttractions = getValue('nearbyAttractions') || [];
  const accessPoints = getValue('accessPoints') || [];

  return (
    <div className="space-y-6">
      <SectionDivider title="Location Analysis" icon={<MapPin className="w-6 h-6" />} />

      <div className="grid md:grid-cols-2 gap-6">
        {/* Map */}
        {mapImage ? (
          <img src={mapImage} alt="Location Map" className="rounded-lg" />
        ) : (
          <MapPlaceholder title="Location Map" address={location} />
        )}

        {/* Location Details */}
        <div className="space-y-4">
          {locationDescription && <TextBlock content={locationDescription} />}

          {nearbyAttractions.length > 0 && (
            <div>
              <p className="font-medium text-sm mb-2">Nearby Attractions</p>
              <BulletList items={nearbyAttractions} variant="arrow" />
            </div>
          )}

          {accessPoints.length > 0 && (
            <div>
              <p className="font-medium text-sm mb-2">Access Points</p>
              <BulletList items={accessPoints} variant="check" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MarketOverviewSection({ section, getValue }: SectionProps) {
  const marketOverview = getValue('market_overview') || getValue('market_analysis');
  const population = getValue('population');
  const medianIncome = getValue('medianIncome');
  const employmentGrowth = getValue('employmentGrowth');
  const boatRegistrations = getValue('boatRegistrations');

  return (
    <div className="space-y-6">
      <SectionDivider title="Market Overview" icon={<BarChart3 className="w-6 h-6" />} />

      {marketOverview && <TextBlock content={marketOverview} />}

      <MetricGrid
        metrics={[
          ...(population ? [{ label: 'Population', value: population, format: 'number' as const }] : []),
          ...(medianIncome ? [{ label: 'Median Household Income', value: medianIncome, format: 'currency' as const }] : []),
          ...(employmentGrowth ? [{ label: 'Employment Growth', value: employmentGrowth, format: 'percent' as const, trend: employmentGrowth > 0 ? 'up' as const : 'down' as const }] : []),
          ...(boatRegistrations ? [{ label: 'Boat Registrations', value: boatRegistrations, format: 'number' as const }] : []),
        ]}
        columns={4}
      />

      <ChartPlaceholder type="bar" title="Market Trends" description="Historical and projected market data" />
    </div>
  );
}

function FinancialSummarySection({ section, getValue }: SectionProps) {
  const financialSummary = getValue('financial_summary') || getValue('financial_analysis');
  const askingPrice = getValue('askingPrice');
  const noi = getValue('noi');
  const capRate = getValue('capRate');
  const pricePerSlip = getValue('pricePerSlip');
  const irr = getValue('irr');
  const cashOnCash = getValue('cashOnCash');

  return (
    <div className="space-y-6">
      <SectionDivider title="Financial Summary" icon={<DollarSign className="w-6 h-6" />} />

      <InvestmentMetrics
        askingPrice={askingPrice || 0}
        noi={noi}
        capRate={capRate}
        pricePerSlip={pricePerSlip}
        irr={irr}
        cashOnCash={cashOnCash}
      />

      {financialSummary && <TextBlock content={financialSummary} />}

      <div className="grid md:grid-cols-2 gap-6">
        <ChartPlaceholder type="bar" title="Revenue Breakdown" />
        <ChartPlaceholder type="pie" title="Operating Expenses" />
      </div>
    </div>
  );
}

function RentRollSummarySection({ section, getValue }: SectionProps) {
  const totalUnits = getValue('totalUnits') || getValue('totalSlips');
  const occupiedUnits = getValue('occupiedUnits');
  const vacantUnits = getValue('vacantUnits');
  const occupancyRate = getValue('occupancyRate') || getValue('occupancy');
  const avgRent = getValue('avgRent') || getValue('avgSlipRate');
  const totalRevenue = getValue('totalRevenue') || getValue('totalAnnualRevenue');
  const rentRollData = getValue('rentRollData') || [];

  return (
    <div className="space-y-6">
      <SectionDivider title="Rent Roll Summary" icon={<Users className="w-6 h-6" />} />

      <MetricGrid
        metrics={[
          { label: 'Total Units', value: totalUnits || 0, format: 'number' },
          { label: 'Occupied', value: occupiedUnits || 0, format: 'number' },
          { label: 'Vacant', value: vacantUnits || 0, format: 'number' },
          { label: 'Occupancy Rate', value: occupancyRate || 0, format: 'percent' },
          { label: 'Average Rent', value: avgRent || 0, format: 'currency' },
          { label: 'Annual Revenue', value: totalRevenue || 0, format: 'currency' },
        ]}
        columns={3}
      />

      {rentRollData.length > 0 && (
        <DataTable
          caption="Rent Roll by Unit Type"
          columns={[
            { key: 'type', label: 'Type' },
            { key: 'count', label: 'Count', align: 'right' },
            { key: 'avgRent', label: 'Avg Rent', format: 'currency', align: 'right' },
            { key: 'totalRent', label: 'Total', format: 'currency', align: 'right' },
          ]}
          data={rentRollData}
        />
      )}
    </div>
  );
}

function UnderwritingSection({ section, getValue }: SectionProps) {
  const assumptions = getValue('underwriting_assumptions') || getValue('assumptions');
  const holdPeriod = getValue('holdPeriod');
  const exitCapRate = getValue('exitCapRate');
  const revenueGrowth = getValue('revenueGrowth');
  const expenseGrowth = getValue('expenseGrowth');

  return (
    <div className="space-y-6">
      <SectionDivider title="Underwriting Assumptions" icon={<TrendingUp className="w-6 h-6" />} />

      <MetricGrid
        metrics={[
          ...(holdPeriod ? [{ label: 'Hold Period', value: holdPeriod, suffix: ' years' }] : []),
          ...(exitCapRate ? [{ label: 'Exit Cap Rate', value: exitCapRate, format: 'percent' as const }] : []),
          ...(revenueGrowth ? [{ label: 'Revenue Growth', value: revenueGrowth, format: 'percent' as const }] : []),
          ...(expenseGrowth ? [{ label: 'Expense Growth', value: expenseGrowth, format: 'percent' as const }] : []),
        ]}
        columns={4}
      />

      {assumptions && <TextBlock content={assumptions} />}

      <ChartPlaceholder type="line" title="Cash Flow Projections" height={200} />
    </div>
  );
}

function RiskAssessmentSection({ section, getValue }: SectionProps) {
  const riskAssessment = getValue('risk_assessment');
  const risks = getValue('risks') || [];
  const mitigations = getValue('mitigations') || [];

  return (
    <div className="space-y-6">
      <SectionDivider title="Risk Assessment" icon={<Shield className="w-6 h-6" />} />

      {riskAssessment && <TextBlock content={riskAssessment} />}

      {risks.length > 0 && (
        <HighlightBox
          title="Key Risks"
          variant="warning"
          icon={<AlertTriangle className="w-5 h-5" />}
          content={<BulletList items={risks} variant="disc" />}
        />
      )}

      {mitigations.length > 0 && (
        <HighlightBox
          title="Mitigating Factors"
          variant="success"
          icon={<Shield className="w-5 h-5" />}
          content={<BulletList items={mitigations} variant="check" />}
        />
      )}
    </div>
  );
}

function GenericSection({ section, getValue, getMedia }: SectionProps) {
  const content = section.content || {};
  const bindings = section.dataBindings || {};
  
  // Collect all values
  const allValues = { ...content };
  Object.entries(bindings).forEach(([key, binding]) => {
    if (binding.resolvedValue !== undefined) {
      allValues[key] = binding.resolvedValue;
    }
  });

  if (Object.keys(allValues).length === 0) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        <p>Section: {section.sectionKey}</p>
        <p className="text-sm mt-1">No content configured</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-lg capitalize">
        {section.customTitle || section.sectionKey.replace(/_/g, ' ')}
      </h3>
      <div className="space-y-2">
        {Object.entries(allValues).map(([key, value]) => (
          <div key={key}>
            <span className="text-sm text-muted-foreground capitalize">{key.replace(/_/g, ' ')}: </span>
            <span>{typeof value === 'object' ? JSON.stringify(value) : String(value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// =============================================================================
// Main DocumentPreview Component
// =============================================================================

export function DocumentPreview({
  className,
  scale = 1,
  showPageBreaks = true,
  showSectionLabels = true,
  showEmptySections = false,
  interactive = true,
  onSectionClick,
}: DocumentPreviewProps) {
  const { document, sectionLibrary, selectedSectionId, selectSection } = useDocumentBuilderStore();
  const [localScale, setLocalScale] = React.useState(scale);

  if (!document) {
    return (
      <div className={cn('flex items-center justify-center h-full text-muted-foreground', className)}>
        <p>No document loaded</p>
      </div>
    );
  }

  const enabledSections = document.sections
    .filter((s) => s.enabled)
    .sort((a, b) => a.order - b.order);

  const handleSectionClick = (sectionId: number) => {
    if (interactive) {
      selectSection(sectionId);
      onSectionClick?.(sectionId);
    }
  };

  return (
    <div className={cn('relative', className)}>
      {/* Preview Controls */}
      <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-2 bg-background/95 backdrop-blur border-b">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Eye className="w-4 h-4" />
          <span>Preview</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="p-1.5 hover:bg-muted rounded"
            onClick={() => setLocalScale((s) => Math.max(0.25, s - 0.1))}
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="text-sm w-12 text-center">{Math.round(localScale * 100)}%</span>
          <button
            className="p-1.5 hover:bg-muted rounded"
            onClick={() => setLocalScale((s) => Math.min(2, s + 0.1))}
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            className="p-1.5 hover:bg-muted rounded"
            onClick={() => setLocalScale(1)}
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Document Preview Area */}
      <div className="overflow-auto p-8 bg-muted/30 min-h-[600px]">
        <div
          className="mx-auto bg-white shadow-lg rounded-lg overflow-hidden"
          style={{
            transform: `scale(${localScale})`,
            transformOrigin: 'top center',
            width: 816, // Letter size: 8.5" x 11" at 96 DPI
            marginBottom: (1 - localScale) * -400, // Adjust container height
          }}
        >
          <div className="p-8 space-y-8">
            {enabledSections.map((section, index) => (
              <React.Fragment key={section.id}>
                <SectionRenderer
                  section={section}
                  definition={sectionLibrary[section.sectionKey] || null}
                  isSelected={selectedSectionId === section.id}
                  showLabel={showSectionLabels}
                  showEmpty={showEmptySections}
                  onClick={() => handleSectionClick(section.id)}
                />
                
                {showPageBreaks && index < enabledSections.length - 1 && (
                  <div className="border-t-2 border-dashed border-muted-foreground/20 my-8 relative">
                    <span className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white px-3 text-xs text-muted-foreground">
                      Page Break
                    </span>
                  </div>
                )}
              </React.Fragment>
            ))}

            {enabledSections.length === 0 && (
              <div className="py-16 text-center text-muted-foreground">
                <FileText className="w-16 h-16 mx-auto mb-4 opacity-30" />
                <p className="text-lg font-medium">No sections enabled</p>
                <p className="text-sm mt-1">Add sections to see a preview of your document</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default DocumentPreview;
