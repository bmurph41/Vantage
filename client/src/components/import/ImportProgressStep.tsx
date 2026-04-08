import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Loader2, Database, Check, AlertTriangle } from "lucide-react";

interface ImportProgressStepProps {
  progress: {
    current: number;
    total: number;
    errors: number;
  };
  isProcessing: boolean;
}

export function ImportProgressStep({ progress, isProcessing }: ImportProgressStepProps) {
  const percentage = progress.total > 0 ? (progress.current / progress.total) * 100 : 0;

  return (
    <div className="flex flex-col items-center justify-center py-12 space-y-8">
      <div className="relative">
        {isProcessing ? (
          <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
          </div>
        ) : (
          <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center">
            <Check className="h-10 w-10 text-green-600" />
          </div>
        )}
      </div>

      <div className="text-center">
        <h3 className="text-xl font-semibold">
          {isProcessing ? 'Importing Data...' : 'Import Complete'}
        </h3>
        <p className="text-muted-foreground mt-2">
          {isProcessing
            ? 'Please wait while your data is being imported.'
            : 'All records have been processed.'}
        </p>
      </div>

      <div className="w-full max-w-md space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Progress</span>
          <span className="font-medium">
            {progress.current} / {progress.total}
          </span>
        </div>
        <Progress value={percentage} className="h-3" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 w-full max-w-lg">
        <Card>
          <CardContent className="pt-4 text-center">
            <div className="flex justify-center mb-2">
              <Database className="h-5 w-5 text-primary" />
            </div>
            <p className="text-2xl font-bold">{progress.total}</p>
            <p className="text-xs text-muted-foreground">Total Records</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 text-center">
            <div className="flex justify-center mb-2">
              <Check className="h-5 w-5 text-green-600" />
            </div>
            <p className="text-2xl font-bold">{progress.current - progress.errors}</p>
            <p className="text-xs text-muted-foreground">Successful</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 text-center">
            <div className="flex justify-center mb-2">
              <AlertTriangle className="h-5 w-5 text-yellow-600" />
            </div>
            <p className="text-2xl font-bold">{progress.errors}</p>
            <p className="text-xs text-muted-foreground">Errors</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
