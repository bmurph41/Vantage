import { AlertTriangle, AlertCircle, Info } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useExitStrategiesStore } from "@/stores/exitStrategiesStore";
import type { CalculationWarning } from "@/lib/financial-validators";

interface ValidationWarningsProps {
  className?: string;
  showOnlyErrors?: boolean;
}

export function ValidationWarnings({ className, showOnlyErrors = false }: ValidationWarningsProps) {
  const validationWarnings = useExitStrategiesStore((state) => state.validationWarnings);
  
  const displayWarnings = showOnlyErrors 
    ? validationWarnings.filter(w => w.severity === 'error')
    : validationWarnings;
  
  if (displayWarnings.length === 0) {
    return null;
  }
  
  const errors = displayWarnings.filter(w => w.severity === 'error');
  const warnings = displayWarnings.filter(w => w.severity === 'warning');
  
  return (
    <div className={`space-y-2 ${className || ''}`}>
      {errors.map((warning, index) => (
        <Alert key={`error-${index}`} variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="ml-2">
            <span className="font-medium">{formatFieldName(warning.field)}:</span> {warning.message}
          </AlertDescription>
        </Alert>
      ))}
      
      {!showOnlyErrors && warnings.map((warning, index) => (
        <Alert key={`warning-${index}`} className="border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20">
          <AlertTriangle className="h-4 w-4 text-yellow-600" />
          <AlertDescription className="ml-2 text-yellow-800 dark:text-yellow-200">
            <span className="font-medium">{formatFieldName(warning.field)}:</span> {warning.message}
          </AlertDescription>
        </Alert>
      ))}
    </div>
  );
}

function formatFieldName(field: string): string {
  const fieldNames: Record<string, string> = {
    adjustedBasis: 'Adjusted Basis',
    capitalGain: 'Capital Gain',
    debtBalance: 'Debt Balance',
    equity: 'Equity',
    depreciation: 'Depreciation',
    proceeds: 'Net Proceeds',
    brokerFee: 'Broker Fee',
  };
  
  return fieldNames[field] || field.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
}

export function ValidationSummaryBadge() {
  const validationWarnings = useExitStrategiesStore((state) => state.validationWarnings);
  
  const errors = validationWarnings.filter(w => w.severity === 'error');
  const warnings = validationWarnings.filter(w => w.severity === 'warning');
  
  if (errors.length === 0 && warnings.length === 0) {
    return (
      <div className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
        <Info className="h-3 w-3" />
        <span>Inputs validated</span>
      </div>
    );
  }
  
  return (
    <div className="flex items-center gap-2">
      {errors.length > 0 && (
        <div className="flex items-center gap-1 text-xs text-red-600 dark:text-red-400">
          <AlertCircle className="h-3 w-3" />
          <span>{errors.length} issue{errors.length !== 1 ? 's' : ''}</span>
        </div>
      )}
      {warnings.length > 0 && (
        <div className="flex items-center gap-1 text-xs text-yellow-600 dark:text-yellow-400">
          <AlertTriangle className="h-3 w-3" />
          <span>{warnings.length} warning{warnings.length !== 1 ? 's' : ''}</span>
        </div>
      )}
    </div>
  );
}

export default ValidationWarnings;
