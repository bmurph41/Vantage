import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import {
  Target, DollarSign, MapPin, Building2, Users, TrendingUp,
  Save, Plus, Trash2, Settings2, CheckCircle2, Info
} from 'lucide-react';

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA',
  'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT',
  'VA','WA','WV','WI','WY'
];

const INVOLVEMENT_LEVELS = [
  { value: 'passive', label: 'Passive', desc: 'Hands-off investor, professional management required' },
  { value: 'semi_active', label: 'Semi-Active', desc: 'Periodic oversight, strategic decisions only' },
  { value: 'active', label: 'Active', desc: 'Day-to-day involvement, willing to manage operations' },
  { value: 'owner_operator', label: 'Owner-Operator', desc: 'Full-time on-site management' },
];

export default function InvestmentCriteria() {
  const { toast } = useToast();

  // Fetch existing criteria
  const { data: criteriaData, isLoading } = useQuery<any>({
    queryKey: ['/api/investment-criteria/default'],
  });

  // Form state
  const [name, setName] = useState('My Investment Criteria');
  const [fin, setFin] = useState<any>({});
  const [cap, setCap] = useState<any>({});
  const [loc, setLoc] = useState<any>({ targetStates: [] });
  const [ops, setOps] = useState<any>({});
  const [sz, setSz] = useState<any>({});
  const [inv, setInv] = useState<any>({});
  const [weights, setWeights] = useState({
    financialWeight: 25, capitalWeight: 10, locationWeight: 20,
    operationalWeight: 15, sizeWeight: 15, involvementWeight: 5, capexWeight: 10,
  });

  // Populate from fetched data
  useEffect(() => {
    if (criteriaData) {
      if (criteriaData.profile) {
        setName(criteriaData.profile.name || 'My Investment Criteria');
        setWeights({
          financialWeight: criteriaData.profile.financialWeight || 25,
          capitalWeight: criteriaData.profile.capitalWeight || 10,
          locationWeight: criteriaData.profile.locationWeight || 20,
          operationalWeight: criteriaData.profile.operationalWeight || 15,
          sizeWeight: criteriaData.profile.sizeWeight || 15,
          involvementWeight: criteriaData.profile.involvementWeight || 5,
          capexWeight: criteriaData.profile.capexWeight || 10,
        });
      }
      if (criteriaData.financial) setFin(criteriaData.financial);
      if (criteriaData.capital) setCap(criteriaData.capital);
      if (criteriaData.location) setLoc(criteriaData.location);
      if (criteriaData.operational) setOps(criteriaData.operational);
      if (criteriaData.size) setSz(criteriaData.size);
      if (criteriaData.involvement) setInv(criteriaData.involvement);
    }
  }, [criteriaData]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name,
        isDefault: true,
        ...weights,
        financial: fin,
        capital: cap,
        location: loc,
        operational: ops,
        size: sz,
        involvement: inv,
      };
      if (criteriaData?.profile?.id) {
        return apiRequest('PUT', `/api/investment-criteria/${criteriaData.profile.id}`, payload);
      } else {
        return apiRequest('POST', '/api/investment-criteria', payload);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/investment-criteria'] });
      toast({ title: 'Investment criteria saved', description: 'Your buy-box criteria will be used for deal scoring' });
    },
    onError: (e: any) => {
      toast({ title: 'Failed to save', description: e.message, variant: 'destructive' });
    },
  });

  const toggleState = (state: string) => {
    setLoc((prev: any) => {
      const current = prev.targetStates || [];
      const updated = current.includes(state)
        ? current.filter((s: string) => s !== state)
        : [...current, state];
      return { ...prev, targetStates: updated };
    });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <Target className="h-7 w-7 text-primary" />
            Investment Criteria
          </h1>
          <p className="text-muted-foreground mt-1">
            Define your buy-box. Deals are scored against these criteria in the Deal Recommendation.
          </p>
        </div>
        <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
          <Save className="h-4 w-4 mr-2" />
          {saveMutation.isPending ? 'Saving...' : 'Save Criteria'}
        </Button>
      </div>

      <Tabs defaultValue="financial" className="space-y-4">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="financial" className="text-xs gap-1"><DollarSign className="h-3.5 w-3.5" />Financial</TabsTrigger>
          <TabsTrigger value="returns" className="text-xs gap-1"><TrendingUp className="h-3.5 w-3.5" />Returns</TabsTrigger>
          <TabsTrigger value="location" className="text-xs gap-1"><MapPin className="h-3.5 w-3.5" />Location</TabsTrigger>
          <TabsTrigger value="operational" className="text-xs gap-1"><Building2 className="h-3.5 w-3.5" />Operational</TabsTrigger>
          <TabsTrigger value="size" className="text-xs gap-1"><Settings2 className="h-3.5 w-3.5" />Size</TabsTrigger>
          <TabsTrigger value="involvement" className="text-xs gap-1"><Users className="h-3.5 w-3.5" />Involvement</TabsTrigger>
        </TabsList>

        {/* FINANCIAL */}
        <TabsContent value="financial" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Financial Criteria</CardTitle>
              <CardDescription>Minimum financial performance for deals to match your buy-box</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <Label>Min Going-In Cap Rate (%)</Label>
                  <Input type="number" step="0.1" value={fin.minCapRate || ''} onChange={e => setFin({...fin, minCapRate: e.target.value})} placeholder="6.0" className="mt-1" />
                  <p className="text-xs text-muted-foreground mt-1">Minimum acceptable cap rate at acquisition</p>
                </div>
                <div>
                  <Label>Max Going-In Cap Rate (%)</Label>
                  <Input type="number" step="0.1" value={fin.maxCapRate || ''} onChange={e => setFin({...fin, maxCapRate: e.target.value})} placeholder="12.0" className="mt-1" />
                </div>
              </div>
              <Separator />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <Label>Min NOI ($)</Label>
                  <Input type="number" value={fin.minNoi || ''} onChange={e => setFin({...fin, minNoi: e.target.value})} placeholder="500000" className="mt-1" />
                </div>
                <div>
                  <Label>Min EBITDA ($)</Label>
                  <Input type="number" value={fin.minEbitda || ''} onChange={e => setFin({...fin, minEbitda: e.target.value})} placeholder="400000" className="mt-1" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <Label>Min Operating Margin (%)</Label>
                  <Input type="number" step="1" value={fin.minOperatingMargin ? (parseFloat(fin.minOperatingMargin) * 100).toFixed(0) : ''} onChange={e => setFin({...fin, minOperatingMargin: String(parseFloat(e.target.value) / 100)})} placeholder="25" className="mt-1" />
                  <p className="text-xs text-muted-foreground mt-1">EBITDA / Revenue</p>
                </div>
                <div>
                  <Label>Min Gross Revenue ($)</Label>
                  <Input type="number" value={fin.minGrossRevenue || ''} onChange={e => setFin({...fin, minGrossRevenue: e.target.value})} placeholder="1000000" className="mt-1" />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* RETURNS / CAPITAL */}
        <TabsContent value="returns" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Return Requirements</CardTitle>
              <CardDescription>Target returns and capital deployment limits</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <Label>Target IRR (%)</Label>
                  <Input type="number" step="0.5" value={cap.minIrrTarget || ''} onChange={e => setCap({...cap, minIrrTarget: e.target.value})} placeholder="15" className="mt-1" />
                  <p className="text-xs text-muted-foreground mt-1">Minimum levered IRR for a "Buy" recommendation</p>
                </div>
                <div>
                  <Label>Min Cash-on-Cash (%)</Label>
                  <Input type="number" step="0.5" value={cap.minCashOnCashReturn || ''} onChange={e => setCap({...cap, minCashOnCashReturn: e.target.value})} placeholder="8" className="mt-1" />
                </div>
              </div>
              <Separator />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <Label>Max Equity per Deal ($)</Label>
                  <Input type="number" value={cap.maxEquityPerDeal || ''} onChange={e => setCap({...cap, maxEquityPerDeal: e.target.value})} placeholder="5000000" className="mt-1" />
                  <p className="text-xs text-muted-foreground mt-1">Fails deals requiring more equity than this</p>
                </div>
                <div>
                  <Label>Target LTV (%)</Label>
                  <Input type="number" step="1" value={cap.targetLtvRatio || ''} onChange={e => setCap({...cap, targetLtvRatio: e.target.value})} placeholder="65" className="mt-1" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <Label>Target Hold Period (years)</Label>
                  <Input type="number" value={cap.targetHoldPeriod || ''} onChange={e => setCap({...cap, targetHoldPeriod: e.target.value})} placeholder="5" className="mt-1" />
                </div>
                <div>
                  <Label>Total Capital Available ($)</Label>
                  <Input type="number" value={cap.totalCapitalAvailable || ''} onChange={e => setCap({...cap, totalCapitalAvailable: e.target.value})} placeholder="20000000" className="mt-1" />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* LOCATION */}
        <TabsContent value="location" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Target Locations</CardTitle>
              <CardDescription>Select states and regions where you want to invest</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="mb-3 block">Target States</Label>
                <div className="flex flex-wrap gap-1.5">
                  {US_STATES.map(st => (
                    <Button
                      key={st}
                      type="button"
                      variant={(loc.targetStates || []).includes(st) ? 'default' : 'outline'}
                      size="sm"
                      className="h-7 text-xs px-2"
                      onClick={() => toggleState(st)}
                    >
                      {st}
                    </Button>
                  ))}
                </div>
                {(loc.targetStates || []).length > 0 && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Selected: {(loc.targetStates || []).join(', ')} ({(loc.targetStates || []).length} states)
                  </p>
                )}
              </div>
              <Separator />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                  <div>
                    <Label>Prefer ICW Access</Label>
                    <p className="text-xs text-muted-foreground">Intracoastal Waterway</p>
                  </div>
                  <Switch checked={loc.preferIcwAccess || false} onCheckedChange={v => setLoc({...loc, preferIcwAccess: v})} />
                </div>
                <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                  <div>
                    <Label>Prefer Ocean Access</Label>
                    <p className="text-xs text-muted-foreground">Direct ocean or inlet access</p>
                  </div>
                  <Switch checked={loc.preferOceanAccess || false} onCheckedChange={v => setLoc({...loc, preferOceanAccess: v})} />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* OPERATIONAL */}
        <TabsContent value="operational" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Operational Requirements</CardTitle>
              <CardDescription>Property type and amenity preferences</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <Label>Min Occupancy Rate (%)</Label>
                <Input type="number" step="1" value={ops.minOccupancyRate || ''} onChange={e => setOps({...ops, minOccupancyRate: e.target.value})} placeholder="85" className="mt-1 max-w-xs" />
              </div>
              <Separator />
              <div>
                <Label className="mb-3 block">Required Amenities</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {[
                    { key: 'requireFuelDock', label: 'Fuel Dock' },
                    { key: 'requireShipStore', label: 'Ship Store' },
                    { key: 'requireRepairShop', label: 'Repair / Service Shop' },
                    { key: 'requireRestaurant', label: 'Restaurant / Bar' },
                    { key: 'requireDryStorage', label: 'Dry Storage' },
                    { key: 'requireBoatRamp', label: 'Boat Ramp' },
                  ].map(am => (
                    <div key={am.key} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                      <Label className="text-sm">{am.label}</Label>
                      <Switch checked={ops[am.key] || false} onCheckedChange={v => setOps({...ops, [am.key]: v})} />
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* SIZE */}
        <TabsContent value="size" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Size Criteria</CardTitle>
              <CardDescription>Minimum and maximum property size</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <Label>Min Total Slips</Label>
                  <Input type="number" value={sz.minTotalSlips || ''} onChange={e => setSz({...sz, minTotalSlips: e.target.value})} placeholder="50" className="mt-1" />
                </div>
                <div>
                  <Label>Max Total Slips</Label>
                  <Input type="number" value={sz.maxTotalSlips || ''} onChange={e => setSz({...sz, maxTotalSlips: e.target.value})} placeholder="500" className="mt-1" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <Label>Min Acreage</Label>
                  <Input type="number" step="0.1" value={sz.minAcreage || ''} onChange={e => setSz({...sz, minAcreage: e.target.value})} placeholder="5" className="mt-1" />
                </div>
                <div>
                  <Label>Max Acreage</Label>
                  <Input type="number" step="0.1" value={sz.maxAcreage || ''} onChange={e => setSz({...sz, maxAcreage: e.target.value})} placeholder="100" className="mt-1" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <Label>Min Water Frontage (ft)</Label>
                  <Input type="number" value={sz.minWaterFrontage || ''} onChange={e => setSz({...sz, minWaterFrontage: e.target.value})} placeholder="500" className="mt-1" />
                </div>
                <div>
                  <Label>Max Water Frontage (ft)</Label>
                  <Input type="number" value={sz.maxWaterFrontage || ''} onChange={e => setSz({...sz, maxWaterFrontage: e.target.value})} placeholder="5000" className="mt-1" />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* INVOLVEMENT */}
        <TabsContent value="involvement" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Involvement Preferences</CardTitle>
              <CardDescription>How hands-on do you want to be?</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <Label className="mb-3 block">Involvement Level</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {INVOLVEMENT_LEVELS.map(level => (
                    <div
                      key={level.value}
                      className={`p-4 rounded-lg border-2 cursor-pointer transition-colors ${inv.involvementLevel === level.value ? 'border-primary bg-primary/5' : 'border-muted hover:border-muted-foreground/20'}`}
                      onClick={() => setInv({...inv, involvementLevel: level.value})}
                    >
                      <div className="font-medium text-sm">{level.label}</div>
                      <p className="text-xs text-muted-foreground mt-1">{level.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
              <Separator />
              <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                <div>
                  <Label>Require Existing Management</Label>
                  <p className="text-xs text-muted-foreground">Only consider marinas with management team in place</p>
                </div>
                <Switch checked={inv.requireManagementInPlace || false} onCheckedChange={v => setInv({...inv, requireManagementInPlace: v})} />
              </div>
              <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                <div>
                  <Label>Willing to Relocate</Label>
                  <p className="text-xs text-muted-foreground">Would you move to be near the property?</p>
                </div>
                <Switch checked={inv.willingToRelocate || false} onCheckedChange={v => setInv({...inv, willingToRelocate: v})} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Scoring Weights */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Settings2 className="h-5 w-5" />
            Scoring Weights
          </CardTitle>
          <CardDescription>How much each category matters in the overall deal score (must total 100)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { key: 'financialWeight', label: 'Financial', icon: DollarSign },
              { key: 'capitalWeight', label: 'Returns', icon: TrendingUp },
              { key: 'locationWeight', label: 'Location', icon: MapPin },
              { key: 'operationalWeight', label: 'Operational', icon: Building2 },
              { key: 'sizeWeight', label: 'Size', icon: Settings2 },
              { key: 'involvementWeight', label: 'Involvement', icon: Users },
            ].map(w => (
              <div key={w.key} className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
                <w.icon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <div className="flex-1">
                  <Label className="text-xs">{w.label}</Label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    value={(weights as any)[w.key]}
                    onChange={e => setWeights({...weights, [w.key]: parseInt(e.target.value) || 0})}
                    className="h-7 text-sm mt-1"
                  />
                </div>
              </div>
            ))}
          </div>
          <div className={`mt-3 text-xs text-center ${Object.values(weights).reduce((s, v) => s + v, 0) === 100 ? 'text-green-600' : 'text-amber-600'}`}>
            Total: {Object.values(weights).reduce((s, v) => s + v, 0)}% {Object.values(weights).reduce((s, v) => s + v, 0) === 100 ? '✓' : '(should be 100%)'}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
