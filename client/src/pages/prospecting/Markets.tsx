import { useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  MapPin, Plus, Search, Target, Building2,
  ChevronRight, Globe, DollarSign, Trash2, Pencil, TrendingUp, Loader2
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { MarketTarget } from "@shared/schema";

export default function MarketTargets() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPriority, setSelectedPriority] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingMarket, setEditingMarket] = useState<MarketTarget | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    region: '',
    states: '',
    priority: 'medium' as string,
    status: 'research' as string,
    totalMarinas: 0,
    notes: '',
  });

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: markets = [], isLoading } = useQuery<MarketTarget[]>({
    queryKey: ['/api/prospecting/market-targets'],
    select: (res: any) => Array.isArray(res) ? res : (res?.data ?? []),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest('POST', '/api/prospecting/market-targets', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/prospecting/market-targets'] });
      toast({ title: "Market target created" });
      closeDialog();
    },
    onError: () => toast({ title: "Failed to create market target", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => apiRequest('PUT', `/api/prospecting/market-targets/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/prospecting/market-targets'] });
      toast({ title: "Market target updated" });
      closeDialog();
    },
    onError: () => toast({ title: "Failed to update market target", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest('DELETE', `/api/prospecting/market-targets/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/prospecting/market-targets'] });
      toast({ title: "Market target deleted" });
    },
    onError: () => toast({ title: "Failed to delete market target", variant: "destructive" }),
  });

  const [, navigate] = useLocation();
  const promoteMutation = useMutation({
    mutationFn: (market: MarketTarget) =>
      apiRequest('POST', '/api/modeling/projects', {
        marinaName: market.name,
        city: market.region || '',
        state: market.states?.[0] || '',
        assetClass: 'marina',
        uwStage: 'not_started',
        customMetrics: {
          sourceType: 'prospecting_target',
          sourceId: market.id,
          sourceName: market.name,
        },
      }),
    onSuccess: (newProject: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/modeling/projects'] });
      toast({ title: "Model created", description: `${newProject.marinaName} promoted to Financial Model` });
      navigate(`/modeling/projects/${newProject.id}?tab=inputs`);
    },
    onError: () => toast({ title: "Failed to create model", variant: "destructive" }),
  });

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingMarket(null);
    setFormData({ name: '', region: '', states: '', priority: 'medium', status: 'research', totalMarinas: 0, notes: '' });
  };

  const openCreateDialog = () => {
    setEditingMarket(null);
    setFormData({ name: '', region: '', states: '', priority: 'medium', status: 'research', totalMarinas: 0, notes: '' });
    setDialogOpen(true);
  };

  const openEditDialog = (market: MarketTarget) => {
    setEditingMarket(market);
    setFormData({
      name: market.name,
      region: market.region || '',
      states: (market.states || []).join(', '),
      priority: market.priority,
      status: market.status,
      totalMarinas: market.totalMarinas || 0,
      notes: market.notes || '',
    });
    setDialogOpen(true);
  };

  const handleSubmit = () => {
    const payload = {
      name: formData.name,
      region: formData.region || null,
      states: formData.states ? formData.states.split(',').map(s => s.trim()).filter(Boolean) : [],
      priority: formData.priority,
      status: formData.status,
      totalMarinas: Number(formData.totalMarinas) || 0,
      notes: formData.notes || null,
    };
    if (editingMarket) {
      updateMutation.mutate({ id: editingMarket.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const filteredMarkets = markets.filter(market => {
    const matchesSearch = market.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         (market.region || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                         (market.states || []).some(s => s.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesPriority = !selectedPriority || market.priority === selectedPriority;
    return matchesSearch && matchesPriority;
  });

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'bg-red-200 text-red-800';
      case 'high': return 'bg-red-100 text-red-700';
      case 'medium': return 'bg-yellow-100 text-yellow-700';
      case 'low': return 'bg-green-100 text-green-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-500';
      case 'research': return 'bg-purple-500';
      case 'saturated': return 'bg-orange-500';
      case 'paused': return 'bg-gray-400';
      default: return 'bg-gray-500';
    }
  };

  const totalMarinas = markets.reduce((sum, m) => sum + (m.totalMarinas || 0), 0);
  const activeCount = markets.filter(m => m.status === 'active').length;
  const totalConverted = markets.reduce((sum, m) => sum + (m.convertedDeals || 0), 0);

  return (
    <div className="flex-1 overflow-auto p-6 bg-gray-50">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900" data-testid="page-title">Market Targets</h1>
            <p className="text-gray-500 mt-1">Define and track your target markets for acquisition</p>
          </div>
          <Button data-testid="button-add-market" onClick={openCreateDialog}>
            <Plus className="w-4 h-4 mr-2" />
            Add Market
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card className="bg-white">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Total Markets</p>
                  <p className="text-2xl font-bold text-gray-900">{isLoading ? '—' : markets.length}</p>
                </div>
                <Globe className="w-8 h-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-white">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Target Marinas</p>
                  <p className="text-2xl font-bold text-gray-900">{isLoading ? '—' : totalMarinas}</p>
                </div>
                <Building2 className="w-8 h-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-white">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Active Markets</p>
                  <p className="text-2xl font-bold text-gray-900">{isLoading ? '—' : activeCount}</p>
                </div>
                <Target className="w-8 h-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-white">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Converted Deals</p>
                  <p className="text-2xl font-bold text-gray-900">{isLoading ? '—' : totalConverted}</p>
                </div>
                <DollarSign className="w-8 h-8 text-orange-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="bg-white mb-6">
          <CardContent className="p-4">
            <div className="flex items-center space-x-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Search markets by name, region, or state..."
                  className="pl-10"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  data-testid="input-search-markets"
                />
              </div>
              <div className="flex items-center space-x-2">
                <Button variant={selectedPriority === null ? "default" : "outline"} size="sm" onClick={() => setSelectedPriority(null)}>All</Button>
                <Button variant={selectedPriority === 'critical' ? "default" : "outline"} size="sm" onClick={() => setSelectedPriority('critical')}>Critical</Button>
                <Button variant={selectedPriority === 'high' ? "default" : "outline"} size="sm" onClick={() => setSelectedPriority('high')}>High</Button>
                <Button variant={selectedPriority === 'medium' ? "default" : "outline"} size="sm" onClick={() => setSelectedPriority('medium')}>Medium</Button>
                <Button variant={selectedPriority === 'low' ? "default" : "outline"} size="sm" onClick={() => setSelectedPriority('low')}>Low</Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <Card key={i} className="bg-white">
                <CardContent className="p-4">
                  <Skeleton className="h-5 w-3/4 mb-2" />
                  <Skeleton className="h-4 w-1/2 mb-4" />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                    <Skeleton className="h-10" />
                    <Skeleton className="h-10" />
                  </div>
                  <Skeleton className="h-8 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredMarkets.length === 0 && markets.length === 0 ? (
          <div className="text-center py-12">
            <MapPin className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900">No market targets yet</h3>
            <p className="text-gray-500 mt-1">Add your first market target to start tracking acquisition opportunities</p>
            <Button className="mt-4" onClick={openCreateDialog}>
              <Plus className="w-4 h-4 mr-2" />
              Add Market
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredMarkets.map((market) => (
              <Card key={market.id} className="bg-white hover:shadow-lg transition-shadow cursor-pointer" data-testid={`market-card-${market.id}`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-gray-900">{market.name}</h3>
                      <p className="text-sm text-gray-500">
                        {market.region}{market.states && market.states.length > 0 ? ` • ${market.states.join(', ')}` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${getStatusColor(market.status)}`} title={market.status} />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-3">
                    <div>
                      <p className="text-xs text-gray-500">Total</p>
                      <p className="text-lg font-semibold text-gray-900">{market.totalMarinas || 0}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Contacted</p>
                      <p className="text-lg font-semibold text-gray-900">{market.contactedMarinas || 0}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Deals</p>
                      <p className="text-lg font-semibold text-gray-900">{market.convertedDeals || 0}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between pt-3 border-t">
                    <Badge className={getPriorityColor(market.priority)}>
                      {market.priority.charAt(0).toUpperCase() + market.priority.slice(1)}
                    </Badge>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs text-blue-600 border-blue-200 hover:bg-blue-50"
                        onClick={(e) => { e.stopPropagation(); promoteMutation.mutate(market); }}
                        disabled={promoteMutation.isPending}
                      >
                        {promoteMutation.isPending ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <TrendingUp className="w-3 h-3 mr-1" />}
                        Model
                      </Button>
                      <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); openEditDialog(market); }}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(market.id); }}>
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {!isLoading && filteredMarkets.length === 0 && markets.length > 0 && (
          <div className="text-center py-12">
            <MapPin className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900">No markets found</h3>
            <p className="text-gray-500 mt-1">Try adjusting your search or filters</p>
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{editingMarket ? 'Edit Market Target' : 'Add Market Target'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Name *</Label>
              <Input id="name" value={formData.name} onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))} placeholder="e.g., Tampa Bay Waterfront" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="region">Region</Label>
              <Input id="region" value={formData.region} onChange={(e) => setFormData(prev => ({ ...prev, region: e.target.value }))} placeholder="e.g., Gulf Coast" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="states">States (comma-separated)</Label>
              <Input id="states" value={formData.states} onChange={(e) => setFormData(prev => ({ ...prev, states: e.target.value }))} placeholder="e.g., FL, GA, SC" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Priority</Label>
                <Select value={formData.priority} onValueChange={(val) => setFormData(prev => ({ ...prev, priority: val }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Status</Label>
                <Select value={formData.status} onValueChange={(val) => setFormData(prev => ({ ...prev, status: val }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="research">Research</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="saturated">Saturated</SelectItem>
                    <SelectItem value="paused">Paused</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="totalMarinas">Total Marinas</Label>
              <Input id="totalMarinas" type="number" value={formData.totalMarinas} onChange={(e) => setFormData(prev => ({ ...prev, totalMarinas: parseInt(e.target.value) || 0 }))} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea id="notes" value={formData.notes} onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))} placeholder="Additional notes about this market..." rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={!formData.name || createMutation.isPending || updateMutation.isPending}>
              {createMutation.isPending || updateMutation.isPending ? 'Saving...' : editingMarket ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
