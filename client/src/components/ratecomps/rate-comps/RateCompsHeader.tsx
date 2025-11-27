import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Search, Upload as UploadIcon, Plus, Columns, Download, Table, TrendingUp, FolderKanban, HelpCircle } from "lucide-react";
import { Link, useLocation } from "wouter";

interface RateCompsHeaderProps {
  searchQuery?: string;
  onSearchChange?: (value: string) => void;
  total: number;
  canManageColumns?: boolean;
  canCreate?: boolean;
  onColumnsClick?: () => void;
  onExportClick?: () => void;
  onAddCompClick?: () => void;
  onUploadClick?: () => void;
  hasData?: boolean;
}

export default function RateCompsHeader({
  searchQuery = "",
  onSearchChange,
  total,
  canManageColumns = false,
  canCreate = false,
  onColumnsClick,
  onExportClick,
  onAddCompClick,
  onUploadClick,
  hasData = false,
}: RateCompsHeaderProps) {
  const [location] = useLocation();
  
  const isActive = (path: string) => location === path;

  return (
    <div className="sticky top-0 z-40 bg-background">
      <div className="bg-card border-b border-border px-6 py-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4 flex-shrink-0">
            <div className="flex items-center gap-1">
              {onSearchChange && (
                <>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                    <Input
                      placeholder="Search marina, location..."
                      className="pl-10 w-72"
                      value={searchQuery}
                      onChange={(e) => onSearchChange(e.target.value)}
                      data-testid="input-search"
                    />
                  </div>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                        <HelpCircle className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p className="text-sm">
                        <strong>Search Tips:</strong><br/>
                        • Type marina name or location<br/>
                        • Use the filters panel for precise filtering<br/>
                        • Click column headers to sort
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </>
              )}
            </div>
            <div className="text-sm text-muted-foreground ml-4 px-3 py-1 bg-muted rounded-md">
              <span data-testid="text-count" className="font-semibold">{total.toLocaleString()}</span> rate comps found
            </div>
          </div>
          
          <div className="flex items-center gap-2 flex-wrap">
            {canManageColumns && onColumnsClick && (
              <Button
                variant="secondary"
                onClick={onColumnsClick}
                data-testid="button-columns"
              >
                <Columns className="h-4 w-4 mr-2" />
                Columns
              </Button>
            )}

            {onExportClick && (
              <Button
                variant="secondary"
                onClick={onExportClick}
                disabled={!hasData}
                data-testid="button-export"
              >
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            )}

            {canCreate && (
              <>
                {onAddCompClick && (
                  <Button
                    onClick={onAddCompClick}
                    data-testid="button-add-comp"
                    className="bg-blue-700 hover:bg-blue-800 text-white"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Rate Comp
                  </Button>
                )}
                
                {onUploadClick && (
                  <Button
                    variant="outline"
                    onClick={onUploadClick}
                    data-testid="button-upload"
                  >
                    <UploadIcon className="h-4 w-4 mr-2" />
                    Upload
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      <div className="px-6 border-b border-border bg-background">
        <div className="flex items-center gap-2 py-2">
          <Link href="/analysis/rate-comps">
            <Button 
              variant="ghost" 
              className={`flex items-center gap-2 ${isActive('/analysis/rate-comps') ? 'bg-muted' : ''}`}
              data-testid="nav-rate-comps"
            >
              <Table className="h-4 w-4" />
              Rate Comps
            </Button>
          </Link>
          <Link href="/analysis/rate-comps/analytics">
            <Button 
              variant="ghost" 
              className={`flex items-center gap-2 ${isActive('/analysis/rate-comps/analytics') ? 'bg-muted' : ''}`}
              data-testid="nav-analytics"
            >
              <TrendingUp className="h-4 w-4" />
              Analytics
            </Button>
          </Link>
          <Link href="/analysis/rate-comps/projects">
            <Button 
              variant="ghost" 
              className={`flex items-center gap-2 ${isActive('/analysis/rate-comps/projects') ? 'bg-muted' : ''}`}
              data-testid="nav-projects"
            >
              <FolderKanban className="h-4 w-4" />
              Projects
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
