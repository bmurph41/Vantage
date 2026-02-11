import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { X, Plus } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

const filterSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  moduleType: z.string().min(1, 'Module type is required'),
  dateRange: z.object({
    from: z.date().optional(),
    to: z.date().optional(),
  }).optional(),
  location: z.string().optional(),
  status: z.string().optional(),
  category: z.string().optional(),
  project: z.string().optional(),
  minValue: z.string().optional(),
  maxValue: z.string().optional(),
});

type FilterForm = z.infer<typeof filterSchema>;

interface CustomModuleBuilderProps {
  onSave: (data: { title: string; moduleType: string; filters: Record<string, any> }) => void;
  onCancel: () => void;
  initialData?: {
    title: string;
    moduleType: string;
    filters: Record<string, any>;
  };
}

const MODULE_TYPES = [
  { value: 'crm', label: 'CRM Deals', filterOptions: ['dateRange', 'status', 'minValue', 'maxValue'] },
  { value: 'salesComps', label: 'Sales Comparables', filterOptions: ['dateRange', 'location', 'minValue', 'maxValue'] },
  { value: 'dueDiligence', label: 'Due Diligence Tasks', filterOptions: ['dateRange', 'status', 'project'] },
  { value: 'rentRoll', label: 'Rent Roll Entries', filterOptions: ['dateRange', 'status', 'minValue', 'maxValue'] },
  { value: 'vdr', label: 'VDR Activity', filterOptions: ['dateRange', 'project', 'category'] },
  { value: 'fuel', label: 'Fuel Transactions', filterOptions: ['dateRange', 'minValue', 'maxValue'] },
  { value: 'shipStore', label: 'Ship Store Sales', filterOptions: ['dateRange', 'status', 'minValue', 'maxValue'] },
  { value: 'modeling', label: 'Modeling Projects', filterOptions: ['dateRange', 'status', 'minValue', 'maxValue'] },
  { value: 'docktalk', label: 'Docket Articles', filterOptions: ['dateRange', 'category'] },
];

