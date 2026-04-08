import { useEffect, useState, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useLocation } from 'wouter';
import { StandardDialogShell } from '@/components/ui/standard-dialog-shell';
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
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Loader2, Check, ChevronsUpDown, User, Building2, Calculator } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { normalizeState } from '@shared/utils/state-normalization';
import { AddressInput, type AddressComponents } from '@/components/address-input';
import { US_REGIONS } from '@shared/salescomps-constants';

const formSchema = z.object({
  marinaName: z.string().min(1, 'Marina name is required'),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zipCode: z.string().optional(),
  region: z.string().optional(),
  dealOutcome: z.enum(['active', 'won', 'lost', 'passed', 'under_review']),
  dealSource: z.enum(['direct_to_seller', 'broker', 'owned_marina']).nullable().optional(),
  ddProjectId: z.string().nullable().optional(),
  salesCompId: z.string().nullable().optional(),
  rateCompId: z.string().nullable().optional(),
  propertyId: z.string().nullable().optional(),
  brokerId: z.string().nullable().optional(),
  brokerCompanyId: z.string().nullable().optional(),
  companyId: z.string().nullable().optional(),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

type ModelingProject = {
  id: string;
  marinaName: string;
  address: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  region: string | null;
  dealOutcome: string;
  dealSource: string | null;
  ddProjectId: string | null;
  salesCompId: string | null;
  rateCompId: string | null;
  propertyId: string | null;
  brokerId: string | null;
  brokerCompanyId: string | null;
  companyId: string | null;
  notes: string | null;
};

type ModelingRegion = {
  id: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
};

type BrokerContact = {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  title: string | null;
  companyId: string | null;
  companyName: string | null;
};

type BrokerCompany = {
  id: string;
  name: string;
  domain: string | null;
  phone: string | null;
};

type BrokerSearchResult = {
  contacts: BrokerContact[];
  companies: BrokerCompany[];
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
  const [, setLocation] = useLocation();
  const [brokerSearch, setBrokerSearch] = useState('');
  const [brokerPopoverOpen, setBrokerPopoverOpen] = useState(false);
  const [selectedBrokerDisplay, setSelectedBrokerDisplay] = useState('');

  const { data: regions = [] } = useQuery<ModelingRegion[]>({
    queryKey: ['/api/modeling/regions'],
    enabled: open,
  });

  const { data: brokerResults, isLoading: isSearchingBrokers } = useQuery<BrokerSearchResult>({
    queryKey: ['/api/modeling/broker-search', brokerSearch],
    queryFn: async () => {
      if (!brokerSearch || brokerSearch.length < 2) {
        return { contacts: [], companies: [] };
      }
      const response = await fetch(`/api/modeling/broker-search?q=${encodeURIComponent(brokerSearch)}`);
      return response.json();
    },
    enabled: open && brokerSearch.length >= 2,
  });

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      marinaName: '',
      address: '',
      city: '',
      state: '',
      zipCode: '',
      region: '',
      dealOutcome: 'active',
      dealSource: null,
      ddProjectId: null,
      salesCompId: null,
      rateCompId: null,
      propertyId: null,
      brokerId: null,
      brokerCompanyId: null,
      companyId: null,
      notes: '',
    },
  });

  const dealSource = form.watch('dealSource');

  const handleAddressSelect = useCallback((components: AddressComponents) => {
    if (components.street || components.streetAddress) {
      form.setValue("address", components.street || components.streetAddress || '');
    }
    if (components.city) form.setValue("city", components.city);
    if (components.state) form.setValue("state", components.state);
    if (components.zipCode) form.setValue("zipCode", components.zipCode);
  }, []);

  useEffect(() => {
    if (open && project && mode === 'edit') {
      form.reset({
        marinaName: project.marinaName,
        address: project.address || '',
        city: project.city || '',
        state: project.state || '',
        zipCode: project.zipCode || '',
        region: project.region || '',
        dealOutcome: project.dealOutcome as any,
        dealSource: project.dealSource as any || null,
        ddProjectId: project.ddProjectId,
        salesCompId: project.salesCompId,
        rateCompId: project.rateCompId,
        propertyId: project.propertyId,
        brokerId: project.brokerId,
        brokerCompanyId: project.brokerCompanyId,
        companyId: project.companyId,
        notes: project.notes || '',
      });
    } else if (open && mode === 'create') {
      form.reset({
        marinaName: '',
        address: '',
        city: '',
        state: '',
        zipCode: '',
        region: '',
        dealOutcome: 'active',
        dealSource: null,
        ddProjectId: null,
        salesCompId: null,
        rateCompId: null,
        propertyId: null,
        brokerId: null,
        brokerCompanyId: null,
        companyId: null,
        notes: '',
      });
      setSelectedBrokerDisplay('');
      setBrokerSearch('');
    }
  }, [open, project, mode]);

  useEffect(() => {
    if (dealSource !== 'broker') {
      form.setValue('brokerId', null);
      form.setValue('brokerCompanyId', null);
      setSelectedBrokerDisplay('');
      setBrokerSearch('');
    }
  }, [dealSource]);

  const createMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const response = await apiRequest('POST', '/api/modeling/projects', data);
      return response.json() as Promise<{ id: string }>;
    },
    onSuccess: (createdProject) => {
      queryClient.invalidateQueries({ queryKey: ['/api/modeling/projects'] });
      toast({ 
        title: 'Project Created', 
        description: 'Now upload your P&L and Rent Roll documents' 
      });
      onOpenChange(false);
      setLocation(`/modeling/projects/${createdProject.id}/doc-intel`);
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

  const handleStateBlur = () => {
    const currentState = form.getValues('state');
    if (currentState) {
      const normalized = normalizeState(currentState);
      form.setValue('state', normalized);
    }
  };

  const onSubmit = (data: FormData) => {
    if (data.state) {
      data.state = normalizeState(data.state);
    }
    
    if (mode === 'create') {
      createMutation.mutate(data);
    } else {
      updateMutation.mutate(data);
    }
  };

  const handleSelectBroker = (contact: BrokerContact) => {
    form.setValue('brokerId', contact.id);
    form.setValue('brokerCompanyId', contact.companyId);
    setSelectedBrokerDisplay(`${contact.firstName} ${contact.lastName}${contact.companyName ? ` (${contact.companyName})` : ''}`);
    setBrokerPopoverOpen(false);
    setBrokerSearch('');
  };

  const handleSelectCompany = (company: BrokerCompany) => {
    form.setValue('brokerCompanyId', company.id);
    form.setValue('brokerId', null);
    setSelectedBrokerDisplay(company.name);
    setBrokerPopoverOpen(false);
    setBrokerSearch('');
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  const sortedRegions = regions.length > 0 
    ? [...regions].filter(r => r.isActive).sort((a, b) => a.sortOrder - b.sortOrder)
    : null;

  return (
    <StandardDialogShell
      open={open}
      onOpenChange={onOpenChange}
      title={mode === 'create' ? 'Create Project' : 'Edit Project'}
      description={mode === 'create'
        ? 'Add a new valuation/financial modeling project'
        : 'Update the modeling project details'}
      icon={Calculator}
      size="lg"
      className="max-h-[90vh] overflow-y-auto"
      footer={
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
            data-testid="button-cancel"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form="modeling-project-form"
            disabled={isPending}
            data-testid="button-submit"
          >
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {mode === 'create' ? 'Create' : 'Update'}
          </Button>
        </div>
      }
    >
      <Form {...form}>
        <form id="modeling-project-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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

          <FormField
            control={form.control}
            name="address"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <AddressInput
                    value={field.value || ''}
                    onChange={(value, components) => {
                      field.onChange(value);
                      if (components) {
                        handleAddressSelect(components);
                      }
                    }}
                    onAddressSelect={handleAddressSelect}
                    label="Address"
                    placeholder="Start typing an address..."
                    testId="input-address"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
                    <Input 
                      {...field} 
                      value={field.value || ''} 
                      placeholder="FL" 
                      data-testid="input-state"
                      onBlur={(e) => {
                        field.onBlur();
                        handleStateBlur();
                      }}
                      maxLength={20}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="zipCode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Zip Code</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value || ''} placeholder="12345" data-testid="input-zipcode" />
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
                <Select
                  onValueChange={(value) => field.onChange(value === 'none' ? '' : value)}
                  value={field.value || 'none'}
                >
                  <FormControl>
                    <SelectTrigger data-testid="select-region">
                      <SelectValue placeholder="Select a region" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="none">No region</SelectItem>
                    {sortedRegions 
                      ? sortedRegions.map((region) => (
                          <SelectItem key={region.id} value={region.name}>
                            {region.name}
                          </SelectItem>
                        ))
                      : US_REGIONS.map((region) => (
                          <SelectItem key={region} value={region}>
                            {region}
                          </SelectItem>
                        ))
                    }
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="dealSource"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Deal Source</FormLabel>
                <Select 
                  onValueChange={(value) => field.onChange(value === 'none' ? null : value)} 
                  value={field.value || 'none'}
                >
                  <FormControl>
                    <SelectTrigger data-testid="select-deal-source">
                      <SelectValue placeholder="Select deal source" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="none">No source selected</SelectItem>
                    <SelectItem value="direct_to_seller">Direct to Seller</SelectItem>
                    <SelectItem value="broker">Broker</SelectItem>
                    <SelectItem value="owned_marina">Owned Marina</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          {dealSource === 'broker' && (
            <FormField
              control={form.control}
              name="brokerId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Broker</FormLabel>
                  <Popover open={brokerPopoverOpen} onOpenChange={setBrokerPopoverOpen}>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          role="combobox"
                          className={cn(
                            "w-full justify-between",
                            !selectedBrokerDisplay && "text-muted-foreground"
                          )}
                          data-testid="button-select-broker"
                        >
                          {selectedBrokerDisplay || "Search for a broker..."}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-[calc(100vw-2rem)] sm:w-[400px] p-0" align="start">
                      <Command shouldFilter={false}>
                        <CommandInput 
                          placeholder="Search brokers by name or company..."
                          value={brokerSearch}
                          onValueChange={setBrokerSearch}
                          data-testid="input-broker-search"
                        />
                        <CommandList>
                          {brokerSearch.length < 2 ? (
                            <CommandEmpty>Type at least 2 characters to search...</CommandEmpty>
                          ) : isSearchingBrokers ? (
                            <div className="flex items-center justify-center py-6">
                              <Loader2 className="h-4 w-4 animate-spin" />
                            </div>
                          ) : (
                            <>
                              {brokerResults?.contacts && brokerResults.contacts.length > 0 && (
                                <CommandGroup heading="Contacts">
                                  {brokerResults.contacts.map((contact) => (
                                    <CommandItem
                                      key={contact.id}
                                      value={contact.id}
                                      onSelect={() => handleSelectBroker(contact)}
                                      data-testid={`broker-contact-${contact.id}`}
                                    >
                                      <User className="mr-2 h-4 w-4" />
                                      <div className="flex flex-col">
                                        <span>{contact.firstName} {contact.lastName}</span>
                                        {contact.companyName && (
                                          <span className="text-xs text-muted-foreground">{contact.companyName}</span>
                                        )}
                                      </div>
                                      {field.value === contact.id && (
                                        <Check className="ml-auto h-4 w-4" />
                                      )}
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              )}
                              {brokerResults?.contacts && brokerResults.contacts.length > 0 && 
                               brokerResults?.companies && brokerResults.companies.length > 0 && (
                                <CommandSeparator />
                              )}
                              {brokerResults?.companies && brokerResults.companies.length > 0 && (
                                <CommandGroup heading="Companies">
                                  {brokerResults.companies.map((company) => (
                                    <CommandItem
                                      key={company.id}
                                      value={company.id}
                                      onSelect={() => handleSelectCompany(company)}
                                      data-testid={`broker-company-${company.id}`}
                                    >
                                      <Building2 className="mr-2 h-4 w-4" />
                                      <span>{company.name}</span>
                                      {form.getValues('brokerCompanyId') === company.id && !form.getValues('brokerId') && (
                                        <Check className="ml-auto h-4 w-4" />
                                      )}
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              )}
                              {(!brokerResults?.contacts || brokerResults.contacts.length === 0) && 
                               (!brokerResults?.companies || brokerResults.companies.length === 0) && (
                                <CommandEmpty>No brokers found</CommandEmpty>
                              )}
                            </>
                          )}
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

          <FormField
            control={form.control}
            name="dealOutcome"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Deal Status</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger data-testid="select-outcome">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="under_review">Under Review</SelectItem>
                    <SelectItem value="won">Won</SelectItem>
                    <SelectItem value="lost">Lost</SelectItem>
                    <SelectItem value="passed">Passed</SelectItem>
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
                    rows={3}
                    data-testid="textarea-notes"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </form>
      </Form>
    </StandardDialogShell>
  );
}
