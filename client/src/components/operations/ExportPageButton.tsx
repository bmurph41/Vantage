import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

interface ExportPageButtonProps {
  title?: string;
  className?: string;
}

export function ExportPageButton({ title = "Export PDF", className }: ExportPageButtonProps) {
  const handleExport = () => {
    // Uses the browser's native print dialog, which includes a "Save as PDF" option.
    // Print-specific styles are defined in client/src/styles/print.css to hide
    // navigation, sidebar, and other non-content elements.
    window.print();
  };

  return (
    <Button variant="outline" size="sm" onClick={handleExport} className={`no-print ${className || ""}`}>
      <Download className="h-4 w-4 mr-2" />
      {title}
    </Button>
  );
}
