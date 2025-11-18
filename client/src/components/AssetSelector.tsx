import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2, FolderKanban } from "lucide-react";

interface Asset {
  id: string;
  propertyId: string;
  acquisitionDate: string;
  status: string;
  property: {
    id: string;
    title: string;
    type: string;
    address?: string;
    status: string;
  };
}

interface AssetSelectorProps {
  value?: string | null;
  onChange: (assetId: string | null) => void;
  className?: string;
}

export function AssetSelector({ value, onChange, className }: AssetSelectorProps) {
  const [selectedAsset, setSelectedAsset] = useState<string>(value || "portfolio");

  // Fetch owned assets
  const { data: assets, isLoading } = useQuery<Asset[]>({
    queryKey: ["/api/owned-assets"],
  });

  useEffect(() => {
    if (value !== undefined) {
      setSelectedAsset(value || "portfolio");
    }
  }, [value]);

  const handleChange = (newValue: string) => {
    setSelectedAsset(newValue);
    onChange(newValue === "portfolio" ? null : newValue);
  };

  if (isLoading) {
    return (
      <Select disabled>
        <SelectTrigger className={className} data-testid="asset-selector-loading">
          <SelectValue placeholder="Loading..." />
        </SelectTrigger>
      </Select>
    );
  }

  const hasAssets = assets && assets.length > 0;

  return (
    <Select value={selectedAsset} onValueChange={handleChange}>
      <SelectTrigger className={className} data-testid="asset-selector">
        <div className="flex items-center gap-2">
          {selectedAsset === "portfolio" ? (
            <FolderKanban className="h-4 w-4" />
          ) : (
            <Building2 className="h-4 w-4" />
          )}
          <SelectValue />
        </div>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="portfolio" data-testid="option-portfolio">
          <div className="flex items-center gap-2">
            <FolderKanban className="h-4 w-4" />
            <span>All Marinas (Portfolio)</span>
          </div>
        </SelectItem>
        
        {hasAssets && assets.map((asset) => (
          <SelectItem 
            key={asset.id} 
            value={asset.id}
            data-testid={`option-asset-${asset.id}`}
          >
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              <span>{asset.property.title}</span>
              {asset.property.address && (
                <span className="text-xs text-muted-foreground">
                  • {asset.property.address}
                </span>
              )}
            </div>
          </SelectItem>
        ))}
        
        {!hasAssets && (
          <SelectItem value="no-assets" disabled data-testid="option-no-assets">
            <span className="text-muted-foreground">No marinas found</span>
          </SelectItem>
        )}
      </SelectContent>
    </Select>
  );
}
