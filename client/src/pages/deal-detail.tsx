import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  ArrowLeft, 
  DollarSign, 
  Calendar, 
  User, 
  Building, 
  Target,
  Clock,
  Edit,
  Trash2,
  Anchor,
  MapPin,
  FileText,
  FolderOpen
} from "lucide-react";
import type { Deal, Contact, Company } from "@shared/schema";
import ConvertToProjectModal from "@/components/modals/convert-to-project-modal";

// Deal with relations type
type DealWithRelations = Deal & { 
  contact?: Contact | null; 
  company?: Company | null; 
};

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function getStageColor(stage: string): string {
  const stageColors: Record<string, string> = {
    'lead': 'bg-gray-100 text-gray-800',
    'qualified': 'bg-blue-100 text-blue-800',
    'proposal': 'bg-yellow-100 text-yellow-800',
    'negotiation': 'bg-orange-100 text-orange-800',
    'closed_won': 'bg-green-100 text-green-800',
    'closed_lost': 'bg-red-100 text-red-800',
    'Under Contract': 'bg-purple-100 text-purple-800',
    'Closed': 'bg-green-100 text-green-800',
  };
  
  return stageColors[stage] || 'bg-gray-100 text-gray-800';
}

function getPriorityColor(priority: string): string {
  const priorityColors: Record<string, string> = {
    'low': 'bg-gray-100 text-gray-800',
    'medium': 'bg-yellow-100 text-yellow-800',
    'high': 'bg-orange-100 text-orange-800',
    'critical': 'bg-red-100 text-red-800',
  };
  
  return priorityColors[priority] || 'bg-gray-100 text-gray-800';
}

