import { useState } from "react";
import { Link, useRoute } from "wouter";
import { ArrowLeft, Download, Printer, FileText, Mail, Share2, FolderLock, Check, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { VdrFolderPicker } from "../components/vdr-folder-picker";
import type { Om, VdrFolder } from "@shared/schema";

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

  const handleExport = () => {
    toast({ 
      title: "Export Started", 
      description: `Your ${exportFormat.toUpperCase()} is being generated...` 
    });
    
    setTimeout(() => {
      toast({ 
        title: "Export Complete", 
        description: "Your document is ready for download." 
      });
    }, 2000);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleEmail = () => {
    toast({ 
      title: "Coming Soon", 
      description: "Email sharing will be available in a future update." 
    });
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

                <Button className="w-full" onClick={handleExport} data-testid="button-export">
                  <Download className="w-4 h-4 mr-2" />
                  Export {exportFormat.toUpperCase()}
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
    </div>
  );
}
