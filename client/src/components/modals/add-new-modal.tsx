import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { User, Building, Handshake, Calendar } from "lucide-react";
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
    onClose(); // Close the main modal
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
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-md" data-testid="add-new-modal">
          <DialogHeader>
            <DialogTitle>Add New</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-4">
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
        </DialogContent>
      </Dialog>

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
