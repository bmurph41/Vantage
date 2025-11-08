import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { 
  ChevronUp, 
  ChevronDown, 
  Edit, 
  Trash2, 
  ExternalLink,
  MoreHorizontal,
  Eye,
  Lightbulb,
  Settings
} from "lucide-react";
import { formatCurrency, formatPercent, formatNumber } from '@/lib/salescomps/format';
import CreateEditCompDialog from "@/components/salescomps/sales-comps/CreateEditCompDialog";
import Detail from "@/pages/analysis/sales-comps/Detail";
import { useAuth } from "@/hooks/useAuth";
import type { SalesComp, User, Project } from "@shared/schema";
import type { ProjectCompsResponse } from '@/lib/salescomps/api';

interface ProjectCompsTableProps {
  data: (ProjectCompsResponse['comps'][0])[];
  loading: boolean;
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
  sortBy: string;
  sortDir: 'asc' | 'desc';
  onSort: (field: string) => void;
  canEdit?: boolean;
  canDelete?: boolean;
  projectId?: string;
  projectName?: string;
  project?: Project | null;
  onAutoPopulate?: () => void;
  onEditProject?: () => void;
}

export default function ProjectCompsTable({
  data,
  loading,
  selectedIds,
  onSelectionChange,
  sortBy,
  sortDir,
  onSort,
  canEdit = false,
  canDelete = false,
  projectId,
  projectName,
  project,
  onAutoPopulate,
  onEditProject,
}: ProjectCompsTableProps) {
  const { user } = useAuth();
  const [editingComp, setEditingComp] = useState<SalesComp | null>(null);
  const [detailCompId, setDetailCompId] = useState<string | null>(null);

  const columns = [
    { key: 'marina', label: 'Marina', sortable: true, width: 'min-w-80' },
    { key: 'state', label: 'State', sortable: true, width: 'w-20' },
    { key: 'saleYear', label: 'Sale Year', sortable: true, width: 'w-24' },
    { key: 'salePrice', label: 'Sale Price', sortable: true, width: 'w-28' },
    { key: 'capRate', label: 'Cap Rate', sortable: true, width: 'w-24' },
    { key: 'noi', label: 'NOI', sortable: true, width: 'w-24' },
    { key: 'wetSlips', label: 'Wet Slips', sortable: true, width: 'w-20' },
    { key: 'dryRacks', label: 'Dry Racks', sortable: true, width: 'w-20' },
    { key: 'occupancy', label: 'Occupancy', sortable: true, width: 'w-24' },
    { key: 'market', label: 'Market', sortable: true, width: 'w-32' },
    { key: 'actions', label: 'Actions', width: 'w-20' },
  ];

  const formatCellValue = (comp: SalesComp, column: string) => {
    const value = comp[column as keyof SalesComp];
    
    switch (column) {
      case 'salePrice':
        if (!comp.isPriceDisclosed) {
          return <span className="text-muted-foreground" title="Price not disclosed">Undisclosed</span>;
        }
        return value ? formatCurrency(Number(value)) : '—';
      case 'listPrice':
        return value ? formatCurrency(Number(value)) : '—';
      case 'noi':
        if (!comp.isNoiDisclosed) {
          return <span className="text-muted-foreground" title="NOI not disclosed">Undisclosed</span>;
        }
        return value ? formatCurrency(Number(value)) : '—';
      case 'capRate':
        // Calculate cap rate as NOI / Sale Price
        if (!comp.isNoiDisclosed || !comp.isPriceDisclosed || !comp.noi || !comp.salePrice) {
          return '—';
        }
        const calculatedCapRate = (Number(comp.noi) / Number(comp.salePrice)) * 100;
        return formatPercent(calculatedCapRate);
      case 'occupancy':
        return value ? formatPercent(Number(value)) : '—';
      case 'saleYear':
      case 'yearBuilt':
        // Format years without commas (yyyy format)
        return value ? Number(value).toString() : '—';
      case 'wetSlips':
      case 'dryRacks':
      case 'daysOnMarket':
        return value ? formatNumber(Number(value)) : '—';
      case 'acres':
        return value ? formatNumber(Number(value), 1) : '—';
      default:
        if (value instanceof Date) {
          return value.toLocaleDateString();
        }
        if (typeof value === 'object' && value !== null) {
          return JSON.stringify(value);
        }
        return value || '—';
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      onSelectionChange(data.map(pc => pc.salesCompId));
    } else {
      onSelectionChange([]);
    }
  };

  const handleSelectRow = (compId: string, checked: boolean) => {
    if (checked) {
      onSelectionChange([...selectedIds, compId]);
    } else {
      onSelectionChange(selectedIds.filter(id => id !== compId));
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading project comps...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="flex-1 overflow-auto" data-testid="project-comps-table-container">
        <Table className="min-w-max">
          <TableHeader className="sticky top-0 bg-muted">
            <TableRow>
              <TableHead className="data-table-cell w-12">
                <Checkbox
                  checked={selectedIds.length === data.length && data.length > 0}
                  onCheckedChange={handleSelectAll}
                  data-testid="checkbox-select-all-project-comps"
                />
              </TableHead>
              {columns.map((column) => (
                <TableHead 
                  key={column.key}
                  className={`data-table-cell font-medium text-muted-foreground text-left ${column.width || ''}`}
                >
                  {column.sortable ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-auto p-0 font-medium text-muted-foreground hover:text-foreground"
                      onClick={() => onSort(column.key)}
                      data-testid={`sort-project-comp-${column.key}`}
                    >
                      {column.label}
                      {sortBy === column.key && (
                        sortDir === 'asc' ? 
                        <ChevronUp className="ml-1 h-3 w-3 text-primary" /> :
                        <ChevronDown className="ml-1 h-3 w-3 text-primary" />
                      )}
                    </Button>
                  ) : (
                    column.label
                  )}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length + 1} className="text-center py-12">
                  {!project?.profile || Object.keys(project.profile).length === 0 ? (
                    <div className="max-w-md mx-auto">
                      <Settings className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <p className="text-lg font-medium mb-2">No Target Criteria Set</p>
                      <p className="text-sm text-muted-foreground mb-4">
                        Set target criteria (states, price range, capacity, etc.) to automatically populate this project with matching comps.
                      </p>
                      {onEditProject && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={onEditProject}
                          data-testid="button-set-criteria"
                        >
                          <Settings className="mr-2 h-4 w-4" />
                          Set Target Criteria
                        </Button>
                      )}
                    </div>
                  ) : (
                    <div className="max-w-md mx-auto">
                      <Lightbulb className="h-12 w-12 text-primary mx-auto mb-4" />
                      <p className="text-lg font-medium mb-2">No comps in this project yet</p>
                      <p className="text-sm text-muted-foreground mb-4">
                        Your project has target criteria set. Use "Auto-Add Comps" to automatically add the top 30 matching comps, or manually select comps with "Add Comps".
                      </p>
                      {onAutoPopulate && (
                        <div className="flex gap-2 justify-center">
                          <Button
                            variant="default"
                            size="sm"
                            onClick={onAutoPopulate}
                            data-testid="button-auto-add-from-empty"
                          >
                            <Lightbulb className="mr-2 h-4 w-4" />
                            Auto-Add Comps
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ) : (
              data.map((projectComp) => {
                const comp = projectComp.salesComp;
                return (
                  <TableRow 
                    key={projectComp.id}
                    className={`hover:bg-muted/50 border-b border-border ${
                      selectedIds.includes(comp.id) ? 'bg-primary/5' : ''
                    }`}
                    data-testid={`project-comp-row-${comp.id}`}
                  >
                    <TableCell className="data-table-cell">
                      <Checkbox
                        checked={selectedIds.includes(comp.id)}
                        onCheckedChange={(checked) => handleSelectRow(comp.id, checked as boolean)}
                        data-testid={`checkbox-project-comp-${comp.id}`}
                      />
                    </TableCell>
                    <TableCell className="font-medium">
                      <div className="max-w-80">
                        <div className="truncate" title={comp.marina}>{comp.marina}</div>
                        {projectComp.notes && (
                          <div className="text-xs text-muted-foreground mt-1 truncate" title={projectComp.notes}>
                            Note: {projectComp.notes}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{formatCellValue(comp, 'state')}</TableCell>
                    <TableCell>{formatCellValue(comp, 'saleYear')}</TableCell>
                    <TableCell>{formatCellValue(comp, 'salePrice')}</TableCell>
                    <TableCell>{formatCellValue(comp, 'capRate')}</TableCell>
                    <TableCell>{formatCellValue(comp, 'noi')}</TableCell>
                    <TableCell>{formatCellValue(comp, 'wetSlips')}</TableCell>
                    <TableCell>{formatCellValue(comp, 'dryRacks')}</TableCell>
                    <TableCell>{formatCellValue(comp, 'occupancy')}</TableCell>
                    <TableCell>
                      <div className="max-w-32 truncate" title={comp.market || ''}>
                        {formatCellValue(comp, 'market')}
                      </div>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            data-testid={`actions-project-comp-${comp.id}`}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem 
                            onClick={() => setDetailCompId(comp.id)}
                            data-testid={`action-view-comp-${comp.id}`}
                          >
                            <Eye className="mr-2 h-4 w-4" />
                            View Details
                          </DropdownMenuItem>
                          {canEdit && (
                            <DropdownMenuItem 
                              onClick={() => setEditingComp(comp)}
                              data-testid={`action-edit-comp-${comp.id}`}
                            >
                              <Edit className="mr-2 h-4 w-4" />
                              Edit Comp
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem asChild>
                            <a 
                              href={`/sales-comps/${comp.id}`} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="flex items-center"
                              data-testid={`action-open-comp-${comp.id}`}
                            >
                              <ExternalLink className="mr-2 h-4 w-4" />
                              Open in New Tab
                            </a>
                          </DropdownMenuItem>
                          {comp.articleUrls && comp.articleUrls.length > 0 && (
                            <>
                              {comp.articleUrls.slice(0, 3).map((url, index) => (
                                <DropdownMenuItem key={index} asChild>
                                  <a 
                                    href={url} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="flex items-center"
                                    data-testid={`action-article-${comp.id}-${index}`}
                                  >
                                    <ExternalLink className="mr-2 h-4 w-4" />
                                    Article {index + 1}
                                  </a>
                                </DropdownMenuItem>
                              ))}
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Status Bar */}
      <div className="bg-card border-t border-border px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Showing <span data-testid="project-comps-count">{data.length}</span> comps in project
          </div>
          
          {selectedIds.length > 0 && (
            <div className="text-sm text-muted-foreground">
              <Badge variant="secondary" data-testid="project-selected-count">
                {selectedIds.length} selected
              </Badge>
            </div>
          )}
        </div>
      </div>

      {/* Edit Comp Dialog */}
      {editingComp && (
        <CreateEditCompDialog
          open={!!editingComp}
          onClose={() => setEditingComp(null)}
          comp={editingComp}
          projectId={projectId}
          projectName={projectName}
        />
      )}

      {/* Detail View */}
      {detailCompId && (
        <Detail
          compId={detailCompId}
          open={!!detailCompId}
          onClose={() => setDetailCompId(null)}
        />
      )}
    </>
  );
}