import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Building2, TrendingUp, DollarSign, ChevronDown, Briefcase } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { formatCurrency, formatPercent } from "@/lib/utils";

interface Fund {
  id: string;
  name: string;
  shortName: string | null;
  status: string;
  vintage: number;
  targetSize: string | null;
  committedCapital: string;
  calledCapital: string;
  distributedCapital: string;
  netIrr: string | null;
  tvpi: string | null;
  dpi: string | null;
}

function formatPercentFromDecimal(value: number | string | null): string {
  if (value === null || value === undefined) return '-';
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '-';
  return formatPercent(num * 100);
}

function formatMultiple(value: number | string | null): string {
  if (value === null || value === undefined) return '-';
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '-';
  return `${num.toFixed(2)}x`;
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'raising': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
    case 'investing': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
    case 'harvesting': return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300';
    case 'closed': return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300';
    case 'liquidated': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
    default: return 'bg-gray-100 text-gray-800';
  }
}

const STORAGE_KEY = 'marinamatch_selected_fund_id';

export function FundSelector() {
  const [selectedFundId, setSelectedFundId] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(STORAGE_KEY);
    }
    return null;
  });

  const { data: funds = [], isLoading } = useQuery<Fund[]>({
    queryKey: ['/api/funds'],
  });

  useEffect(() => {
    if (selectedFundId && typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, selectedFundId);
    }
  }, [selectedFundId]);

  useEffect(() => {
    if (!selectedFundId && funds.length > 0) {
      setSelectedFundId(funds[0].id);
    }
  }, [funds, selectedFundId]);

  const selectedFund = funds.find(f => f.id === selectedFundId);

  if (isLoading) {
    return (
      <div className="flex items-center gap-3">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-6 w-20" />
        <Skeleton className="h-6 w-20" />
        <Skeleton className="h-6 w-20" />
      </div>
    );
  }

  if (funds.length === 0) {
    return (
      <Link href="/modeling/funds">
        <Button variant="outline" size="sm" className="gap-2" data-testid="button-create-first-fund">
          <Briefcase className="h-4 w-4" />
          Create Your First Fund
        </Button>
      </Link>
    );
  }

  const handleSelectFund = (fundId: string) => {
    setSelectedFundId(fundId);
  };

  return (
    <div className="flex items-center gap-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 px-4 py-2 rounded-lg border border-blue-100 dark:border-blue-900/30">
      <div className="flex items-center gap-2">
        <Building2 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
        <span className="text-xs font-medium text-muted-foreground">Active Fund</span>
      </div>
      
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button 
            variant="ghost" 
            size="sm" 
            className="gap-2 font-semibold hover:bg-blue-100 dark:hover:bg-blue-900/30"
            data-testid="button-fund-selector"
          >
            <span className="max-w-[180px] truncate">
              {selectedFund?.shortName || selectedFund?.name || 'Select Fund'}
            </span>
            {selectedFund && (
              <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${getStatusColor(selectedFund.status)}`}>
                {selectedFund.status}
              </Badge>
            )}
            <ChevronDown className="h-3.5 w-3.5 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-80">
          <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
            Select a fund to view metrics
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {funds.map((fund) => (
            <DropdownMenuItem 
              key={fund.id}
              onClick={() => handleSelectFund(fund.id)}
              className="flex flex-col items-start gap-1 py-3 cursor-pointer"
              data-testid={`menu-item-fund-${fund.id}`}
            >
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{fund.name}</span>
                  {fund.id === selectedFundId && (
                    <Badge variant="default" className="text-[10px] px-1.5 py-0">Active</Badge>
                  )}
                </div>
                <Badge variant="outline" className={`text-[10px] ${getStatusColor(fund.status)}`}>
                  {fund.status}
                </Badge>
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span>Vintage {fund.vintage}</span>
                <span>•</span>
                <span>Committed: {formatCurrency(fund.committedCapital)}</span>
                {fund.netIrr && (
                  <>
                    <span>•</span>
                    <span className="text-green-600 dark:text-green-400">IRR: {formatPercentFromDecimal(fund.netIrr)}</span>
                  </>
                )}
              </div>
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <Link href="/modeling/funds">
            <DropdownMenuItem className="cursor-pointer">
              <Briefcase className="h-4 w-4 mr-2" />
              Manage Funds
            </DropdownMenuItem>
          </Link>
        </DropdownMenuContent>
      </DropdownMenu>

      {selectedFund && (
        <div className="hidden md:flex items-center gap-4 ml-2 pl-4 border-l border-blue-200 dark:border-blue-800">
          <div className="flex items-center gap-1.5">
            <TrendingUp className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
            <span className="text-xs text-muted-foreground">Net IRR</span>
            <span className="text-sm font-semibold text-green-600 dark:text-green-400">
              {formatPercentFromDecimal(selectedFund.netIrr)}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <DollarSign className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
            <span className="text-xs text-muted-foreground">TVPI</span>
            <span className="text-sm font-semibold">
              {formatMultiple(selectedFund.tvpi)}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">DPI</span>
            <span className="text-sm font-semibold">
              {formatMultiple(selectedFund.dpi)}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">Committed</span>
            <span className="text-sm font-semibold">
              {formatCurrency(selectedFund.committedCapital)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

export function useFundContext() {
  const [selectedFundId, setSelectedFundId] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(STORAGE_KEY);
    }
    return null;
  });

  const { data: funds = [] } = useQuery<Fund[]>({
    queryKey: ['/api/funds'],
  });

  const selectedFund = funds.find(f => f.id === selectedFundId) || funds[0] || null;

  return {
    selectedFundId: selectedFund?.id || null,
    selectedFund,
    funds,
    setSelectedFundId,
  };
}