export default function DealDetail() {
  const params = useParams();
  const [, setLocation] = useLocation();
  const dealId = params.dealId;
  const [isConvertModalOpen, setIsConvertModalOpen] = useState(false);

  const { data: deal, isLoading, error } = useQuery<DealWithRelations>({
    queryKey: ['/api/deals', dealId],
    enabled: !!dealId,
  });

  const handleBack = () => {
    setLocation('/deals');
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="outline" onClick={handleBack}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Deals
          </Button>
        </div>
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded mb-4"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (error || !deal) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="outline" onClick={handleBack}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Deals
          </Button>
        </div>
        <div className="text-center py-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Deal Not Found</h2>
          <p className="text-gray-600">The deal you're looking for doesn't exist or you don't have permission to view it.</p>
        </div>
      </div>
    );
  }

  const dealValue = Number(deal.amount || deal.value) || 0;
  const commission = dealValue * 0.03; // 3% commission rate

  return (
    <div className="p-6 max-w-6xl mx-auto" data-testid="deal-detail-page">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={handleBack} data-testid="button-back">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Deals
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900" data-testid="text-deal-title">
              {deal.title}
            </h1>
            <p className="text-gray-600">Deal Details</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {deal.ddProjectId ? (
            <Button 
              variant="default" 
              size="sm" 
              onClick={() => setLocation(`/dd/project/${deal.ddProjectId}`)}
              data-testid="button-view-dd-project"
            >
              <FolderOpen className="w-4 h-4 mr-2" />
              View DD Project
            </Button>
          ) : (
            <Button 
              variant="default" 
              size="sm" 
              onClick={() => setIsConvertModalOpen(true)}
              data-testid="button-convert-to-project"
            >
              <FolderOpen className="w-4 h-4 mr-2" />
              Convert to DD Project
            </Button>
          )}
          <Button variant="outline" size="sm" data-testid="button-edit">
            <Edit className="w-4 h-4 mr-2" />
            Edit Deal
          </Button>
          <Button variant="outline" size="sm" data-testid="button-delete">
            <Trash2 className="w-4 h-4 mr-2" />
            Delete
          </Button>
        </div>
      </div>

      <ConvertToProjectModal
        isOpen={isConvertModalOpen}
        onClose={() => setIsConvertModalOpen(false)}
        deal={deal}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Deal Information */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="w-5 h-5" />
                Deal Overview
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-600">Stage</label>
                  <div className="mt-1">
                    <Badge className={getStageColor(deal.stage)} data-testid="text-stage">
                      {deal.stage}
                    </Badge>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">Priority</label>
                  <div className="mt-1">
                    <Badge className={getPriorityColor(deal.priority)} data-testid="text-priority">
                      {deal.priority}
                    </Badge>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">Probability</label>
                  <p className="text-lg font-semibold text-gray-900" data-testid="text-probability">
                    {deal.probability}%
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">Days in Stage</label>
                  <p className="text-lg font-semibold text-gray-900" data-testid="text-days-in-stage">
                    {deal.daysInCurrentStage || 0} days
                  </p>
                </div>
              </div>
              
              {deal.description && (
                <div>
                  <label className="text-sm font-medium text-gray-600">Description</label>
                  <p className="mt-1 text-gray-900" data-testid="text-description">
                    {deal.description}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Financial Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="w-5 h-5" />
                Financial Details
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <p className="text-sm text-gray-600">Deal Value</p>
                  <p className="text-2xl font-bold text-blue-600" data-testid="text-deal-value">
                    {formatCurrency(dealValue)}
                  </p>
                </div>
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <p className="text-sm text-gray-600">Commission (3%)</p>
                  <p className="text-2xl font-bold text-green-600" data-testid="text-commission">
                    {formatCurrency(commission)}
                  </p>
                </div>
                <div className="text-center p-4 bg-purple-50 rounded-lg">
                  <p className="text-sm text-gray-600">Forecast Category</p>
                  <p className="text-lg font-semibold text-purple-600" data-testid="text-forecast-category">
                    {deal.forecastCategory || 'Not Set'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Property Details - Show if any property details exist */}
          {deal.propertyDetails && Object.keys(deal.propertyDetails as any).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Anchor className="w-5 h-5" />
                  Marina Property Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {(() => {
                  const pd = deal.propertyDetails as any;
                  const hasCapacity = pd.slipsTotal || pd.linearFeet || pd.maxBoatLength || pd.highDryCapacity || pd.winterStorageCapacity || pd.occupancyRate;
                  const hasProperty = pd.acreage || pd.ownershipType || pd.expansionApproved || pd.buildingSize;
                  const hasFacilities = pd.fuelCapacity || pd.equipment || pd.amenities || pd.servicesOffered;
                  const hasLocation = pd.locationDetails || pd.marketPosition;
                  const hasFinancials = pd.grossRevenue || pd.noi || pd.revenueBreakdown;

                  return (
                    <>
                      {hasCapacity && (
                        <div>
                          <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
                            <Anchor className="w-4 h-4" />
                            Physical Capacity
                          </h4>
                          <div className="grid grid-cols-2 gap-3 text-sm">
                            {pd.slipsTotal && (
                              <div>
                                <span className="text-gray-600">Total Wet Slips:</span>
                                <span className="ml-2 font-medium">{pd.slipsTotal}</span>
                              </div>
                            )}
                            {pd.linearFeet && (
                              <div>
                                <span className="text-gray-600">Linear Feet:</span>
                                <span className="ml-2 font-medium">{pd.linearFeet} ft</span>
                              </div>
                            )}
                            {pd.maxBoatLength && (
                              <div>
                                <span className="text-gray-600">Max Boat Length:</span>
                                <span className="ml-2 font-medium">{pd.maxBoatLength} ft</span>
                              </div>
                            )}
                            {pd.highDryCapacity && (
                              <div>
                                <span className="text-gray-600">High & Dry:</span>
                                <span className="ml-2 font-medium">{pd.highDryCapacity} spots</span>
                              </div>
                            )}
                            {pd.winterStorageCapacity && (
                              <div>
                                <span className="text-gray-600">Winter Storage:</span>
                                <span className="ml-2 font-medium">{pd.winterStorageCapacity} spots</span>
                              </div>
                            )}
                            {pd.occupancyRate && (
                              <div>
                                <span className="text-gray-600">Occupancy Rate:</span>
                                <span className="ml-2 font-medium">{pd.occupancyRate}%</span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {hasProperty && (
                        <div className="pt-4 border-t">
                          <h4 className="font-semibold text-sm mb-3">Property Details</h4>
                          <div className="grid grid-cols-2 gap-3 text-sm">
                            {pd.acreage && (
                              <div>
                                <span className="text-gray-600">Total Acreage:</span>
                                <span className="ml-2 font-medium">{pd.acreage} acres</span>
                              </div>
                            )}
                            {pd.ownershipType && (
                              <div>
                                <span className="text-gray-600">Ownership:</span>
                                <span className="ml-2 font-medium capitalize">{pd.ownershipType.replace('_', ' ')}</span>
                              </div>
                            )}
                            {pd.expansionApproved && (
                              <div>
                                <span className="text-gray-600">Approved Expansion:</span>
                                <span className="ml-2 font-medium">{pd.expansionApproved} slips</span>
                              </div>
                            )}
                            {pd.buildingSize && (
                              <div>
                                <span className="text-gray-600">Building Size:</span>
                                <span className="ml-2 font-medium">{pd.buildingSize} sq ft</span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {hasFacilities && (
                        <div className="pt-4 border-t">
                          <h4 className="font-semibold text-sm mb-3">Facilities & Equipment</h4>
                          <div className="space-y-2 text-sm">
                            {pd.fuelCapacity && (
                              <div>
                                <span className="text-gray-600">Fuel Storage:</span>
                                <span className="ml-2 font-medium">{pd.fuelCapacity} gallons</span>
                              </div>
                            )}
                            {pd.equipment && (
                              <div>
                                <span className="text-gray-600 block mb-1">Major Equipment:</span>
                                <p className="text-gray-900 whitespace-pre-wrap">{pd.equipment}</p>
                              </div>
                            )}
                            {pd.amenities && (
                              <div>
                                <span className="text-gray-600 block mb-1">Amenities:</span>
                                <p className="text-gray-900 whitespace-pre-wrap">{pd.amenities}</p>
                              </div>
                            )}
                            {pd.servicesOffered && (
                              <div>
                                <span className="text-gray-600 block mb-1">Services Offered:</span>
                                <p className="text-gray-900 whitespace-pre-wrap">{pd.servicesOffered}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {pd.recentImprovements && (
                        <div className="pt-4 border-t">
                          <h4 className="font-semibold text-sm mb-3">Recent Improvements</h4>
                          <p className="text-sm text-gray-900 whitespace-pre-wrap">{pd.recentImprovements}</p>
                        </div>
                      )}

                      {hasLocation && (
                        <div className="pt-4 border-t">
                          <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
                            <MapPin className="w-4 h-4" />
                            Location & Market
                          </h4>
                          <div className="space-y-2 text-sm">
                            {pd.locationDetails && (
                              <div>
                                <span className="text-gray-600 block mb-1">Location Details:</span>
                                <p className="text-gray-900 whitespace-pre-wrap">{pd.locationDetails}</p>
                              </div>
                            )}
                            {pd.marketPosition && (
                              <div>
                                <span className="text-gray-600 block mb-1">Market Position:</span>
                                <p className="text-gray-900 whitespace-pre-wrap">{pd.marketPosition}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {hasFinancials && (
                        <div className="pt-4 border-t">
                          <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
                            <DollarSign className="w-4 h-4" />
                            Financial Performance
                          </h4>
                          <div className="space-y-2 text-sm">
                            {pd.grossRevenue && (
                              <div>
                                <span className="text-gray-600">Gross Revenue:</span>
                                <span className="ml-2 font-medium">{formatCurrency(pd.grossRevenue)}</span>
                              </div>
                            )}
                            {pd.noi && (
                              <div>
                                <span className="text-gray-600">NOI:</span>
                                <span className="ml-2 font-medium">{formatCurrency(pd.noi)}</span>
                              </div>
                            )}
                            {pd.revenueBreakdown && (
                              <div>
                                <span className="text-gray-600 block mb-1">Revenue Breakdown:</span>
                                <p className="text-gray-900 whitespace-pre-wrap">{pd.revenueBreakdown}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {pd.additionalNotes && (
                        <div className="pt-4 border-t">
                          <h4 className="font-semibold text-sm mb-3">Additional Notes</h4>
                          <p className="text-sm text-gray-900 whitespace-pre-wrap">{pd.additionalNotes}</p>
                        </div>
                      )}
                    </>
                  );
                })()}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar Information */}
        <div className="space-y-6">
          {/* Contact Information */}
          {deal.contact && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="w-5 h-5" />
                  Primary Contact
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <p className="font-semibold text-gray-900" data-testid="text-contact-name">
                    {deal.contact.firstName} {deal.contact.lastName}
                  </p>
                  {deal.contact.email && (
                    <p className="text-sm text-gray-600" data-testid="text-contact-email">
                      {deal.contact.email}
                    </p>
                  )}
                  {deal.contact.phone && (
                    <p className="text-sm text-gray-600" data-testid="text-contact-phone">
                      {deal.contact.phone}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Company Information */}
          {deal.company && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building className="w-5 h-5" />
                  Company
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <p className="font-semibold text-gray-900" data-testid="text-company-name">
                    {deal.company.name}
                  </p>
                  {deal.company.industry && (
                    <p className="text-sm text-gray-600" data-testid="text-company-industry">
                      {deal.company.industry}
                    </p>
                  )}
                  {deal.company.website && (
                    <p className="text-sm text-gray-600" data-testid="text-company-website">
                      {deal.company.website}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Timeline Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Timeline
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-600">Expected Close Date</label>
                <p className="text-sm text-gray-900" data-testid="text-close-date">
                  {deal.expectedCloseDate 
                    ? new Date(deal.expectedCloseDate).toLocaleDateString()
                    : 'Not set'
                  }
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600">Created</label>
                <p className="text-sm text-gray-900" data-testid="text-created-date">
                  {new Date(deal.createdAt).toLocaleDateString()}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600">Last Updated</label>
                <p className="text-sm text-gray-900" data-testid="text-updated-date">
                  {new Date(deal.updatedAt).toLocaleDateString()}
                </p>
              </div>
              {deal.lastActivityDate && (
                <div>
                  <label className="text-sm font-medium text-gray-600">Last Activity</label>
                  <p className="text-sm text-gray-900" data-testid="text-last-activity">
                    {new Date(deal.lastActivityDate).toLocaleDateString()}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}