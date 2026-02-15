import { useState, useRef, type RefObject } from "react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { FileDown, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface ExportPdfButtonProps {
  contentRef: RefObject<HTMLElement | null>;
  filename?: string;
  title?: string;
  variant?: "default" | "outline" | "ghost" | "secondary";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
  includeDate?: boolean;
}

async function generatePdf(
  element: HTMLElement,
  filename: string,
  title?: string,
) {
  const html2canvas = (await import("html2canvas")).default;
  const { jsPDF } = await import("jspdf");

  const cloned = element.cloneNode(true) as HTMLElement;
  cloned.style.width = `${element.scrollWidth}px`;
  cloned.style.position = "absolute";
  cloned.style.left = "-9999px";
  cloned.style.top = "0";
  document.body.appendChild(cloned);

  try {
    const canvas = await html2canvas(cloned, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: "#ffffff",
      logging: false,
      windowWidth: Math.max(element.scrollWidth, 1200),
      onclone: (doc) => {
        const root = doc.querySelector("[data-pdf-content]") || doc.body;
        root.querySelectorAll(".dark\\:bg-black, .dark\\:bg-gray-900, .dark\\:bg-slate-900").forEach((el) => {
          (el as HTMLElement).style.backgroundColor = "#ffffff";
        });
      },
    });

    document.body.removeChild(cloned);

    const imgData = canvas.toDataURL("image/png");
    const imgWidth = canvas.width;
    const imgHeight = canvas.height;

    const pdfWidth = 297;
    const pdfMargin = 10;
    const contentWidth = pdfWidth - pdfMargin * 2;
    const ratio = contentWidth / imgWidth;
    const scaledHeight = imgHeight * ratio;

    const headerHeight = title ? 20 : 0;
    const footerHeight = 12;
    const pageHeight = 210;
    const usableHeight = pageHeight - pdfMargin * 2 - headerHeight - footerHeight;

    const pdf = new jsPDF({
      orientation: "landscape",
      unit: "mm",
      format: "a4",
    });

    const totalPages = Math.ceil(scaledHeight / usableHeight);

    for (let page = 0; page < totalPages; page++) {
      if (page > 0) pdf.addPage();

      if (title) {
        pdf.setFontSize(14);
        pdf.setTextColor(30, 30, 30);
        pdf.text(title, pdfMargin, pdfMargin + 8);
        pdf.setDrawColor(220, 220, 220);
        pdf.line(pdfMargin, pdfMargin + 12, pdfWidth - pdfMargin, pdfMargin + 12);
      }

      const sourceY = (page * usableHeight) / ratio;
      const sourceHeight = usableHeight / ratio;
      const sliceCanvas = document.createElement("canvas");
      sliceCanvas.width = imgWidth;
      sliceCanvas.height = Math.min(sourceHeight, imgHeight - sourceY);
      const ctx = sliceCanvas.getContext("2d");
      if (ctx) {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
        ctx.drawImage(
          canvas,
          0, sourceY,
          imgWidth, sliceCanvas.height,
          0, 0,
          imgWidth, sliceCanvas.height,
        );
      }

      const sliceData = sliceCanvas.toDataURL("image/png");
      const sliceScaledH = sliceCanvas.height * ratio;

      pdf.addImage(
        sliceData, "PNG",
        pdfMargin, pdfMargin + headerHeight,
        contentWidth, sliceScaledH,
      );

      pdf.setFontSize(8);
      pdf.setTextColor(150, 150, 150);
      const now = new Date().toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
      pdf.text(`Generated ${now}`, pdfMargin, pageHeight - pdfMargin + 2);
      pdf.text(`Page ${page + 1} of ${totalPages}`, pdfWidth - pdfMargin - 25, pageHeight - pdfMargin + 2);
    }

    pdf.save(`${filename}.pdf`);
  } catch {
    if (document.body.contains(cloned)) document.body.removeChild(cloned);
    throw new Error("PDF generation failed");
  }
}

export function ExportPdfButton({
  contentRef,
  filename = "report",
  title,
  variant = "outline",
  size = "sm",
  className,
  includeDate = true,
}: ExportPdfButtonProps) {
  const [isExporting, setIsExporting] = useState(false);
  const { toast } = useToast();

  const handleExport = async () => {
    if (!contentRef.current) {
      toast({ title: "Nothing to export", description: "The report content is not available.", variant: "destructive" });
      return;
    }

    setIsExporting(true);
    toast({ title: "Generating PDF...", description: "This may take a few seconds for large reports." });

    try {
      const dateStr = includeDate ? `_${new Date().toISOString().slice(0, 10)}` : "";
      const cleanFilename = filename.replace(/[^a-zA-Z0-9_-]/g, "_");
      await generatePdf(contentRef.current, `${cleanFilename}${dateStr}`, title);
      toast({ title: "PDF exported", description: "Your report has been downloaded." });
    } catch (err) {
      console.error("PDF export error:", err);
      toast({ title: "Export failed", description: "Unable to generate PDF. Please try again.", variant: "destructive" });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Button
      variant={variant}
      size={size}
      className={cn("gap-2", className)}
      onClick={handleExport}
      disabled={isExporting}
    >
      {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
      {isExporting ? "Exporting..." : "Export PDF"}
    </Button>
  );
}
