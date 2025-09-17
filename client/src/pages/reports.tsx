import { useState } from "react";
import { cn } from "@/lib/utils";
import { 
  Printer, 
  Download, 
  Settings, 
  FileText, 
  Palette, 
  Monitor,
  Eye,
  EyeOff,
  ChevronDown
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

// Report Components
import ReportLayout from "@/components/report/ReportLayout";
import ReportCover from "@/components/report/ReportCover";
import ExecutiveSummary from "@/components/report/templates/ExecutiveSummary";
import InvestmentHighlights from "@/components/report/templates/InvestmentHighlights";
import PropertyOverview from "@/components/report/templates/PropertyOverview";
import LocationMarket from "@/components/report/templates/LocationMarket";
import FinancialSummary from "@/components/report/templates/FinancialSummary";
import Photos from "@/components/report/templates/Photos";
import AerialsAndMaps from "@/components/report/templates/AerialsAndMaps";
import Disclaimers from "@/components/report/templates/Disclaimers";

// Demo Data
import { demoOfferingMemorandum } from "@/data/demoReport";
import type { AccentColor } from "@/theme/reportTheme";

interface ReportSettings {
  accentColor: AccentColor;
  pageSize: "letter" | "a4";
  showCoverPage: boolean;
  showSensitiveData: boolean;
  fontScale: number;
  spacingScale: number;
  showPreview: boolean;
}

const defaultSettings: ReportSettings = {
  accentColor: "emerald",
  pageSize: "letter", 
  showCoverPage: true,
  showSensitiveData: true,
  fontScale: 1.0,
  spacingScale: 1.0,
  showPreview: true,
};

export default function ReportsPage() {
  const [settings, setSettings] = useState<ReportSettings>(defaultSettings);
  const [activeSection, setActiveSection] = useState<string>("all");
  const [isSettingsExpanded, setIsSettingsExpanded] = useState(false);
  
  const updateSetting = <K extends keyof ReportSettings>(
    key: K,
    value: ReportSettings[K]
  ) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExportPDF = () => {
    // In a real app, this would trigger PDF generation
    window.print();
  };

  const sections = [
    { id: "cover", name: "Cover Page", component: "cover" },
    { id: "executive", name: "Executive Summary", component: ExecutiveSummary },
    { id: "highlights", name: "Investment Highlights", component: InvestmentHighlights },
    { id: "property", name: "Property Overview", component: PropertyOverview },
    { id: "location", name: "Location & Market", component: LocationMarket },
    { id: "financial", name: "Financial Summary", component: FinancialSummary },
    { id: "photos", name: "Photos", component: Photos },
    { id: "maps", name: "Aerials & Maps", component: AerialsAndMaps },
    { id: "disclaimers", name: "Disclaimers", component: Disclaimers },
  ];

  const visibleSections = sections.filter(section => {
    if (!settings.showCoverPage && section.id === "cover") return false;
    return true;
  });

  return (
    <div className="min-h-screen bg-neutral-50" data-testid="reports-page">
      {/* Header */}
      <div className="bg-white border-b border-neutral-200 print:hidden">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-neutral-900" data-testid="page-title">
                Offering Memorandum Reports
              </h1>
              <p className="text-neutral-600 mt-1">
                Professional commercial real estate investment marketing materials
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                <FileText className="w-3 h-3 mr-1" />
                Demo Report
              </Badge>
              <Button
                onClick={handlePrint}
                variant="outline"
                size="sm"
                data-testid="button-print"
              >
                <Printer className="w-4 h-4 mr-2" />
                Print
              </Button>
              <Button
                onClick={handleExportPDF}
                size="sm"
                data-testid="button-export-pdf"
              >
                <Download className="w-4 h-4 mr-2" />
                Export PDF
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-4 print:p-0 print:max-w-none">
        <div className="flex gap-6 print:gap-0">
          {/* Settings Panel */}
          <div className="w-80 print:hidden">
            <Card className="sticky top-4">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">Report Settings</CardTitle>
                    <CardDescription>Customize appearance and format</CardDescription>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsSettingsExpanded(!isSettingsExpanded)}
                    data-testid="button-settings-toggle"
                  >
                    <Settings className="w-4 h-4" />
                  </Button>
                </div>
              </CardHeader>
              
              <CardContent className="space-y-6">
                {/* Quick Actions */}
                <div className="space-y-3">
                  <h4 className="font-medium text-neutral-900">Quick Actions</h4>
                  <div className="space-y-2">
                    <Button
                      onClick={handlePrint}
                      variant="outline"
                      size="sm"
                      className="w-full"
                      data-testid="settings-print"
                    >
                      <Printer className="w-4 h-4 mr-2" />
                      Print Report
                    </Button>
                    <Button
                      onClick={handleExportPDF}
                      variant="outline" 
                      size="sm"
                      className="w-full"
                      data-testid="settings-export"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Export PDF
                    </Button>
                  </div>
                </div>

                <Separator />

                {/* Style Settings */}
                <div className="space-y-4">
                  <h4 className="font-medium text-neutral-900 flex items-center gap-2">
                    <Palette className="w-4 h-4" />
                    Styling
                  </h4>
                  
                  <div className="space-y-3">
                    <div>
                      <label className="text-sm font-medium text-neutral-700">Accent Color</label>
                      <Select
                        value={settings.accentColor}
                        onValueChange={(value: AccentColor) => updateSetting("accentColor", value)}
                      >
                        <SelectTrigger className="w-full mt-1" data-testid="select-accent-color">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="emerald">Emerald Green</SelectItem>
                          <SelectItem value="blue">Professional Blue</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <label className="text-sm font-medium text-neutral-700">Page Size</label>
                      <Select
                        value={settings.pageSize}
                        onValueChange={(value: "letter" | "a4") => updateSetting("pageSize", value)}
                      >
                        <SelectTrigger className="w-full mt-1" data-testid="select-page-size">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="letter">Letter (8.5" x 11")</SelectItem>
                          <SelectItem value="a4">A4 (210mm x 297mm)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Content Settings */}
                <div className="space-y-4">
                  <h4 className="font-medium text-neutral-900 flex items-center gap-2">
                    <Monitor className="w-4 h-4" />
                    Content
                  </h4>
                  
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium text-neutral-700">Cover Page</label>
                      <Switch
                        checked={settings.showCoverPage}
                        onCheckedChange={(checked) => updateSetting("showCoverPage", checked)}
                        data-testid="toggle-cover-page"
                      />
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium text-neutral-700">Financial Data</label>
                      <Switch
                        checked={settings.showSensitiveData}
                        onCheckedChange={(checked) => updateSetting("showSensitiveData", checked)}
                        data-testid="toggle-sensitive-data"
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium text-neutral-700">Preview Mode</label>
                      <Switch
                        checked={settings.showPreview}
                        onCheckedChange={(checked) => updateSetting("showPreview", checked)}
                        data-testid="toggle-preview"
                      />
                    </div>
                  </div>
                </div>

                {/* Advanced Settings */}
                <Collapsible open={isSettingsExpanded} onOpenChange={setIsSettingsExpanded}>
                  <CollapsibleTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full justify-between p-0 h-auto"
                      data-testid="advanced-settings-trigger"
                    >
                      <span className="text-sm font-medium">Advanced Settings</span>
                      <ChevronDown className={cn(
                        "w-4 h-4 transition-transform",
                        isSettingsExpanded && "rotate-180"
                      )} />
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-4 mt-4">
                    <div>
                      <label className="text-sm font-medium text-neutral-700">Font Scale</label>
                      <Select
                        value={settings.fontScale.toString()}
                        onValueChange={(value) => updateSetting("fontScale", parseFloat(value))}
                      >
                        <SelectTrigger className="w-full mt-1" data-testid="select-font-scale">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="0.8">Small (80%)</SelectItem>
                          <SelectItem value="0.9">Compact (90%)</SelectItem>
                          <SelectItem value="1.0">Normal (100%)</SelectItem>
                          <SelectItem value="1.1">Large (110%)</SelectItem>
                          <SelectItem value="1.2">Extra Large (120%)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <label className="text-sm font-medium text-neutral-700">Spacing</label>
                      <Select
                        value={settings.spacingScale.toString()}
                        onValueChange={(value) => updateSetting("spacingScale", parseFloat(value))}
                      >
                        <SelectTrigger className="w-full mt-1" data-testid="select-spacing">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="0.8">Compact</SelectItem>
                          <SelectItem value="1.0">Normal</SelectItem>
                          <SelectItem value="1.2">Relaxed</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </CollapsibleContent>
                </Collapsible>

                <Separator />

                {/* Section Navigation */}
                <div className="space-y-3">
                  <h4 className="font-medium text-neutral-900">Sections</h4>
                  <Tabs value={activeSection} onValueChange={setActiveSection} orientation="vertical">
                    <TabsList className="grid w-full grid-cols-1 h-auto p-1">
                      <TabsTrigger value="all" className="text-xs py-2" data-testid="nav-all-sections">
                        All Sections
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>
                  
                  <div className="space-y-1">
                    {visibleSections.map((section) => (
                      <button
                        key={section.id}
                        onClick={() => {
                          const element = document.getElementById(`section-${section.id}`);
                          element?.scrollIntoView({ behavior: 'smooth' });
                        }}
                        className={cn(
                          "w-full text-left px-3 py-2 text-xs rounded-md transition-colors",
                          "hover:bg-neutral-100 text-neutral-600 hover:text-neutral-900"
                        )}
                        data-testid={`nav-${section.id}`}
                      >
                        {section.name}
                      </button>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Report Content */}
          <div className="flex-1 print:w-full">
            <div className={cn(
              "transition-all duration-300",
              settings.showPreview && "print:shadow-none shadow-lg"
            )}>
              <ReportLayout
                accentColor={settings.accentColor}
                pageSize={settings.pageSize}
                style={{
                  fontSize: `${settings.fontScale * 100}%`,
                  "--spacing-scale": settings.spacingScale.toString(),
                } as React.CSSProperties}
                data-testid="report-layout"
              >
                {/* Cover Page */}
                {settings.showCoverPage && (
                  <div id="section-cover" className="print:break-after-page">
                    <ReportCover 
                      title={demoOfferingMemorandum.title}
                      subtitle={demoOfferingMemorandum.subtitle}
                      heroImage={demoOfferingMemorandum.images.find(img => img.category === "exterior")?.url}
                      heroImageAlt={demoOfferingMemorandum.images.find(img => img.category === "exterior")?.caption}
                      badges={[
                        { text: "Investment Opportunity", variant: "default" },
                        { text: demoOfferingMemorandum.property.propertyType.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()), variant: "secondary" },
                        { text: `${demoOfferingMemorandum.property.totalUnits} Units`, variant: "outline" }
                      ]}
                    />
                  </div>
                )}

                {/* Executive Summary */}
                <div id="section-executive" className="print:break-before-page">
                  <ExecutiveSummary data={demoOfferingMemorandum} />
                </div>

                {/* Investment Highlights */}
                <div id="section-highlights" className="print:break-before-page">
                  <InvestmentHighlights data={demoOfferingMemorandum} />
                </div>

                {/* Property Overview */}
                <div id="section-property" className="print:break-before-page">
                  <PropertyOverview data={demoOfferingMemorandum} />
                </div>

                {/* Location & Market */}
                <div id="section-location" className="print:break-before-page">
                  <LocationMarket data={demoOfferingMemorandum} />
                </div>

                {/* Financial Summary */}
                {settings.showSensitiveData && (
                  <div id="section-financial" className="print:break-before-page">
                    <FinancialSummary data={demoOfferingMemorandum} />
                  </div>
                )}

                {/* Photos */}
                <div id="section-photos" className="print:break-before-page">
                  <Photos data={demoOfferingMemorandum} />
                </div>

                {/* Aerials & Maps */}
                <div id="section-maps" className="print:break-before-page">
                  <AerialsAndMaps data={demoOfferingMemorandum} />
                </div>

                {/* Disclaimers */}
                <div id="section-disclaimers" className="print:break-before-page">
                  <Disclaimers data={demoOfferingMemorandum} />
                </div>
              </ReportLayout>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}