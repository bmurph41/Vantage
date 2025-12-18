import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

export interface DdFee {
  id: string;
  projectId: string;
  orgId: string;
  contactId: string | null;
  companyId: string | null;
  taskId: string | null;
  category: string;
  description: string | null;
  amount: string;
  dateIncurred: string | null;
  datePaid: string | null;
  isPaid: boolean;
  invoiceNumber: string | null;
  paymentMethod: string | null;
  notes: string | null;
  phase: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  contactName?: string | null;
  companyName?: string | null;
  taskName?: string | null;
}

export interface DdFeesSummary {
  byCategory: Array<{
    category: string;
    totalAmount: string;
    count: number;
  }>;
  totalFees: number;
  paidFees: number;
  unpaidFees: number;
}

export const FEE_CATEGORIES = [
  { value: 'legal', label: 'Legal', icon: 'Scale' },
  { value: 'accounting', label: 'Accounting', icon: 'Calculator' },
  { value: 'consulting', label: 'Consulting', icon: 'Users' },
  { value: 'inspection', label: 'Inspection', icon: 'Search' },
  { value: 'appraisal', label: 'Appraisal', icon: 'FileText' },
  { value: 'environmental', label: 'Environmental', icon: 'Leaf' },
  { value: 'survey', label: 'Survey', icon: 'Map' },
  { value: 'title', label: 'Title', icon: 'FileCheck' },
  { value: 'lender', label: 'Lender Fees', icon: 'Building' },
  { value: 'broker', label: 'Broker', icon: 'Briefcase' },
  { value: 'other', label: 'Other', icon: 'MoreHorizontal' },
] as const;

export type FeeCategoryType = typeof FEE_CATEGORIES[number]['value'];

export function useDdFees(projectId: string | undefined) {
  const { toast } = useToast();

  const feesQuery = useQuery<DdFee[]>({
    queryKey: ['/api/dd/projects', projectId, 'fees'],
    enabled: !!projectId,
  });

  const summaryQuery = useQuery<DdFeesSummary>({
    queryKey: ['/api/dd/projects', projectId, 'fees/summary'],
    enabled: !!projectId,
  });

  const createFeeMutation = useMutation({
    mutationFn: async (data: Omit<DdFee, 'id' | 'projectId' | 'orgId' | 'createdBy' | 'createdAt' | 'updatedAt'>) => {
      const response = await apiRequest('POST', `/api/dd/projects/${projectId}/fees`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/dd/projects', projectId, 'fees'] });
      toast({ title: 'Fee Added', description: 'Due diligence fee has been recorded.' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const updateFeeMutation = useMutation({
    mutationFn: async ({ feeId, data }: { feeId: string; data: Partial<DdFee> }) => {
      const response = await apiRequest('PATCH', `/api/dd/fees/${feeId}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/dd/projects', projectId, 'fees'] });
      toast({ title: 'Fee Updated', description: 'Fee record has been updated.' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const deleteFeeMutation = useMutation({
    mutationFn: async (feeId: string) => {
      const response = await apiRequest('DELETE', `/api/dd/fees/${feeId}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/dd/projects', projectId, 'fees'] });
      toast({ title: 'Fee Deleted', description: 'Fee record has been removed.' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const markPaidMutation = useMutation({
    mutationFn: async ({ feeId, datePaid, paymentMethod }: { feeId: string; datePaid?: string; paymentMethod?: string }) => {
      const response = await apiRequest('POST', `/api/dd/fees/${feeId}/mark-paid`, { datePaid, paymentMethod });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/dd/projects', projectId, 'fees'] });
      toast({ title: 'Fee Marked Paid', description: 'Fee has been marked as paid.' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const getFeesByCategory = (category: string) => {
    return feesQuery.data?.filter(f => f.category === category) || [];
  };

  const getUnpaidFees = () => {
    return feesQuery.data?.filter(f => !f.isPaid) || [];
  };

  return {
    fees: feesQuery.data || [],
    summary: summaryQuery.data,
    isLoading: feesQuery.isLoading,
    createFee: createFeeMutation.mutateAsync,
    updateFee: updateFeeMutation.mutateAsync,
    deleteFee: deleteFeeMutation.mutateAsync,
    markPaid: markPaidMutation.mutateAsync,
    getFeesByCategory,
    getUnpaidFees,
    isPending: 
      createFeeMutation.isPending || 
      updateFeeMutation.isPending || 
      deleteFeeMutation.isPending ||
      markPaidMutation.isPending,
  };
}
