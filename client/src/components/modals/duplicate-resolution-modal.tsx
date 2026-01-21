import { useState } from "react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  AlertCircle, 
  Check, 
  X, 
  ArrowRight, 
  Pencil, 
  User, 
  Building2, 
  MapPin, 
  Mail, 
  Phone, 
  Globe, 
  Briefcase,
  DollarSign,
  FileText,
  GitCompare,
  Info,
  CheckCircle2,
  MinusCircle
} from "lucide-react";
import type { PendingContact, PendingCompany, PendingProperty, CrmContact, CrmCompany, Property } from "@shared/schema";

type EntityType = 'contact' | 'company' | 'property';

interface DuplicateResolutionModalProps {
  isOpen: boolean;
  onClose: () => void;
  entityType: EntityType;
  pendingEntity: PendingContact | PendingCompany | PendingProperty | null;
  existingEntity: CrmContact | CrmCompany | Property | null;
  onAccept: (mode: 'replace' | 'add_new') => void;
  onReject: () => void;
  onEditDetails?: () => void;
  isLoading?: boolean;
}

interface DataRowProps {
  label: string;
  value: string | number | null | undefined;
  icon?: React.ReactNode;
}

function DataRow({ label, value, icon }: DataRowProps) {
  const displayValue = value?.toString() || '';
  return (
    <div className="flex justify-between items-center py-2 border-b border-border/50 last:border-0">
      <span className="text-sm text-muted-foreground flex items-center gap-2">
        {icon}
        {label}
      </span>
      <span className="text-sm font-medium text-right">
        {displayValue || <span className="text-muted-foreground">—</span>}
      </span>
    </div>
  );
}

interface ComparisonRowProps {
  label: string;
  existingValue: string | number | null | undefined;
  newValue: string | number | null | undefined;
}

function ComparisonRow({ label, existingValue, newValue }: ComparisonRowProps) {
  const existing = existingValue?.toString() || '';
  const newVal = newValue?.toString() || '';
  
  const getStatus = () => {
    if (!existing && !newVal) return 'empty';
    if (existing === newVal) return 'match';
    if (existing && newVal && existing !== newVal) return 'differ';
    return 'new';
  };

  const status = getStatus();
  
  const StatusIcon = () => {
    switch (status) {
      case 'match':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'differ':
        return <AlertCircle className="h-4 w-4 text-amber-500" />;
      case 'new':
        return <Info className="h-4 w-4 text-blue-500" />;
      default:
        return <MinusCircle className="h-4 w-4 text-muted-foreground" />;
    }
  };

  return (
    <div className="grid grid-cols-[1fr,2fr,2fr,auto] gap-3 py-2.5 border-b border-border/50 last:border-0 items-center">
      <span className="text-sm font-medium text-muted-foreground">{label}</span>
      <span className={`text-sm ${status === 'match' ? 'text-green-600' : status === 'differ' ? 'text-muted-foreground' : 'text-muted-foreground'}`}>
        {existing || <span className="text-muted-foreground/50 italic">Empty</span>}
      </span>
      <span className={`text-sm font-medium ${status === 'match' ? 'text-green-600' : status === 'differ' ? 'text-amber-600' : status === 'new' ? 'text-blue-600' : 'text-muted-foreground/50'}`}>
        {newVal || <span className="italic">Empty</span>}
      </span>
      <StatusIcon />
    </div>
  );
}

function ContactOverview({ pending }: { pending: PendingContact }) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <Card className="bg-blue-50/50 border-blue-200">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <User className="h-4 w-4 text-blue-600" />
            Personal Info
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-0">
          <DataRow label="First Name" value={pending.firstName} />
          <DataRow label="Last Name" value={pending.lastName} />
          <DataRow label="Full Name" value={pending.fullName} />
          <DataRow label="Job Title" value={pending.jobTitle} icon={<Briefcase className="h-3 w-3" />} />
        </CardContent>
      </Card>

      <Card className="bg-green-50/50 border-green-200">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Mail className="h-4 w-4 text-green-600" />
            Contact Details
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-0">
          <DataRow label="Email" value={pending.email} icon={<Mail className="h-3 w-3" />} />
          <DataRow label="Phone" value={pending.phone} icon={<Phone className="h-3 w-3" />} />
        </CardContent>
      </Card>
    </div>
  );
}

