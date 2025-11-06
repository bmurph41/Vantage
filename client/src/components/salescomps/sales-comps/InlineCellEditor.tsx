import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Check, X } from "lucide-react";

interface InlineCellEditorProps {
  value: any;
  type: string;
  options?: string[];
  onSave: (value: any) => void;
  onCancel: () => void;
}

export default function InlineCellEditor({
  value,
  type,
  options,
  onSave,
  onCancel
}: InlineCellEditorProps) {
  const [editValue, setEditValue] = useState(value || '');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, []);

  const handleSave = () => {
    let processedValue = editValue;

    // Process value based on type
    switch (type) {
      case 'salePrice':
      case 'listPrice':
      case 'noi':
        // Remove currency symbols and parse as number
        const cleanedCurrency = editValue.toString().replace(/[$,]/g, '');
        processedValue = cleanedCurrency ? parseFloat(cleanedCurrency) : null;
        break;
      case 'capRate':
      case 'occupancy':
        // Parse percentage
        const cleanedPercent = editValue.toString().replace('%', '');
        processedValue = cleanedPercent ? parseFloat(cleanedPercent) : null;
        break;
      case 'wetSlips':
      case 'dryRacks':
      case 'saleYear':
      case 'yearBuilt':
      case 'daysOnMarket':
        // Parse as integer
        processedValue = editValue ? parseInt(editValue.toString()) : null;
        break;
      case 'acres':
        // Parse as float
        processedValue = editValue ? parseFloat(editValue.toString()) : null;
        break;
      default:
        // Keep as string
        processedValue = editValue;
    }

    onSave(processedValue);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    }
  };

  const renderEditor = () => {
    if (options && options.length > 0) {
      // Select dropdown for predefined options
      return (
        <Select
          value={editValue}
          onValueChange={setEditValue}
          onOpenChange={(open) => {
            if (!open && editValue !== value) {
              handleSave();
            }
          }}
        >
          <SelectTrigger className="w-32" data-testid="inline-select-editor">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {options.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }

    // Input field for other types
    const inputType = ['salePrice', 'listPrice', 'noi', 'capRate', 'occupancy', 'wetSlips', 'dryRacks', 'saleYear', 'yearBuilt', 'daysOnMarket', 'acres'].includes(type) 
      ? 'number' 
      : 'text';

    const step = ['capRate', 'occupancy', 'acres'].includes(type) ? '0.1' : undefined;

    return (
      <div className="flex items-center gap-1">
        <Input
          ref={inputRef}
          type={inputType}
          step={step}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleSave}
          className="h-8 min-w-0 bg-primary/10 border-primary text-sm"
          data-testid="inline-input-editor"
        />
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            className="h-6 w-6 p-0 text-accent hover:text-accent/80"
            onClick={handleSave}
            data-testid="inline-save-button"
          >
            <Check className="h-3 w-3" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-6 w-6 p-0 text-destructive hover:text-destructive/80"
            onClick={onCancel}
            data-testid="inline-cancel-button"
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      </div>
    );
  };

  return (
    <div className="inline-flex items-center min-w-0" onClick={(e) => e.stopPropagation()}>
      {renderEditor()}
    </div>
  );
}
