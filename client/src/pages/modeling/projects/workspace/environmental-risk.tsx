import { useState, useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import { apiRequest } from '@/lib/queryClient';
import { formatCurrency, formatPercent } from '@/lib/utils';
import {
  AlertTriangle,
  Shield,
  CloudRain,
  FileText,
  CheckCircle2,
  XCircle,
  Droplets,
  Wind,
  Thermometer,
  Waves,
  Leaf,
  Fuel,
  Bug,
  FlaskConical,
} from 'lucide-react';

interface EnvironmentalRiskProps {
  projectId: string;
  onTabChange?: (tab: string) => void;
}

type PhaseStatus = 'not_started' | 'phase_1_clear' | 'phase_1_rec' | 'phase_2_in_progress' | 'phase_2_clear' | 'remediation_needed';

interface EnvironmentalIssue {
  id: string;
  label: string;
  icon: React.ReactNode;
  checked: boolean;
  notes: string;
  estimatedCost: number;
}

interface InsuranceLine {
  id: string;
  type: string;
  annualPremium: number;
  deductible: number;
  coverageLimit: number;
  notes: string;
}

interface SeaLevelScenario {
  rise: string;
  propertyImpactPct: number;
  estimatedLoss: number;
  mitigationCost: number;
}

const phaseStatusOptions: { value: PhaseStatus; label: string; color: string }[] = [
  { value: 'not_started', label: 'Not Started', color: 'bg-gray-100 text-gray-700' },
  { value: 'phase_1_clear', label: 'Phase I - Clear', color: 'bg-green-100 text-green-700' },
  { value: 'phase_1_rec', label: 'Phase I - REC Identified', color: 'bg-yellow-100 text-yellow-700' },
  { value: 'phase_2_in_progress', label: 'Phase II - In Progress', color: 'bg-blue-100 text-blue-700' },
  { value: 'phase_2_clear', label: 'Phase II - Clear', color: 'bg-green-100 text-green-700' },
  { value: 'remediation_needed', label: 'Remediation Needed', color: 'bg-red-100 text-red-700' },
];

const defaultInsuranceLines: InsuranceLine[] = [
  { id: 'property', type: 'Property', annualPremium: 0, deductible: 25000, coverageLimit: 0, notes: '' },
  { id: 'liability', type: 'General Liability', annualPremium: 0, deductible: 10000, coverageLimit: 2000000, notes: '' },
  { id: 'marine', type: 'Marine / Marina Operators', annualPremium: 0, deductible: 15000, coverageLimit: 5000000, notes: '' },
  { id: 'flood', type: 'Flood', annualPremium: 0, deductible: 50000, coverageLimit: 0, notes: '' },
  { id: 'windstorm', type: 'Windstorm / Named Storm', annualPremium: 0, deductible: 0, coverageLimit: 0, notes: '' },
  { id: 'environmental', type: 'Environmental Liability', annualPremium: 0, deductible: 25000, coverageLimit: 1000000, notes: '' },
  { id: 'umbrella', type: 'Umbrella / Excess', annualPremium: 0, deductible: 0, coverageLimit: 10000000, notes: '' },
];

const defaultSeaLevelScenarios: SeaLevelScenario[] = [
  { rise: '1 ft', propertyImpactPct: 5, estimatedLoss: 0, mitigationCost: 0 },
  { rise: '2 ft', propertyImpactPct: 15, estimatedLoss: 0, mitigationCost: 0 },
  { rise: '3 ft', propertyImpactPct: 35, estimatedLoss: 0, mitigationCost: 0 },
];

function RiskGauge({ label, score, maxScore = 10 }: { label: string; score: number; maxScore?: number }) {
  const pct = Math.min((score / maxScore) * 100, 100);
  const color = pct <= 33 ? 'bg-green-500' : pct <= 66 ? 'bg-yellow-500' : 'bg-red-500';
  const textColor = pct <= 33 ? 'text-green-700' : pct <= 66 ? 'text-yellow-700' : 'text-red-700';

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <span className="text-sm font-medium">{label}</span>
        <span className={`text-sm font-bold ${textColor}`}>{score.toFixed(1)} / {maxScore}</span>
      </div>
      <div className="h-3 bg-muted rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function EnvironmentalRisk({ projectId, onTabChange }: EnvironmentalRiskProps) {
  const [activeTab, setActiveTab] = useState('environmental');
  const [phaseStatus, setPhaseStatus] = useState<PhaseStatus>('not_started');
  const [environmentalNotes, setEnvironmentalNotes] = useState('');

  const [issues, setIssues] = useState<EnvironmentalIssue[]>([
    { id: 'fuel_tanks', label: 'Fuel Storage Tanks (USTs/ASTs)', icon: <Fuel className="h-4 w-4" />, checked: false, notes: '', estimatedCost: 0 },
    { id: 'hazmat', label: 'Hazardous Materials', icon: <FlaskConical className="h-4 w-4" />, checked: false, notes: '', estimatedCost: 0 },
    { id: 'wetlands', label: 'Wetlands / Protected Areas', icon: <Droplets className="h-4 w-4" />, checked: false, notes: '', estimatedCost: 0 },
    { id: 'endangered', label: 'Endangered Species Habitat', icon: <Bug className="h-4 w-4" />, checked: false, notes: '', estimatedCost: 0 },
    { id: 'water_quality', label: 'Water Quality Concerns', icon: <Waves className="h-4 w-4" />, checked: false, notes: '', estimatedCost: 0 },
  ]);

  const [insuranceLines, setInsuranceLines] = useState<InsuranceLine[]>(defaultInsuranceLines);
  const [hurricaneScore, setHurricaneScore] = useState(3);
  const [seaLevelScenarios, setSeaLevelScenarios] = useState<SeaLevelScenario[]>(defaultSeaLevelScenarios);
  const [stormSurgeRiskFt, setStormSurgeRiskFt] = useState(8);

  const { data: projectData, isLoading } = useQuery<any>({
    queryKey: ['/api/modeling/projects', projectId],
  });

  const { data: financials } = useQuery<any>({
    queryKey: ['/api/modeling/projects', projectId, 'financials'],
  });

  const totalRemediationCost = useMemo(() => {
    return issues.filter(i => i.checked).reduce((sum, i) => sum + i.estimatedCost, 0);
  }, [issues]);

  const totalAnnualPremium = useMemo(() => {
    return insuranceLines.reduce((sum, line) => sum + line.annualPremium, 0);
  }, [insuranceLines]);

  const revenue = financials?.totalRevenue || projectData?.totalRevenue || 0;
  const totalSlips = projectData?.totalUnits || 0;
  const purchasePrice = projectData?.purchasePrice || projectData?.estimatedValue || 0;
  const noi = financials?.noi || 0;

  const insurancePctRevenue = revenue > 0 ? (totalAnnualPremium / revenue) * 100 : 0;
  const insurancePerSlip = totalSlips > 0 ? totalAnnualPremium / totalSlips : 0;

  const femaFloodZone = projectData?.femaFloodZone || projectData?.floodZone || 'Unknown';

  const environmentalRiskScore = useMemo(() => {
    let score = 0;
    if (phaseStatus === 'remediation_needed') score += 4;
    else if (phaseStatus === 'phase_1_rec') score += 2;
    else if (phaseStatus === 'phase_2_in_progress') score += 2.5;
    else if (phaseStatus === 'not_started') score += 1;

    const checkedCount = issues.filter(i => i.checked).length;
    score += checkedCount * 1.2;

    return Math.min(score, 10);
  }, [phaseStatus, issues]);

  const insuranceRiskScore = useMemo(() => {
    let score = 0;
    if (insurancePctRevenue > 8) score += 3;
    else if (insurancePctRevenue > 5) score += 2;
    else if (insurancePctRevenue > 3) score += 1;

    if (totalAnnualPremium > 500000) score += 2;
    else if (totalAnnualPremium > 250000) score += 1;

    const hasFlood = insuranceLines.find(l => l.id === 'flood');
    if (hasFlood && hasFlood.annualPremium > 100000) score += 2;

    return Math.min(score, 10);
  }, [insurancePctRevenue, totalAnnualPremium, insuranceLines]);

  const climateRiskScore = useMemo(() => {
    let score = 0;
    score += hurricaneScore * 1.2;

    if (femaFloodZone === 'AE' || femaFloodZone === 'VE' || femaFloodZone === 'A') score += 2;
    else if (femaFloodZone === 'X500') score += 1;

    if (stormSurgeRiskFt > 10) score += 2;
    else if (stormSurgeRiskFt > 6) score += 1;

    return Math.min(score, 10);
  }, [hurricaneScore, femaFloodZone, stormSurgeRiskFt]);

  const totalRiskCostImpact = useMemo(() => {
    return totalRemediationCost + totalAnnualPremium;
  }, [totalRemediationCost, totalAnnualPremium]);

  const adjustedNOI = noi - totalAnnualPremium;

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    onTabChange?.(tab);
  };

  const updateIssue = (id: string, field: keyof EnvironmentalIssue, value: any) => {
    setIssues(prev => prev.map(issue =>
      issue.id === id ? { ...issue, [field]: value } : issue
    ));
  };

  const updateInsuranceLine = (id: string, field: keyof InsuranceLine, value: any) => {
    setInsuranceLines(prev => prev.map(line =>
      line.id === id ? { ...line, [field]: value } : line
    ));
  };

  const updateSeaLevelScenario = (index: number, field: keyof SeaLevelScenario, value: number) => {
    setSeaLevelScenarios(prev => prev.map((s, i) =>
      i === index ? { ...s, [field]: value } : s
    ));
  };

  const mitigationMeasures = useMemo(() => {
    const measures: string[] = [];
    if (phaseStatus === 'remediation_needed' || phaseStatus === 'phase_1_rec') {
      measures.push('Complete Phase II Environmental Site Assessment before closing');
    }
    if (issues.find(i => i.id === 'fuel_tanks' && i.checked)) {
      measures.push('Obtain UST/AST compliance reports and tank tightness testing');
    }
    if (issues.find(i => i.id === 'wetlands' && i.checked)) {
      measures.push('Engage wetlands consultant for delineation and permitting review');
    }
    if (hurricaneScore >= 4) {
      measures.push('Require hurricane-rated construction for all new structures');
    }
    if (femaFloodZone === 'VE' || femaFloodZone === 'AE') {
      measures.push('Elevate critical infrastructure above base flood elevation + 2 ft');
    }
    if (stormSurgeRiskFt > 8) {
      measures.push('Install storm surge barriers and breakwater improvements');
    }
    if (insurancePctRevenue > 6) {
      measures.push('Explore captive insurance or higher deductibles to reduce premium burden');
    }
    if (issues.find(i => i.id === 'water_quality' && i.checked)) {
      measures.push('Implement stormwater management and spill prevention plan (SWPPP)');
    }
    if (measures.length === 0) {
      measures.push('Continue standard environmental monitoring and insurance renewals');
    }
    return measures;
  }, [phaseStatus, issues, hurricaneScore, femaFloodZone, stormSurgeRiskFt, insurancePctRevenue]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Environmental & Insurance Risk</h2>
          <p className="text-muted-foreground">Assess environmental liabilities, insurance costs, and climate exposure</p>
        </div>
        <div className="flex gap-2">
          <Badge variant={environmentalRiskScore > 5 ? 'destructive' : 'secondary'}>
            <AlertTriangle className="h-3 w-3 mr-1" />
            Risk Score: {((environmentalRiskScore + insuranceRiskScore + climateRiskScore) / 3).toFixed(1)} / 10
          </Badge>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList className="grid w-full grid-cols-2 lg:grid-cols-4">
          <TabsTrigger value="environmental" className="gap-1">
            <Leaf className="h-4 w-4" />
            Environmental
          </TabsTrigger>
          <TabsTrigger value="insurance" className="gap-1">
            <Shield className="h-4 w-4" />
            Insurance
          </TabsTrigger>
          <TabsTrigger value="climate" className="gap-1">
            <CloudRain className="h-4 w-4" />
            Climate Risk
          </TabsTrigger>
          <TabsTrigger value="summary" className="gap-1">
            <FileText className="h-4 w-4" />
            Summary
          </TabsTrigger>
        </TabsList>

        {/* Environmental Tab */}
        <TabsContent value="environmental" className="space-y-6 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Leaf className="h-5 w-5 text-green-600" />
                Phase I / Phase II Environmental Assessment
              </CardTitle>
              <CardDescription>Track the status of environmental site assessments</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Assessment Status</Label>
                  <Select value={phaseStatus} onValueChange={(v) => setPhaseStatus(v as PhaseStatus)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {phaseStatusOptions.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>
                          <span className="flex items-center gap-2">
                            <span className={`inline-block w-2 h-2 rounded-full ${opt.color.split(' ')[0]}`} />
                            {opt.label}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Current Status</Label>
                  <div className="pt-2">
                    {(() => {
                      const opt = phaseStatusOptions.find(o => o.value === phaseStatus);
                      return opt ? (
                        <Badge className={opt.color}>{opt.label}</Badge>
                      ) : null;
                    })()}
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Environmental Assessment Notes</Label>
                <Textarea
                  value={environmentalNotes}
                  onChange={(e) => setEnvironmentalNotes(e.target.value)}
                  placeholder="Enter notes about environmental assessment findings, recommendations, etc."
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Environmental Issues Checklist</CardTitle>
              <CardDescription>Identify known environmental concerns and estimate remediation costs</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto w-full">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8">Issue</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead className="text-right">Est. Remediation Cost</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {issues.map(issue => (
                    <TableRow key={issue.id}>
                      <TableCell>
                        <input
                          type="checkbox"
                          checked={issue.checked}
                          onChange={(e) => updateIssue(issue.id, 'checked', e.target.checked)}
                          className="h-4 w-4 rounded border-gray-300"
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {issue.icon}
                          <span className={issue.checked ? 'font-medium' : 'text-muted-foreground'}>{issue.label}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Input
                          value={issue.notes}
                          onChange={(e) => updateIssue(issue.id, 'notes', e.target.value)}
                          placeholder="Details..."
                          className="h-8 text-sm"
                          disabled={!issue.checked}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <Input
                          type="number"
                          value={issue.estimatedCost || ''}
                          onChange={(e) => updateIssue(issue.id, 'estimatedCost', Number(e.target.value) || 0)}
                          placeholder="$0"
                          className="h-8 text-sm text-right w-32 ml-auto"
                          disabled={!issue.checked}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </div>
              <Separator className="my-4" />
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">
                  {issues.filter(i => i.checked).length} of {issues.length} issues identified
                </span>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Total Estimated Remediation</p>
                  <p className="text-xl font-bold">{formatCurrency(totalRemediationCost)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Insurance Tab */}
        <TabsContent value="insurance" className="space-y-6 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-blue-600" />
                Insurance Cost Modeling
              </CardTitle>
              <CardDescription>Model annual insurance premiums across all policy lines</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto w-full">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Insurance Line</TableHead>
                    <TableHead className="text-right">Annual Premium</TableHead>
                    <TableHead className="text-right">Deductible</TableHead>
                    <TableHead className="text-right">Coverage Limit</TableHead>
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {insuranceLines.map(line => (
                    <TableRow key={line.id}>
                      <TableCell className="font-medium">{line.type}</TableCell>
                      <TableCell className="text-right">
                        <Input
                          type="number"
                          value={line.annualPremium || ''}
                          onChange={(e) => updateInsuranceLine(line.id, 'annualPremium', Number(e.target.value) || 0)}
                          placeholder="$0"
                          className="h-8 text-sm text-right w-28 ml-auto"
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <Input
                          type="number"
                          value={line.deductible || ''}
                          onChange={(e) => updateInsuranceLine(line.id, 'deductible', Number(e.target.value) || 0)}
                          placeholder="$0"
                          className="h-8 text-sm text-right w-28 ml-auto"
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <Input
                          type="number"
                          value={line.coverageLimit || ''}
                          onChange={(e) => updateInsuranceLine(line.id, 'coverageLimit', Number(e.target.value) || 0)}
                          placeholder="$0"
                          className="h-8 text-sm text-right w-28 ml-auto"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={line.notes}
                          onChange={(e) => updateInsuranceLine(line.id, 'notes', e.target.value)}
                          placeholder="Notes..."
                          className="h-8 text-sm"
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Total Annual Premium</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{formatCurrency(totalAnnualPremium)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Insurance as % of Revenue</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">
                  {insurancePctRevenue.toFixed(2)}%
                </p>
                <p className="text-xs text-muted-foreground">
                  {insurancePctRevenue > 6 ? 'Above typical range (3-6%)' : 'Within typical range (3-6%)'}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Insurance Cost per Slip</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{formatCurrency(insurancePerSlip)}</p>
                <p className="text-xs text-muted-foreground">
                  Based on {totalSlips || '—'} total slips
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Climate Risk Tab */}
        <TabsContent value="climate" className="space-y-6 mt-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Droplets className="h-5 w-5 text-blue-600" />
                  FEMA Flood Zone
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-3">
                  <Badge variant={
                    femaFloodZone === 'X' || femaFloodZone === 'X500' ? 'secondary' :
                    femaFloodZone === 'Unknown' ? 'outline' : 'destructive'
                  } className="text-lg px-4 py-1">
                    {femaFloodZone}
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    {femaFloodZone === 'AE' && 'Special Flood Hazard Area — 1% annual flood risk'}
                    {femaFloodZone === 'VE' && 'Coastal High Hazard — wave action expected'}
                    {femaFloodZone === 'A' && 'Special Flood Hazard Area — no BFE determined'}
                    {femaFloodZone === 'X' && 'Minimal flood hazard — outside 500-year floodplain'}
                    {femaFloodZone === 'X500' && 'Moderate flood hazard — 0.2% annual flood risk'}
                    {femaFloodZone === 'Unknown' && 'Flood zone not yet determined'}
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wind className="h-5 w-5 text-orange-600" />
                  Hurricane Risk Score
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-4">
                  <Select value={String(hurricaneScore)} onValueChange={(v) => setHurricaneScore(Number(v))}>
                    <SelectTrigger className="w-24">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 4, 5].map(n => (
                        <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <span className="text-sm text-muted-foreground">
                    {hurricaneScore <= 2 ? 'Low risk' : hurricaneScore <= 3 ? 'Moderate risk' : 'High risk'}
                    {' — '}scale of 1 (lowest) to 5 (highest)
                  </span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      hurricaneScore <= 2 ? 'bg-green-500' : hurricaneScore <= 3 ? 'bg-yellow-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${(hurricaneScore / 5) * 100}%` }}
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Thermometer className="h-5 w-5 text-red-600" />
                Sea-Level Rise Projections
              </CardTitle>
              <CardDescription>Estimate property impact under different sea-level rise scenarios</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto w-full">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Scenario</TableHead>
                    <TableHead className="text-right">Property Impact (%)</TableHead>
                    <TableHead className="text-right">Estimated Value Loss</TableHead>
                    <TableHead className="text-right">Mitigation Cost</TableHead>
                    <TableHead className="text-right">Net Impact</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {seaLevelScenarios.map((scenario, idx) => {
                    const valueLoss = purchasePrice > 0 ? (purchasePrice * scenario.propertyImpactPct) / 100 : scenario.estimatedLoss;
                    return (
                      <TableRow key={scenario.rise}>
                        <TableCell>
                          <Badge variant="outline" className="font-mono">{scenario.rise} rise</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Input
                            type="number"
                            value={scenario.propertyImpactPct}
                            onChange={(e) => updateSeaLevelScenario(idx, 'propertyImpactPct', Number(e.target.value) || 0)}
                            className="h-8 text-sm text-right w-20 ml-auto"
                            min={0}
                            max={100}
                          />
                        </TableCell>
                        <TableCell className="text-right font-medium text-red-600">
                          {formatCurrency(valueLoss)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Input
                            type="number"
                            value={scenario.mitigationCost || ''}
                            onChange={(e) => updateSeaLevelScenario(idx, 'mitigationCost', Number(e.target.value) || 0)}
                            placeholder="$0"
                            className="h-8 text-sm text-right w-28 ml-auto"
                          />
                        </TableCell>
                        <TableCell className="text-right font-bold">
                          {formatCurrency(valueLoss + scenario.mitigationCost)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Waves className="h-5 w-5 text-blue-700" />
                Storm Surge Risk
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Maximum Expected Storm Surge (ft)</Label>
                  <Input
                    type="number"
                    value={stormSurgeRiskFt}
                    onChange={(e) => setStormSurgeRiskFt(Number(e.target.value) || 0)}
                    className="w-32"
                    min={0}
                    max={30}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Risk Assessment</Label>
                  <div className="pt-1">
                    <Badge variant={stormSurgeRiskFt > 10 ? 'destructive' : stormSurgeRiskFt > 6 ? 'default' : 'secondary'}>
                      {stormSurgeRiskFt > 10 ? 'Severe' : stormSurgeRiskFt > 6 ? 'Elevated' : 'Moderate'}
                      {' — '}{stormSurgeRiskFt} ft surge potential
                    </Badge>
                  </div>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                Storm surge estimates should be based on SLOSH model data from NHC for the property location.
                Category 3+ hurricane surge heights are particularly relevant for coastal marina properties.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Summary Tab */}
        <TabsContent value="summary" className="space-y-6 mt-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Total Environmental Cost</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{formatCurrency(totalRemediationCost)}</p>
                <p className="text-xs text-muted-foreground">One-time remediation estimate</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Annual Insurance Cost</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{formatCurrency(totalAnnualPremium)}</p>
                <p className="text-xs text-muted-foreground">{insurancePctRevenue.toFixed(1)}% of revenue</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Adjusted NOI Impact</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{formatCurrency(adjustedNOI)}</p>
                <p className="text-xs text-muted-foreground">
                  NOI after insurance costs
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Risk Score Dashboard</CardTitle>
              <CardDescription>Composite risk assessment across all categories</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <RiskGauge label="Environmental Risk" score={environmentalRiskScore} />
              <RiskGauge label="Insurance Risk" score={insuranceRiskScore} />
              <RiskGauge label="Climate Risk" score={climateRiskScore} />
              <Separator />
              <RiskGauge
                label="Overall Risk Score"
                score={Number(((environmentalRiskScore + insuranceRiskScore + climateRiskScore) / 3).toFixed(1))}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                Recommended Mitigation Measures
              </CardTitle>
              <CardDescription>Auto-generated based on identified risks and thresholds</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {mitigationMeasures.map((measure, idx) => (
                  <li key={idx} className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
                      {idx + 1}
                    </span>
                    <span className="text-sm">{measure}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Cost Impact on NOI</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto w-full">
              <Table>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-medium">In-Place NOI</TableCell>
                    <TableCell className="text-right">{formatCurrency(noi)}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium text-red-600">Less: Annual Insurance Premiums</TableCell>
                    <TableCell className="text-right text-red-600">({formatCurrency(totalAnnualPremium)})</TableCell>
                  </TableRow>
                  <TableRow className="border-t-2">
                    <TableCell className="font-bold">Adjusted NOI</TableCell>
                    <TableCell className="text-right font-bold">{formatCurrency(adjustedNOI)}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium text-red-600">One-Time: Environmental Remediation</TableCell>
                    <TableCell className="text-right text-red-600">({formatCurrency(totalRemediationCost)})</TableCell>
                  </TableRow>
                  <TableRow className="border-t-2">
                    <TableCell className="font-bold">Total Risk-Adjusted Cost Impact</TableCell>
                    <TableCell className="text-right font-bold">{formatCurrency(totalRiskCostImpact)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default EnvironmentalRisk;
