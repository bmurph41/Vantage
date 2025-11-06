import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import ColumnManager from "@/pages/analysis/sales-comps/ColumnManager";

interface ColumnEditorDialogProps {
  open: boolean;
  onClose: () => void;
}

export default function ColumnEditorDialog({ open, onClose }: ColumnEditorDialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-4xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <CardHeader className="border-b border-border">
          <div className="flex items-center justify-between">
            <CardTitle>Column Manager</CardTitle>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={onClose}
              data-testid="button-close"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          <ColumnManager onClose={onClose} />
        </div>
      </Card>
    </div>
  );
}
