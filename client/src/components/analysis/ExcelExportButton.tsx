import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { FileSpreadsheet, Download } from 'lucide-react';

interface ColumnDef {
  key: string;
  header: string;
  formatter?: (value: any) => string;
}

interface ExcelExportButtonProps {
  data: Record<string, any>[];
  columns: ColumnDef[];
  filename?: string;
  label?: string;
  variant?: 'default' | 'outline' | 'ghost' | 'secondary';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  className?: string;
  disabled?: boolean;
}

function escapeCSVValue(value: any): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  // Escape values that contain commas, quotes, or newlines
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function generateCSV(data: Record<string, any>[], columns: ColumnDef[]): string {
  // Header row
  const headerRow = columns.map((col) => escapeCSVValue(col.header)).join(',');

  // Data rows
  const dataRows = data.map((row) =>
    columns
      .map((col) => {
        const rawValue = row[col.key];
        const formattedValue = col.formatter ? col.formatter(rawValue) : rawValue;
        return escapeCSVValue(formattedValue);
      })
      .join(',')
  );

  return [headerRow, ...dataRows].join('\n');
}

function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob(['\ufeff' + content], { type: mimeType }); // BOM for Excel UTF-8
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export default function ExcelExportButton({
  data,
  columns,
  filename = 'export',
  label = 'Export CSV',
  variant = 'outline',
  size = 'sm',
  className,
  disabled = false,
}: ExcelExportButtonProps) {
  const { toast } = useToast();
  const [exporting, setExporting] = useState(false);

  const handleExport = () => {
    if (!data || data.length === 0) {
      toast({
        title: 'No Data to Export',
        description: 'There is no data available to export.',
        variant: 'destructive',
      });
      return;
    }

    setExporting(true);
    try {
      const csv = generateCSV(data, columns);
      const timestamp = new Date().toISOString().slice(0, 10);
      const safeFilename = filename.replace(/[^a-zA-Z0-9_-]/g, '_');
      downloadFile(csv, `${safeFilename}_${timestamp}.csv`, 'text/csv;charset=utf-8');

      toast({
        title: 'Export Complete',
        description: `${data.length} row(s) exported to CSV.`,
      });
    } catch (error) {
      toast({
        title: 'Export Failed',
        description: 'An error occurred while generating the export.',
        variant: 'destructive',
      });
    } finally {
      setExporting(false);
    }
  };

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleExport}
      disabled={disabled || exporting || !data || data.length === 0}
      className={className}
    >
      {exporting ? (
        <Download className="h-4 w-4 mr-2 animate-bounce" />
      ) : (
        <FileSpreadsheet className="h-4 w-4 mr-2" />
      )}
      {exporting ? 'Exporting...' : label}
    </Button>
  );
}
