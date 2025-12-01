import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { format } from "date-fns";
import { 
  X, 
  User, 
  Phone, 
  Mail, 
  MapPin, 
  Ship as BoatIcon, 
  Calendar, 
  DollarSign, 
  Activity,
  Shield,
  Anchor,
  Waves,
  Zap,
  Wifi,
  Fuel
} from "lucide-react";
import type { Customer, Boat, Lease } from "@shared/schema";

interface EnrichedSlip {
  id: string;
  number: string;
  type: string;
  section: string;
  maxLength: string;
  maxBeam: string;
  maxDraft: string | null;
  utilities: string[] | null;
  monthlyRate: string;
  isOccupied: boolean;
  currentBoatId: string | null;
  customer: Customer | null;
  boat: Boat | null;
  lease: Lease | null;
  paymentStatus: string | null;
  lastPaymentDate: Date | null;
  launchCount: number;
}

interface SlipDetailPanelProps {
  slip: EnrichedSlip | null;
  onClose: () => void;
}

export default function SlipDetailPanel({ slip, onClose }: SlipDetailPanelProps) {
  if (!slip) return null;

  const formatCurrency = (amount: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(parseFloat(amount));
  };

  const getPaymentStatusColor = (status: string | null) => {
    switch (status) {
      case "paid": return "bg-green-500";
      case "pending": return "bg-yellow-500";
      case "overdue": return "bg-red-500";
      default: return "bg-gray-500";
    }
  };

  const getPaymentStatusText = (status: string | null) => {
    switch (status) {
      case "paid": return "Paid";
      case "pending": return "Payment Due";
      case "overdue": return "Overdue";
      default: return "No Payment Info";
    }
  };

  const getUtilityIcon = (utility: string) => {
    switch (utility.toLowerCase()) {
      case "water": return <Waves className="w-4 h-4" />;
      case "electric": return <Zap className="w-4 h-4" />;
      case "wifi": return <Wifi className="w-4 h-4" />;
      case "cable": return <Phone className="w-4 h-4" />;
      case "pump-out": return <Fuel className="w-4 h-4" />;
      default: return <Activity className="w-4 h-4" />;
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto h-fit" data-testid="panel-slip-details">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="text-xl font-bold flex items-center space-x-2">
          <Anchor className="w-5 h-5" />
          <span data-testid="text-slip-number">Slip {slip.number}</span>
        </CardTitle>
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={onClose}
          data-testid="button-close-details"
        >
          <X className="w-4 h-4" />
        </Button>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Slip Information */}
        <div className="space-y-3" data-testid="section-slip-info">
          <h3 className="font-semibold text-lg">Slip Information</h3>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-muted-foreground">Section:</span>
              <span className="ml-2 font-medium" data-testid="text-slip-section">{slip.section}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Type:</span>
              <span className="ml-2 font-medium capitalize" data-testid="text-slip-type">{slip.type.replace('_', ' ')}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Max Length:</span>
              <span className="ml-2 font-medium" data-testid="text-max-length">{slip.maxLength} ft</span>
            </div>
            <div>
              <span className="text-muted-foreground">Max Beam:</span>
              <span className="ml-2 font-medium" data-testid="text-max-beam">{slip.maxBeam} ft</span>
            </div>
            {slip.maxDraft && (
              <div>
                <span className="text-muted-foreground">Max Draft:</span>
                <span className="ml-2 font-medium" data-testid="text-max-draft">{slip.maxDraft} ft</span>
              </div>
            )}
            <div>
              <span className="text-muted-foreground">Monthly Rate:</span>
              <span className="ml-2 font-medium text-green-600" data-testid="text-monthly-rate">
                {formatCurrency(slip.monthlyRate)}
              </span>
            </div>
          </div>

          {/* Utilities */}
          {slip.utilities && slip.utilities.length > 0 && (
            <div>
              <span className="text-muted-foreground text-sm">Utilities:</span>
              <div className="flex flex-wrap gap-1 mt-1">
                {slip.utilities.map((utility) => (
                  <Badge key={utility} variant="outline" className="text-xs" data-testid={`badge-utility-${utility}`}>
                    {getUtilityIcon(utility)}
                    <span className="ml-1 capitalize">{utility}</span>
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>

        <Separator />

        {/* Occupancy Status */}
        <div className="space-y-3" data-testid="section-occupancy">
          <h3 className="font-semibold text-lg">Status</h3>
          <div className="flex items-center space-x-2">
            <Badge 
              className={`${slip.isOccupied ? 'bg-red-500' : 'bg-green-500'} text-white`}
              data-testid="badge-occupancy-status"
            >
              {slip.isOccupied ? 'Occupied' : 'Available'}
            </Badge>
            {slip.paymentStatus && (
              <Badge 
                className={`${getPaymentStatusColor(slip.paymentStatus)} text-white`}
                data-testid="badge-payment-status"
              >
                {getPaymentStatusText(slip.paymentStatus)}
              </Badge>
            )}
          </div>
        </div>

        {/* Customer Information */}
        {slip.customer && (
          <>
            <Separator />
            <div className="space-y-3" data-testid="section-customer-info">
              <h3 className="font-semibold text-lg flex items-center space-x-2">
                <User className="w-4 h-4" />
                <span>Customer</span>
              </h3>
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <User className="w-4 h-4 text-muted-foreground" />
                  <span className="font-medium" data-testid="text-customer-name">
                    {slip.customer.firstName} {slip.customer.lastName}
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <Mail className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm" data-testid="text-customer-email">{slip.customer.email}</span>
                </div>
                {slip.customer.phone && (
                  <div className="flex items-center space-x-2">
                    <Phone className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm" data-testid="text-customer-phone">{slip.customer.phone}</span>
                  </div>
                )}
                {slip.customer.address && (
                  <div className="flex items-start space-x-2">
                    <MapPin className="w-4 h-4 text-muted-foreground mt-0.5" />
                    <span className="text-sm" data-testid="text-customer-address">{slip.customer.address}</span>
                  </div>
                )}
                {slip.customer.emergencyContact && (
                  <div className="mt-3 p-3 bg-muted rounded-lg">
                    <span className="text-sm font-medium">Emergency Contact:</span>
                    <div className="text-sm text-muted-foreground mt-1">
                      <div data-testid="text-emergency-contact-name">{slip.customer.emergencyContact.name}</div>
                      <div data-testid="text-emergency-contact-phone">{slip.customer.emergencyContact.phone}</div>
                      <div className="capitalize" data-testid="text-emergency-contact-relationship">
                        {slip.customer.emergencyContact.relationship}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {/* Boat Information */}
        {slip.boat && (
          <>
            <Separator />
            <div className="space-y-3" data-testid="section-boat-info">
              <h3 className="font-semibold text-lg flex items-center space-x-2">
                <BoatIcon className="w-4 h-4" />
                <span>Boat</span>
              </h3>
              <div className="space-y-2">
                <div>
                  <span className="font-medium text-lg" data-testid="text-boat-name">{slip.boat.name}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Make:</span>
                    <span className="ml-2" data-testid="text-boat-make">{slip.boat.make}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Model:</span>
                    <span className="ml-2" data-testid="text-boat-model">{slip.boat.model}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Year:</span>
                    <span className="ml-2" data-testid="text-boat-year">{slip.boat.year}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Length:</span>
                    <span className="ml-2" data-testid="text-boat-length">{slip.boat.length} ft</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Beam:</span>
                    <span className="ml-2" data-testid="text-boat-beam">{slip.boat.beam} ft</span>
                  </div>
                  {slip.boat.draft && (
                    <div>
                      <span className="text-muted-foreground">Draft:</span>
                      <span className="ml-2" data-testid="text-boat-draft">{slip.boat.draft} ft</span>
                    </div>
                  )}
                </div>
                {slip.boat.registrationNumber && (
                  <div className="text-sm">
                    <span className="text-muted-foreground">Registration:</span>
                    <span className="ml-2 font-mono" data-testid="text-boat-registration">{slip.boat.registrationNumber}</span>
                  </div>
                )}
                {slip.boat.hullId && (
                  <div className="text-sm">
                    <span className="text-muted-foreground">Hull ID:</span>
                    <span className="ml-2 font-mono" data-testid="text-boat-hull-id">{slip.boat.hullId}</span>
                  </div>
                )}
                
                {/* Insurance Information */}
                {slip.boat.insuranceInfo && (
                  <div className="mt-3 p-3 bg-muted rounded-lg">
                    <div className="flex items-center space-x-2 mb-2">
                      <Shield className="w-4 h-4" />
                      <span className="text-sm font-medium">Insurance</span>
                    </div>
                    <div className="text-sm space-y-1">
                      <div>
                        <span className="text-muted-foreground">Provider:</span>
                        <span className="ml-2" data-testid="text-insurance-provider">{slip.boat.insuranceInfo.provider}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Policy:</span>
                        <span className="ml-2" data-testid="text-insurance-policy">{slip.boat.insuranceInfo.policyNumber}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Expires:</span>
                        <span className="ml-2" data-testid="text-insurance-expiry">{slip.boat.insuranceInfo.expirationDate}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {/* Lease Information */}
        {slip.lease && (
          <>
            <Separator />
            <div className="space-y-3" data-testid="section-lease-info">
              <h3 className="font-semibold text-lg flex items-center space-x-2">
                <Calendar className="w-4 h-4" />
                <span>Lease</span>
              </h3>
              <div className="space-y-2 text-sm">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-muted-foreground">Start Date:</span>
                    <div className="font-medium" data-testid="text-lease-start">
                      {format(new Date(slip.lease.startDate), 'MMM dd, yyyy')}
                    </div>
                  </div>
                  {slip.lease.endDate && (
                    <div>
                      <span className="text-muted-foreground">End Date:</span>
                      <div className="font-medium" data-testid="text-lease-end">
                        {format(new Date(slip.lease.endDate), 'MMM dd, yyyy')}
                      </div>
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-muted-foreground">Monthly Rate:</span>
                    <div className="font-medium text-green-600" data-testid="text-lease-rate">
                      {formatCurrency(slip.lease.monthlyRate)}
                    </div>
                  </div>
                  {slip.lease.depositAmount && (
                    <div>
                      <span className="text-muted-foreground">Deposit:</span>
                      <div className="font-medium" data-testid="text-lease-deposit">
                        {formatCurrency(slip.lease.depositAmount)}
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex items-center space-x-4">
                  <Badge 
                    variant={slip.lease.status === 'active' ? 'default' : 'secondary'}
                    data-testid="badge-lease-status"
                  >
                    {slip.lease.status}
                  </Badge>
                  {slip.lease.autoRenew && (
                    <Badge variant="outline" data-testid="badge-auto-renew">
                      Auto Renew
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </>
        )}

        {/* Usage Statistics */}
        <Separator />
        <div className="space-y-3" data-testid="section-usage-stats">
          <h3 className="font-semibold text-lg flex items-center space-x-2">
            <Activity className="w-4 h-4" />
            <span>Usage Statistics</span>
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center p-3 bg-muted rounded-lg">
              <div className="text-2xl font-bold text-primary" data-testid="text-launch-count">{slip.launchCount}</div>
              <div className="text-sm text-muted-foreground">Total Launches</div>
            </div>
            {slip.lastPaymentDate && (
              <div className="text-center p-3 bg-muted rounded-lg">
                <div className="text-sm font-medium" data-testid="text-last-payment-date">
                  {format(new Date(slip.lastPaymentDate), 'MMM dd, yyyy')}
                </div>
                <div className="text-sm text-muted-foreground">Last Payment</div>
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 pt-4">
          <Button variant="outline" className="flex-1" data-testid="button-view-customer">
            <User className="w-4 h-4 mr-2" />
            View Customer
          </Button>
          <Button variant="outline" className="flex-1" data-testid="button-schedule-launch">
            <Calendar className="w-4 h-4 mr-2" />
            Schedule Launch
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}