function CompanyOverview({ pending }: { pending: PendingCompany }) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <Card className="bg-purple-50/50 border-purple-200">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Building2 className="h-4 w-4 text-purple-600" />
            Company Info
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-0">
          <DataRow label="Company Name" value={pending.name} />
          <DataRow label="Industry" value={pending.industry} />
          <DataRow label="Website" value={pending.website} icon={<Globe className="h-3 w-3" />} />
          <DataRow label="Phone" value={pending.phone} icon={<Phone className="h-3 w-3" />} />
        </CardContent>
      </Card>

      <Card className="bg-amber-50/50 border-amber-200">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <MapPin className="h-4 w-4 text-amber-600" />
            Location
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-0">
          <DataRow label="Address" value={pending.address} />
          <DataRow label="City" value={pending.city} />
          <DataRow label="State" value={pending.state} />
          <DataRow label="ZIP Code" value={pending.zipCode} />
        </CardContent>
      </Card>
    </div>
  );
}

function PropertyOverview({ pending }: { pending: PendingProperty }) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <Card className="bg-teal-50/50 border-teal-200">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <MapPin className="h-4 w-4 text-teal-600" />
            Property Details
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-0">
          <DataRow label="Marina Name" value={pending.marinaName} />
          <DataRow label="Address" value={pending.address} />
          <DataRow label="City" value={pending.city} />
          <DataRow label="State" value={pending.state} />
        </CardContent>
      </Card>

      <Card className="bg-emerald-50/50 border-emerald-200">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-emerald-600" />
            Financial Info
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-0">
          <DataRow label="Sale Price" value={pending.salePrice ? `$${Number(pending.salePrice).toLocaleString()}` : null} />
          <DataRow label="Est. Price" value={pending.estimatedSalePrice ? `$${Number(pending.estimatedSalePrice).toLocaleString()}` : null} />
        </CardContent>
      </Card>
    </div>
  );
}

function ContactComparison({ pending, existing }: { pending: PendingContact; existing: CrmContact | null }) {
  return (
    <div className="space-y-1">
      <ComparisonRow label="First Name" existingValue={existing?.firstName} newValue={pending.firstName} />
      <ComparisonRow label="Last Name" existingValue={existing?.lastName} newValue={pending.lastName} />
      <ComparisonRow label="Full Name" existingValue={existing?.fullName} newValue={pending.fullName} />
      <ComparisonRow label="Email" existingValue={existing?.email} newValue={pending.email} />
      <ComparisonRow label="Phone" existingValue={existing?.phone} newValue={pending.phone} />
      <ComparisonRow label="Job Title" existingValue={existing?.jobTitle} newValue={pending.jobTitle} />
    </div>
  );
}

function CompanyComparison({ pending, existing }: { pending: PendingCompany; existing: CrmCompany | null }) {
  return (
    <div className="space-y-1">
      <ComparisonRow label="Name" existingValue={existing?.name} newValue={pending.name} />
      <ComparisonRow label="Website" existingValue={existing?.website} newValue={pending.website} />
      <ComparisonRow label="Phone" existingValue={existing?.phone} newValue={pending.phone} />
      <ComparisonRow label="Address" existingValue={existing?.address} newValue={pending.address} />
      <ComparisonRow label="City" existingValue={existing?.city} newValue={pending.city} />
      <ComparisonRow label="State" existingValue={existing?.state} newValue={pending.state} />
      <ComparisonRow label="ZIP Code" existingValue={existing?.zipCode} newValue={pending.zipCode} />
      <ComparisonRow label="Industry" existingValue={existing?.industry} newValue={pending.industry} />
    </div>
  );
}

function PropertyComparison({ pending, existing }: { pending: PendingProperty; existing: Property | null }) {
  return (
    <div className="space-y-1">
      <ComparisonRow label="Marina Name" existingValue={existing?.marinaName} newValue={pending.marinaName} />
      <ComparisonRow label="Address" existingValue={existing?.address} newValue={pending.address} />
      <ComparisonRow label="City" existingValue={existing?.city} newValue={pending.city} />
      <ComparisonRow label="State" existingValue={existing?.state} newValue={pending.state} />
      <ComparisonRow label="Sale Price" existingValue={existing?.listingPrice} newValue={pending.salePrice} />
    </div>
  );
}

