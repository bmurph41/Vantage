import { useState, useEffect, useRef, Fragment, useMemo, useCallback } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  ChevronUp, 
  ChevronDown, 
  ChevronLeft, 
  ChevronRight, 
  Eye, 
  Edit, 
  Trash2, 
  ExternalLink,
  MoreHorizontal,
  FolderPlus,
  Plus,
  Minus,
  Check,
  X
} from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { formatCurrency, formatPercent, formatNumber } from '@/lib/salescomps/format';
import Detail from "@/pages/analysis/sales-comps/Detail";
import { useQuery, useMutation } from "@tanstack/react-query";
import BulkEdit from "@/pages/analysis/sales-comps/BulkEdit";
import ProjectAssignmentDialog from "@/components/salescomps/projects/ProjectAssignmentDialog";
import CreateEditCompDialog from "./CreateEditCompDialog";
import ColumnFilter from "./ColumnFilter";
import SelectMarinaDialog from "./SelectMarinaDialog";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { SalesComp } from "@shared/schema";

// Type for the sales comps query response
type SalesCompsQuery = {
  comps: SalesComp[];
  total: number;
};

interface CompsDataGridProps {
  data: SalesComp[];
  loading: boolean;
  sortBy: string;
  sortDir: 'asc' | 'desc';
  onSort: (field: string) => void;
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
  total: number;
  canDelete?: boolean;
  canAddToProject?: boolean;
  columnFilters: Record<string, string[]>;
  onColumnFilterChange: (column: string, excludedValues: string[]) => void;
  columnUniqueValues: Record<string, string[]>;
  isEditMode?: boolean;
  onCellChange?: (compId: string, field: string, value: any) => void;
  onCompUpdate?: (updatedComp: SalesComp) => void;
}

