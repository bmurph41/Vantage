import { useState } from "react";
import { StandardDialogShell } from "@/components/ui/standard-dialog-shell";
import { Button } from "@/components/ui/button";
import { User, Building, Handshake, Calendar, PlusCircle } from "lucide-react";
import ContactFormModal from "./contact-form-modal";
import CompanyFormModal from "./company-form-modal";
import DealFormModal from "./deal-form-modal";
import TaskFormModal from "./task-form-modal";

interface AddNewModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AddNewModal({ isOpen, onClose }: AddNewModalProps) {
  const [activeModal, setActiveModal] = useState<string | null>(null);

  const handleModalOpen = (modalType: string) => {
    setActiveModal(modalType);
    onClose();
  };

  const handleModalClose = () => {
    setActiveModal(null);
  };

  const options = [
    {
      id: 'contact',
      title: 'Contact',
      description: 'Add a new contact to your CRM',
      icon: User,
      color: 'text-blue-500',
    },
    {
      id: 'company',
      title: 'Company',
      description: 'Add a new company',
      icon: Building,
      color: 'text-green-500',
    },
    {
      id: 'deal',
      title: 'Deal',
      description: 'Create a new sales opportunity',
      icon: Handshake,
      color: 'text-primary',
    },
    {
      id: 'task',
      title: 'Task',
      description: 'Create a new task or reminder',
      icon: Calendar,
      color: 'text-purple-500',
    },
  ];

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
        <div className="grid grid-cols-2 gap-4" data-testid="add-new-modal">
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
      
      <CompanyFormModal
        isOpen={activeModal === 'company'}
        onClose={handleModalClose}
        company={null}
      />
      
      <DealFormModal
        isOpen={activeModal === 'deal'}
        onClose={handleModalClose}
        deal={null}
      />
      
      <TaskFormModal
        isOpen={activeModal === 'task'}
        onClose={handleModalClose}
        task={null}
      />
    </>
  );
}
