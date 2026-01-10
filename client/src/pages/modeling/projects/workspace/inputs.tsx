import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import {
  Calendar,
  Save,
  Sun,
  Snowflake,
  Building2,
  Anchor,
  Ship,
  Fuel,
  ShoppingCart,
  FileText,
  Warehouse,
  RefreshCw
} from 'lucide-react';

interface WorkspaceInputsProps {
  projectId: string;
}

type DepartmentConfig = {
  id: string;
  name: string;
  category: 'revenue' | 'expense' | 'cogs';
  isYearRound: boolean;
  isEnabled: boolean;
  icon: React.ReactNode;
  description: string;
};

const defaultDepartments: DepartmentConfig[] = [
  { id: 'wet_slips', name: 'Wet Slips', category: 'revenue', isYearRound: false, isEnabled: true, icon: <Anchor className="h-4 w-4" />, description: 'Marina dock and slip rentals' },
  { id: 'dry_storage', name: 'Dry Storage', category: 'revenue', isYearRound: false, isEnabled: true, icon: <Warehouse className="h-4 w-4" />, description: 'Dry rack and indoor storage' },
  { id: 'annual_storage', name: 'Annual Storage', category: 'revenue', isYearRound: true, isEnabled: false, icon: <Calendar className="h-4 w-4" />, description: 'Year-round storage contracts' },
  { id: 'rental_boats', name: 'Rental Boats', category: 'revenue', isYearRound: false, isEnabled: false, icon: <Ship className="h-4 w-4" />, description: 'Boat rental operations' },
  { id: 'fuel', name: 'Fuel Sales', category: 'revenue', isYearRound: false, isEnabled: true, icon: <Fuel className="h-4 w-4" />, description: 'Marine fuel operations' },
  { id: 'ship_store', name: 'Ship Store', category: 'revenue', isYearRound: false, isEnabled: true, icon: <ShoppingCart className="h-4 w-4" />, description: 'Retail and convenience store' },
  { id: 'service_repair', name: 'Service & Repair', category: 'revenue', isYearRound: false, isEnabled: false, icon: <RefreshCw className="h-4 w-4" />, description: 'Boat service and repair' },
  { id: 'third_party_leases', name: 'Third-Party Leases', category: 'revenue', isYearRound: true, isEnabled: false, icon: <FileText className="h-4 w-4" />, description: 'Restaurant, retail tenant leases' },
  { id: 'other_revenue', name: 'Other Revenue', category: 'revenue', isYearRound: true, isEnabled: false, icon: <Building2 className="h-4 w-4" />, description: 'Miscellaneous income' },
];

const months = [
  { value: 1, label: 'January', short: 'Jan' },
  { value: 2, label: 'February', short: 'Feb' },
  { value: 3, label: 'March', short: 'Mar' },
  { value: 4, label: 'April', short: 'Apr' },
  { value: 5, label: 'May', short: 'May' },
  { value: 6, label: 'June', short: 'Jun' },
  { value: 7, label: 'July', short: 'Jul' },
  { value: 8, label: 'August', short: 'Aug' },
  { value: 9, label: 'September', short: 'Sep' },
  { value: 10, label: 'October', short: 'Oct' },
  { value: 11, label: 'November', short: 'Nov' },
  { value: 12, label: 'December', short: 'Dec' },
];

