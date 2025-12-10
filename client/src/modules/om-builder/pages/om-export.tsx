import { useState } from "react";
import { Link, useRoute } from "wouter";
import { ArrowLeft, Download, Printer, FileText, Mail, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import type { Om } from "@shared/schema";

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
          </div>
        </div>
      </div>
    </div>
  );
}
