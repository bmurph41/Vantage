import { useState } from "react";
import { useLocation } from "wouter";
import { StandardDialogShell } from "@/components/ui/standard-dialog-shell";
import { Button } from "@/components/ui/button";
import { User, Handshake, MapPin, FileText, PlusCircle } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import ContactFormModal from "./contact-form-modal";
import DealFormModal from "./deal-form-modal";
import PropertyFormModal from "./property-form-modal";

interface AddNewModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// Role-aware option ordering: deal/contact/property/document
// Operators and GPs lead with Property; analysts lead with Document; others lead with Deal.
const ROLE_OPTION_ORDER: Record<string, string[]> = {
  operator: ['property', 'deal', 'contact', 'document'],
  gp:       ['deal', 'property', 'contact', 'document'],
  broker:   ['contact', 'deal', 'property', 'document'],
  analyst:  ['document', 'deal', 'contact', 'property'],
  investor: ['deal', 'property', 'contact', 'document'],
  default:  ['deal', 'contact', 'property', 'document'],
};

const ALL_OPTIONS = [
  {
    id: 'deal',
    title: 'Deal',
    description: 'Create a new acquisition opportunity',
    icon: Handshake,
    color: 'text-primary',
  },
  {
    id: 'contact',
    title: 'Contact',
    description: 'Add a new contact to your CRM',
    icon: User,
    color: 'text-blue-500',
  },
  {
    id: 'property',
    title: 'Property',
    description: 'Add a marina or CRE property listing',
    icon: MapPin,
    color: 'text-green-500',
  },
  {
    id: 'document',
    title: 'Document',
    description: 'Upload to your virtual data room',
    icon: FileText,
    color: 'text-purple-500',
  },
];

export default function AddNewModal({ isOpen, onClose }: AddNewModalProps) {
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  const role = (user as { userPrimaryRole?: string | null } | null)?.userPrimaryRole
    ?? localStorage.getItem('vantage_primary_role')
    ?? 'default';
  const order = ROLE_OPTION_ORDER[role] ?? ROLE_OPTION_ORDER.default;
  const options = order.map((id) => ALL_OPTIONS.find((o) => o.id === id)!);

  const handleModalOpen = (modalType: string) => {
    if (modalType === 'document') {
      onClose();
      setLocation('/vdr');
      return;
    }
    setActiveModal(modalType);
    onClose();
  };

  const handleModalClose = () => {
    setActiveModal(null);
  };

  return (
    <>
      <StandardDialogShell
        open={isOpen}
        onOpenChange={onClose}
        title="Add New"
        icon={PlusCircle}
        size="sm"
        showProgressBar={true}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4" data-testid="add-new-modal">
          {options.map((option) => (
            <Button
              key={option.id}
              variant="outline"
              className="flex flex-col items-center p-6 h-auto space-y-3 hover:bg-gray-50"
              onClick={() => handleModalOpen(option.id)}
              data-testid={`button-add-${option.id}`}
            >
              <option.icon className={`w-8 h-8 ${option.color}`} />
              <div className="text-center">
                <div className="font-medium text-sm">{option.title}</div>
                <div className="text-xs text-gray-500 mt-1">{option.description}</div>
              </div>
            </Button>
          ))}
        </div>
      </StandardDialogShell>

      {/* Sub-modals */}
      <ContactFormModal
        isOpen={activeModal === 'contact'}
        onClose={handleModalClose}
        contact={null}
      />

      <DealFormModal
        isOpen={activeModal === 'deal'}
        onClose={handleModalClose}
        deal={null}
      />

      <PropertyFormModal
        isOpen={activeModal === 'property'}
        onClose={handleModalClose}
        property={null}
      />
    </>
  );
}
