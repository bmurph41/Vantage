import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Images, Upload, Search, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { useOmEditorStore } from '@/stores/om-editor-store';

interface OmAsset {
  id: string;
  fileName: string;
  fileType: string;
  url: string;
  thumbnailUrl?: string;
  width?: number;
  height?: number;
  fileSizeBytes: number;
}

interface OmAssetLibraryPanelProps {
  omId: string | null;
}

export function OmAssetLibraryPanel({ omId }: OmAssetLibraryPanelProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const { addBlock, currentPageId } = useOmEditorStore();

  const { data: assets = [], isLoading } = useQuery<OmAsset[]>({
    queryKey: ['/api/om-builder/assets', { omId }],
    enabled: Boolean(omId),
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      if (omId) formData.append('omId', omId);
      
      const res = await fetch('/api/om-builder/assets/upload', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      
      if (!res.ok) throw new Error('Upload failed');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/om-builder/assets'] });
      toast({ title: 'Asset uploaded', description: 'Image added to library' });
    },
    onError: () => {
      toast({ title: 'Upload failed', description: 'Could not upload file', variant: 'destructive' });
    },
  });

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setIsUploading(true);
    try {
      await uploadMutation.mutateAsync(file);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleInsertAsset = (asset: OmAsset) => {
    if (!currentPageId) {
      toast({ title: 'No page selected', description: 'Select a page first', variant: 'destructive' });
      return;
    }

    addBlock({
      id: crypto.randomUUID(),
      pageId: currentPageId,
      position: { x: 50, y: 50, width: asset.width || 200, height: asset.height || 150, zIndex: 1 },
      style: {},
      data: {
        type: 'image',
        src: asset.url,
        alt: asset.fileName,
      },
    });
    toast({ title: 'Image inserted', description: asset.fileName });
  };

  const filteredAssets = assets.filter(a => 
    a.fileName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="h-full flex flex-col">
      <div className="p-3 border-b">
        <div className="flex items-center gap-2 mb-2">
          <Images className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">Asset Library</span>
        </div>
        
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
        />
        
        <Button
          variant="outline"
          size="sm"
          className="w-full mb-2"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          data-testid="btn-upload-asset"
        >
          <Upload className="h-3 w-3 mr-1" />
          {isUploading ? 'Uploading...' : 'Upload Image'}
        </Button>
        
        <div className="relative">
          <Search className="h-3 w-3 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search assets..."
            className="text-xs h-8 pl-7"
            data-testid="input-search-assets"
          />
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-3">
          {isLoading ? (
            <div className="text-xs text-muted-foreground text-center py-4">Loading assets...</div>
          ) : filteredAssets.length === 0 ? (
            <div className="text-xs text-muted-foreground text-center py-4">
              {searchQuery ? 'No matching assets found' : 'No assets yet. Upload an image to get started.'}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {filteredAssets.map((asset) => (
                <div
                  key={asset.id}
                  className="group relative border rounded-lg overflow-hidden cursor-pointer hover:border-primary transition-colors"
                  onClick={() => handleInsertAsset(asset)}
                  data-testid={`asset-${asset.id}`}
                >
                  <div className="aspect-square bg-muted flex items-center justify-center">
                    <img
                      src={asset.thumbnailUrl || asset.url}
                      alt={asset.fileName}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Button size="sm" variant="secondary" className="text-xs">
                      Insert
                    </Button>
                  </div>
                  <div className="p-1.5">
                    <p className="text-xs truncate">{asset.fileName}</p>
                    <p className="text-[10px] text-muted-foreground">{formatSize(asset.fileSizeBytes)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
