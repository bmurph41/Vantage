import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Palette, Plus, Globe, Check, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { useOmEditorStore } from '@/stores/om-editor-store';

interface BrandKit {
  id: string;
  name: string;
  logoUrl?: string;
  primaryColor?: string;
  secondaryColor?: string;
  accentColor?: string;
  headingFont?: string;
  bodyFont?: string;
}

interface OmBrandKitPanelProps {
  omId: string | null;
}

export function OmBrandKitPanel({ omId }: OmBrandKitPanelProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [scanUrl, setScanUrl] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const { document, updateDocument } = useOmEditorStore();

  const { data: brandKits = [], isLoading } = useQuery<BrandKit[]>({
    queryKey: ['/api/om-builder/brand-kits'],
    enabled: Boolean(omId),
  });

  const scanMutation = useMutation({
    mutationFn: async (url: string) => {
      const res = await apiRequest('POST', '/api/om-builder/brand-kits/auto-import', { url });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/om-builder/brand-kits'] });
      toast({ title: 'Brand kit created', description: 'Colors and fonts extracted from website' });
      setScanUrl('');
    },
    onError: () => {
      toast({ title: 'Scan failed', description: 'Could not extract brand from URL', variant: 'destructive' });
    },
  });

  const handleScan = async () => {
    if (!scanUrl.trim()) return;
    setIsScanning(true);
    try {
      await scanMutation.mutateAsync(scanUrl);
    } finally {
      setIsScanning(false);
    }
  };

  const handleSelectKit = (kit: BrandKit) => {
    updateDocument({ brandKitId: kit.id });
    toast({ title: 'Brand kit applied', description: `Using "${kit.name}" brand kit` });
  };

  const selectedKitId = document?.brandKitId;

  return (
    <div className="h-full flex flex-col">
      <div className="p-3 border-b">
        <div className="flex items-center gap-2 mb-2">
          <Palette className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">Brand Kit</span>
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          Import brand colors and fonts from a website URL
        </p>
        <div className="flex gap-2">
          <Input
            value={scanUrl}
            onChange={(e) => setScanUrl(e.target.value)}
            placeholder="https://example.com"
            className="text-xs h-8"
            data-testid="input-brand-url"
          />
          <Button
            size="sm"
            onClick={handleScan}
            disabled={isScanning || !scanUrl.trim()}
            data-testid="btn-scan-brand"
          >
            <Globe className="h-3 w-3 mr-1" />
            {isScanning ? 'Scanning...' : 'Scan'}
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-3 space-y-2">
          {isLoading ? (
            <div className="text-xs text-muted-foreground text-center py-4">Loading brand kits...</div>
          ) : brandKits.length === 0 ? (
            <div className="text-xs text-muted-foreground text-center py-4">
              No brand kits yet. Scan a website to create one.
            </div>
          ) : (
            brandKits.map((kit) => (
              <div
                key={kit.id}
                className={`p-3 border rounded-lg cursor-pointer hover:border-primary transition-colors ${
                  selectedKitId === kit.id ? 'border-primary bg-primary/5' : ''
                }`}
                onClick={() => handleSelectKit(kit)}
                data-testid={`brandkit-${kit.id}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">{kit.name}</span>
                  {selectedKitId === kit.id && (
                    <Check className="h-4 w-4 text-primary" />
                  )}
                </div>
                <div className="flex gap-1 mb-2">
                  {kit.primaryColor && (
                    <div
                      className="w-6 h-6 rounded border"
                      style={{ backgroundColor: kit.primaryColor }}
                      title="Primary"
                    />
                  )}
                  {kit.secondaryColor && (
                    <div
                      className="w-6 h-6 rounded border"
                      style={{ backgroundColor: kit.secondaryColor }}
                      title="Secondary"
                    />
                  )}
                  {kit.accentColor && (
                    <div
                      className="w-6 h-6 rounded border"
                      style={{ backgroundColor: kit.accentColor }}
                      title="Accent"
                    />
                  )}
                </div>
                <div className="text-xs text-muted-foreground">
                  {kit.headingFont && <span>{kit.headingFont}</span>}
                  {kit.headingFont && kit.bodyFont && <span> / </span>}
                  {kit.bodyFont && <span>{kit.bodyFont}</span>}
                </div>
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
