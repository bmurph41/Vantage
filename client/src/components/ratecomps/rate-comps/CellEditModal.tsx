import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency, formatPercent } from '@/lib/ratecomps/format';
import type { RateComp } from "@shared/schema";

interface CellEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (value: any) => Promise<void>;
  comp: RateComp | null;
  field: string;
  value: any;
}

interface FieldConfig {
  label: string;
  type: string;
  placeholder?: string;
  options?: string[];
}

const FIELD_CONFIGS: Record<string, FieldConfig> = {
  marina: {
    label: "Marina Name",
    type: "text",
    placeholder: "Enter marina name"
  },
  state: {
    label: "State",
    type: "select",
    options: ["AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA", "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD", "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ", "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC", "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY"]
  },
  market: {
    label: "Market",
    type: "text",
    placeholder: "Enter market name"
  },
  saleYear: {
    label: "Sale Year",
    type: "number",
    placeholder: "Enter year (e.g., 2024)"
  },
  salePrice: {
    label: "Sale Price",
    type: "currency",
    placeholder: "Enter sale price"
  },
  listPrice: {
    label: "List Price",
    type: "currency", 
    placeholder: "Enter list price"
  },
  noi: {
    label: "Net Operating Income (NOI)",
    type: "currency",
    placeholder: "Enter NOI"
  },
  capRate: {
    label: "Cap Rate",
    type: "percentage",
    placeholder: "Enter cap rate (e.g., 8.5)"
  },
  occupancy: {
    label: "Occupancy Rate",
    type: "percentage",
    placeholder: "Enter occupancy rate (e.g., 95)"
  },
  wetSlips: {
    label: "Wet Slips",
    type: "number",
    placeholder: "Enter number of wet slips"
  },
  dryRacks: {
    label: "Dry Racks",
    type: "number", 
    placeholder: "Enter number of dry racks"
  },
  acres: {
    label: "Acres",
    type: "decimal",
    placeholder: "Enter total acres"
  },
  yearBuilt: {
    label: "Year Built",
    type: "number",
    placeholder: "Enter year built"
  },
  daysOnMarket: {
    label: "Days on Market",
    type: "number",
    placeholder: "Enter days on market"
  },
  notes: {
    label: "Notes",
    type: "textarea",
    placeholder: "Enter additional notes or comments"
  },
  saleCondition: {
    label: "Sale Condition",
    type: "select",
    options: ["Arms Length", "Non-Arms Length", "Distressed", "Auction", "Bank Owned", "Other"]
  },
  brokerName: {
    label: "Broker Name",
    type: "text",
    placeholder: "Enter broker name"
  },
  brokerCompany: {
    label: "Broker Company",
    type: "text",
    placeholder: "Enter broker company"
  }
};

export default function CellEditModal({
  isOpen,
  onClose,
  onSave,
  comp,
  field,
  value
}: CellEditModalProps) {
  const [editValue, setEditValue] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);

  const config = FIELD_CONFIGS[field] || {
    label: field,
    type: "text",
    placeholder: "Enter value"
  };

  useEffect(() => {
    if (isOpen && value !== undefined) {
      // Format the initial value based on field type
      let formattedValue = "";
      
      if (value === null || value === undefined) {
        formattedValue = "";
      } else if (config.type === "currency") {
        formattedValue = value.toString();
      } else if (config.type === "percentage") {
        formattedValue = value.toString();
      } else {
        formattedValue = value.toString();
      }
      
      setEditValue(formattedValue);
    }
  }, [isOpen, value, config.type]);

  const handleSave = async () => {
    setIsLoading(true);
    
    try {
      let processedValue: any = editValue;

      // Process value based on type
      switch (config.type) {
        case "currency":
          const cleanedCurrency = editValue.toString().replace(/[$,]/g, '');
          processedValue = cleanedCurrency ? parseFloat(cleanedCurrency) : null;
          break;
        case "percentage":
          const cleanedPercent = editValue.toString().replace('%', '');
          processedValue = cleanedPercent ? parseFloat(cleanedPercent) : null;
          break;
        case "number":
          processedValue = editValue ? parseInt(editValue.toString()) : null;
          break;
        case "decimal":
          processedValue = editValue ? parseFloat(editValue.toString()) : null;
          break;
        default:
          processedValue = editValue || null;
      }

      await onSave(processedValue);
      onClose();
    } catch (error) {
      console.error('Error saving cell:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  const renderInput = () => {
    switch (config.type) {
      case "select":
        return (
          <Select value={editValue} onValueChange={setEditValue}>
            <SelectTrigger data-testid="modal-select">
              <SelectValue placeholder={`Select ${config.label.toLowerCase()}`} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none" data-testid="modal-select-empty">
                <em>No selection</em>
              </SelectItem>
              {config.options?.map((option) => (
                <SelectItem key={option} value={option} data-testid={`modal-select-${option}`}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      case "textarea":
        return (
          <Textarea
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={config.placeholder}
            className="min-h-24"
            data-testid="modal-textarea"
          />
        );

      case "currency":
        return (
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
            <Input
              type="text"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={config.placeholder}
              className="pl-8"
              data-testid="modal-input-currency"
            />
          </div>
        );

      case "percentage":
        return (
          <div className="relative">
            <Input
              type="text"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={config.placeholder}
              className="pr-8"
              data-testid="modal-input-percentage"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">%</span>
          </div>
        );

      default:
        return (
          <Input
            type={config.type === "number" || config.type === "decimal" ? "number" : "text"}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={config.placeholder}
            step={config.type === "decimal" ? "0.01" : undefined}
            data-testid={`modal-input-${config.type}`}
          />
        );
    }
  };

  const getCurrentDisplayValue = () => {
    if (value === null || value === undefined) return "—";
    
    switch (config.type) {
      case "currency":
        return formatCurrency(value);
      case "percentage":
        return formatPercent(value);
      default:
        return value.toString();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md" data-testid="cell-edit-modal">
        <DialogHeader>
          <DialogTitle data-testid="modal-title">
            Edit {config.label || field}
          </DialogTitle>
          <DialogDescription data-testid="modal-description">
            {comp?.marina && (
              <span className="block mb-2 font-medium text-foreground">
                {comp.marina}
              </span>
            )}
            Current value: <span className="font-medium">{getCurrentDisplayValue()}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-input" data-testid="modal-label">
              {config.label || field}
            </Label>
            {renderInput()}
          </div>
        </div>

        <DialogFooter className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={onClose}
            disabled={isLoading}
            data-testid="modal-cancel"
          >
            Cancel
          </Button>
          <Button 
            onClick={handleSave}
            disabled={isLoading}
            data-testid="modal-save"
          >
            {isLoading ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}