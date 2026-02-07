import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { 
  FileText, 
  Building2, 
  DollarSign, 
  BarChart3, 
  Settings, 
  Download, 
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Clock
} from "lucide-react";

interface OMTemplate {
  id: string;
  name: string;
  scope: string;
  category: string | null;
}

interface OMData {
  dealId: string;
  dealName: string;
  propertyOverview: {
    name: string;
    address: string | null;
    city: string | null;
    state: string | null;
    zipCode: string | null;
    totalSlips: number | null;
    wetSlips: number | null;
    drySlips: number | null;
    askingPrice: number | null;
    yearBuilt: number | null;
    waterFrontage: number | null;
    acreage: number | null;
    amenities: string[];
    description: string | null;
  };
  financialSummary: {
    purchasePrice: number | null;
    noiEstimate: number | null;
    capRate: number | null;
    revenueProjections: {
      year1: number | null;
      year2: number | null;
      year3: number | null;
    };
    operatingExpenses: number | null;
    debtService: number | null;
    cashOnCash: number | null;
    irr: number | null;
  };
  rentRoll: {
    totalUnits: number;
    occupiedUnits: number;
    vacantUnits: number;
    occupancyRate: number;
    totalAnnualRevenue: number;
    avgRentPerSlip: number;
    byType: {
      type: string;
      count: number;
      avgRent: number;
      totalRent: number;
    }[];
  };
  operations: {
    fuelSalesAnnual: number | null;
    shipStoreSalesAnnual: number | null;
    serviceRevenue: number | null;
    otherRevenue: number | null;
    seasonalFactors: string | null;
    staffCount: number | null;
    managementNotes: string | null;
  };
  generatedAt: string;
}

interface OMDocument {
  id: string;
  dealId: string;
  templateId: string | null;
  title: string;
  generatedAt: string;
  pdfUrl: string | null;
  status: 'draft' | 'generating' | 'completed' | 'failed';
  metadata: Record<string, any>;
}

function formatCurrency(value: number | null | undefined): string {
  if (value == null) return 'N/A';
  return new Intl.NumberFormat('en-US', { 
    style: 'currency', 
    currency: 'USD',
    maximumFractionDigits: 0 
  }).format(value);
}

function formatPercent(value: number | null | undefined): string {
  if (value == null) return 'N/A';
  return `${value.toFixed(1)}%`;
}

function formatNumber(value: number | null | undefined): string {
  if (value == null) return 'N/A';
  return new Intl.NumberFormat('en-US').format(value);
}

interface OMBuilderProps {
  dealId: string;
}

