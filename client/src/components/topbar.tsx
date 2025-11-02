import { useState } from "react";
import { Search, Bell, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import AddNewModal from "@/components/modals/add-new-modal";

interface TopBarProps {
  title: string;
  subtitle?: string;
}

export default function TopBar({ title, subtitle }: TopBarProps) {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  return (
    <>
      <header className="bg-white shadow-sm border-b border-gray-200 px-6 py-4" data-testid="topbar">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <h1 className="text-2xl font-semibold text-gray-900" data-testid="topbar-title">{title}</h1>
            {subtitle && (
              <span className="text-sm text-gray-500" data-testid="topbar-subtitle">{subtitle}</span>
            )}
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="w-4 h-4 text-gray-400" />
              </div>
              <Input
                type="text"
                placeholder="Search contacts, deals, companies..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 w-80"
                data-testid="input-search"
              />
            </div>
            
            <button
              className="relative p-2 text-gray-400 hover:text-gray-600"
              data-testid="button-notifications"
            >
              <Bell className="w-5 h-5" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
            </button>
            
            <Button
              onClick={() => setIsAddModalOpen(true)}
              className="bg-primary hover:bg-primary/90"
              data-testid="button-add-new"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add New
            </Button>
          </div>
        </div>
      </header>

      <AddNewModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
      />
    </>
  );
}