export default function CompsDataGrid({
  data,
  loading,
  sortBy,
  sortDir,
  onSort,
  selectedIds,
  onSelectionChange,
  total,
  canDelete = false,
  canAddToProject = false,
  columnFilters,
  onColumnFilterChange,
  columnUniqueValues,
  isEditMode = false,
  onCellChange,
  onCompUpdate,
}: CompsDataGridProps) {
  // Column configuration state for widths and ordering
  const [columnConfig, setColumnConfig] = useState<Record<string, { width: number; order: number }>>({});
  const [isResizing, setIsResizing] = useState<{ columnKey: string; startX: number; startWidth: number } | null>(null);
  const [isDraggingColumn, setIsDraggingColumn] = useState<string | null>(null);

  // Dialog states for empty portfolio actions
  const [showSelectMarinaDialog, setShowSelectMarinaDialog] = useState(false);
  const [showCreateCompDialog, setShowCreateCompDialog] = useState(false);
  const [selectedPortfolioForAdd, setSelectedPortfolioForAdd] = useState<string | null>(null);
  const [dragState, setDragState] = useState<{
    draggedKey: string;
    startX: number;
    currentX: number;
    dragStartIndex: number;
    dropTargetIndex: number;
    columnPositions: Array<{ key: string; left: number; right: number; centerX: number }>;
    isDragging: boolean; // Track if we've passed the threshold
  } | null>(null);
  const [detailCompId, setDetailCompId] = useState<string | null>(null);
  const [showBulkEdit, setShowBulkEdit] = useState(false);
  const [showProjectAssignment, setShowProjectAssignment] = useState(false);
  const [selectedCompForProject, setSelectedCompForProject] = useState<SalesComp | null>(null);
  const [editingComp, setEditingComp] = useState<SalesComp | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [expandedPortfolios, setExpandedPortfolios] = useState<Set<string>>(new Set());
  const [showAddPropertyDialog, setShowAddPropertyDialog] = useState(false);
  const [selectedPortfolioForProperty, setSelectedPortfolioForProperty] = useState<SalesComp | null>(null);
  const [showCreatePropertyDialog, setShowCreatePropertyDialog] = useState(false);
  const [portfolioPending, setPortfolioPending] = useState<Set<string>>(new Set());
  const [portfolioConfirmDialog, setPortfolioConfirmDialog] = useState<{
    isOpen: boolean;
    comp: SalesComp | null;
    childCount: number;
  }>({ isOpen: false, comp: null, childCount: 0 });
  const horizontalScrollRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();


  // Helper to get the current portfolio status
  const getPortfolioStatus = (comp: SalesComp) => {
    return !!comp.isPortfolio;
  };

  const togglePortfolioExpanded = (portfolioId: string) => {
    const newExpanded = new Set(expandedPortfolios);
    if (newExpanded.has(portfolioId)) {
      newExpanded.delete(portfolioId);
    } else {
      newExpanded.add(portfolioId);
    }
    setExpandedPortfolios(newExpanded);
  };

  // Portfolio toggle mutation for instant updates  
  const portfolioMutation = useMutation<
    { comp: SalesComp; isPortfolio: boolean },
    Error,
    { comp: SalesComp; isPortfolio: boolean }
  >({
    mutationFn: async ({ comp, isPortfolio }) => {
      
      if (!isPortfolio) {
        // When unchecking portfolio, handle child properties
        const childProperties = data.filter(item => item.parentPortfolioId === comp.id);
        
        if (childProperties.length > 0) {
          // Show custom confirmation dialog and wait for user response
          return new Promise((resolve, reject) => {
            setPortfolioConfirmDialog({
              isOpen: true,
              comp,
              childCount: childProperties.length
            });
            
            // Store callbacks for handling user choice
            (window as any)._portfolioMutationResolve = async () => {
              try {
                // Detach all child properties
                await Promise.all(
                  childProperties.map(child => 
                    apiRequest('PATCH', `/api/sales-comps/${child.id}`, {
                      parentPortfolioId: null
                    })
                  )
                );
                
                // Update the portfolio status
                const updatedComp = await apiRequest(
                  'PATCH',
                  `/api/sales-comps/${comp.id}`,
                  {
                    isPortfolio: false,
                    parentPortfolioId: null
                  }
                );
                
                resolve({ comp, isPortfolio: false });
              } catch (error) {
                reject(error);
              }
            };
            (window as any)._portfolioMutationReject = reject;
          });
        }
      }

      // Update the portfolio status (for portfolios without children or when making portfolio)
      const updatedComp = await apiRequest(
        'PATCH',
        `/api/sales-comps/${comp.id}`,
        {
          isPortfolio,
          parentPortfolioId: isPortfolio ? null : comp.parentPortfolioId
        }
      );

      return { comp, isPortfolio };
    },
    onMutate: ({ comp, isPortfolio }) => {
      // Store previous data for rollback FIRST
      const previousData = queryClient.getQueryData<SalesCompsQuery>(['/api/sales-comps']);
      
      // INSTANT UPDATE: Synchronously update the cached query data for immediate visual changes
      queryClient.setQueryData<SalesCompsQuery>(['/api/sales-comps'], (oldData) => {
        if (!oldData?.comps) return oldData;
        
        return {
          ...oldData,
          comps: oldData.comps.map((item: SalesComp) => {
            if (item.id === comp.id) {
              return {
                ...item,
                isPortfolio,
                parentPortfolioId: isPortfolio ? null : item.parentPortfolioId
              };
            }
            // When deselecting a portfolio, also detach its children
            if (!isPortfolio && item.parentPortfolioId === comp.id) {
              return {
                ...item,
                parentPortfolioId: null
              };
            }
            return item;
          })
        };
      });

      // Cancel queries without await for instant response
      queryClient.cancelQueries({ queryKey: ['/api/sales-comps'] });

      // Set subtle pending state for loading indicator only
      setPortfolioPending(prev => new Set(prev.add(comp.id)));

      return { comp, isPortfolio, previousData };
    },
    onSuccess: (data: { comp: SalesComp; isPortfolio: boolean }, variables, context) => {
      const { comp, isPortfolio } = data;
      
      // Clear pending state
      setPortfolioPending(prev => {
        const newSet = new Set(prev);
        newSet.delete(comp.id);
        return newSet;
      });

      toast({
        title: "Portfolio status updated",
        description: `${comp.marina} ${isPortfolio ? 'marked as' : 'unmarked as'} portfolio sale`,
      });
    },
    onError: (error: any, { comp, isPortfolio }: { comp: SalesComp; isPortfolio: boolean }, context: any) => {
      
      // Restore previous data if available
      if (context?.previousData) {
        queryClient.setQueryData(['/api/sales-comps'], context.previousData);
      }

      // Clear pending state
      setPortfolioPending(prev => {
        const newSet = new Set(prev);
        newSet.delete(comp.id);
        return newSet;
      });

      if (error.message !== 'User cancelled') {
        toast({
          title: "Error",
          description: "Failed to update portfolio status",
          variant: "destructive",
        });
      }
    },
    onSettled: () => {
      // Non-blocking query invalidation for eventual consistency
      queryClient.invalidateQueries({ 
        queryKey: ['/api/sales-comps'],
        exact: false 
      });
    },
  });

  // Handler functions for portfolio confirmation dialog
  const handlePortfolioConfirm = () => {
    if ((window as any)._portfolioMutationResolve) {
      (window as any)._portfolioMutationResolve();
    }
    setPortfolioConfirmDialog({ isOpen: false, comp: null, childCount: 0 });
  };
  
  const handlePortfolioCancel = () => {
    if ((window as any)._portfolioMutationReject) {
      (window as any)._portfolioMutationReject(new Error('User cancelled'));
    }
    setPortfolioConfirmDialog({ isOpen: false, comp: null, childCount: 0 });
  };

  const togglePortfolioStatus = (comp: SalesComp, isPortfolio: boolean) => {
    // Immediate mutation for instant response - no delay checks
    portfolioMutation.mutate({ comp, isPortfolio });
  };

  const addPropertyToPortfolio = async (propertyId: string, portfolioId: string) => {
    try {
      await apiRequest(
        'PATCH',
        `/api/sales-comps/${propertyId}`,
        {
          parentPortfolioId: portfolioId
        }
      );

      await queryClient.invalidateQueries({ 
        queryKey: ['/api/sales-comps'],
        exact: false
      });
      
      toast({
        title: "Property added to portfolio",
        description: "Property has been successfully added to the portfolio",
      });
    } catch (error) {
      console.error('Error adding property to portfolio:', error);
      toast({
        title: "Error",
        description: "Failed to add property to portfolio",
        variant: "destructive",
      });
    }
  };

  // Handle adding new marina to portfolio
  const handleAddNewMarina = (portfolioId: string) => {
    setSelectedPortfolioForAdd(portfolioId);
    setShowCreateCompDialog(true);
  };

  // Handle selecting existing marinas for portfolio
  const handleSelectExistingMarinas = (portfolioId: string) => {
    setSelectedPortfolioForAdd(portfolioId);
    setShowSelectMarinaDialog(true);
  };

  // Handle selected marinas from dialog
  const handleMarinaSelection = async (selectedMarinaIds: string[]) => {
    if (!selectedPortfolioForAdd || selectedMarinaIds.length === 0) return;

    try {
      // Update all selected marinas to belong to the portfolio
      await Promise.all(
        selectedMarinaIds.map(marinaId =>
          apiRequest('PATCH', `/api/sales-comps/${marinaId}`, {
            parentPortfolioId: selectedPortfolioForAdd
          })
        )
      );

      await queryClient.invalidateQueries({ 
        queryKey: ['/api/sales-comps'],
        exact: false
      });
      
      toast({
        title: "Marinas added to portfolio",
        description: `Successfully added ${selectedMarinaIds.length} marina${selectedMarinaIds.length !== 1 ? 's' : ''} to the portfolio`,
      });

      // Auto-expand the portfolio to show the new children
      setExpandedPortfolios(prev => new Set(prev).add(selectedPortfolioForAdd));
    } catch (error) {
      console.error('Error adding marinas to portfolio:', error);
      toast({
        title: "Error",
        description: "Failed to add marinas to portfolio",
        variant: "destructive",
      });
    }
  };

  const removePropertyFromPortfolio = async (propertyId: string) => {
    try {
      await apiRequest(
        'PATCH',
        `/api/sales-comps/${propertyId}`,
        {
          parentPortfolioId: null
        }
      );

      await queryClient.invalidateQueries({ 
        queryKey: ['/api/sales-comps'],
        exact: false
      });
      
      toast({
        title: "Property removed from portfolio",
        description: "Property has been successfully removed from the portfolio",
      });
    } catch (error) {
      console.error('Error removing property from portfolio:', error);
      toast({
        title: "Error",
        description: "Failed to remove property from portfolio",
        variant: "destructive",
      });
    }
  };

  // Organize data into hierarchical structure
  const organizeHierarchicalData = (comps: SalesComp[]) => {
    const portfolios = comps.filter(comp => comp.isPortfolio);
    const nonPortfolios = comps.filter(comp => !comp.isPortfolio);
    const hierarchicalData: (SalesComp & { level: number; isChild?: boolean; isEmptyPortfolioActions?: boolean })[] = [];

    portfolios.forEach(portfolio => {
      hierarchicalData.push({ ...portfolio, level: 0 });
      
      if (expandedPortfolios.has(portfolio.id)) {
        const children = nonPortfolios.filter(comp => comp.parentPortfolioId === portfolio.id);
        
        if (children.length > 0) {
          children.forEach(child => {
            hierarchicalData.push({ ...child, level: 1, isChild: true });
          });
        } else {
          // Add empty portfolio actions row
          hierarchicalData.push({ 
            ...portfolio, 
            level: 1, 
            isChild: true, 
            isEmptyPortfolioActions: true 
          });
        }
      }
    });

    // Add non-portfolio items that aren't children of any portfolio
    const orphanedItems = nonPortfolios.filter(comp => !comp.parentPortfolioId);
    orphanedItems.forEach(item => {
      hierarchicalData.push({ ...item, level: 0 });
    });

    return hierarchicalData;
  };

  const hierarchicalData = organizeHierarchicalData(data);
  
  // Virtual scrolling setup
  const tableContainerRef = useRef<HTMLDivElement>(null);
  
  const rowVirtualizer = useVirtualizer({
    count: hierarchicalData.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => 60, // Estimated row height in pixels
    overscan: 5, // Render 5 extra rows above and below viewport
  });

  // Default column configuration with pixel widths
  const defaultColumns = [
    { key: 'expand', label: '', width: 48, sortable: false, order: 0 },
    { key: 'marina', label: 'Marina', width: 280, sortable: true, order: 1 },
    { key: 'state', label: 'State', width: 100, sortable: true, order: 2 },
    { key: 'saleYear', label: 'Year', width: 100, sortable: true, order: 3 },
    { key: 'salePrice', label: 'Sale Price', width: 180, sortable: true, order: 4 },
    { key: 'capRate', label: 'Cap Rate', width: 140, sortable: true, order: 5 },
    { key: 'noi', label: 'NOI', width: 160, sortable: true, order: 6 },
    { key: 'wetSlips', label: 'Wet Slips', width: 140, sortable: true, order: 7 },
    { key: 'dryRacks', label: 'Dry Racks', width: 140, sortable: true, order: 8 },
    { key: 'occupancy', label: 'Occupancy', width: 140, sortable: true, order: 9 },
    { key: 'market', label: 'Market', width: 160, sortable: true, order: 10 },
    // Profit Center columns
    { key: 'profitCenterStorage', label: 'Storage', width: 120, sortable: false, order: 11 },
    { key: 'profitCenterEvents', label: 'Events', width: 120, sortable: false, order: 12 },
    { key: 'profitCenterService', label: 'Service', width: 120, sortable: false, order: 13 },
    { key: 'profitCenterThirdPartyLeases', label: 'Third-Party Leases', width: 200, sortable: false, order: 14 },
    { key: 'profitCenterBoatRentals', label: 'Boat Rentals', width: 160, sortable: false, order: 15 },
    { key: 'profitCenterBoatBrokerage', label: 'Boat Brokerage', width: 180, sortable: false, order: 16 },
    { key: 'profitCenterRvPark', label: 'RV Park', width: 120, sortable: false, order: 17 },
    { key: 'profitCenterFuel', label: 'Fuel', width: 110, sortable: false, order: 18 },
    { key: 'profitCenterShipStore', label: 'Ship Store', width: 140, sortable: false, order: 19 },
    { key: 'profitCenterParts', label: 'Parts', width: 110, sortable: false, order: 20 },
    { key: 'profitCenterBoatClub', label: 'Boat Club', width: 140, sortable: false, order: 21 },
    { key: 'profitCenterBoatSales', label: 'Boat Sales', width: 140, sortable: false, order: 22 },
    { key: 'profitCenterFnb', label: 'F&B', width: 110, sortable: false, order: 23 },
    { key: 'profitCenterHospitality', label: 'Hospitality/Accommodations', width: 250, sortable: false, order: 24 },
    { key: 'actions', label: 'Actions', width: 150, sortable: false, order: 25 },
  ];

  // Load column configuration from localStorage on mount
  useEffect(() => {
    const savedConfig = localStorage.getItem('marinamatch-column-config');
    if (savedConfig) {
      try {
        setColumnConfig(JSON.parse(savedConfig));
      } catch (error) {
        console.error('Failed to parse saved column configuration:', error);
      }
    }
  }, []);

  // Save column configuration to localStorage when it changes
  useEffect(() => {
    if (Object.keys(columnConfig).length > 0) {
      localStorage.setItem('marinamatch-column-config', JSON.stringify(columnConfig));
    }
  }, [columnConfig]);

  // Get ordered columns with custom widths
  const columns = useMemo(() => {
    return defaultColumns
      .map(col => ({
        ...col,
        width: columnConfig[col.key]?.width ?? col.width,
        order: columnConfig[col.key]?.order ?? col.order
      }))
      .sort((a, b) => a.order - b.order);
  }, [columnConfig]);

  // Handle column resize
  const handleColumnResize = (columnKey: string, newWidth: number) => {
    setColumnConfig(prev => ({
      ...prev,
      [columnKey]: {
        ...prev[columnKey],
        width: Math.max(50, newWidth) // Minimum width of 50px
      }
    }));
  };

  // Handle column reorder
  const handleColumnReorder = (draggedKey: string, targetKey: string) => {
    const draggedColumn = columns.find(col => col.key === draggedKey);
    const targetColumn = columns.find(col => col.key === targetKey);
    
    if (!draggedColumn || !targetColumn) return;

    setColumnConfig(prev => {
      const newConfig = { ...prev };
      
      // Get all columns with their current orders
      const allColumns = defaultColumns.map(col => ({
        key: col.key,
        order: newConfig[col.key]?.order ?? col.order
      }));
      
      // Remove dragged column and insert at target position
      const filteredColumns = allColumns.filter(col => col.key !== draggedKey);
      const targetIndex = filteredColumns.findIndex(col => col.key === targetKey);
      
      // Reorder all columns
      const reorderedColumns = [
        ...filteredColumns.slice(0, targetIndex),
        { key: draggedKey, order: targetColumn.order },
        ...filteredColumns.slice(targetIndex)
      ];
      
      // Update orders
      reorderedColumns.forEach((col, index) => {
        newConfig[col.key] = {
          ...newConfig[col.key],
          order: index
        };
      });
      
      return newConfig;
    });
  };

  // Mouse event handlers for resizing
  const handleMouseDown = (e: React.MouseEvent, columnKey: string) => {
    e.preventDefault();
    const column = columns.find(col => col.key === columnKey);
    if (!column) return;

    setIsResizing({
      columnKey,
      startX: e.clientX,
      startWidth: column.width
    });
  };

  // Throttled resize handler using requestAnimationFrame for 60fps smooth operation
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizing) return;
    
    // Use requestAnimationFrame to throttle updates to 60fps max
    requestAnimationFrame(() => {
      if (!isResizing) return; // Check again in case state changed
      
      const deltaX = e.clientX - isResizing.startX;
      const newWidth = Math.max(50, isResizing.startWidth + deltaX); // Ensure minimum width
      
      // Only update if width actually changed significantly (reduce unnecessary renders)
      const currentColumn = columns.find(col => col.key === isResizing.columnKey);
      if (currentColumn && Math.abs(newWidth - currentColumn.width) > 2) {
        handleColumnResize(isResizing.columnKey, newWidth);
      }
    });
  }, [isResizing, columns]);

  const handleMouseUp = useCallback(() => {
    setIsResizing(null);
  }, []);

  // Global mouse event listeners for resizing
  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };
    }
  }, [isResizing, handleMouseMove, handleMouseUp]);

  // Enhanced mouse-based column dragging with position caching for fluid movement
  const handleColumnMouseDown = (e: React.MouseEvent, columnKey: string) => {
    const target = e.target as HTMLElement;
    
    // Don't start drag if clicking on interactive elements
    if (
      target.closest('[data-testid^="resize-handle"]') ||
      target.closest('button') ||
      target.closest('[role="button"]') ||
      target.closest('input') ||
      target.closest('[data-radix-collection-item]') // Radix UI dropdown items
    ) {
      return;
    }
    
    // Only allow dragging from non-sortable columns or the label area
    const column = columns.find(col => col.key === columnKey);
    if (!column || column.key === 'expand' || column.key === 'actions') {
      return;
    }
    
    e.preventDefault();
    e.stopPropagation();
    
    const columnIndex = columns.findIndex(col => col.key === columnKey);
    if (columnIndex === -1) return;
    
    // Pre-calculate all column positions to avoid expensive DOM queries during drag
    const tableElement = document.querySelector('[data-testid="data-table"]');
    const columnPositions: Array<{ key: string; left: number; right: number; centerX: number }> = [];
    
    if (tableElement) {
      const columnHeaders = tableElement.querySelectorAll('[data-testid^="header-"]');
      columnHeaders.forEach((header, index) => {
        const rect = header.getBoundingClientRect();
        const columnData = columns[index];
        if (columnData) {
          columnPositions.push({
            key: columnData.key,
            left: rect.left,
            right: rect.right,
            centerX: rect.left + rect.width / 2
          });
        }
      });
    }
    
    // Don't set isDraggingColumn yet - wait for threshold
    setDragState({
      draggedKey: columnKey,
      startX: e.clientX,
      currentX: e.clientX,
      dragStartIndex: columnIndex,
      dropTargetIndex: columnIndex,
      columnPositions,
      isDragging: false
    });
  };

  const handleColumnMouseMove = useCallback((e: MouseEvent) => {
    if (!dragState) return;
    
    const currentX = e.clientX;
    const dragThreshold = 5; // pixels to move before drag starts
    
    // Use requestAnimationFrame for smooth 60fps updates
    requestAnimationFrame(() => {
      // Update drag position for visual feedback using cached positions
      setDragState(prev => {
        if (!prev) return null;
        
        const distance = Math.abs(currentX - prev.startX);
        
        // Check if we've passed the drag threshold
        if (!prev.isDragging && distance > dragThreshold) {
          // Activate dragging
          setIsDraggingColumn(prev.draggedKey);
          return { ...prev, isDragging: true, currentX };
        }
        
        // Only update drop target if we're actively dragging
        if (!prev.isDragging) {
          return { ...prev, currentX };
        }
        
        // Find the target column using pre-calculated positions (much faster than DOM queries)
        let newTargetIndex = prev.dragStartIndex;
        let closestDistance = Infinity;
        
        prev.columnPositions.forEach((position, index) => {
          const dist = Math.abs(currentX - position.centerX);
          const halfWidth = (position.right - position.left) / 2;
          
          if (dist < closestDistance && dist < halfWidth) {
            closestDistance = dist;
            newTargetIndex = index;
          }
        });
        
        return {
          ...prev,
          currentX,
          dropTargetIndex: newTargetIndex
        };
      });
    });
  }, [dragState]);

  const handleColumnMouseUp = useCallback(() => {
    if (!dragState) return;
    
    const { draggedKey, dragStartIndex, dropTargetIndex, isDragging } = dragState;
    
    // Use a small delay to ensure smooth animation completion
    requestAnimationFrame(() => {
      // Only reorder if we actually started dragging and dropped on a different position
      if (isDragging && dragStartIndex !== dropTargetIndex) {
        const targetColumn = columns[dropTargetIndex];
        if (targetColumn) {
          handleColumnReorder(draggedKey, targetColumn.key);
        }
      }
      
      // Clean up drag state
      setIsDraggingColumn(null);
      setDragState(null);
    });
  }, [dragState, columns]);

  // Global mouse event listeners for smooth dragging
  useEffect(() => {
    if (dragState) {
      document.addEventListener('mousemove', handleColumnMouseMove);
      document.addEventListener('mouseup', handleColumnMouseUp);
      
      // Only change cursor if actively dragging
      if (dragState.isDragging) {
        document.body.style.cursor = 'grabbing';
        document.body.style.userSelect = 'none';
      }
      
      return () => {
        document.removeEventListener('mousemove', handleColumnMouseMove);
        document.removeEventListener('mouseup', handleColumnMouseUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };
    }
  }, [dragState, handleColumnMouseMove, handleColumnMouseUp]);

  // Helper function to calculate aggregated NOI for portfolios
  const getPortfolioNOI = (portfolioComp: SalesComp): number | null => {
    if (!portfolioComp.isPortfolio) return null;
    
    const childComps = data.filter(item => item.parentPortfolioId === portfolioComp.id);
    if (childComps.length === 0) return null;
    
    let totalNOI = 0;
    let hasValidNOI = false;
    
    for (const child of childComps) {
      // Check for disclosed NOI that is not null/undefined (zero is valid)
      if (child.isNoiDisclosed && child.noi !== null && child.noi !== undefined) {
        totalNOI += Number(child.noi);
        hasValidNOI = true;
      }
    }
    
    // Return the total even if it's zero (hasValidNOI ensures we have at least one disclosed NOI)
    return hasValidNOI ? totalNOI : null;
  };

  const formatCellValue = (comp: SalesComp, column: string) => {
    const value = comp[column as keyof SalesComp];
    
    switch (column) {
      case 'marina':
        // Show marina name with green check if linked to CRM property
        return (
          <div className="flex items-center gap-2">
            {comp.propertyId && (
              <Check 
                className="h-4 w-4 text-green-600 dark:text-green-400 flex-shrink-0" 
                title="Linked to CRM Property"
              />
            )}
            <span className="truncate">{value || '—'}</span>
          </div>
        );
      case 'salePrice':
        if (!comp.isPriceDisclosed) {
          return <span className="text-muted-foreground" title="Price not disclosed">Undisclosed</span>;
        }
        return value ? formatCurrency(Number(value)) : '—';
      case 'listPrice':
        return value ? formatCurrency(Number(value)) : '—';
      case 'noi':
        if (comp.isPortfolio) {
          // For portfolios, display aggregated NOI from child properties
          const portfolioNOI = getPortfolioNOI(comp);
          if (portfolioNOI === null) {
            return '—';
          }
          return formatCurrency(portfolioNOI);
        } else {
          if (!comp.isNoiDisclosed) {
            return <span className="text-muted-foreground" title="NOI not disclosed">Undisclosed</span>;
          }
          return value ? formatCurrency(Number(value)) : '—';
        }
      case 'capRate':
        if (comp.isPortfolio) {
          // For portfolios, calculate cap rate as Portfolio NOI / Portfolio Price
          const portfolioNOI = getPortfolioNOI(comp);
          if (!comp.isPriceDisclosed || !comp.salePrice || portfolioNOI === null) {
            return '—';
          }
          const portfolioCapRate = (portfolioNOI / Number(comp.salePrice)) * 100;
          return formatPercent(portfolioCapRate);
        } else {
          // Calculate cap rate as NOI / Sale Price for individual properties
          if (!comp.isNoiDisclosed || !comp.isPriceDisclosed || !comp.noi || !comp.salePrice) {
            return '—';
          }
          const calculatedCapRate = (Number(comp.noi) / Number(comp.salePrice)) * 100;
          return formatPercent(calculatedCapRate);
        }
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
      // Simple profit centers without operation types
      case 'profitCenterStorage':
      case 'profitCenterEvents':
      case 'profitCenterService':
      case 'profitCenterThirdPartyLeases':
      case 'profitCenterRvPark':
        return value ? (
          <Check className="h-4 w-4 text-green-600 dark:text-green-400 mx-auto" />
        ) : (
          <X className="h-4 w-4 text-red-500 dark:text-red-400 mx-auto" />
        );
      
      // Profit centers with In-House/Leased operation types
      case 'profitCenterBoatRentals':
      case 'profitCenterBoatBrokerage':
      case 'profitCenterFuel':
      case 'profitCenterShipStore':
      case 'profitCenterParts':
      case 'profitCenterBoatSales':
      case 'profitCenterFnb':
      case 'profitCenterHospitality': {
        if (!value) {
          return <X className="h-4 w-4 text-red-500 dark:text-red-400 mx-auto" />;
        }
        const typeField = `${column}Type` as keyof SalesComp;
        const operationType = comp[typeField] as string;
        const displayType = operationType === 'in-house' ? 'In-House' : 
                           operationType === 'leased' ? 'Leased' : '';
        return (
          <div className="flex flex-col items-center gap-1">
            <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
            {displayType && (
              <span className="text-xs text-muted-foreground font-medium">
                {displayType}
              </span>
            )}
          </div>
        );
      }
      
      // Boat Club with special In-House/Third-Party and company name
      case 'profitCenterBoatClub': {
        if (!value) {
          return <X className="h-4 w-4 text-red-500 dark:text-red-400 mx-auto" />;
        }
        const operationType = comp.profitCenterBoatClubType as string;
        const companyName = comp.profitCenterBoatClubCompany as string;
        const displayType = operationType === 'in-house' ? 'In-House' : 
                           operationType === 'third-party' ? 'Third-Party' : '';
        return (
          <div className="flex flex-col items-center gap-1">
            <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
            {displayType && (
              <div className="flex flex-col items-center">
                <span className="text-xs text-muted-foreground font-medium">
                  {displayType}
                </span>
                {operationType === 'third-party' && companyName && (
                  <span className="text-xs text-blue-600 dark:text-blue-400 font-medium max-w-20 truncate" title={companyName}>
                    {companyName}
                  </span>
                )}
              </div>
            )}
          </div>
        );
      }
      
      case 'state': {
        if (comp.isPortfolio) {
          // For portfolios, show all unique states from child properties
          const childProperties = data.filter(item => item.parentPortfolioId === comp.id);
          if (childProperties.length > 0) {
            const uniqueStates = Array.from(new Set(childProperties.map(child => child.state).filter(Boolean)));
            const abbreviatedStates = uniqueStates.map(state => {
              // Convert to two-letter abbreviation
              const abbrev = state?.toUpperCase().substring(0, 2);
              return abbrev;
            }).filter(Boolean);
            
            if (abbreviatedStates.length > 0) {
              return (
                <div className="flex items-center justify-center gap-1 flex-wrap">
                  {abbreviatedStates.map((state, index) => (
                    <span key={index} className="text-sm font-medium">
                      {state}
                    </span>
                  ))}
                </div>
              );
            }
          }
          // If no child properties or states, show portfolio's own state
          const abbrev = comp.state?.toUpperCase().substring(0, 2);
          return abbrev ? (
            <div className="flex justify-center">
              <span className="text-sm font-medium">
                {abbrev}
              </span>
            </div>
          ) : '—';
        }
        
        // For regular properties, show abbreviated state
        const abbrev = value?.toString().toUpperCase().substring(0, 2);
        return abbrev ? (
          <div className="flex justify-center">
            <span className="text-sm font-medium">
              {abbrev}
            </span>
          </div>
        ) : '—';
      }
      
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
      onSelectionChange(data.map(comp => comp.id));
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
          <p className="text-muted-foreground">Loading comps...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Iframe-styled container that extends to bottom of sidebar */}
      <div className="flex-1 border-2 border-border rounded-lg bg-card shadow-lg overflow-y-hidden" style={{height: 'calc(100vh - 120px)'}}>
        {/* Data Grid container with enhanced horizontal and vertical scroll */}
        <div 
          ref={tableContainerRef}
          className="flex-1 overflow-x-auto overflow-y-auto border border-border rounded-md"
          style={{
            width: '100%',
            height: '100%',
            minWidth: 0,
            scrollbarWidth: 'auto',
            msOverflowStyle: 'scrollbar',
            scrollbarColor: 'auto',
            display: 'block'
          }}
          onKeyDown={(e) => {
            const container = tableContainerRef.current;
            if (!container) return;
            
            switch (e.key) {
              case 'ArrowLeft':
                e.preventDefault();
                container.scrollBy({ left: -50 });
                break;
              case 'ArrowRight':
                e.preventDefault();
                container.scrollBy({ left: 50 });
                break;
              case 'ArrowDown':
                e.preventDefault();
                container.scrollBy({ top: 50 });
                break;
              case 'ArrowUp':
                e.preventDefault();
                container.scrollBy({ top: -50 });
                break;
              case 'PageDown':
                e.preventDefault();
                container.scrollBy({ top: container.clientHeight * 0.8 });
                break;
              case 'PageUp':
                e.preventDefault();
                container.scrollBy({ top: -container.clientHeight * 0.8 });
                break;
            }
          }}
          data-testid="comps-table-container"
          tabIndex={0}
        >
            <Table className="min-w-full w-full" style={{ minWidth: '1500px' }} data-testid="data-table">
            <TableHeader className="bg-card border-b border-border">
              <TableRow>
                <TableHead className="data-table-header w-8 bg-card sticky top-0 z-20 shadow-sm">
                  <Checkbox
                    checked={selectedIds.length === data.length && data.length > 0}
                    onCheckedChange={handleSelectAll}
                    data-testid="checkbox-select-all"
                  />
                </TableHead>
                {columns.map((column, index) => (
                  <TableHead 
                    key={column.key}
                    className={`data-table-header text-left relative select-none transition-all duration-75 bg-card sticky top-0 z-20 shadow-sm ${
                      isDraggingColumn === column.key ? 'opacity-60 shadow-lg z-50' : ''
                    } ${
                      dragState && dragState.dropTargetIndex === index && isDraggingColumn !== column.key 
                        ? 'bg-primary/10 border-l-2 border-primary' : ''
                    }`}
                    style={{ 
                      width: `${column.width}px`,
                      minWidth: `${column.width}px`,
                      maxWidth: `${column.width}px`,
                      transform: isDraggingColumn === column.key && dragState ? 
                        `translateX(${dragState.currentX - dragState.startX}px)` : 'none',
                      zIndex: isDraggingColumn === column.key ? 1000 : undefined
                    }}
                    data-testid={`header-${column.key}`}
                  >
                    <div 
                      className="flex items-center justify-between h-full"
                      onMouseDown={(e) => handleColumnMouseDown(e, column.key)}
                    >
                      <div className="flex items-center flex-1 min-w-0 cursor-grab active:cursor-grabbing">
                        {column.sortable ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-auto p-0 font-medium text-muted-foreground hover:text-foreground truncate cursor-pointer"
                            onClick={(e) => {
                              e.stopPropagation();
                              onSort(column.key);
                            }}
                            data-testid={`sort-${column.key}`}
                          >
                            <span className="truncate">{column.label}</span>
                            {sortBy === column.key && (
                              sortDir === 'asc' ? 
                              <ChevronUp className="ml-1 h-3 w-3 text-primary flex-shrink-0" /> :
                              <ChevronDown className="ml-1 h-3 w-3 text-primary flex-shrink-0" />
                            )}
                          </Button>
                        ) : (
                          <span className="font-medium text-muted-foreground truncate">{column.label}</span>
                        )}
                      </div>
                      {column.key !== 'expand' && (
                        <div className="flex-shrink-0 ml-2">
                          <ColumnFilter
                            column={column.key}
                            uniqueValues={columnUniqueValues[column.key] || []}
                            selectedValues={columnFilters[column.key] || []}
                            onFilterChange={onColumnFilterChange}
                          />
                        </div>
                      )}
                    </div>
                    
                    {/* Drop indicator for column reordering */}
                    {dragState && dragState.dropTargetIndex === index && isDraggingColumn !== column.key && (
                      <div className="absolute inset-0 pointer-events-none">
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary animate-pulse"></div>
                      </div>
                    )}
                    
                    {/* Resize handle */}
                    {index < columns.length - 1 && (
                      <div
                        className="absolute top-0 right-0 w-1 h-full cursor-col-resize bg-transparent hover:bg-primary/20 transition-colors z-10"
                        onMouseDown={(e) => handleMouseDown(e, column.key)}
                        data-testid={`resize-handle-${column.key}`}
                      >
                        <div className="w-full h-full flex items-center justify-center">
                          <div className="w-px h-4 bg-border"></div>
                        </div>
                      </div>
                    )}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {hierarchicalData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={columns.length + 1} className="text-center py-8">
                    <div className="text-muted-foreground">
                      <p className="text-lg mb-2">No comps found</p>
                      <p className="text-sm">Try adjusting your filters or upload some data to get started</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                <>
                  {/* Spacer for virtual scrolling - adds padding before first visible row */}
                  {rowVirtualizer.getVirtualItems().length > 0 && (
                    <tr style={{ height: `${rowVirtualizer.getVirtualItems()[0]?.start ?? 0}px` }} />
                  )}
                  
                  {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                    const comp = hierarchicalData[virtualRow.index];
                    const index = virtualRow.index;
                    // Handle empty portfolio actions row
                    if (comp.isEmptyPortfolioActions) {
                      return (
                        <TableRow 
                          key={`${comp.id}-empty-actions`}
                          className="data-table-row border-b border-border/50 bg-gradient-to-r from-blue-50/60 via-blue-50/30 to-transparent border-l-4 border-l-blue-400"
                          data-testid={`row-empty-portfolio-${comp.id}`}
                        >
                          <TableCell className="data-table-cell">
                            {/* Empty checkbox cell */}
                          </TableCell>
                          <TableCell className="data-table-cell w-8">
                            {/* Empty expand cell */}
                          </TableCell>
                          <TableCell 
                            colSpan={columns.length - 1} 
                            className="data-table-cell py-8"
                          >
                            <div className="flex items-center justify-center gap-4 ml-8">
                              <div className="text-muted-foreground text-sm mr-4">
                                This portfolio has no marinas yet
                              </div>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleAddNewMarina(comp.id)}
                                data-testid={`button-add-new-marina-${comp.id}`}
                                className="gap-2"
                              >
                                <Plus className="h-4 w-4" />
                                Add New Marina
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleSelectExistingMarinas(comp.id)}
                                data-testid={`button-select-existing-marinas-${comp.id}`}
                                className="gap-2"
                              >
                                <FolderPlus className="h-4 w-4" />
                                Select Existing Marinas
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    }

                    // Handle regular portfolio and marina rows
                    return (
                    <TableRow 
                      key={comp.id}
                      className={`data-table-row border-b border-border/50 ${
                        selectedIds.includes(comp.id) ? 'bg-primary/8 border-primary/20' : ''
                      } ${
                        comp.isChild ? 
                          'bg-gradient-to-r from-blue-50/60 via-blue-50/30 to-transparent border-l-4 border-l-blue-400 hover:from-blue-100/60 hover:via-blue-50/40 hover:to-blue-50/20' : 
                          ''
                      } ${
                        comp.isPortfolio ? 
                          'bg-gradient-to-r from-purple-50 via-purple-25 to-transparent border-l-4 border-l-purple-500 dark:from-purple-900/20 dark:via-purple-900/10 dark:to-transparent font-medium hover:from-purple-100 hover:via-purple-50 hover:to-purple-25' : 
                          ''
                      } ${
                        isEditMode ? 'cursor-pointer hover:bg-primary/5 transition-colors' : ''
                      }`}
                      onClick={isEditMode ? () => {
                        setEditingComp(comp);
                        setShowEditDialog(true);
                      } : undefined}
                      data-testid={`row-comp-${comp.id}`}
                    >
                    <TableCell className="data-table-cell" onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selectedIds.includes(comp.id)}
                        onCheckedChange={(checked) => handleSelectRow(comp.id, checked as boolean)}
                        data-testid={`checkbox-row-${comp.id}`}
                      />
                    </TableCell>
                    
                    {/* Expand/Collapse Column */}
                    <TableCell className="data-table-cell w-8" onClick={(e) => e.stopPropagation()}>
                      {comp.isPortfolio ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={() => togglePortfolioExpanded(comp.id)}
                          data-testid={`expand-portfolio-${comp.id}`}
                        >
                          {expandedPortfolios.has(comp.id) ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </Button>
                      ) : (
                        <div className={`${comp.isChild ? 'ml-4' : ''}`} />
                      )}
                    </TableCell>
                    
                    {columns.slice(1, -1).map((column) => (
                      <TableCell 
                        key={column.key}
                        className={`data-table-cell ${
                          column.key.startsWith('profitCenter') ? 'text-center' : 'text-left'
                        } ${
                          column.key === 'marina' ? 
                            (comp.isPortfolio ? 'font-bold text-blue-800 dark:text-blue-200' : 
                             comp.isChild ? 'font-medium text-blue-700 dark:text-blue-300' : 
                             'font-medium') : 
                            ''
                        } whitespace-nowrap`}
                        style={{ 
                          width: `${column.width}px`,
                          minWidth: `${column.width}px`,
                          maxWidth: `${column.width}px`
                        }}
                        data-testid={`cell-${column.key}-${comp.id}`}
                      >
                        <div className={`flex ${
                          column.key === 'marina' && comp.isPortfolio ? 'flex-col items-start gap-2' : 'items-center gap-2'
                        } ${
                          column.key === 'marina' && comp.isChild ? 'ml-12 relative' : ''
                        }`}>
                          {column.key === 'marina' && comp.isChild && (
                            <div className="absolute -left-8 top-1/2 w-6 h-px bg-blue-300 dark:bg-blue-600"></div>
                          )}
                          <div className={`flex items-center gap-3 ${
                            column.key === 'marina' && comp.isPortfolio ? 'w-full' : ''
                          }`}>
                            {column.key === 'marina' && comp.isPortfolio && (
                              <div className="status-badge status-portfolio">
                                <div className="h-1.5 w-1.5 bg-current rounded-full mr-1"></div>
                                Portfolio
                              </div>
                            )}
                            {formatCellValue(comp, column.key)}
                            {column.key === 'marina' && comp.articleUrls && comp.articleUrls.length > 0 && (
                              <ExternalLink className="h-3 w-3 text-muted-foreground hover:text-primary cursor-pointer" />
                            )}
                          </div>
                          {column.key === 'marina' && comp.isPortfolio && !isEditMode && (
                            <div className="flex gap-2 mt-1" onClick={(e) => e.stopPropagation()}>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 px-2 text-xs"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedPortfolioForProperty(comp);
                                  setShowCreatePropertyDialog(true);
                                }}
                                data-testid={`button-add-new-marina-${comp.id}`}
                              >
                                <Plus className="h-3 w-3 mr-1" />
                                Add New Marina
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 px-2 text-xs"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedPortfolioForProperty(comp);
                                  setShowAddPropertyDialog(true);
                                }}
                                data-testid={`button-select-existing-marina-${comp.id}`}
                              >
                                <Plus className="h-3 w-3 mr-1" />
                                Select Existing Marinas
                              </Button>
                            </div>
                          )}
                        </div>
                      </TableCell>
                    ))}
                    
                    {/* Actions */}
                    <TableCell className="data-table-cell text-left w-20 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" data-testid={`actions-${comp.id}`}>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem 
                            onClick={() => setDetailCompId(comp.id)}
                            data-testid={`action-view-${comp.id}`}
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            View Details
                          </DropdownMenuItem>
                          {!isEditMode && (
                            <DropdownMenuItem 
                              onClick={() => {
                                setEditingComp(comp);
                                setShowEditDialog(true);
                              }}
                              data-testid={`action-edit-${comp.id}`}
                            >
                              <Edit className="h-4 w-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                          )}
                          {canAddToProject && (
                            <DropdownMenuItem 
                              onClick={() => {
                                setSelectedCompForProject(comp);
                                setShowProjectAssignment(true);
                              }}
                              data-testid={`action-add-to-project-${comp.id}`}
                            >
                              <FolderPlus className="h-4 w-4 mr-2" />
                              Add to Project
                            </DropdownMenuItem>
                          )}
                          {!comp.isChild && (
                            <DropdownMenuItem 
                              onClick={() => togglePortfolioStatus(comp, !getPortfolioStatus(comp))}
                              data-testid={`action-toggle-portfolio-${comp.id}`}
                            >
                              <div className="flex items-center justify-between w-full">
                                <span className="flex items-center">
                                  <Check className="h-4 w-4 mr-2" />
                                  Portfolio
                                </span>
                                <Switch
                                  checked={getPortfolioStatus(comp)}
                                  className={portfolioPending.has(comp.id) ? 'opacity-90' : ''}
                                />
                              </div>
                            </DropdownMenuItem>
                          )}
                          {comp.isChild && (
                            <DropdownMenuItem 
                              onClick={() => removePropertyFromPortfolio(comp.id)}
                              data-testid={`action-remove-from-portfolio-${comp.id}`}
                            >
                              <Minus className="h-4 w-4 mr-2" />
                              Remove from Portfolio
                            </DropdownMenuItem>
                          )}
                          {comp.isPortfolio && (
                            <>
                              <div className="border-b border-border my-1" />
                              <DropdownMenuItem 
                                onClick={() => {
                                  setSelectedPortfolioForProperty(comp);
                                  setShowAddPropertyDialog(true);
                                }}
                                data-testid={`action-add-existing-${comp.id}`}
                                className="text-blue-600 dark:text-blue-400"
                              >
                                <Plus className="h-4 w-4 mr-2" />
                                Add Existing Marina
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={() => {
                                  setSelectedPortfolioForProperty(comp);
                                  setShowCreatePropertyDialog(true);
                                }}
                                data-testid={`action-add-new-${comp.id}`}
                                className="text-blue-600 dark:text-blue-400"
                              >
                                <Plus className="h-4 w-4 mr-2" />
                                Add New Marina
                              </DropdownMenuItem>
                            </>
                          )}
                          {canDelete && (
                            <DropdownMenuItem 
                              className="text-destructive"
                              data-testid={`action-delete-${comp.id}`}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                    );
                  })}
                  
                  {/* Spacer for virtual scrolling - adds padding after last visible row */}
                  {rowVirtualizer.getVirtualItems().length > 0 && (
                    <tr style={{ 
                      height: `${
                        rowVirtualizer.getTotalSize() - 
                        (rowVirtualizer.getVirtualItems()[rowVirtualizer.getVirtualItems().length - 1]?.end ?? 0)
                      }px` 
                    }} />
                  )}
                </>
              )}
            </TableBody>
            </Table>
        </div>

        {/* Status Bar */}
        <div className="bg-muted/50 border-t border-border px-6 py-3">
          <div className="text-sm text-muted-foreground">
            Showing <span data-testid="total-loaded">{data.length}</span> comps
          </div>
        </div>
      </div>

      {/* Bulk Edit Modal */}
      {showBulkEdit && (
        <BulkEdit
          selectedIds={selectedIds}
          onClose={() => setShowBulkEdit(false)}
        />
      )}

      {/* Detail Modal */}
      {detailCompId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-card rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
            <Detail
              compId={detailCompId}
              onClose={() => setDetailCompId(null)}
              isModal={true}
            />
          </div>
        </div>
      )}

      {/* Single Comp Project Assignment Dialog */}
      {showProjectAssignment && selectedCompForProject && (
        <ProjectAssignmentDialog
          open={showProjectAssignment}
          onClose={() => {
            setShowProjectAssignment(false);
            setSelectedCompForProject(null);
          }}
          selectedIds={[selectedCompForProject.id]}
          selectedCompsPreview={[selectedCompForProject]}
          onSuccess={() => {
            setShowProjectAssignment(false);
            setSelectedCompForProject(null);
          }}
        />
      )}

      {/* Add Property to Portfolio Dialog */}
      {showAddPropertyDialog && selectedPortfolioForProperty && (
        <AddPropertyToPortfolioDialog
          portfolio={selectedPortfolioForProperty}
          onAddProperty={addPropertyToPortfolio}
          onClose={() => {
            setShowAddPropertyDialog(false);
            setSelectedPortfolioForProperty(null);
          }}
        />
      )}

      {/* Create Property for Portfolio Dialog */}
      {showCreatePropertyDialog && selectedPortfolioForProperty && (
        <CreateEditCompDialog
          open={showCreatePropertyDialog}
          onClose={() => {
            setShowCreatePropertyDialog(false);
            setSelectedPortfolioForProperty(null);
          }}
        />
      )}
      
      {/* Portfolio Confirmation Dialog */}
      <Dialog open={portfolioConfirmDialog.isOpen} onOpenChange={() => handlePortfolioCancel()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Detach Portfolio Properties</DialogTitle>
            <DialogDescription>
              This portfolio contains {portfolioConfirmDialog.childCount} properties. 
              Unchecking will detach all properties from this portfolio. Continue?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={handlePortfolioCancel}>
              Cancel
            </Button>
            <Button onClick={handlePortfolioConfirm}>
              OK
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Select Marina Dialog */}
      <SelectMarinaDialog
        open={showSelectMarinaDialog}
        onOpenChange={setShowSelectMarinaDialog}
        availableMarinas={data.filter(comp => !comp.isPortfolio && !comp.parentPortfolioId)}
        onSelect={handleMarinaSelection}
      />

      {/* Create Comp Dialog for adding new marina to portfolio */}
      {showCreateCompDialog && selectedPortfolioForAdd && (
        <CreateEditCompDialog
          open={showCreateCompDialog}
          onClose={() => {
            setShowCreateCompDialog(false);
            setSelectedPortfolioForAdd(null);
            // Auto-expand the portfolio to show the new child
            if (selectedPortfolioForAdd) {
              setExpandedPortfolios(prev => new Set(prev).add(selectedPortfolioForAdd));
            }
          }}
        />
      )}

      {/* Edit Comp Dialog */}
      {showEditDialog && editingComp && (
        <CreateEditCompDialog
          open={showEditDialog}
          onClose={() => {
            setShowEditDialog(false);
            setEditingComp(null);
          }}
          comp={editingComp}
          onUpdate={onCompUpdate}
        />
      )}
    </>
  );
}

