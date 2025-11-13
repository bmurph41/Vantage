import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { CurrencyInput } from '@/components/ui/currency-input';

const formSchema = z.object({
  marinaName: z.string().min(1, 'Marina name is required'),
  city: z.string().optional(),
  state: z.string().optional(),
  region: z.string().optional(),
  purchasePrice: z.number().nullable().optional(),
  year1CapRate: z.number().nullable().optional(),
  totalStorageUnits: z.number().nullable().optional(),
  ebitda: z.number().nullable().optional(),
  dealOutcome: z.enum(['active', 'won', 'lost', 'passed', 'under_review']),
  ddProjectId: z.string().nullable().optional(),
  salesCompId: z.string().nullable().optional(),
  rateCompId: z.string().nullable().optional(),
  propertyId: z.string().nullable().optional(),
  brokerId: z.string().nullable().optional(),
  companyId: z.string().nullable().optional(),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

type ModelingProject = {
  id: string;
  marinaName: string;
  city: string | null;
  state: string | null;
  region: string | null;
  purchasePrice: number | null;
  year1CapRate: number | null;
  totalStorageUnits: number | null;
  ebitda: number | null;
  dealOutcome: string;
  ddProjectId: string | null;
  salesCompId: string | null;
  rateCompId: string | null;
  propertyId: string | null;
  brokerId: string | null;
  companyId: string | null;
  notes: string | null;
};

type Contact = {
  id: string;
  firstName: string;
  lastName: string;
};

interface ModelingProjectFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'create' | 'edit';
  project: ModelingProject | null;
}

export default function ModelingProjectFormDialog({
  open,
  onOpenChange,
  mode,
  project,
}: ModelingProjectFormDialogProps) {
  const { toast } = useToast();
  const [brokerSearch, setBrokerSearch] = useState('');

  const { data: contacts = [] } = useQuery<Contact[]>({
    queryKey: ['/api/crm/contacts'],
    enabled: open,
  });

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      marinaName: '',
      city: '',
      state: '',
      region: '',
      purchasePrice: null,
      year1CapRate: null,
      totalStorageUnits: null,
      ebitda: null,
      dealOutcome: 'active',
      ddProjectId: null,
      salesCompId: null,
      rateCompId: null,
      propertyId: null,
      brokerId: null,
      companyId: null,
      notes: '',
    },
  });

  useEffect(() => {
    if (open && project && mode === 'edit') {
      form.reset({
        marinaName: project.marinaName,
        city: project.city || '',
        state: project.state || '',
        region: project.region || '',
        purchasePrice: project.purchasePrice,
        year1CapRate: project.year1CapRate,
        totalStorageUnits: project.totalStorageUnits,
        ebitda: project.ebitda,
        dealOutcome: project.dealOutcome as any,
        ddProjectId: project.ddProjectId,
        salesCompId: project.salesCompId,
        rateCompId: project.rateCompId,
        propertyId: project.propertyId,
        brokerId: project.brokerId,
        companyId: project.companyId,
        notes: project.notes || '',
      });
    } else if (open && mode === 'create') {
      form.reset({
        marinaName: '',
        city: '',
        state: '',
        region: '',
        purchasePrice: null,
        year1CapRate: null,
        totalStorageUnits: null,
        ebitda: null,
        dealOutcome: 'active',
        ddProjectId: null,
        salesCompId: null,
        rateCompId: null,
        propertyId: null,
        brokerId: null,
        companyId: null,
        notes: '',
      });
    }
  }, [open, project, mode, form]);

  const createMutation = useMutation({
    mutationFn: (data: FormData) => apiRequest('POST', '/api/modeling/projects', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/modeling/projects'] });
      toast({ title: 'Success', description: 'Modeling project created successfully' });
      onOpenChange(false);
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to create modeling project',
        variant: 'destructive',
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: FormData) =>
      apiRequest('PATCH', `/api/modeling/projects/${project?.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/modeling/projects'] });
      toast({ title: 'Success', description: 'Modeling project updated successfully' });
      onOpenChange(false);
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to update modeling project',
        variant: 'destructive',
      });
    },
  });

  const onSubmit = (data: FormData) => {
    if (mode === 'create') {
      createMutation.mutate(data);
    } else {
      updateMutation.mutate(data);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  const filteredContacts = contacts.filter(
    (contact) =>
      `${contact.firstName} ${contact.lastName}`.toLowerCase().includes(brokerSearch.toLowerCase())
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {mode === 'create' ? 'Create Modeling Project' : 'Edit Modeling Project'}
          </DialogTitle>
          <DialogDescription>
            {mode === 'create'
              ? 'Add a new valuation/financial modeling project'
              : 'Update the modeling project details'}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="marinaName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Marina Name *</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Enter marina name" data-testid="input-marina-name" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="city"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>City</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value || ''} placeholder="City" data-testid="input-city" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="state"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>State</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value || ''} placeholder="State" data-testid="input-state" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="region"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Region</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value || ''} placeholder="e.g., Southeast, Northeast" data-testid="input-region" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="purchasePrice"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Purchase Price</FormLabel>
                    <FormControl>
                      <CurrencyInput
                        value={field.value || 0}
                        onChange={field.onChange}
                        placeholder="$0"
                        data-testid="input-purchase-price"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="year1CapRate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Year 1 Cap Rate (%)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        {...field}
                        value={field.value ?? ''}
                        onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : null)}
                        placeholder="0.00"
                        data-testid="input-cap-rate"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="totalStorageUnits"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Total Storage Units</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        {...field}
                        value={field.value ?? ''}
                        onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : null)}
                        placeholder="0"
                        data-testid="input-storage-units"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="ebitda"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>EBITDA</FormLabel>
                    <FormControl>
                      <CurrencyInput
                        value={field.value || 0}
                        onChange={field.onChange}
                        placeholder="$0"
                        data-testid="input-ebitda"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="dealOutcome"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Deal Outcome</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-outcome">
                        <SelectValue placeholder="Select outcome" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="won">Won</SelectItem>
                      <SelectItem value="lost">Lost</SelectItem>
                      <SelectItem value="passed">Passed</SelectItem>
                      <SelectItem value="under_review">Under Review</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="brokerId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Broker (Contact)</FormLabel>
                  <Select
                    onValueChange={(value) => field.onChange(value === 'none' ? null : value)}
                    value={field.value || 'none'}
                  >
                    <FormControl>
                      <SelectTrigger data-testid="select-broker">
                        <SelectValue placeholder="Select a broker" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <div className="p-2">
                        <Input
                          placeholder="Search contacts..."
                          value={brokerSearch}
                          onChange={(e) => setBrokerSearch(e.target.value)}
                          className="mb-2"
                          data-testid="input-broker-search"
                        />
                      </div>
                      <SelectItem value="none">No broker</SelectItem>
                      {filteredContacts.map((contact) => (
                        <SelectItem key={contact.id} value={contact.id}>
                          {contact.firstName} {contact.lastName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      value={field.value || ''}
                      placeholder="Additional notes or comments..."
                      rows={4}
                      data-testid="textarea-notes"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isPending}
                data-testid="button-cancel"
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isPending} data-testid="button-submit">
                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {mode === 'create' ? 'Create' : 'Update'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
