import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { toast } from '@/hooks/use-toast';
import { Calendar, Info, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';

export type MonthWeights = Record<number, number>;
export interface DeptConfig { profile: string; weights: MonthWeights; enabled: boolean; }
export interface SeasonalConfig { version: number; defaultProfile: string; departments: Record<string, DeptConfig>; }

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const EVEN_WEIGHTS: MonthWeights = Object.fromEntries(Array.from({length:12},(_,i)=>[i+1,1/12]));

export const SEASONAL_PRESETS: Record<string, {label:string; description:string; weights:MonthWeights}> = {
  even:             { label:'Even (1/12)',       description:'Equal across all 12 months',                          weights: EVEN_WEIGHTS },
  marina_in_season: { label:'Marina In-Season',  description:'Peak May–Oct (boating), minimal Nov–Mar',            weights:{1:0.02,2:0.02,3:0.04,4:0.07,5:0.12,6:0.14,7:0.15,8:0.15,9:0.12,10:0.09,11:0.04,12:0.04} },
  winter_storage:   { label:'Winter Storage',    description:'Peak Nov–Mar, off-season May–Sep',                   weights:{1:0.12,2:0.11,3:0.10,4:0.05,5:0.02,6:0.01,7:0.01,8:0.01,9:0.03,10:0.07,11:0.12,12:0.13} },
  summer_peak:      { label:'Summer Peak',       description:'Heavy Jun–Aug, minimal Nov–Mar',                     weights:{1:0.02,2:0.02,3:0.04,4:0.06,5:0.09,6:0.14,7:0.18,8:0.17,9:0.10,10:0.07,11:0.04,12:0.03} },
  year_round:       { label:'Year-Round',        description:'Slightly higher warm months (leases, utilities)',    weights:{1:0.07,2:0.07,3:0.08,4:0.08,5:0.09,6:0.09,7:0.09,8:0.09,9:0.08,10:0.08,11:0.08,12:0.07} },
  first_half:       { label:'First Half',        description:'Jan–Jun only',                                       weights:{1:0.17,2:0.17,3:0.17,4:0.17,5:0.16,6:0.16,7:0,8:0,9:0,10:0,11:0,12:0} },
  second_half:      { label:'Second Half',       description:'Jul–Dec only',                                       weights:{1:0,2:0,3:0,4:0,5:0,6:0,7:0.17,8:0.17,9:0.17,10:0.17,11:0.16,12:0.16} },
};

const DEPT_DEFAULTS: Record<string,string> = {
  'Service':'marina_in_season',"Ship's Store":'marina_in_season','Fuel':'marina_in_season',
  'Dockage':'marina_in_season','Wet Slips':'marina_in_season','Transient Dockage':'marina_in_season',
  'Boat Sales':'marina_in_season','Boat Rentals':'marina_in_season','Boat Storage':'marina_in_season',
  'Winter Storage':'winter_storage','Dry Storage':'winter_storage','Land Storage':'winter_storage',
  'Commercial Leases':'year_round','Commercial Tenants':'year_round',
  'Repairs & Maintenance':'year_round','Insurance':'year_round','Taxes':'year_round',
  'Utilities':'year_round','Professional Services':'year_round','Payroll':'marina_in_season',
  'Advertising':'marina_in_season','Bank & Credit Card Fees':'year_round',
  'Licenses & Permits':'year_round','Security & Contract Services':'year_round',
  'General':'even','Miscellaneous':'even',
};

function normalizeWeights(w: MonthWeights): MonthWeights {
  const total = Object.values(w).reduce((a,b)=>a+b,0);
  if (total === 0) return EVEN_WEIGHTS;
  return Object.fromEntries(Object.entries(w).map(([k,v])=>[k,v/total]));
}

interface Props {
  open: boolean; onClose: ()=>void;
  uploadId: string; projectId: string; uploadName: string;
  departments: string[]; existingConfig?: SeasonalConfig;
}

export function SeasonalDistributionModal({ open, onClose, uploadId, projectId, uploadName, departments, existingConfig }: Props) {
  const qc = useQueryClient();

  const initConfig = (): SeasonalConfig => {
    if (existingConfig?.version) return existingConfig;
    const depts: Record<string,DeptConfig> = {};
    const all = departments.length > 0 ? departments : Object.keys(DEPT_DEFAULTS).slice(0,12);
    for (const d of all) {
      const p = DEPT_DEFAULTS[d] ?? 'even';
      depts[d] = { profile: p, weights: SEASONAL_PRESETS[p].weights, enabled: p !== 'even' };
    }
    return { version:1, defaultProfile:'even', departments: depts };
  };

  const [config, setConfig] = useState<SeasonalConfig>(initConfig);
  const [activeTab, setActiveTab] = useState('overview');
  const [activeDept, setActiveDept] = useState(departments[0] ?? 'General');

  useEffect(() => { if (open) setConfig(initConfig()); }, [open, uploadId]);

  const saveMutation = useMutation({
    mutationFn: () => apiRequest('PATCH', `/api/modeling/projects/${projectId}/documents/${uploadId}/seasonal-config`, { seasonalConfig: config }),
    onSuccess: () => { qc.invalidateQueries({ queryKey:['/api/modeling/projects',projectId,'documents'] }); toast({ title:'✅ Saved', description:'Seasonal distribution config saved.' }); onClose(); },
    onError: () => toast({ title:'Error', description:'Failed to save config.', variant:'destructive' }),
  });

  const setDeptProfile = (dept: string, key: string) => {
    const preset = SEASONAL_PRESETS[key];
    setConfig(prev => ({ ...prev, departments: { ...prev.departments, [dept]: { profile:key, weights:preset.weights, enabled:key!=='even' } } }));
  };

  const setMonthWeight = (dept: string, m: number, pct: number) => {
    setConfig(prev => {
      const old = prev.departments[dept] ?? { profile:'custom', weights:EVEN_WEIGHTS, enabled:true };
      return { ...prev, departments: { ...prev.departments, [dept]: { ...old, profile:'custom', weights:{ ...old.weights, [m]: pct/100 } } } };
    });
  };

  const toggleDept = (dept: string, enabled: boolean) =>
    setConfig(prev => ({ ...prev, departments: { ...prev.departments, [dept]: { ...(prev.departments[dept] ?? {profile:'even',weights:EVEN_WEIGHTS}), enabled } } }));

  const resetDept = (dept: string) => setDeptProfile(dept, DEPT_DEFAULTS[dept] ?? 'even');

  const applyToAll = (key: string) => {
    const preset = SEASONAL_PRESETS[key];
    const depts: Record<string,DeptConfig> = {};
    for (const d of Object.keys(config.departments)) depts[d] = { profile:key, weights:preset.weights, enabled:key!=='even' };
    setConfig(prev => ({ ...prev, defaultProfile:key, departments:depts }));
  };

  const cur = config.departments[activeDept];
  const norm = cur ? normalizeWeights(cur.weights) : EVEN_WEIGHTS;

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-blue-600" />
            Seasonal Distribution Config
          </DialogTitle>
          <DialogDescription>
            <span className="font-medium text-foreground">{uploadName}</span> — How to spread annual figures across months per department.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="overview">Overview &amp; Presets</TabsTrigger>
            <TabsTrigger value="department">Per-Department Detail</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4 pt-4">
            <div>
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Apply Preset to All Departments</div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {Object.entries(SEASONAL_PRESETS).map(([key,preset]) => (
                  <button key={key} onClick={() => applyToAll(key)}
                    className={cn("text-left p-2.5 rounded-lg border text-xs transition-all hover:border-blue-400",
                      config.defaultProfile===key ? "border-blue-500 bg-blue-50 dark:bg-blue-950/30" : "border-border")}>
                    <div className="font-medium">{preset.label}</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5 leading-tight">{preset.description}</div>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Department Summary</div>
              <div className="rounded-lg border overflow-hidden text-xs">
                <table className="w-full">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium">Department</th>
                      <th className="text-left px-3 py-2 font-medium">Profile</th>
                      <th className="text-center px-3 py-2 font-medium">Active</th>
                      <th className="px-3 py-2 font-medium">Jan → Dec</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {Object.entries(config.departments).map(([dept,cfg]) => {
                      const nw = normalizeWeights(cfg.weights);
                      return (
                        <tr key={dept} className="hover:bg-muted/30 cursor-pointer" onClick={() => { setActiveDept(dept); setActiveTab('department'); }}>
                          <td className="px-3 py-1.5 font-medium max-w-[130px] truncate">{dept}</td>
                          <td className="px-3 py-1.5"><Badge variant="outline" className="text-[10px]">{SEASONAL_PRESETS[cfg.profile]?.label ?? cfg.profile}</Badge></td>
                          <td className="px-3 py-1.5 text-center"><div className={cn("w-2 h-2 rounded-full mx-auto",cfg.enabled?"bg-emerald-500":"bg-gray-300")} /></td>
                          <td className="px-3 py-1.5">
                            <div className="flex gap-px items-end h-5">
                              {Array.from({length:12},(_,i)=>(
                                <div key={i} className="flex-1 flex items-end">
                                  <div className={cn("w-full rounded-sm",cfg.enabled?"bg-blue-400":"bg-gray-200")}
                                    style={{height:`${Math.max(8,Math.round((nw[i+1]??0)*1200))}%`}} />
                                </div>
                              ))}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="department" className="pt-4">
            <div className="flex gap-4">
              <div className="w-44 shrink-0 space-y-0.5">
                <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">Departments</div>
                {Object.keys(config.departments).map(dept => (
                  <button key={dept} onClick={() => setActiveDept(dept)}
                    className={cn("w-full text-left px-2.5 py-1.5 rounded-md text-xs transition-colors truncate",
                      activeDept===dept?"bg-primary text-primary-foreground":"hover:bg-muted")}>
                    {dept}
                  </button>
                ))}
              </div>
              {cur && (
                <div className="flex-1 space-y-4 min-w-0">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold text-sm">{activeDept}</h4>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1.5">
                        <Switch checked={cur.enabled} onCheckedChange={v => toggleDept(activeDept,v)} id="enabled" />
                        <Label htmlFor="enabled" className="text-xs text-muted-foreground">Custom distribution</Label>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => resetDept(activeDept)} className="h-7 text-xs gap-1">
                        <RotateCcw className="h-3 w-3" />Reset
                      </Button>
                    </div>
                  </div>
                  <div className="grid grid-cols-4 gap-1.5">
                    {Object.entries(SEASONAL_PRESETS).map(([key,preset]) => (
                      <button key={key} onClick={() => setDeptProfile(activeDept,key)} disabled={!cur.enabled && key!=='even'}
                        className={cn("text-left p-2 rounded-md border text-[11px] transition-all",
                          cur.profile===key?"border-blue-500 bg-blue-50 dark:bg-blue-950/30 font-medium":"border-border hover:border-blue-300",
                          (!cur.enabled && key!=='even')&&"opacity-40 cursor-not-allowed")}>
                        {preset.label}
                      </button>
                    ))}
                  </div>
                  <div className="grid grid-cols-6 gap-2 pt-2">
                    {MONTHS.map((mo,i) => {
                      const m = i+1;
                      const pct = Math.round((norm[m]??0)*100);
                      return (
                        <div key={m} className="space-y-1">
                          <div className="text-[10px] text-muted-foreground text-center font-medium">{mo}</div>
                          <div className="h-14 flex items-end justify-center pb-0.5">
                            <div className={cn("w-7 rounded-t transition-all",
                              cur.enabled?(pct>9?"bg-blue-500":pct<5?"bg-amber-400":"bg-blue-400"):"bg-gray-200")}
                              style={{height:`${Math.max(4,pct*5)}%`}} />
                          </div>
                          <div className="text-[10px] text-center font-mono text-muted-foreground">{pct}%</div>
                          <Slider min={0} max={25} step={0.5}
                            value={[Math.round((cur.weights[m]??0)*100*12)]}
                            onValueChange={([v]) => setMonthWeight(activeDept, m, v/12)}
                            disabled={!cur.enabled} className="w-full" />
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground pt-1 border-t">
                    <Info className="h-3 w-3" />
                    Weights are auto-normalized to 100% at import time.
                  </div>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter className="pt-4 border-t">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? 'Saving...' : 'Save Distribution Config'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default SeasonalDistributionModal;