// Add Property to Portfolio Dialog Component
interface AddPropertyToPortfolioDialogProps {
  portfolio: SalesComp;
  onAddProperty: (propertyId: string, portfolioId: string) => Promise<void>;
  onClose: () => void;
}

const AddPropertyToPortfolioDialog = ({ 
  portfolio, 
  onAddProperty, 
  onClose 
}: AddPropertyToPortfolioDialogProps) => {
  const [selectedProperties, setSelectedProperties] = useState<Set<string>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Query to fetch all comps from the database for searching
  const { data: allCompsResponse, isLoading } = useQuery<SalesCompsQuery>({ 
    queryKey: ['/api/sales-comps?pageSize=10000&page=1'] // Use default fetcher with large page size to get all comps
  });

  const handlePropertyToggle = (propertyId: string) => {
    const newSelected = new Set(selectedProperties);
    if (newSelected.has(propertyId)) {
      newSelected.delete(propertyId);
    } else {
      newSelected.add(propertyId);
    }
    setSelectedProperties(newSelected);
  };

  // Get available properties from all comps (not portfolios, not already in a portfolio, not the current portfolio)
  const availableProperties = (allCompsResponse?.comps || []).filter((comp: SalesComp) => 
    !comp.isPortfolio && 
    !comp.parentPortfolioId && 
    comp.id !== portfolio.id
  );

  // Filter properties based on search term  
  const filteredProperties = availableProperties.filter((property: SalesComp) =>
    searchTerm === '' || // If no search term, show all available properties
    (property.marina || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (property.market || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (property.state || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (property.region || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSubmit = async () => {
    if (selectedProperties.size === 0) return;
    
    setIsSubmitting(true);
    try {
      // Add each selected property to the portfolio
      await Promise.all(
        Array.from(selectedProperties).map(propertyId => 
          onAddProperty(propertyId, portfolio.id)
        )
      );
      onClose();
    } catch (error) {
      console.error('Error adding properties to portfolio:', error);
    }
    setIsSubmitting(false);
  };

  const handleClose = () => {
    setSearchTerm(''); // Clear search when dialog closes
    onClose();
  };

  return (
    <Dialog open={true} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle>Add Properties to Portfolio: {portfolio.marina}</DialogTitle>
          <DialogDescription>
            Select properties to add to this portfolio. Only properties that are not already in a portfolio are shown.
          </DialogDescription>
        </DialogHeader>
        
        {/* Search Bar */}
        <div className="py-4">
          <Input
            type="text"
            placeholder="Search marinas by name, market, state, or region..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full"
            data-testid="input-search-properties"
          />
        </div>
        
        <div className="overflow-y-auto max-h-96">
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading properties...
            </div>
          ) : filteredProperties.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {searchTerm ? 'No properties match your search.' : 'No available properties to add to this portfolio.'}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredProperties.map((property: SalesComp) => (
                <div 
                  key={property.id}
                  className="flex items-center gap-3 p-3 border rounded-lg hover:bg-muted/50"
                >
                  <Checkbox
                    checked={selectedProperties.has(property.id)}
                    onCheckedChange={() => handlePropertyToggle(property.id)}
                    data-testid={`checkbox-add-property-${property.id}`}
                  />
                  <div className="flex-1">
                    <div className="font-medium">{property.marina}</div>
                    <div className="text-sm text-muted-foreground">
                      {property.market || property.region}, {property.state} • {formatCurrency(Number(property.salePrice) || 0)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button 
            variant="outline" 
            onClick={handleClose}
            data-testid="button-cancel-add-properties"
          >
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit}
            disabled={selectedProperties.size === 0 || isSubmitting}
            data-testid="button-confirm-add-properties"
          >
            {isSubmitting ? 'Adding...' : `Add ${selectedProperties.size} Properties`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
