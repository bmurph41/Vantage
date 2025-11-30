import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Target, Save, Trash2, Settings2, ChevronDown, ChevronUp } from "lucide-react";
import type { TargetDemographics } from "@shared/schema";

interface TargetDemographicsFormProps {
  projectId?: string | null;
  onTargetsChange?: (targets: TargetDemographics | null) => void;
  compact?: boolean;
}

export default function TargetDemographicsForm({ projectId, onTargetsChange, compact = false }: TargetDemographicsFormProps) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(!compact);
  
  const [medianAgeMin, setMedianAgeMin] = useState<number | null>(null);
  const [medianAgeMax, setMedianAgeMax] = useState<number | null>(null);
  const [medianIncomeMin, setMedianIncomeMin] = useState<number | null>(null);
  const [medianIncomeMax, setMedianIncomeMax] = useState<number | null>(null);
  const [populationDensityMin, setPopulationDensityMin] = useState<number | null>(null);
  const [populationDensityMax, setPopulationDensityMax] = useState<number | null>(null);
  const [householdSizeMin, setHouseholdSizeMin] = useState<number | null>(null);
  const [householdSizeMax, setHouseholdSizeMax] = useState<number | null>(null);
  const [educationBachelorsMin, setEducationBachelorsMin] = useState<number | null>(null);
  const [educationBachelorsMax, setEducationBachelorsMax] = useState<number | null>(null);
  const [employmentRateMin, setEmploymentRateMin] = useState<number | null>(null);
  const [employmentRateMax, setEmploymentRateMax] = useState<number | null>(null);
  const [homeValueMin, setHomeValueMin] = useState<number | null>(null);
  const [homeValueMax, setHomeValueMax] = useState<number | null>(null);
  
  const [weights, setWeights] = useState({
    medianAge: 0,
    medianIncome: 0,
    populationDensity: 0,
    householdSize: 0,
    educationBachelors: 0,
    employmentRate: 0,
    homeValue: 0
  });
  
  const [showWeights, setShowWeights] = useState(false);
  
  const { data: existingTargets, isLoading } = useQuery<TargetDemographics>({
    queryKey: ['/api/target-demographics', projectId || 'default'],
    queryFn: async () => {
      const url = projectId 
        ? `/api/target-demographics?projectId=${projectId}` 
        : '/api/target-demographics';
      const res = await fetch(url, { credentials: 'include' });
      if (!res.ok) {
        if (res.status === 404) return null;
        throw new Error('Failed to fetch target demographics');
      }
      return res.json();
    }
  });
  
  useEffect(() => {
    if (existingTargets) {
      setMedianAgeMin(existingTargets.medianAgeMin);
      setMedianAgeMax(existingTargets.medianAgeMax);
      setMedianIncomeMin(existingTargets.medianIncomeMin);
      setMedianIncomeMax(existingTargets.medianIncomeMax);
      setPopulationDensityMin(existingTargets.populationDensityMin);
      setPopulationDensityMax(existingTargets.populationDensityMax);
      setHouseholdSizeMin(existingTargets.householdSizeMin);
      setHouseholdSizeMax(existingTargets.householdSizeMax);
      setEducationBachelorsMin(existingTargets.educationBachelorsMin);
      setEducationBachelorsMax(existingTargets.educationBachelorsMax);
      setEmploymentRateMin(existingTargets.employmentRateMin);
      setEmploymentRateMax(existingTargets.employmentRateMax);
      setHomeValueMin(existingTargets.homeValueMin);
      setHomeValueMax(existingTargets.homeValueMax);
      
      if (existingTargets.weights && typeof existingTargets.weights === 'object') {
        const loadedWeights = existingTargets.weights as Record<string, number>;
        setWeights({
          medianAge: loadedWeights.medianAge || 0,
          medianIncome: loadedWeights.medianIncome || 0,
          populationDensity: loadedWeights.populationDensity || 0,
          householdSize: loadedWeights.householdSize || 0,
          educationBachelors: loadedWeights.educationBachelors || 0,
          employmentRate: loadedWeights.employmentRate || 0,
          homeValue: loadedWeights.homeValue || 0
        });
        
        const hasWeights = Object.values(loadedWeights).some((w: number) => w > 0);
        setShowWeights(hasWeights);
      }
      
      onTargetsChange?.(existingTargets);
    }
  }, [existingTargets, onTargetsChange]);
  
  const saveMutation = useMutation({
    mutationFn: async () => {
      const hasWeightsConfigured = Object.values(weights).some(w => w > 0);
      
      const targetData: Record<string, unknown> = {
        medianAgeMin,
        medianAgeMax,
        medianIncomeMin,
        medianIncomeMax,
        populationDensityMin,
        populationDensityMax,
        householdSizeMin,
        householdSizeMax,
        educationBachelorsMin,
        educationBachelorsMax,
        employmentRateMin,
        employmentRateMax,
        homeValueMin,
        homeValueMax,
        weights: hasWeightsConfigured ? weights : null
      };
      
      if (projectId) {
        targetData.projectId = projectId;
      }
      
      const response = await apiRequest('POST', '/api/target-demographics', targetData);
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/target-demographics', projectId || 'default'] });
      onTargetsChange?.(data);
      toast({
        title: "Target Demographics Saved",
        description: projectId 
          ? "Project-specific targets have been saved."
          : "Your default target demographics have been saved.",
      });
    },
    onError: () => {
      toast({
        title: "Save Failed",
        description: "Failed to save target demographics. Please try again.",
        variant: "destructive"
      });
    }
  });
  
  const deleteMutation = useMutation({
    mutationFn: async () => {
      const params = projectId ? `?projectId=${projectId}` : '';
      const response = await apiRequest('DELETE', `/api/target-demographics${params}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/target-demographics', projectId || 'default'] });
      
      setMedianAgeMin(null);
      setMedianAgeMax(null);
      setMedianIncomeMin(null);
      setMedianIncomeMax(null);
      setPopulationDensityMin(null);
      setPopulationDensityMax(null);
      setHouseholdSizeMin(null);
      setHouseholdSizeMax(null);
      setEducationBachelorsMin(null);
      setEducationBachelorsMax(null);
      setEmploymentRateMin(null);
      setEmploymentRateMax(null);
      setHomeValueMin(null);
      setHomeValueMax(null);
      setWeights({
        medianAge: 0,
        medianIncome: 0,
        populationDensity: 0,
        householdSize: 0,
        educationBachelors: 0,
        employmentRate: 0,
        homeValue: 0
      });
      
      onTargetsChange?.(null);
      
      toast({
        title: "Targets Cleared",
        description: projectId 
          ? "Project-specific targets have been removed."
          : "Your default target demographics have been cleared.",
      });
    },
    onError: () => {
      toast({
        title: "Delete Failed",
        description: "Failed to clear target demographics. Please try again.",
        variant: "destructive"
      });
    }
  });
  
  const handleSave = () => {
    saveMutation.mutate();
  };
  
  const handleClear = () => {
    deleteMutation.mutate();
  };
  
  const handleWeightChange = (criterion: string, value: number[]) => {
    setWeights(prev => ({
      ...prev,
      [criterion]: value[0] / 100
    }));
  };

  const hasAnyTargets = medianAgeMin !== null || medianAgeMax !== null ||
    medianIncomeMin !== null || medianIncomeMax !== null ||
    populationDensityMin !== null || populationDensityMax !== null ||
    householdSizeMin !== null || householdSizeMax !== null ||
    educationBachelorsMin !== null || educationBachelorsMax !== null ||
    employmentRateMin !== null || employmentRateMax !== null ||
    homeValueMin !== null || homeValueMax !== null;
  
  if (isLoading) {
    return (
      <Card data-testid="card-target-demographics-loading">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Target className="h-4 w-4" />
            Target Demographics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">Loading...</div>
        </CardContent>
      </Card>
    );
  }

  const formContent = (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-sm font-medium">Median Age (years)</Label>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs text-muted-foreground">Min</Label>
              <Input
                type="number"
                placeholder="25"
                value={medianAgeMin ?? ''}
                onChange={(e) => setMedianAgeMin(e.target.value ? parseFloat(e.target.value) : null)}
                className="h-8"
                data-testid="input-median-age-min"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Max</Label>
              <Input
                type="number"
                placeholder="55"
                value={medianAgeMax ?? ''}
                onChange={(e) => setMedianAgeMax(e.target.value ? parseFloat(e.target.value) : null)}
                className="h-8"
                data-testid="input-median-age-max"
              />
            </div>
          </div>
        </div>
        
        <div className="space-y-2">
          <Label className="text-sm font-medium">Median Household Income ($)</Label>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs text-muted-foreground">Min</Label>
              <Input
                type="number"
                placeholder="75,000"
                value={medianIncomeMin ?? ''}
                onChange={(e) => setMedianIncomeMin(e.target.value ? parseFloat(e.target.value) : null)}
                className="h-8"
                data-testid="input-median-income-min"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Max</Label>
              <Input
                type="number"
                placeholder="150,000"
                value={medianIncomeMax ?? ''}
                onChange={(e) => setMedianIncomeMax(e.target.value ? parseFloat(e.target.value) : null)}
                className="h-8"
                data-testid="input-median-income-max"
              />
            </div>
          </div>
        </div>
        
        <div className="space-y-2">
          <Label className="text-sm font-medium">Population Density (per sq mi)</Label>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs text-muted-foreground">Min</Label>
              <Input
                type="number"
                placeholder="500"
                value={populationDensityMin ?? ''}
                onChange={(e) => setPopulationDensityMin(e.target.value ? parseFloat(e.target.value) : null)}
                className="h-8"
                data-testid="input-population-density-min"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Max</Label>
              <Input
                type="number"
                placeholder="5,000"
                value={populationDensityMax ?? ''}
                onChange={(e) => setPopulationDensityMax(e.target.value ? parseFloat(e.target.value) : null)}
                className="h-8"
                data-testid="input-population-density-max"
              />
            </div>
          </div>
        </div>
        
        <div className="space-y-2">
          <Label className="text-sm font-medium">Avg Household Size</Label>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs text-muted-foreground">Min</Label>
              <Input
                type="number"
                step="0.1"
                placeholder="2.0"
                value={householdSizeMin ?? ''}
                onChange={(e) => setHouseholdSizeMin(e.target.value ? parseFloat(e.target.value) : null)}
                className="h-8"
                data-testid="input-household-size-min"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Max</Label>
              <Input
                type="number"
                step="0.1"
                placeholder="3.5"
                value={householdSizeMax ?? ''}
                onChange={(e) => setHouseholdSizeMax(e.target.value ? parseFloat(e.target.value) : null)}
                className="h-8"
                data-testid="input-household-size-max"
              />
            </div>
          </div>
        </div>
        
        <div className="space-y-2">
          <Label className="text-sm font-medium">Bachelor's Degree+ (%)</Label>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs text-muted-foreground">Min</Label>
              <Input
                type="number"
                placeholder="30"
                value={educationBachelorsMin ?? ''}
                onChange={(e) => setEducationBachelorsMin(e.target.value ? parseFloat(e.target.value) : null)}
                className="h-8"
                data-testid="input-education-bachelors-min"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Max</Label>
              <Input
                type="number"
                placeholder="70"
                value={educationBachelorsMax ?? ''}
                onChange={(e) => setEducationBachelorsMax(e.target.value ? parseFloat(e.target.value) : null)}
                className="h-8"
                data-testid="input-education-bachelors-max"
              />
            </div>
          </div>
        </div>
        
        <div className="space-y-2">
          <Label className="text-sm font-medium">Employment Rate (%)</Label>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs text-muted-foreground">Min</Label>
              <Input
                type="number"
                placeholder="60"
                value={employmentRateMin ?? ''}
                onChange={(e) => setEmploymentRateMin(e.target.value ? parseFloat(e.target.value) : null)}
                className="h-8"
                data-testid="input-employment-rate-min"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Max</Label>
              <Input
                type="number"
                placeholder="95"
                value={employmentRateMax ?? ''}
                onChange={(e) => setEmploymentRateMax(e.target.value ? parseFloat(e.target.value) : null)}
                className="h-8"
                data-testid="input-employment-rate-max"
              />
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-medium">Median Home Value ($)</Label>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs text-muted-foreground">Min</Label>
              <Input
                type="number"
                placeholder="300,000"
                value={homeValueMin ?? ''}
                onChange={(e) => setHomeValueMin(e.target.value ? parseFloat(e.target.value) : null)}
                className="h-8"
                data-testid="input-home-value-min"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Max</Label>
              <Input
                type="number"
                placeholder="800,000"
                value={homeValueMax ?? ''}
                onChange={(e) => setHomeValueMax(e.target.value ? parseFloat(e.target.value) : null)}
                className="h-8"
                data-testid="input-home-value-max"
              />
            </div>
          </div>
        </div>
      </div>
      
      <Collapsible open={showWeights} onOpenChange={setShowWeights}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="w-full justify-between" data-testid="button-toggle-weights">
            <span className="flex items-center gap-2">
              <Settings2 className="h-4 w-4" />
              Criterion Weights (Optional)
            </span>
            {showWeights ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-2">
          <div className="space-y-3 bg-muted/30 p-3 rounded-lg">
            <p className="text-xs text-muted-foreground">
              Adjust importance of each criterion (0% = exclude, higher = more important).
            </p>
            
            {[
              { key: 'medianAge', label: 'Median Age' },
              { key: 'medianIncome', label: 'Median Income' },
              { key: 'populationDensity', label: 'Population Density' },
              { key: 'householdSize', label: 'Household Size' },
              { key: 'educationBachelors', label: 'Education (Bachelor\'s+)' },
              { key: 'employmentRate', label: 'Employment Rate' },
              { key: 'homeValue', label: 'Home Value' }
            ].map(({ key, label }) => (
              <div key={key} className="space-y-1">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">{label}</Label>
                  <span className="text-xs font-medium" data-testid={`text-weight-${key}`}>
                    {Math.round(weights[key as keyof typeof weights] * 100)}%
                  </span>
                </div>
                <Slider
                  value={[weights[key as keyof typeof weights] * 100]}
                  onValueChange={(value) => handleWeightChange(key, value)}
                  max={100}
                  step={5}
                  className="cursor-pointer"
                  data-testid={`slider-weight-${key}`}
                />
              </div>
            ))}
          </div>
        </CollapsibleContent>
      </Collapsible>
      
      <div className="flex gap-2 pt-2">
        <Button
          onClick={handleSave}
          disabled={saveMutation.isPending}
          className="flex-1"
          size="sm"
          data-testid="button-save-targets"
        >
          <Save className="h-4 w-4 mr-2" />
          {saveMutation.isPending ? 'Saving...' : 'Save Targets'}
        </Button>
        <Button
          variant="outline"
          onClick={handleClear}
          disabled={deleteMutation.isPending || !hasAnyTargets}
          size="sm"
          data-testid="button-clear-targets"
        >
          <Trash2 className="h-4 w-4 mr-2" />
          Clear
        </Button>
      </div>
    </div>
  );

  if (compact) {
    return (
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <Card data-testid="card-target-demographics">
          <CollapsibleTrigger asChild>
            <CardHeader className="pb-3 cursor-pointer hover:bg-muted/50 transition-colors">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Target className="h-4 w-4" />
                  Target Demographics
                  {projectId && (
                    <span className="text-xs font-normal text-muted-foreground ml-1">
                      (Project Override)
                    </span>
                  )}
                </CardTitle>
                {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </div>
              <CardDescription className="text-xs">
                Define your ideal marina market profile to calculate suitability scores
              </CardDescription>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0">
              {formContent}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>
    );
  }
  
  return (
    <Card data-testid="card-target-demographics">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Target className="h-4 w-4" />
          Target Demographics
          {projectId && (
            <span className="text-xs font-normal text-muted-foreground ml-1">
              (Project Override)
            </span>
          )}
        </CardTitle>
        <CardDescription className="text-xs">
          Define your ideal marina market profile to calculate suitability scores
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        {formContent}
      </CardContent>
    </Card>
  );
}