export default function WorkspaceInputs({ projectId }: WorkspaceInputsProps) {
  const { toast } = useToast();

  const { data: config, isLoading } = useQuery<any>({
    queryKey: ['/api/modeling/projects', projectId, 'config'],
  });

  const [holdPeriod, setHoldPeriod] = useState<number>(5);
  const [startDate, setStartDate] = useState<string>('2026-01-31');
  const [cashFlowGranularity, setCashFlowGranularity] = useState<string>('annual');
  const [seasonMonths, setSeasonMonths] = useState<number[]>([4, 5, 6, 7, 8, 9, 10]);
  const [departments, setDepartments] = useState<DepartmentConfig[]>(defaultDepartments);

  useEffect(() => {
    if (config) {
      setHoldPeriod(config.holdPeriod || 5);
      setStartDate(config.startDate || '2026-01-31');
      setCashFlowGranularity(config.cashFlowGranularity || 'annual');
      setSeasonMonths(config.seasonMonths || [4, 5, 6, 7, 8, 9, 10]);
      if (config.departments) {
        setDepartments(prev => prev.map(dept => ({
          ...dept,
          isYearRound: config.departments[dept.id]?.isYearRound ?? dept.isYearRound,
          isEnabled: config.departments[dept.id]?.isEnabled ?? dept.isEnabled
        })));
      }
    }
  }, [config]);

  const saveMutation = useMutation({
    mutationFn: (data: any) => apiRequest('POST', `/api/modeling/projects/${projectId}/config`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/modeling/projects', projectId, 'config'] });
      toast({ title: 'Saved', description: 'Project configuration has been saved.' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to save configuration.', variant: 'destructive' });
    },
  });

  const toggleSeasonMonth = (month: number) => {
    setSeasonMonths(prev => 
      prev.includes(month) 
        ? prev.filter(m => m !== month)
        : [...prev, month].sort((a, b) => a - b)
    );
  };

  const toggleDepartmentYearRound = (deptId: string) => {
    setDepartments(prev => prev.map(dept => 
      dept.id === deptId ? { ...dept, isYearRound: !dept.isYearRound } : dept
    ));
  };

  const toggleDepartmentEnabled = (deptId: string) => {
    setDepartments(prev => prev.map(dept => 
      dept.id === deptId ? { ...dept, isEnabled: !dept.isEnabled } : dept
    ));
  };

  const handleSave = () => {
    const departmentSettings: Record<string, { isYearRound: boolean; isEnabled: boolean }> = {};
    departments.forEach(dept => {
      departmentSettings[dept.id] = { isYearRound: dept.isYearRound, isEnabled: dept.isEnabled };
    });

    saveMutation.mutate({
      holdPeriod,
      startDate,
      cashFlowGranularity,
      seasonMonths,
      departments: departmentSettings,
    });
  };

  const getSeasonLabel = () => {
    if (seasonMonths.length === 0) return 'No season selected';
    if (seasonMonths.length === 12) return 'Year-round';
    
    const startMonth = months.find(m => m.value === Math.min(...seasonMonths));
    const endMonth = months.find(m => m.value === Math.max(...seasonMonths));
    return `${startMonth?.short} - ${endMonth?.short} (${seasonMonths.length} months)`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Project Inputs</h2>
          <p className="text-sm text-muted-foreground">
            Configure seasonality, hold period, and department settings
          </p>
        </div>
        <Button 
          onClick={handleSave} 
          disabled={saveMutation.isPending}
          data-testid="button-save-inputs"
        >
          <Save className="h-4 w-4 mr-2" />
          {saveMutation.isPending ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Hold Period & Start Date
            </CardTitle>
            <CardDescription>
              Set the investment timeline for pro forma projections
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="holdPeriod">Hold Period</Label>
              <Select 
                value={holdPeriod.toString()} 
                onValueChange={(v) => setHoldPeriod(parseInt(v))}
              >
                <SelectTrigger id="holdPeriod" data-testid="select-hold-period">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">5 Years</SelectItem>
                  <SelectItem value="7">7 Years</SelectItem>
                  <SelectItem value="10">10 Years</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="startDate">Pro Forma Start Date</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                data-testid="input-start-date"
              />
            </div>
            <Separator className="my-4" />
            <div className="space-y-2">
              <Label htmlFor="cashFlowGranularity">Cash Flow Timing</Label>
              <Select 
                value={cashFlowGranularity} 
                onValueChange={(v) => setCashFlowGranularity(v)}
              >
                <SelectTrigger id="cashFlowGranularity" data-testid="select-granularity">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="annual">Annual</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Monthly uses XIRR for precise return calculations based on actual dates
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sun className="h-5 w-5" />
              In-Season Months
            </CardTitle>
            <CardDescription>
              Select the months when seasonal operations are active
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Badge variant="outline" className="gap-1">
                <Sun className="h-3 w-3" />
                {getSeasonLabel()}
              </Badge>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSeasonMonths([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])}
                data-testid="button-year-round"
              >
                <Calendar className="h-3 w-3 mr-1" />
                Year-Round
              </Button>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {months.map((month) => (
                <Button
                  key={month.value}
                  variant={seasonMonths.includes(month.value) ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => toggleSeasonMonth(month.value)}
                  className="w-full"
                  data-testid={`button-month-${month.value}`}
                >
                  {seasonMonths.includes(month.value) ? (
                    <Sun className="h-3 w-3 mr-1" />
                  ) : (
                    <Snowflake className="h-3 w-3 mr-1" />
                  )}
                  {month.short}
                </Button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Off-season months will show $0 for seasonal departments in Pro Forma
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Department Configuration</CardTitle>
          <CardDescription>
            Enable departments that apply to this property and configure seasonality. 
            Only enabled departments will appear in Growth Rates and Pro Forma.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {departments.map((dept) => (
              <div
                key={dept.id}
                className={`flex items-center justify-between p-3 rounded-lg border ${
                  dept.isEnabled 
                    ? 'bg-muted/30 border-border' 
                    : 'bg-muted/10 border-dashed opacity-60'
                }`}
                data-testid={`department-${dept.id}`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <input
                    type="checkbox"
                    checked={dept.isEnabled}
                    onChange={() => toggleDepartmentEnabled(dept.id)}
                    className="h-4 w-4 rounded border-muted-foreground/50 text-primary focus:ring-primary cursor-pointer"
                    data-testid={`checkbox-${dept.id}-enabled`}
                  />
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                    dept.isEnabled ? 'bg-background' : 'bg-muted/30'
                  }`}>
                    {dept.icon}
                  </div>
                  <span className={`font-medium text-sm truncate ${!dept.isEnabled && 'text-muted-foreground'}`}>
                    {dept.name}
                  </span>
                </div>
                {dept.isEnabled && (
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <span className="text-xs text-muted-foreground">
                      {dept.isYearRound ? 'Year-Round' : 'Seasonal'}
                    </span>
                    <Switch
                      checked={dept.isYearRound}
                      onCheckedChange={() => toggleDepartmentYearRound(dept.id)}
                      className="scale-75"
                      data-testid={`switch-${dept.id}-year-round`}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