export function CustomModuleBuilder({ onSave, onCancel, initialData }: CustomModuleBuilderProps) {
  const [selectedModuleType, setSelectedModuleType] = useState(initialData?.moduleType || '');
  const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date }>({
    from: initialData?.filters?.dateRange?.from ? new Date(initialData.filters.dateRange.from) : undefined,
    to: initialData?.filters?.dateRange?.to ? new Date(initialData.filters.dateRange.to) : undefined,
  });

  const form = useForm<FilterForm>({
    resolver: zodResolver(filterSchema),
    defaultValues: {
      title: initialData?.title || '',
      moduleType: initialData?.moduleType || '',
      location: initialData?.filters?.location || '',
      status: initialData?.filters?.status || '',
      category: initialData?.filters?.category || '',
      project: initialData?.filters?.project || '',
      minValue: initialData?.filters?.minValue || '',
      maxValue: initialData?.filters?.maxValue || '',
    },
  });

  const selectedModule = MODULE_TYPES.find(m => m.value === selectedModuleType);

  const handleSubmit = (data: FilterForm) => {
    const filters: Record<string, any> = {};
    
    if (dateRange.from || dateRange.to) {
      filters.dateRange = {
        from: dateRange.from?.toISOString(),
        to: dateRange.to?.toISOString(),
      };
    }
    
    if (data.location) filters.location = data.location;
    if (data.status) filters.status = data.status;
    if (data.category) filters.category = data.category;
    if (data.project) filters.project = data.project;
    if (data.minValue) filters.minValue = parseFloat(data.minValue);
    if (data.maxValue) filters.maxValue = parseFloat(data.maxValue);

    onSave({
      title: data.title,
      moduleType: data.moduleType,
      filters,
    });
  };

  const hasFilterOption = (option: string) => {
    return selectedModule?.filterOptions.includes(option) || false;
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Create Custom Module</CardTitle>
        <CardDescription>
          Build a custom dashboard module with your own filters and data sources
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="title">Module Title</Label>
            <Input
              id="title"
              data-testid="input-module-title"
              placeholder="e.g., Florida Sales Comps, Q1 DD Tasks"
              {...form.register('title')}
            />
            {form.formState.errors.title && (
              <p className="text-sm text-red-500">{form.formState.errors.title.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="moduleType">Data Source <span className="text-red-500">*</span></Label>
            <Select
              value={selectedModuleType}
              onValueChange={(value) => {
                setSelectedModuleType(value);
                form.setValue('moduleType', value);
                form.clearErrors('moduleType');
              }}
            >
              <SelectTrigger 
                id="moduleType" 
                data-testid="select-module-type"
                className={form.formState.errors.moduleType ? 'border-red-500' : ''}
              >
                <SelectValue placeholder="Select a data source" />
              </SelectTrigger>
              <SelectContent>
                {MODULE_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {form.formState.errors.moduleType && (
              <p className="text-sm text-red-500">{form.formState.errors.moduleType.message}</p>
            )}
            {!selectedModuleType && !form.formState.errors.moduleType && (
              <p className="text-sm text-gray-500">Choose what data you want to display in this module</p>
            )}
          </div>

          {selectedModuleType && (
            <div className="space-y-4 border-t pt-4">
              <h3 className="font-medium text-sm">Filters</h3>

              {hasFilterOption('dateRange') && (
                <div className="space-y-2">
                  <Label>Date Range</Label>
                  <div className="flex gap-2">
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !dateRange.from && "text-muted-foreground"
                          )}
                          data-testid="button-date-from"
                        >
                          {dateRange.from ? format(dateRange.from, 'PPP') : 'From date'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={dateRange.from}
                          onSelect={(date) => setDateRange({ ...dateRange, from: date })}
                        />
                      </PopoverContent>
                    </Popover>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !dateRange.to && "text-muted-foreground"
                          )}
                          data-testid="button-date-to"
                        >
                          {dateRange.to ? format(dateRange.to, 'PPP') : 'To date'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={dateRange.to}
                          onSelect={(date) => setDateRange({ ...dateRange, to: date })}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
              )}

              {hasFilterOption('location') && (
                <div className="space-y-2">
                  <Label htmlFor="location">Location</Label>
                  <Input
                    id="location"
                    data-testid="input-location"
                    placeholder="e.g., Florida, Miami"
                    {...form.register('location')}
                  />
                </div>
              )}

              {hasFilterOption('status') && (
                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <Select
                    value={form.watch('status')}
                    onValueChange={(value) => form.setValue('status', value)}
                  >
                    <SelectTrigger id="status" data-testid="select-status">
                      <SelectValue placeholder="Any status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Any status</SelectItem>
                      {selectedModuleType === 'crm' && (
                        <>
                          <SelectItem value="lead">Lead</SelectItem>
                          <SelectItem value="qualified">Qualified</SelectItem>
                          <SelectItem value="proposal">Proposal</SelectItem>
                          <SelectItem value="negotiation">Negotiation</SelectItem>
                          <SelectItem value="closed_won">Closed Won</SelectItem>
                          <SelectItem value="closed_lost">Closed Lost</SelectItem>
                        </>
                      )}
                      {selectedModuleType === 'dueDiligence' && (
                        <>
                          <SelectItem value="not_started">Not Started</SelectItem>
                          <SelectItem value="in_progress">In Progress</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                          <SelectItem value="blocked">Blocked</SelectItem>
                        </>
                      )}
                      {selectedModuleType === 'rentRoll' && (
                        <>
                          <SelectItem value="occupied">Occupied</SelectItem>
                          <SelectItem value="vacant">Vacant</SelectItem>
                          <SelectItem value="notice">Notice</SelectItem>
                        </>
                      )}
                      {selectedModuleType === 'shipStore' && (
                        <>
                          <SelectItem value="completed">Completed</SelectItem>
                          <SelectItem value="refunded">Refunded</SelectItem>
                        </>
                      )}
                      {selectedModuleType === 'modeling' && (
                        <>
                          <SelectItem value="pursuing">Pursuing</SelectItem>
                          <SelectItem value="passed">Passed</SelectItem>
                          <SelectItem value="won">Won</SelectItem>
                        </>
                      )}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {hasFilterOption('category') && (
                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <Input
                    id="category"
                    data-testid="input-category"
                    placeholder="e.g., Financial, Legal"
                    {...form.register('category')}
                  />
                </div>
              )}

              {hasFilterOption('project') && (
                <div className="space-y-2">
                  <Label htmlFor="project">Project</Label>
                  <Input
                    id="project"
                    data-testid="input-project"
                    placeholder="Project name or ID"
                    {...form.register('project')}
                  />
                </div>
              )}

              {hasFilterOption('minValue') && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="minValue">Min Value ($)</Label>
                    <Input
                      id="minValue"
                      data-testid="input-min-value"
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      {...form.register('minValue')}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="maxValue">Max Value ($)</Label>
                    <Input
                      id="maxValue"
                      data-testid="input-max-value"
                      type="number"
                      step="0.01"
                      placeholder="999999.99"
                      {...form.register('maxValue')}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="flex gap-2 justify-end pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              data-testid="button-cancel"
            >
              Cancel
            </Button>
            <Button type="submit" data-testid="button-save-module">
              Save Module
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
