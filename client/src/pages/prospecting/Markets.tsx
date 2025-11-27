import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  MapPin, Plus, Search, Filter, Target, TrendingUp, Building2,
  ChevronRight, Globe, Users, DollarSign
} from "lucide-react";

type MarketTarget = {
  id: string;
  name: string;
  region: string;
  state: string;
  city?: string;
  marinasCount: number;
  avgDealSize: number;
  priority: 'high' | 'medium' | 'low';
  status: 'active' | 'prospecting' | 'researching';
};

const mockMarkets: MarketTarget[] = [
  { id: '1', name: 'Tampa Bay Waterfront', region: 'Gulf Coast', state: 'FL', city: 'Tampa', marinasCount: 45, avgDealSize: 4500000, priority: 'high', status: 'active' },
  { id: '2', name: 'Chesapeake Bay', region: 'Mid-Atlantic', state: 'MD', marinasCount: 120, avgDealSize: 3200000, priority: 'high', status: 'prospecting' },
  { id: '3', name: 'San Diego Harbor', region: 'Pacific', state: 'CA', city: 'San Diego', marinasCount: 28, avgDealSize: 8500000, priority: 'medium', status: 'researching' },
  { id: '4', name: 'Great Lakes - Michigan', region: 'Great Lakes', state: 'MI', marinasCount: 85, avgDealSize: 2100000, priority: 'medium', status: 'active' },
  { id: '5', name: 'Florida Keys', region: 'Southeast', state: 'FL', marinasCount: 35, avgDealSize: 6200000, priority: 'high', status: 'prospecting' },
  { id: '6', name: 'Puget Sound', region: 'Pacific Northwest', state: 'WA', marinasCount: 55, avgDealSize: 4800000, priority: 'low', status: 'researching' },
];

export default function MarketTargets() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPriority, setSelectedPriority] = useState<string | null>(null);

  const filteredMarkets = mockMarkets.filter(market => {
    const matchesSearch = market.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         market.region.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         market.state.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesPriority = !selectedPriority || market.priority === selectedPriority;
    return matchesSearch && matchesPriority;
  });

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-700';
      case 'medium': return 'bg-yellow-100 text-yellow-700';
      case 'low': return 'bg-green-100 text-green-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-500';
      case 'prospecting': return 'bg-blue-500';
      case 'researching': return 'bg-purple-500';
      default: return 'bg-gray-500';
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <div className="flex-1 overflow-auto p-6 bg-gray-50">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900" data-testid="page-title">Market Targets</h1>
            <p className="text-gray-500 mt-1">Define and track your target markets for acquisition</p>
          </div>
          <Button data-testid="button-add-market">
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
                  <p className="text-2xl font-bold text-gray-900">{mockMarkets.length}</p>
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
                  <p className="text-2xl font-bold text-gray-900">
                    {mockMarkets.reduce((sum, m) => sum + m.marinasCount, 0)}
                  </p>
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
                  <p className="text-2xl font-bold text-gray-900">
                    {mockMarkets.filter(m => m.status === 'active').length}
                  </p>
                </div>
                <Target className="w-8 h-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-white">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Avg Deal Size</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {formatCurrency(mockMarkets.reduce((sum, m) => sum + m.avgDealSize, 0) / mockMarkets.length)}
                  </p>
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
                <Button 
                  variant={selectedPriority === null ? "default" : "outline"} 
                  size="sm"
                  onClick={() => setSelectedPriority(null)}
                >
                  All
                </Button>
                <Button 
                  variant={selectedPriority === 'high' ? "default" : "outline"} 
                  size="sm"
                  onClick={() => setSelectedPriority('high')}
                >
                  High Priority
                </Button>
                <Button 
                  variant={selectedPriority === 'medium' ? "default" : "outline"} 
                  size="sm"
                  onClick={() => setSelectedPriority('medium')}
                >
                  Medium
                </Button>
                <Button 
                  variant={selectedPriority === 'low' ? "default" : "outline"} 
                  size="sm"
                  onClick={() => setSelectedPriority('low')}
                >
                  Low
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredMarkets.map((market) => (
            <Card key={market.id} className="bg-white hover:shadow-lg transition-shadow cursor-pointer" data-testid={`market-card-${market.id}`}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-gray-900">{market.name}</h3>
                    <p className="text-sm text-gray-500">{market.region} • {market.state}</p>
                  </div>
                  <div className={`w-2 h-2 rounded-full ${getStatusColor(market.status)}`} />
                </div>
                
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <p className="text-xs text-gray-500">Marinas</p>
                    <p className="text-lg font-semibold text-gray-900">{market.marinasCount}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Avg Deal</p>
                    <p className="text-lg font-semibold text-gray-900">{formatCurrency(market.avgDealSize)}</p>
                  </div>
                </div>
                
                <div className="flex items-center justify-between pt-3 border-t">
                  <Badge className={getPriorityColor(market.priority)}>
                    {market.priority.charAt(0).toUpperCase() + market.priority.slice(1)} Priority
                  </Badge>
                  <Button variant="ghost" size="sm">
                    View <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {filteredMarkets.length === 0 && (
          <div className="text-center py-12">
            <MapPin className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900">No markets found</h3>
            <p className="text-gray-500 mt-1">Try adjusting your search or filters</p>
          </div>
        )}
      </div>
    </div>
  );
}
