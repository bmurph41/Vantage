import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { AlertCircle, Check, X, ArrowRight, Pencil } from "lucide-react";
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

interface FieldComparisonProps {
  label: string;
  existingValue: string | number | null | undefined;
  newValue: string | number | null | undefined;
}

function FieldComparison({ label, existingValue, newValue }: FieldComparisonProps) {
  const existing = existingValue?.toString() || '';
  const newVal = newValue?.toString() || '';
  
  const getColor = () => {
    if (!existing && !newVal) return 'text-gray-400';
    if (existing === newVal) return 'text-green-600';
    if (existing && newVal && existing !== newVal) return 'text-yellow-600';
    return 'text-blue-600';
  };

  return (
    <div className="grid grid-cols-3 gap-4 py-2 border-b border-gray-100">
      <div className="text-sm font-medium text-gray-700">{label}</div>
      <div className={`text-sm ${getColor()}`}>
        {existing || <span className="text-gray-300 italic">empty</span>}
      </div>
      <div className={`text-sm ${getColor()}`}>
        {newVal || <span className="text-gray-300 italic">empty</span>}
      </div>
    </div>
  );
}

function ContactComparison({ pending, existing }: { pending: PendingContact; existing: CrmContact | null }) {
  return (
    <div className="space-y-1">
      <FieldComparison label="First Name" existingValue={existing?.firstName} newValue={pending.firstName} />
      <FieldComparison label="Last Name" existingValue={existing?.lastName} newValue={pending.lastName} />
      <FieldComparison label="Full Name" existingValue={existing?.fullName} newValue={pending.fullName} />
      <FieldComparison label="Email" existingValue={existing?.email} newValue={pending.email} />
      <FieldComparison label="Phone" existingValue={existing?.phone} newValue={pending.phone} />
      <FieldComparison label="Job Title" existingValue={existing?.jobTitle} newValue={pending.jobTitle} />
    </div>
  );
}

function CompanyComparison({ pending, existing }: { pending: PendingCompany; existing: CrmCompany | null }) {
  return (
    <div className="space-y-1">
      <FieldComparison label="Name" existingValue={existing?.name} newValue={pending.name} />
      <FieldComparison label="Website" existingValue={existing?.website} newValue={pending.website} />
      <FieldComparison label="Phone" existingValue={existing?.phone} newValue={pending.phone} />
      <FieldComparison label="Address" existingValue={existing?.address} newValue={pending.address} />
      <FieldComparison label="City" existingValue={existing?.city} newValue={pending.city} />
      <FieldComparison label="State" existingValue={existing?.state} newValue={pending.state} />
      <FieldComparison label="Zip Code" existingValue={existing?.zipCode} newValue={pending.zipCode} />
      <FieldComparison label="Industry" existingValue={existing?.industry} newValue={pending.industry} />
    </div>
  );
}