export default function OMBuilder({ dealId }: OMBuilderProps) {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [documentTitle, setDocumentTitle] = useState<string>("");

  const { data: templates, isLoading: templatesLoading } = useQuery<OMTemplate[]>({
    queryKey: ['/api/om-builder/templates'],
  });

  const { data: omData, isLoading: dataLoading, refetch: refetchData } = useQuery<OMData>({
    queryKey: ['/api/om-builder', dealId, 'data'],
    enabled: !!dealId,
  });

  const { data: documents, isLoading: documentsLoading } = useQuery<OMDocument[]>({
    queryKey: ['/api/om-builder', dealId, 'documents'],
    enabled: !!dealId,
  });

  const generateMutation = useMutation({
    mutationFn: async (data: { templateId: string | null; title: string }) => {
      return apiRequest('POST', `/api/om-builder/${dealId}/generate`, data);
    },
    onSuccess: () => {
      toast({
        title: "OM Generated",
        description: "Your Offering Memorandum has been created successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/om-builder', dealId, 'documents'] });
      setDocumentTitle("");
    },
    onError: (error: any) => {
      toast({
        title: "Generation Failed",
        description: error.message || "Failed to generate OM document.",
        variant: "destructive",
      });
    },
  });

  const exportPdfMutation = useMutation({
    mutationFn: async (documentId: string) => {
      return apiRequest('POST', `/api/om-builder/documents/${documentId}/export-pdf`);
    },
    onSuccess: (data: any) => {
      toast({
        title: "PDF Export Ready",
        description: "Your PDF has been generated.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/om-builder', dealId, 'documents'] });
    },
    onError: (error: any) => {
      toast({
        title: "Export Failed",
        description: error.message || "Failed to export PDF.",
        variant: "destructive",
      });
    },
  });

  const handleGenerate = () => {
    if (!documentTitle.trim()) {
      toast({
        title: "Title Required",
        description: "Please enter a title for the OM document.",
        variant: "destructive",
      });
      return;
    }
    generateMutation.mutate({
      templateId: selectedTemplateId || null,
      title: documentTitle.trim(),
    });
  };

  const getStatusBadge = (status: OMDocument['status']) => {
    switch (status) {
      case 'completed':
        return <Badge variant="default" className="bg-green-500"><CheckCircle className="h-3 w-3 mr-1" />Completed</Badge>;
      case 'generating':
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Generating</Badge>;
      case 'failed':
        return <Badge variant="destructive"><AlertCircle className="h-3 w-3 mr-1" />Failed</Badge>;
      default:
        return <Badge variant="outline">Draft</Badge>;
    }
  };

  if (dataLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileText className="h-6 w-6" />
            Investment Materials
          </h1>
          <p className="text-muted-foreground">
            {omData?.dealName || 'Create professional offering memorandums'}
          </p>
        </div>
        <Button variant="outline" onClick={() => refetchData()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh Data
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Generate New OM</CardTitle>
          <CardDescription>Select a template and configure your offering memorandum</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="template">Template</Label>
              <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a template" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">Default Template</SelectItem>
                  {templates?.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="title">Document Title</Label>
              <Input
                id="title"
                value={documentTitle}
                onChange={(e) => setDocumentTitle(e.target.value)}
                placeholder="Enter document title"
              />
            </div>
            <div className="flex items-end">
              <Button 
                onClick={handleGenerate} 
                disabled={generateMutation.isPending || !documentTitle.trim()}
                className="w-full"
              >
                {generateMutation.isPending ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <FileText className="h-4 w-4 mr-2" />
                    Generate OM
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="grid grid-cols-5 w-full max-w-2xl">
          <TabsTrigger value="overview" className="flex items-center gap-1">
            <Building2 className="h-4 w-4" />
            <span className="hidden sm:inline">Property</span>
          </TabsTrigger>
          <TabsTrigger value="financial" className="flex items-center gap-1">
            <DollarSign className="h-4 w-4" />
            <span className="hidden sm:inline">Financial</span>
          </TabsTrigger>
          <TabsTrigger value="rentroll" className="flex items-center gap-1">
            <BarChart3 className="h-4 w-4" />
            <span className="hidden sm:inline">Rent Roll</span>
          </TabsTrigger>
          <TabsTrigger value="operations" className="flex items-center gap-1">
            <Settings className="h-4 w-4" />
            <span className="hidden sm:inline">Operations</span>
          </TabsTrigger>
          <TabsTrigger value="documents" className="flex items-center gap-1">
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">Documents</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <Card>
            <CardHeader>
              <CardTitle>Property Overview</CardTitle>
              <CardDescription>Key property information for the offering memorandum</CardDescription>
            </CardHeader>
            <CardContent>
              {omData?.propertyOverview ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Property Name</p>
                    <p className="font-medium">{omData.propertyOverview.name}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Location</p>
                    <p className="font-medium">
                      {[omData.propertyOverview.city, omData.propertyOverview.state].filter(Boolean).join(', ') || 'N/A'}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Asking Price</p>
                    <p className="font-medium">{formatCurrency(omData.propertyOverview.askingPrice)}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Total Slips</p>
                    <p className="font-medium">{formatNumber(omData.propertyOverview.totalSlips)}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Wet Slips</p>
                    <p className="font-medium">{formatNumber(omData.propertyOverview.wetSlips)}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Dry Slips</p>
                    <p className="font-medium">{formatNumber(omData.propertyOverview.drySlips)}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Water Frontage</p>
                    <p className="font-medium">{omData.propertyOverview.waterFrontage ? `${formatNumber(omData.propertyOverview.waterFrontage)} ft` : 'N/A'}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Year Built</p>
                    <p className="font-medium">{omData.propertyOverview.yearBuilt || 'N/A'}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Acreage</p>
                    <p className="font-medium">{omData.propertyOverview.acreage ? `${omData.propertyOverview.acreage} acres` : 'N/A'}</p>
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground">No property data available</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="financial">
          <Card>
            <CardHeader>
              <CardTitle>Financial Summary</CardTitle>
              <CardDescription>Investment metrics and projections</CardDescription>
            </CardHeader>
            <CardContent>
              {omData?.financialSummary ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Purchase Price</p>
                    <p className="font-medium text-lg">{formatCurrency(omData.financialSummary.purchasePrice)}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">NOI Estimate</p>
                    <p className="font-medium text-lg">{formatCurrency(omData.financialSummary.noiEstimate)}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Cap Rate</p>
                    <p className="font-medium text-lg">{formatPercent(omData.financialSummary.capRate)}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Cash-on-Cash</p>
                    <p className="font-medium text-lg">{formatPercent(omData.financialSummary.cashOnCash)}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">IRR</p>
                    <p className="font-medium">{formatPercent(omData.financialSummary.irr)}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Operating Expenses</p>
                    <p className="font-medium">{formatCurrency(omData.financialSummary.operatingExpenses)}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Debt Service</p>
                    <p className="font-medium">{formatCurrency(omData.financialSummary.debtService)}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Year 1 Revenue</p>
                    <p className="font-medium">{formatCurrency(omData.financialSummary.revenueProjections.year1)}</p>
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground">No financial data available</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rentroll">
          <Card>
            <CardHeader>
              <CardTitle>Rent Roll Summary</CardTitle>
              <CardDescription>Occupancy and revenue breakdown</CardDescription>
            </CardHeader>
            <CardContent>
              {omData?.rentRoll ? (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Total Units</p>
                      <p className="font-medium text-2xl">{formatNumber(omData.rentRoll.totalUnits)}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Occupancy Rate</p>
                      <p className="font-medium text-2xl">{formatPercent(omData.rentRoll.occupancyRate)}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Annual Revenue</p>
                      <p className="font-medium text-2xl">{formatCurrency(omData.rentRoll.totalAnnualRevenue)}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Avg Rent/Slip</p>
                      <p className="font-medium text-2xl">{formatCurrency(omData.rentRoll.avgRentPerSlip)}</p>
                    </div>
                  </div>
                  
                  {omData.rentRoll.byType.length > 0 && (
                    <div>
                      <h4 className="font-medium mb-3">By Unit Type</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {omData.rentRoll.byType.map((type) => (
                          <div key={type.type} className="p-3 bg-muted rounded-lg">
                            <p className="font-medium capitalize">{type.type}</p>
                            <div className="text-sm text-muted-foreground mt-1">
                              <p>{type.count} units</p>
                              <p>Avg: {formatCurrency(type.avgRent)}/mo</p>
                              <p>Total: {formatCurrency(type.totalRent)}/mo</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-muted-foreground">No rent roll data available</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="operations">
          <Card>
            <CardHeader>
              <CardTitle>Operations Summary</CardTitle>
              <CardDescription>Ancillary revenue and operational details</CardDescription>
            </CardHeader>
            <CardContent>
              {omData?.operations ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Fuel Sales (Annual)</p>
                    <p className="font-medium">{formatCurrency(omData.operations.fuelSalesAnnual)}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Ship Store Sales (Annual)</p>
                    <p className="font-medium">{formatCurrency(omData.operations.shipStoreSalesAnnual)}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Service Revenue</p>
                    <p className="font-medium">{formatCurrency(omData.operations.serviceRevenue)}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Other Revenue</p>
                    <p className="font-medium">{formatCurrency(omData.operations.otherRevenue)}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Staff Count</p>
                    <p className="font-medium">{omData.operations.staffCount || 'N/A'}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Seasonal Factors</p>
                    <p className="font-medium">{omData.operations.seasonalFactors || 'N/A'}</p>
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground">No operations data available</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documents">
          <Card>
            <CardHeader>
              <CardTitle>Generated Documents</CardTitle>
              <CardDescription>Previously generated OM documents</CardDescription>
            </CardHeader>
            <CardContent>
              {documentsLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              ) : documents && documents.length > 0 ? (
                <div className="space-y-3">
                  {documents.map((doc) => (
                    <div key={doc.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-4">
                        <FileText className="h-8 w-8 text-muted-foreground" />
                        <div>
                          <p className="font-medium">{doc.title}</p>
                          <p className="text-sm text-muted-foreground">
                            Generated {new Date(doc.generatedAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {getStatusBadge(doc.status)}
                        {doc.status === 'completed' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => exportPdfMutation.mutate(doc.id)}
                            disabled={exportPdfMutation.isPending}
                          >
                            <Download className="h-4 w-4 mr-1" />
                            Export PDF
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-8">No documents generated yet</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
