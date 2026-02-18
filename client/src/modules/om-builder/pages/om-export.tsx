import { useState } from "react";
import { Link, useRoute } from "wouter";
import { ArrowLeft, Download, Printer, FileText, Mail, Share2, FolderLock, Check, FolderOpen, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { VdrFolderPicker } from "../components/vdr-folder-picker";
import { generatePdf, downloadPdf } from "../components/OmPdfDocument";
import type { Om, VdrFolder } from "@shared/schema";
import type { OmPage, OmDocumentDimension } from "../types";

export default function OMExport() {
  const [, params] = useRoute("/om/export/:omId");
  const omId = params?.omId;

  const { data: om } = useQuery<Om>({
    queryKey: ['/api/om/oms', omId],
    enabled: !!omId,
  });

  const [exportFormat, setExportFormat] = useState("pdf");
  const [includeAppendix, setIncludeAppendix] = useState(true);
  const [includeToc, setIncludeToc] = useState(true);
  const [selectedVdrFolder, setSelectedVdrFolder] = useState<VdrFolder | null>(null);
  const [vdrExportSuccess, setVdrExportSuccess] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [recipientEmail, setRecipientEmail] = useState("");
  const [emailSending, setEmailSending] = useState(false);

  const pages: OmPage[] = om?.pages as OmPage[] || [];
  const dimension: OmDocumentDimension = (om?.dimension as OmDocumentDimension) || 'portrait';

  const handleExport = async () => {
    if (pages.length === 0) {
      toast({ 
        title: "No Pages", 
        description: "This document has no pages to export.",
        variant: "destructive" 
      });
      return;
    }

    setIsExporting(true);

    if (exportFormat === 'pdf') {
      toast({ title: "Export Started", description: "Your PDF is being generated..." });
      try {
        const blob = await generatePdf(pages, om?.name || 'Offering Memorandum', {
          dimension,
          includePageNumbers: true,
          includeHeader: true,
        });
        const filename = `${om?.name || 'Offering_Memorandum'}.pdf`.replace(/\s+/g, '_');
        downloadPdf(blob, filename);
        toast({ title: "Export Complete", description: "Your PDF has been downloaded." });
      } catch (error) {
        console.error('PDF generation error:', error);
        toast({ title: "Export Failed", description: "There was an error generating the PDF. Please try again.", variant: "destructive" });
      } finally {
        setIsExporting(false);
      }
      return;
    }

    if (exportFormat === 'docx') {
      try {
        toast({ title: "Export Started", description: "Your Word document is being generated..." });
        const htmlContent = pages.map((page, idx) => {
          const title = page.title || `Page ${idx + 1}`;
          const body = page.content || page.body || '';
          return `<div style="page-break-after: always;"><h2>${title}</h2><div>${body}</div></div>`;
        }).join('');
        
        const fullHtml = `
          <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
          <head><meta charset="utf-8"><title>${om?.name || 'Offering Memorandum'}</title>
          <style>body { font-family: Calibri, Arial, sans-serif; margin: 1in; } h1 { color: #1a365d; } h2 { color: #2d3748; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; }</style>
          </head><body>
          <h1>${om?.name || 'Offering Memorandum'}</h1>
          ${includeToc ? '<h2>Table of Contents</h2><ul>' + pages.map((p, i) => `<li>${p.title || `Page ${i + 1}`}</li>`).join('') + '</ul><div style="page-break-after: always;"></div>' : ''}
          ${htmlContent}
          </body></html>`;
        
        const blob = new Blob([fullHtml], { type: 'application/msword' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${om?.name || 'Offering_Memorandum'}.doc`.replace(/\s+/g, '_');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        toast({ title: "Export Complete", description: "Your Word document has been downloaded." });
      } catch (error) {
        console.error('DOCX generation error:', error);
        toast({ title: "Export Failed", description: "There was an error generating the document.", variant: "destructive" });
      } finally {
        setIsExporting(false);
      }
      return;
    }

    if (exportFormat === 'pptx') {
      try {
        toast({ title: "Export Started", description: "Your presentation is being generated..." });
        const htmlContent = pages.map((page, idx) => {
          const title = page.title || `Slide ${idx + 1}`;
          const body = page.content || page.body || '';
          return `<div style="page-break-after: always; min-height: 500px;"><h1 style="font-size: 28px; color: #1a365d;">${title}</h1><div style="font-size: 16px; margin-top: 20px;">${body}</div></div>`;
        }).join('');
        
        const fullHtml = `
          <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
          <head><meta charset="utf-8"><title>${om?.name || 'Offering Memorandum'}</title>
          <style>body { font-family: Calibri, Arial, sans-serif; margin: 40px; }</style>
          </head><body>${htmlContent}</body></html>`;
        
        const blob = new Blob([fullHtml], { type: 'application/vnd.ms-powerpoint' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${om?.name || 'Offering_Memorandum'}.ppt`.replace(/\s+/g, '_');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        toast({ title: "Export Complete", description: "Your presentation has been downloaded." });
      } catch (error) {
        console.error('PPTX generation error:', error);
        toast({ title: "Export Failed", description: "There was an error generating the presentation.", variant: "destructive" });
      } finally {
        setIsExporting(false);
      }
      return;
    }

    setIsExporting(false);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleEmail = () => {
    setRecipientEmail("");
    setEmailDialogOpen(true);
  };

  const handleSendEmail = async () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(recipientEmail)) {
      toast({ title: "Invalid Email", description: "Please enter a valid email address.", variant: "destructive" });
      return;
    }

    setEmailSending(true);
    try {
      await apiRequest("POST", `/api/om/oms/${omId}/email`, { recipientEmail, omName: om?.name || 'Offering Memorandum' });
      toast({ title: "Email Sent", description: `Document sent to ${recipientEmail}` });
      setEmailDialogOpen(false);
    } catch (error) {
      toast({ title: "Send Failed", description: "Could not send the email. Please try again.", variant: "destructive" });
    } finally {
      setEmailSending(false);
    }
  };

  const exportToVdrMutation = useMutation({
    mutationFn: (data: { folderId: string; projectId: string }) =>
      apiRequest('POST', `/api/om/oms/${omId}/export-to-vdr`, data),
    onSuccess: () => {
      setVdrExportSuccess(true);
      toast({ 
        title: "Saved to Data Room", 
        description: `Document saved to "${selectedVdrFolder?.name}" folder.` 
      });
      setTimeout(() => setVdrExportSuccess(false), 3000);
    },
    onError: () => {
      toast({ 
        title: "Error", 
        description: "Failed to save to VDR.", 
        variant: "destructive" 
      });
    }
  });

  const handleExportToVdr = () => {
    if (!selectedVdrFolder) {
      toast({
        title: "Select a Folder",
        description: "Please select a Data Room folder first.",
        variant: "destructive"
      });
      return;
    }
    
    exportToVdrMutation.mutate({
      folderId: selectedVdrFolder.id,
      projectId: om?.projectId || selectedVdrFolder.projectId,
    });
  };

  const handleFolderSelect = (folder: VdrFolder) => {
    setSelectedVdrFolder(folder);
    setVdrExportSuccess(false);
  };

  return (
    <div className="h-full bg-background overflow-auto">
      <div className="container mx-auto max-w-6xl py-8 px-6">
        <div className="mb-8">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground" data-testid="text-page-title">
            Export & Share
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {om?.name || "Offering Memorandum"}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Document Preview</CardTitle>
                <CardDescription>Preview how your document will appear when exported</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="aspect-[8.5/11] bg-white border border-border rounded-lg shadow-sm flex items-center justify-center">
                  <div className="text-center text-muted-foreground">
                    <FileText className="w-16 h-16 mx-auto mb-4" />
                    <p className="font-medium">{om?.name || "Document Preview"}</p>
                    <p className="text-sm mt-1">Preview will appear here</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Export Options</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-xs">Format</Label>
                  <Select value={exportFormat} onValueChange={setExportFormat}>
                    <SelectTrigger className="mt-1" data-testid="select-export-format">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pdf">PDF Document</SelectItem>
                      <SelectItem value="docx">Word Document</SelectItem>
                      <SelectItem value="pptx">PowerPoint</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-xs">Paper Size</Label>
                  <Select defaultValue="letter">
                    <SelectTrigger className="mt-1" data-testid="select-paper-size">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="letter">US Letter</SelectItem>
                      <SelectItem value="a4">A4</SelectItem>
                      <SelectItem value="legal">Legal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="toc" 
                      checked={includeToc}
                      onCheckedChange={(checked) => setIncludeToc(checked as boolean)}
                    />
                    <Label htmlFor="toc" className="text-sm font-normal">Include Table of Contents</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="appendix" 
                      checked={includeAppendix}
                      onCheckedChange={(checked) => setIncludeAppendix(checked as boolean)}
                    />
                    <Label htmlFor="appendix" className="text-sm font-normal">Include Appendix</Label>
                  </div>
                </div>

                <Button className="w-full" onClick={handleExport} disabled={isExporting} data-testid="button-export">
                  {isExporting ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4 mr-2" />
                  )}
                  {isExporting ? 'Generating...' : `Export ${exportFormat.toUpperCase()}`}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button variant="outline" className="w-full justify-start" onClick={handlePrint}>
                  <Printer className="w-4 h-4 mr-2" />
                  Print
                </Button>
                <Button variant="outline" className="w-full justify-start" onClick={handleEmail}>
                  <Mail className="w-4 h-4 mr-2" />
                  Email
                </Button>
                <Button variant="outline" className="w-full justify-start" onClick={handleEmail}>
                  <Share2 className="w-4 h-4 mr-2" />
                  Share Link
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <FolderLock className="w-4 h-4" />
                  Save to Data Room
                </CardTitle>
                <CardDescription className="text-xs">
                  Export this document directly to the Virtual Data Room
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label className="text-xs mb-1.5 block">Destination Folder</Label>
                  <VdrFolderPicker
                    projectId={om?.projectId || null}
                    onSelect={handleFolderSelect}
                    selectedFolderId={selectedVdrFolder?.id}
                  />
                  {selectedVdrFolder && (
                    <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded px-2 py-1.5">
                      <FolderOpen className="w-3 h-3" />
                      <span className="truncate">{selectedVdrFolder.path || selectedVdrFolder.name}</span>
                    </div>
                  )}
                </div>
                
                <Button 
                  className="w-full" 
                  onClick={handleExportToVdr}
                  disabled={exportToVdrMutation.isPending || !selectedVdrFolder}
                  data-testid="button-export-vdr"
                >
                  {vdrExportSuccess ? (
                    <>
                      <Check className="w-4 h-4 mr-2" />
                      Saved Successfully
                    </>
                  ) : exportToVdrMutation.isPending ? (
                    'Saving...'
                  ) : (
                    <>
                      <FolderLock className="w-4 h-4 mr-2" />
                      Save to Data Room
                    </>
                  )}
                </Button>
                
                {!om?.projectId && (
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    This OM is not linked to a project. Link it to a project to access its Data Room.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <Dialog open={emailDialogOpen} onOpenChange={setEmailDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Email Document</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Recipient Email</Label>
              <Input
                type="email"
                placeholder="name@example.com"
                value={recipientEmail}
                onChange={(e: any) => setRecipientEmail(e.target.value)}
                onKeyDown={(e: any) => e.key === 'Enter' && handleSendEmail()}
              />
            </div>
            <p className="text-sm text-muted-foreground">
              The document will be sent as a PDF attachment.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEmailDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSendEmail} disabled={!recipientEmail || emailSending}>
              {emailSending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Mail className="w-4 h-4 mr-2" />}
              {emailSending ? 'Sending...' : 'Send'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
