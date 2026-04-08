import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Target, Plus, Minus, User, Building, 
  Phone, Mail, Calendar, TrendingUp,
  Settings, Save, RotateCcw
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

interface ScoringRule {
  id: string;
  category: 'demographics' | 'engagement' | 'behavior' | 'firmographics';
  field: string;
  condition: 'equals' | 'contains' | 'greater_than' | 'less_than' | 'exists';
  value: any;
  points: number;
  isActive: boolean;
}

interface LeadScoringConfig {
  rules: ScoringRule[];
  hotThreshold: number;
  warmThreshold: number;
  isEnabled: boolean;
}

interface ContactScore {
  contactId: string;
  name: string;
  email: string;
  currentScore: number;
  maxScore: number;
  status: 'hot' | 'warm' | 'cold';
  scoreBreakdown: {
    category: string;
    points: number;
    rules: { field: string; points: number }[];
  }[];
  lastUpdated: string;
}

export default function LeadScoring() {
  const [editMode, setEditMode] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: config, isLoading: configLoading } = useQuery<LeadScoringConfig>({
    queryKey: ['/api/lead-scoring/config'],
  });

  const { data: topScores = [], isLoading: scoresLoading } = useQuery<ContactScore[]>({
    queryKey: ['/api/lead-scoring/top-scores'],
  });

  const updateConfigMutation = useMutation({
    mutationFn: async (newConfig: LeadScoringConfig) => {
      const response = await fetch('/api/lead-scoring/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newConfig),
      });
      if (!response.ok) throw new Error('Failed to update config');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/lead-scoring/config'] });
      queryClient.invalidateQueries({ queryKey: ['/api/lead-scoring/top-scores'] });
      toast({ title: "Lead scoring configuration updated" });
      setEditMode(false);
    },
    onError: () => {
      toast({ title: "Failed to update configuration", variant: "destructive" });
    },
  });

  const recalculateScoresMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/lead-scoring/recalculate', {
        method: 'POST',
      });
      if (!response.ok) throw new Error('Failed to recalculate');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/lead-scoring/top-scores'] });
      toast({ title: "Lead scores recalculated successfully" });
    },
  });

  const [localConfig, setLocalConfig] = useState<LeadScoringConfig | null>(null);

  const workingConfig = editMode ? localConfig : config;

  const handleStartEdit = () => {
    setLocalConfig(config ? { ...config } : {
      rules: [],
      hotThreshold: 80,
      warmThreshold: 40,
      isEnabled: true,
    });
    setEditMode(true);
  };

  const handleSave = () => {
    if (localConfig) {
      updateConfigMutation.mutate(localConfig);
    }
  };

  const handleCancel = () => {
    setLocalConfig(null);
    setEditMode(false);
  };

  const addRule = () => {
    if (!localConfig) return;
    
    const newRule: ScoringRule = {
      id: Date.now().toString(),
      category: 'demographics',
      field: 'leadStatus',
      condition: 'equals',
      value: 'hot',
      points: 10,
      isActive: true,
    };

    setLocalConfig({
      ...localConfig,
      rules: [...localConfig.rules, newRule],
    });
  };

  const updateRule = (ruleId: string, updates: Partial<ScoringRule>) => {
    if (!localConfig) return;
    
    setLocalConfig({
      ...localConfig,
      rules: localConfig.rules.map(rule => 
        rule.id === ruleId ? { ...rule, ...updates } : rule
      ),
    });
  };

  const removeRule = (ruleId: string) => {
    if (!localConfig) return;
    
    setLocalConfig({
      ...localConfig,
      rules: localConfig.rules.filter(rule => rule.id !== ruleId),
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'hot': return 'bg-red-100 text-red-800';
      case 'warm': return 'bg-yellow-100 text-yellow-800';
      case 'cold': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'demographics': return User;
      case 'engagement': return TrendingUp;
      case 'behavior': return Target;
      case 'firmographics': return Building;
      default: return Settings;
    }
  };

  if (configLoading || scoresLoading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="p-6">
            <div className="animate-pulse space-y-4">
              <div className="h-6 bg-gray-200 rounded w-1/3"></div>
              <div className="h-4 bg-gray-200 rounded w-2/3"></div>
              <div className="h-32 bg-gray-200 rounded"></div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Target className="w-6 h-6" />
            Lead Scoring
          </h2>
          <p className="text-gray-600">
            Automatically score and prioritize leads based on their characteristics and behavior.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => recalculateScoresMutation.mutate()}
            disabled={recalculateScoresMutation.isPending}
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            Recalculate All
          </Button>
          {!editMode ? (
            <Button onClick={handleStartEdit}>
              <Settings className="w-4 h-4 mr-2" />
              Configure Rules
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleCancel}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={updateConfigMutation.isPending}>
                <Save className="w-4 h-4 mr-2" />
                Save Changes
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Configuration */}
      {editMode && workingConfig && (
        <Card>
          <CardHeader>
            <CardTitle>Scoring Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Global Settings */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Enable Lead Scoring</Label>
                <Switch
                  checked={workingConfig.isEnabled}
                  onCheckedChange={(checked) => setLocalConfig(prev => 
                    prev ? { ...prev, isEnabled: checked } : null
                  )}
                />
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label>Hot Lead Threshold</Label>
                  <Input
                    type="number"
                    value={workingConfig.hotThreshold}
                    onChange={(e) => setLocalConfig(prev => 
                      prev ? { ...prev, hotThreshold: Number(e.target.value) } : null
                    )}
                  />
                </div>
                <div>
                  <Label>Warm Lead Threshold</Label>
                  <Input
                    type="number"
                    value={workingConfig.warmThreshold}
                    onChange={(e) => setLocalConfig(prev => 
                      prev ? { ...prev, warmThreshold: Number(e.target.value) } : null
                    )}
                  />
                </div>
              </div>
            </div>

            {/* Scoring Rules */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Scoring Rules</Label>
                <Button variant="outline" size="sm" onClick={addRule}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Rule
                </Button>
              </div>

              <div className="space-y-3">
                {workingConfig.rules.map((rule) => (
                  <ScoringRuleEditor
                    key={rule.id}
                    rule={rule}
                    onUpdate={(updates) => updateRule(rule.id, updates)}
                    onRemove={() => removeRule(rule.id)}
                  />
                ))}
                
                {workingConfig.rules.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    No scoring rules configured. Add a rule to get started.
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Top Scoring Leads */}
      <Card>
        <CardHeader>
          <CardTitle>Top Scoring Leads</CardTitle>
        </CardHeader>
        <CardContent>
          {topScores.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No leads scored yet. Configure scoring rules and recalculate scores.
            </div>
          ) : (
            <div className="space-y-4">
              {topScores.map((contact) => (
                <div key={contact.contactId} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-gray-900">
                        {contact.currentScore}
                      </div>
                      <div className="text-xs text-gray-500">
                        / {contact.maxScore}
                      </div>
                    </div>
                    
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium">{contact.name}</span>
                        <Badge className={getStatusColor(contact.status)}>
                          {contact.status}
                        </Badge>
                      </div>
                      <div className="text-sm text-gray-600 mb-2">
                        {contact.email}
                      </div>
                      <Progress 
                        value={(contact.currentScore / contact.maxScore) * 100} 
                        className="h-2"
                      />
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <div className="text-xs text-gray-500 mb-1">
                      Last updated: {new Date(contact.lastUpdated).toLocaleDateString()}
                    </div>
                    <Button variant="outline" size="sm">
                      View Details
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Scoring Breakdown */}
      {!editMode && workingConfig && (
        <Card>
          <CardHeader>
            <CardTitle>Scoring Rules Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {['demographics', 'engagement', 'behavior', 'firmographics'].map((category) => {
                const categoryRules = workingConfig.rules.filter(rule => rule.category === category && rule.isActive);
                const totalPoints = categoryRules.reduce((sum, rule) => sum + rule.points, 0);
                const Icon = getCategoryIcon(category);
                
                return (
                  <div key={category} className="text-center p-4 border rounded-lg">
                    <Icon className="w-8 h-8 mx-auto mb-2 text-gray-600" />
                    <div className="font-medium capitalize mb-1">{category}</div>
                    <div className="text-2xl font-bold text-blue-600 mb-1">
                      {totalPoints}
                    </div>
                    <div className="text-xs text-gray-500">
                      {categoryRules.length} rules
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

interface ScoringRuleEditorProps {
  rule: ScoringRule;
  onUpdate: (updates: Partial<ScoringRule>) => void;
  onRemove: () => void;
}

function ScoringRuleEditor({ rule, onUpdate, onRemove }: ScoringRuleEditorProps) {
  const fieldOptions = {
    demographics: [
      { value: 'leadStatus', label: 'Lead Status' },
      { value: 'leadScore', label: 'Current Score' },
      { value: 'email', label: 'Has Email' },
      { value: 'phone', label: 'Has Phone' },
    ],
    engagement: [
      { value: 'emailOpened', label: 'Email Opened' },
      { value: 'linkClicked', label: 'Link Clicked' },
      { value: 'propertyViewed', label: 'Property Viewed' },
      { value: 'showingAttended', label: 'Showing Attended' },
    ],
    behavior: [
      { value: 'responseTime', label: 'Response Time' },
      { value: 'activityCount', label: 'Activity Count' },
      { value: 'lastActivityDate', label: 'Recent Activity' },
    ],
    firmographics: [
      { value: 'companySize', label: 'Company Size' },
      { value: 'industry', label: 'Industry' },
      { value: 'website', label: 'Has Website' },
    ],
  };

  return (
    <div className="flex items-center gap-3 p-3 border rounded-lg">
      <Switch
        checked={rule.isActive}
        onCheckedChange={(checked) => onUpdate({ isActive: checked })}
      />
      
      <select
        value={rule.category}
        onChange={(e) => onUpdate({ category: e.target.value as any })}
        className="px-3 py-1 border rounded text-sm"
      >
        <option value="demographics">Demographics</option>
        <option value="engagement">Engagement</option>
        <option value="behavior">Behavior</option>
        <option value="firmographics">Firmographics</option>
      </select>
      
      <select
        value={rule.field}
        onChange={(e) => onUpdate({ field: e.target.value })}
        className="px-3 py-1 border rounded text-sm"
      >
        {fieldOptions[rule.category].map(option => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      
      <select
        value={rule.condition}
        onChange={(e) => onUpdate({ condition: e.target.value as any })}
        className="px-3 py-1 border rounded text-sm"
      >
        <option value="equals">Equals</option>
        <option value="contains">Contains</option>
        <option value="greater_than">Greater Than</option>
        <option value="less_than">Less Than</option>
        <option value="exists">Exists</option>
      </select>
      
      <Input
        value={rule.value}
        onChange={(e) => onUpdate({ value: e.target.value })}
        placeholder="Value"
        className="w-24"
      />
      
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onUpdate({ points: Math.max(-50, rule.points - 5) })}
        >
          <Minus className="w-3 h-3" />
        </Button>
        <span className="w-8 text-center text-sm">{rule.points}</span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onUpdate({ points: Math.min(50, rule.points + 5) })}
        >
          <Plus className="w-3 h-3" />
        </Button>
      </div>
      
      <Button variant="outline" size="sm" onClick={onRemove}>
        <Minus className="w-4 h-4" />
      </Button>
    </div>
  );
}