function PropertyComparison({ pending, existing }: { pending: PendingProperty; existing: Property | null }) {
  return (
    <div className="space-y-1">
      <FieldComparison label="Marina Name" existingValue={existing?.marinaName} newValue={pending.marinaName} />
      <FieldComparison label="Address" existingValue={existing?.address} newValue={pending.address} />
      <FieldComparison label="City" existingValue={existing?.city} newValue={pending.city} />
      <FieldComparison label="State" existingValue={existing?.state} newValue={pending.state} />
      <FieldComparison 
        label="Sale Price" 
        existingValue={existing?.listingPrice} 
        newValue={pending.salePrice} 
      />
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

  const handleDiscardClick = () => {
    setShowDiscardConfirm(true);
  };

  const handleConfirmDiscard = () => {
    setShowDiscardConfirm(false);
    onReject();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {hasDuplicate ? (
              <>
                <AlertCircle className="h-5 w-5 text-yellow-600" />
                Duplicate {entityLabel} Detected
              </>
            ) : (
              <>
                <Check className="h-5 w-5 text-green-600" />
                Review New {entityLabel}
              </>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {hasDuplicate ? (
            <>
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-sm text-yellow-800">
                  We found a potential duplicate in your CRM. Please review the comparison below and decide how to proceed.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-4 mb-2">
                <div className="text-sm font-semibold text-gray-500 uppercase">Field</div>
                <div className="text-sm font-semibold text-gray-500 uppercase">Existing CRM Record</div>
                <div className="text-sm font-semibold text-gray-500 uppercase">New Submission</div>
              </div>

              <Card className="border-2">
                <div className="p-4">
                  {entityType === 'contact' && (
                    <ContactComparison 
                      pending={pendingEntity as PendingContact} 
                      existing={existingEntity as CrmContact | null} 
                    />
                  )}
                  {entityType === 'company' && (
                    <CompanyComparison 
                      pending={pendingEntity as PendingCompany} 
                      existing={existingEntity as CrmCompany | null} 
                    />
                  )}
                  {entityType === 'property' && (
                    <PropertyComparison 
                      pending={pendingEntity as PendingProperty} 
                      existing={existingEntity as Property | null} 
                    />
                  )}
                </div>
              </Card>

              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-sm font-semibold mb-3">Color Legend</h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-green-600"></div>
                    <span className="text-gray-700">Values match</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-yellow-600"></div>
                    <span className="text-gray-700">Values differ</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-blue-600"></div>
                    <span className="text-gray-700">New value (no existing)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-gray-300"></div>
                    <span className="text-gray-700">No value</span>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-sm text-green-800">
                This is a new {entityType}. You can add it to your CRM directly, or edit the details first.
              </p>
            </div>
          )}

          <Separator />

          <div className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold">How would you like to proceed?</h3>
            
            <div className="grid gap-3">
              {onEditDetails && (
                <Button
                  variant="outline"
                  className="w-full justify-start h-auto py-3 px-4 border-2 border-blue-300 hover:bg-blue-50"
                  onClick={onEditDetails}
                  disabled={isLoading}
                  data-testid="button-edit-details"
                >
                  <Pencil className="h-5 w-5 mr-3 text-blue-600" />
                  <div className="text-left">
                    <div className="font-semibold">Edit Details First</div>
                    <div className="text-xs text-gray-600">
                      Add more information before saving to CRM
                    </div>
                  </div>
                </Button>
              )}

              <Button
                variant="outline"
                className="w-full justify-start h-auto py-3 px-4 border-2 border-green-300 hover:bg-green-50"
                onClick={() => onAccept('add_new')}
                disabled={isLoading}
                data-testid="button-add-as-new"
              >
                <Check className="h-5 w-5 mr-3 text-green-600" />
                <div className="text-left">
                  <div className="font-semibold">{hasDuplicate ? 'Add as New' : 'Accept & Add to CRM'}</div>
                  <div className="text-xs text-gray-600">
                    {hasDuplicate ? `Create a new ${entityType} record (keep both)` : `Create this ${entityType} in your CRM`}
                  </div>
                </div>
              </Button>

              {hasDuplicate && (
                <Button
                  variant="outline"
                  className="w-full justify-start h-auto py-3 px-4 border-2 border-orange-300 hover:bg-orange-50"
                  onClick={() => onAccept('replace')}
                  disabled={isLoading}
                  data-testid="button-replace-existing"
                >
                  <ArrowRight className="h-5 w-5 mr-3 text-orange-600" />
                  <div className="text-left">
                    <div className="font-semibold">Replace Existing</div>
                    <div className="text-xs text-gray-600">
                      Update the existing CRM record with the new submission data
                    </div>
                  </div>
                </Button>
              )}

              <Button
                variant="destructive"
                className="w-full justify-start h-auto py-3 px-4"
                onClick={handleDiscardClick}
                disabled={isLoading}
                data-testid="button-reject-duplicate"
              >
                <X className="h-5 w-5 mr-3" />
                <div className="text-left">
                  <div className="font-semibold">{hasDuplicate ? 'Discard Duplicate' : 'Discard'}</div>
                  <div className="text-xs opacity-90">
                    {hasDuplicate ? 'Reject this submission and keep only the existing record' : 'Remove this pending item'}
                  </div>
                </div>
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>

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
    </Dialog>
  );
}
