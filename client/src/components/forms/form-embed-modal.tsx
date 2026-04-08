import { useState } from "react";
import { Copy, ExternalLink, QrCode, Code, Share, Link, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import type { Form } from "@shared/schema";

interface FormEmbedModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: Form;
}

export default function FormEmbedModal({ open, onOpenChange, form }: FormEmbedModalProps) {
  const [embedType, setEmbedType] = useState<string>("iframe");
  const [embedSize, setEmbedSize] = useState<string>("medium");
  const [includeStyles, setIncludeStyles] = useState<boolean>(true);
  const [trackingEnabled, setTrackingEnabled] = useState<boolean>(true);
  
  const { toast } = useToast();

  // Generate embed codes
  const baseUrl = `${window.location.origin}`;
  const formUrl = `${baseUrl}/forms/${form.id}`;
  
  const embedSizes = {
    small: { width: "400", height: "300" },
    medium: { width: "600", height: "500" },
    large: { width: "800", height: "700" },
    responsive: { width: "100%", height: "500" }
  };

  const selectedSize = embedSizes[embedSize as keyof typeof embedSizes];

  const generateEmbedCode = () => {
    const trackingParams = trackingEnabled ? '?utm_source=embed' : '';
    
    switch (embedType) {
      case 'iframe':
        return `<iframe 
  src="${formUrl}${trackingParams}" 
  width="${selectedSize.width}" 
  height="${selectedSize.height}" 
  frameborder="0" 
  style="border: none; border-radius: 8px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
</iframe>`;

      case 'javascript':
        return `<script>
  (function(d, s, id) {
    var js, fjs = d.getElementsByTagName(s)[0];
    if (d.getElementById(id)) return;
    js = d.createElement(s); js.id = id;
    js.src = "${baseUrl}/embed.js";
    js.setAttribute('data-form-id', '${form.id}');
    js.setAttribute('data-width', '${selectedSize.width}');
    js.setAttribute('data-height', '${selectedSize.height}');
    ${includeStyles ? `js.setAttribute('data-include-styles', 'true');` : ''}
    ${trackingEnabled ? `js.setAttribute('data-tracking', 'true');` : ''}
    fjs.parentNode.insertBefore(js, fjs);
  }(document, 'script', 'marina-form-${form.id}'));
</script>
<div id="marina-form-${form.id}"></div>`;

      case 'link':
        return `<a href="${formUrl}${trackingParams}" target="_blank" style="display: inline-block; padding: 12px 24px; background: #3b82f6; color: white; text-decoration: none; border-radius: 6px; font-weight: 500;">
  Fill out ${form.name}
</a>`;

      case 'popup':
        return `<script>
  function openMarinaForm() {
    const popup = window.open(
      '${formUrl}${trackingParams}', 
      'marina-form', 
      'width=${selectedSize.width},height=${selectedSize.height},scrollbars=yes,resizable=yes'
    );
    popup.focus();
  }
</script>
<button onclick="openMarinaForm()" style="padding: 12px 24px; background: #3b82f6; color: white; border: none; border-radius: 6px; font-weight: 500; cursor: pointer;">
  Open ${form.name}
</button>`;

      default:
        return '';
    }
  };

  const embedCode = generateEmbedCode();

  const copyToClipboard = async (text: string, type: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: `${type} copied to clipboard` });
    } catch (error) {
      toast({ 
        title: "Failed to copy", 
        description: "Please copy manually",
        variant: "destructive" 
      });
    }
  };

  const generateQRCode = () => {
    // In a real implementation, you would use a QR code library
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(formUrl)}`;
    return qrCodeUrl;
  };

  const socialShareUrls = {
    twitter: `https://twitter.com/intent/tweet?text=Check out this form&url=${encodeURIComponent(formUrl)}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(formUrl)}`,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(formUrl)}`
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl w-full max-h-[90vh] overflow-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <Share className="w-5 h-5 mr-2" />
            Embed & Share Form: {form.name}
          </DialogTitle>
          <DialogDescription>
            Generate embed codes, direct links, and sharing options for your form.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="embed" className="w-full">
          <TabsList className="grid w-full grid-cols-2 lg:grid-cols-4">
            <TabsTrigger data-testid="tab-embed" value="embed">Embed Code</TabsTrigger>
            <TabsTrigger data-testid="tab-link" value="link">Direct Link</TabsTrigger>
            <TabsTrigger data-testid="tab-qr" value="qr">QR Code</TabsTrigger>
            <TabsTrigger data-testid="tab-social" value="social">Social Share</TabsTrigger>
          </TabsList>

          {/* Embed Code Tab */}
          <TabsContent value="embed" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Configuration */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Embed Configuration</CardTitle>
                  <CardDescription>
                    Customize how your form appears when embedded
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="embed-type">Embed Type</Label>
                    <Select value={embedType} onValueChange={setEmbedType}>
                      <SelectTrigger data-testid="select-embed-type">
                        <SelectValue placeholder="Select embed type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="iframe">iframe (Recommended)</SelectItem>
                        <SelectItem value="javascript">JavaScript Widget</SelectItem>
                        <SelectItem value="link">Simple Link</SelectItem>
                        <SelectItem value="popup">Popup Window</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="embed-size">Size</Label>
                    <Select value={embedSize} onValueChange={setEmbedSize}>
                      <SelectTrigger data-testid="select-embed-size">
                        <SelectValue placeholder="Select size" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="small">Small (400x300)</SelectItem>
                        <SelectItem value="medium">Medium (600x500)</SelectItem>
                        <SelectItem value="large">Large (800x700)</SelectItem>
                        <SelectItem value="responsive">Responsive (100%)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="include-styles"
                        checked={includeStyles}
                        onCheckedChange={setIncludeStyles}
                        data-testid="switch-include-styles"
                      />
                      <Label htmlFor="include-styles">Include default styles</Label>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Switch
                        id="tracking-enabled"
                        checked={trackingEnabled}
                        onCheckedChange={setTrackingEnabled}
                        data-testid="switch-tracking"
                      />
                      <Label htmlFor="tracking-enabled">Enable tracking</Label>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Preview */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Preview</CardTitle>
                  <CardDescription>
                    How your form will appear when embedded
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="border rounded-lg p-4 bg-gray-50 dark:bg-gray-900/50">
                    <div 
                      className="bg-white dark:bg-gray-900 rounded border"
                      style={{
                        width: embedSize === 'responsive' ? '100%' : selectedSize.width + 'px',
                        height: '200px',
                        minHeight: '200px'
                      }}
                    >
                      <div className="p-4 text-center text-gray-500 flex items-center justify-center h-full">
                        <div>
                          <Code className="w-8 h-8 mx-auto mb-2" />
                          <p className="text-sm">Form Preview</p>
                          <p className="text-xs">{selectedSize.width} × {selectedSize.height}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Generated Code */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Generated Embed Code</CardTitle>
                <CardDescription>
                  Copy and paste this code into your website
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="relative">
                  <Textarea
                    data-testid="textarea-embed-code"
                    value={embedCode}
                    readOnly
                    className="font-mono text-sm min-h-[120px]"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    className="absolute top-2 right-2"
                    onClick={() => copyToClipboard(embedCode, "Embed code")}
                    data-testid="button-copy-embed"
                  >
                    <Copy className="w-4 h-4 mr-1" />
                    Copy
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Direct Link Tab */}
          <TabsContent value="link" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Direct Form Link</CardTitle>
                <CardDescription>
                  Share this link directly with your audience
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="form-url">Form URL</Label>
                  <div className="flex gap-2">
                    <Input
                      id="form-url"
                      data-testid="input-form-url"
                      value={formUrl}
                      readOnly
                      className="flex-1"
                    />
                    <Button
                      variant="outline"
                      onClick={() => copyToClipboard(formUrl, "Form URL")}
                      data-testid="button-copy-url"
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => window.open(formUrl, '_blank')}
                      data-testid="button-open-form"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                  <Card className="p-4">
                    <div className="text-center">
                      <Link className="w-8 h-8 mx-auto mb-2 text-blue-600" />
                      <h4 className="font-semibold">Direct Access</h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Users can access the form directly via this URL
                      </p>
                    </div>
                  </Card>

                  <Card className="p-4">
                    <div className="text-center">
                      <Share className="w-8 h-8 mx-auto mb-2 text-green-600" />
                      <h4 className="font-semibold">Easy Sharing</h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Perfect for emails, messages, or social media
                      </p>
                    </div>
                  </Card>

                  <Card className="p-4">
                    <div className="text-center">
                      <ExternalLink className="w-8 h-8 mx-auto mb-2 text-purple-600" />
                      <h4 className="font-semibold">Mobile Friendly</h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Optimized for all devices and screen sizes
                      </p>
                    </div>
                  </Card>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* QR Code Tab */}
          <TabsContent value="qr" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">QR Code</CardTitle>
                <CardDescription>
                  Generate a QR code for easy mobile access to your form
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col lg:flex-row gap-6">
                  <div className="flex-1 text-center">
                    <div className="inline-block p-4 bg-white dark:bg-gray-900 border rounded-lg">
                      <img
                        src={generateQRCode()}
                        alt="QR Code for form"
                        className="w-48 h-48 mx-auto"
                        data-testid="img-qr-code"
                      />
                    </div>
                    <div className="mt-4 space-x-2">
                      <Button
                        variant="outline"
                        onClick={() => {
                          const link = document.createElement('a');
                          link.href = generateQRCode();
                          link.download = `${form.name}-qr-code.png`;
                          link.click();
                        }}
                        data-testid="button-download-qr"
                      >
                        <Download className="w-4 h-4 mr-1" />
                        Download
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => copyToClipboard(generateQRCode(), "QR code URL")}
                        data-testid="button-copy-qr"
                      >
                        <Copy className="w-4 h-4 mr-1" />
                        Copy URL
                      </Button>
                    </div>
                  </div>

                  <div className="flex-1 space-y-4">
                    <div>
                      <h4 className="font-semibold mb-2">How to use QR codes:</h4>
                      <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                        <li>• Print on business cards or flyers</li>
                        <li>• Display at events or in physical locations</li>
                        <li>• Include in presentations or documents</li>
                        <li>• Add to marketing materials</li>
                      </ul>
                    </div>

                    <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                      <h4 className="font-semibold text-blue-900 dark:text-blue-200 mb-2">
                        <QrCode className="w-4 h-4 inline mr-1" />
                        Pro Tip
                      </h4>
                      <p className="text-sm text-blue-800 dark:text-blue-300">
                        QR codes work best when they're at least 1 inch (2.5 cm) square. 
                        Test scanning from various distances to ensure readability.
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Social Share Tab */}
          <TabsContent value="social" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Social Media Sharing</CardTitle>
                <CardDescription>
                  Share your form across social media platforms
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card className="p-4 text-center">
                    <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center mx-auto mb-3">
                      <svg className="w-6 h-6 text-blue-600" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M24 4.557c-.883.392-1.832.656-2.828.775 1.017-.609 1.798-1.574 2.165-2.724-.951.564-2.005.974-3.127 1.195-.897-.957-2.178-1.555-3.594-1.555-3.179 0-5.515 2.966-4.797 6.045-4.091-.205-7.719-2.165-10.148-5.144-1.29 2.213-.669 5.108 1.523 6.574-.806-.026-1.566-.247-2.229-.616-.054 2.281 1.581 4.415 3.949 4.89-.693.188-1.452.232-2.224.084.626 1.956 2.444 3.379 4.6 3.419-2.07 1.623-4.678 2.348-7.29 2.04 2.179 1.397 4.768 2.212 7.548 2.212 9.142 0 14.307-7.721 13.995-14.646.962-.695 1.797-1.562 2.457-2.549z"/>
                      </svg>
                    </div>
                    <h4 className="font-semibold mb-2">Twitter</h4>
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => window.open(socialShareUrls.twitter, '_blank')}
                      data-testid="button-share-twitter"
                    >
                      Share on Twitter
                    </Button>
                  </Card>

                  <Card className="p-4 text-center">
                    <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center mx-auto mb-3">
                      <svg className="w-6 h-6 text-blue-600" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                      </svg>
                    </div>
                    <h4 className="font-semibold mb-2">Facebook</h4>
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => window.open(socialShareUrls.facebook, '_blank')}
                      data-testid="button-share-facebook"
                    >
                      Share on Facebook
                    </Button>
                  </Card>

                  <Card className="p-4 text-center">
                    <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center mx-auto mb-3">
                      <svg className="w-6 h-6 text-blue-600" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                      </svg>
                    </div>
                    <h4 className="font-semibold mb-2">LinkedIn</h4>
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => window.open(socialShareUrls.linkedin, '_blank')}
                      data-testid="button-share-linkedin"
                    >
                      Share on LinkedIn
                    </Button>
                  </Card>
                </div>

                {/* Custom Share Message */}
                <Card className="mt-6">
                  <CardHeader>
                    <CardTitle className="text-base">Custom Share Message</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <Textarea
                        placeholder="Write a custom message to accompany your form link..."
                        className="min-h-[80px]"
                        data-testid="textarea-share-message"
                      />
                      <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
                        <span>Include form link automatically</span>
                        <Badge variant="secondary">{formUrl}</Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}