export default function DuplicateResolutionModal({
  isOpen,
  onClose,
  entityType,
  pendingEntity,
  existingEntity,
  onAccept,
  onReject,
  onEditDetails,
  isLoading = false,
}: DuplicateResolutionModalProps) {
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

  if (!pendingEntity) return null;

  const hasDuplicate = existingEntity !== null;
  const entityLabel = entityType.charAt(0).toUpperCase() + entityType.slice(1);

  const getEntityIcon = () => {
    switch (entityType) {
      case 'contact':
        return <User className="h-5 w-5" />;
      case 'company':
        return <Building2 className="h-5 w-5" />;
      case 'property':
        return <MapPin className="h-5 w-5" />;
    }
  };

  const getEntityName = () => {
    switch (entityType) {
      case 'contact':
        return (pendingEntity as PendingContact).fullName || 
               `${(pendingEntity as PendingContact).firstName || ''} ${(pendingEntity as PendingContact).lastName || ''}`.trim() || 
               'Unnamed Contact';
      case 'company':
        return (pendingEntity as PendingCompany).name || 'Unnamed Company';
      case 'property':
        return (pendingEntity as PendingProperty).marinaName || 'Unnamed Property';
    }
  };

  const handleDiscardClick = () => {
    setShowDiscardConfirm(true);
  };

  const handleConfirmDiscard = () => {
    setShowDiscardConfirm(false);
    onReject();
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden p-0">
          <DialogHeader className="px-6 pt-6 pb-4 border-b bg-muted/30">
            <div className="flex items-start gap-3">
              <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${hasDuplicate ? 'bg-amber-100 text-amber-600' : 'bg-blue-100 text-blue-600'}`}>
                {hasDuplicate ? <AlertCircle className="h-5 w-5" /> : getEntityIcon()}
              </div>
              <div className="flex-1">
                <DialogTitle className="text-lg font-semibold">
                  {hasDuplicate ? `Potential Duplicate ${entityLabel}` : `Review New ${entityLabel}`}
                </DialogTitle>
                <DialogDescription className="mt-1">
                  {getEntityName()}
                </DialogDescription>
              </div>
              {hasDuplicate && (
                <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300">
                  Duplicate Found
                </Badge>
              )}
            </div>
          </DialogHeader>

          <Tabs defaultValue="overview" className="w-full">
            <div className="px-6 pt-2 border-b">
              <TabsList className={`grid w-full ${hasDuplicate ? 'grid-cols-3' : 'grid-cols-2'}`}>
                <TabsTrigger value="overview" className="gap-2">
                  <Info className="h-4 w-4" />
                  Overview
                </TabsTrigger>
                {hasDuplicate && (
                  <TabsTrigger value="compare" className="gap-2">
                    <GitCompare className="h-4 w-4" />
                    Compare
                  </TabsTrigger>
                )}
                <TabsTrigger value="actions" className="gap-2">
                  <Check className="h-4 w-4" />
                  Actions
                </TabsTrigger>
              </TabsList>
            </div>

            <div className="px-6 py-4 max-h-[50vh] overflow-y-auto">
              <TabsContent value="overview" className="mt-0 space-y-4">
                <Card className="bg-slate-50/50">
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2 mb-3">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">Source Information</span>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Source:</span>
                        <span className="ml-2 font-medium">{(pendingEntity as any).source || 'Import'}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Created:</span>
                        <span className="ml-2 font-medium">
                          {(pendingEntity as any).createdAt 
                            ? new Date((pendingEntity as any).createdAt).toLocaleDateString() 
                            : 'Unknown'}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {entityType === 'contact' && <ContactOverview pending={pendingEntity as PendingContact} />}
                {entityType === 'company' && <CompanyOverview pending={pendingEntity as PendingCompany} />}
                {entityType === 'property' && <PropertyOverview pending={pendingEntity as PendingProperty} />}
              </TabsContent>

              {hasDuplicate && (
                <TabsContent value="compare" className="mt-0 space-y-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <GitCompare className="h-4 w-4" />
                        Field Comparison
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-[1fr,2fr,2fr,auto] gap-3 pb-2 mb-2 border-b-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        <span>Field</span>
                        <span>Existing Record</span>
                        <span>New Submission</span>
                        <span>Status</span>
                      </div>
                      {entityType === 'contact' && (
                        <ContactComparison 
                          pending={pendingEntity as PendingContact} 
                          existing={existingEntity as CrmContact} 
                        />
                      )}
                      {entityType === 'company' && (
                        <CompanyComparison 
                          pending={pendingEntity as PendingCompany} 
                          existing={existingEntity as CrmCompany} 
                        />
                      )}
                      {entityType === 'property' && (
                        <PropertyComparison 
                          pending={pendingEntity as PendingProperty} 
                          existing={existingEntity as Property} 
                        />
                      )}
                    </CardContent>
                  </Card>

                  <div className="grid grid-cols-4 gap-3 text-xs">
                    <div className="flex items-center gap-2 p-2 rounded-lg bg-green-50 border border-green-200">
                      <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                      <span className="text-green-700">Match</span>
                    </div>
                    <div className="flex items-center gap-2 p-2 rounded-lg bg-amber-50 border border-amber-200">
                      <AlertCircle className="h-3.5 w-3.5 text-amber-600" />
                      <span className="text-amber-700">Different</span>
                    </div>
                    <div className="flex items-center gap-2 p-2 rounded-lg bg-blue-50 border border-blue-200">
                      <Info className="h-3.5 w-3.5 text-blue-600" />
                      <span className="text-blue-700">New Value</span>
                    </div>
                    <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 border border-slate-200">
                      <MinusCircle className="h-3.5 w-3.5 text-slate-400" />
                      <span className="text-slate-500">Empty</span>
                    </div>
                  </div>
                </TabsContent>
              )}

              <TabsContent value="actions" className="mt-0 space-y-3">
                <div className="text-sm text-muted-foreground mb-4">
                  Choose how you want to handle this {entityType}:
                </div>

                {onEditDetails && (
                  <Card 
                    className="p-4 cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 transition-all border-2"
                    onClick={onEditDetails}
                  >
                    <div className="flex items-start gap-3">
                      <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center">
                        <Pencil className="h-5 w-5 text-blue-600" />
                      </div>
                      <div className="flex-1">
                        <div className="font-semibold">Edit Details First</div>
                        <div className="text-sm text-muted-foreground">
                          Review and modify the information before adding to CRM
                        </div>
                      </div>
                    </div>
                  </Card>
                )}

                <Card 
                  className="p-4 cursor-pointer hover:border-green-400 hover:bg-green-50/50 transition-all border-2"
                  onClick={() => onAccept('add_new')}
                >
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-lg bg-green-100 flex items-center justify-center">
                      <Check className="h-5 w-5 text-green-600" />
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold">{hasDuplicate ? 'Add as New Record' : 'Accept & Add to CRM'}</div>
                      <div className="text-sm text-muted-foreground">
                        {hasDuplicate 
                          ? `Create a separate ${entityType} record (keep both versions)`
                          : `Add this ${entityType} to your CRM database`}
                      </div>
                    </div>
                  </div>
                </Card>

                {hasDuplicate && (
                  <Card 
                    className="p-4 cursor-pointer hover:border-amber-400 hover:bg-amber-50/50 transition-all border-2"
                    onClick={() => onAccept('replace')}
                  >
                    <div className="flex items-start gap-3">
                      <div className="h-10 w-10 rounded-lg bg-amber-100 flex items-center justify-center">
                        <ArrowRight className="h-5 w-5 text-amber-600" />
                      </div>
                      <div className="flex-1">
                        <div className="font-semibold">Replace Existing Record</div>
                        <div className="text-sm text-muted-foreground">
                          Update the existing CRM record with this new information
                        </div>
                      </div>
                    </div>
                  </Card>
                )}

                <Card 
                  className="p-4 cursor-pointer hover:border-red-400 hover:bg-red-50/50 transition-all border-2 border-red-200"
                  onClick={handleDiscardClick}
                >
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-lg bg-red-100 flex items-center justify-center">
                      <X className="h-5 w-5 text-red-600" />
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold text-red-700">{hasDuplicate ? 'Discard Duplicate' : 'Discard'}</div>
                      <div className="text-sm text-red-600/80">
                        {hasDuplicate 
                          ? 'Remove this submission and keep only the existing record'
                          : 'Remove this pending item without adding to CRM'}
                      </div>
                    </div>
                  </div>
                </Card>
              </TabsContent>
            </div>
          </Tabs>

          <DialogFooter className="px-6 py-4 border-t bg-muted/20">
            <Button variant="outline" onClick={onClose} disabled={isLoading}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showDiscardConfirm} onOpenChange={setShowDiscardConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Discard</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to discard this {entityType}? This will permanently remove it from the pending list without adding it to your CRM. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-discard">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDiscard}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-discard"
            >
              Yes, Discard
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
