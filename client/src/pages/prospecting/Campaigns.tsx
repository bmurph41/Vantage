import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Send, Plus, Search, Mail, Phone, FileText, 
  MoreVertical, Play, Pause, Copy, Edit, Trash2,
  Clock, Users, TrendingUp, CheckCircle
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type Campaign = {
  id: string;
  name: string;
  type: 'email' | 'call' | 'mixed';
  status: 'active' | 'paused' | 'completed' | 'draft';
  targets: number;
  sent: number;
  opened: number;
  replied: number;
  startDate: string;
  endDate?: string;
};

type Template = {
  id: string;
  name: string;
  type: 'email' | 'call_script';
  category: string;
  usageCount: number;
  lastUsed?: string;
};

const mockCampaigns: Campaign[] = [
  { id: '1', name: 'Great Lakes Q1 Outreach', type: 'email', status: 'active', targets: 150, sent: 120, opened: 45, replied: 12, startDate: '2025-01-15' },
  { id: '2', name: 'Florida Keys Direct', type: 'mixed', status: 'active', targets: 75, sent: 50, opened: 28, replied: 8, startDate: '2025-01-20' },
  { id: '3', name: 'Legacy Owner Outreach', type: 'call', status: 'paused', targets: 100, sent: 35, opened: 0, replied: 5, startDate: '2025-01-10' },
  { id: '4', name: 'Chesapeake Broker Network', type: 'email', status: 'completed', targets: 200, sent: 200, opened: 85, replied: 22, startDate: '2024-12-01', endDate: '2024-12-31' },
  { id: '5', name: 'Pacific Northwest Q2', type: 'email', status: 'draft', targets: 80, sent: 0, opened: 0, replied: 0, startDate: '2025-02-01' },
];

const mockTemplates: Template[] = [
  { id: '1', name: 'Initial Owner Outreach', type: 'email', category: 'Cold Outreach', usageCount: 245, lastUsed: '2025-01-25' },
  { id: '2', name: 'Broker Introduction', type: 'email', category: 'Networking', usageCount: 128, lastUsed: '2025-01-24' },
  { id: '3', name: 'Follow-up After Call', type: 'email', category: 'Follow-up', usageCount: 89, lastUsed: '2025-01-23' },
  { id: '4', name: 'Legacy Owner Call Script', type: 'call_script', category: 'Cold Call', usageCount: 156, lastUsed: '2025-01-22' },
  { id: '5', name: 'Market Update Email', type: 'email', category: 'Nurture', usageCount: 67, lastUsed: '2025-01-20' },
  { id: '6', name: 'Property Interest Call', type: 'call_script', category: 'Warm Call', usageCount: 92, lastUsed: '2025-01-18' },
];

export default function Campaigns() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('campaigns');

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-700';
      case 'paused': return 'bg-yellow-100 text-yellow-700';
      case 'completed': return 'bg-blue-100 text-blue-700';
      case 'draft': return 'bg-gray-100 text-gray-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'email': return <Mail className="w-4 h-4" />;
      case 'call': case 'call_script': return <Phone className="w-4 h-4" />;
      case 'mixed': return <Send className="w-4 h-4" />;
      default: return <FileText className="w-4 h-4" />;
    }
  };

  const filteredCampaigns = mockCampaigns.filter(c =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredTemplates = mockTemplates.filter(t =>
    t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex-1 overflow-auto p-6 bg-gray-50">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900" data-testid="page-title">Campaigns & Templates</h1>
            <p className="text-gray-500 mt-1">Manage your outreach campaigns and message templates</p>
          </div>
          <Button data-testid="button-create-new">
            <Plus className="w-4 h-4 mr-2" />
            {activeTab === 'campaigns' ? 'New Campaign' : 'New Template'}
          </Button>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6">
          <TabsList>
            <TabsTrigger value="campaigns">Campaigns</TabsTrigger>
            <TabsTrigger value="templates">Templates</TabsTrigger>
          </TabsList>

          <TabsContent value="campaigns" className="mt-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <Card className="bg-white">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500">Active Campaigns</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {mockCampaigns.filter(c => c.status === 'active').length}
                      </p>
                    </div>
                    <Play className="w-8 h-8 text-green-500" />
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-white">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500">Total Targets</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {mockCampaigns.reduce((sum, c) => sum + c.targets, 0)}
                      </p>
                    </div>
                    <Users className="w-8 h-8 text-blue-500" />
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-white">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500">Avg Open Rate</p>
                      <p className="text-2xl font-bold text-gray-900">38%</p>
                    </div>
                    <TrendingUp className="w-8 h-8 text-purple-500" />
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-white">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500">Total Replies</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {mockCampaigns.reduce((sum, c) => sum + c.replied, 0)}
                      </p>
                    </div>
                    <CheckCircle className="w-8 h-8 text-orange-500" />
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="bg-white mb-4">
              <CardContent className="p-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    placeholder="Search campaigns..."
                    className="pl-10"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    data-testid="input-search-campaigns"
                  />
                </div>
              </CardContent>
            </Card>

            <div className="space-y-4">
              {filteredCampaigns.map((campaign) => (
                <Card key={campaign.id} className="bg-white" data-testid={`campaign-card-${campaign.id}`}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                          campaign.type === 'email' ? 'bg-blue-100' : 
                          campaign.type === 'call' ? 'bg-green-100' : 'bg-purple-100'
                        }`}>
                          {getTypeIcon(campaign.type)}
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900">{campaign.name}</h3>
                          <p className="text-sm text-gray-500">
                            Started {campaign.startDate}
                            {campaign.endDate && ` • Ended ${campaign.endDate}`}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-6">
                        <div className="text-center">
                          <p className="text-lg font-semibold text-gray-900">{campaign.targets}</p>
                          <p className="text-xs text-gray-500">Targets</p>
                        </div>
                        <div className="text-center">
                          <p className="text-lg font-semibold text-gray-900">{campaign.sent}</p>
                          <p className="text-xs text-gray-500">Sent</p>
                        </div>
                        <div className="text-center">
                          <p className="text-lg font-semibold text-gray-900">{campaign.opened}</p>
                          <p className="text-xs text-gray-500">Opened</p>
                        </div>
                        <div className="text-center">
                          <p className="text-lg font-semibold text-gray-900">{campaign.replied}</p>
                          <p className="text-xs text-gray-500">Replied</p>
                        </div>
                        
                        <Badge className={getStatusColor(campaign.status)}>
                          {campaign.status.charAt(0).toUpperCase() + campaign.status.slice(1)}
                        </Badge>
                        
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem>
                              <Edit className="w-4 h-4 mr-2" /> Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              {campaign.status === 'active' ? (
                                <><Pause className="w-4 h-4 mr-2" /> Pause</>
                              ) : (
                                <><Play className="w-4 h-4 mr-2" /> Resume</>
                              )}
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Copy className="w-4 h-4 mr-2" /> Duplicate
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-red-600">
                              <Trash2 className="w-4 h-4 mr-2" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="templates" className="mt-4">
            <Card className="bg-white mb-4">
              <CardContent className="p-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    placeholder="Search templates..."
                    className="pl-10"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    data-testid="input-search-templates"
                  />
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredTemplates.map((template) => (
                <Card key={template.id} className="bg-white hover:shadow-lg transition-shadow" data-testid={`template-card-${template.id}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        template.type === 'email' ? 'bg-blue-100' : 'bg-green-100'
                      }`}>
                        {getTypeIcon(template.type)}
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem><Edit className="w-4 h-4 mr-2" /> Edit</DropdownMenuItem>
                          <DropdownMenuItem><Copy className="w-4 h-4 mr-2" /> Duplicate</DropdownMenuItem>
                          <DropdownMenuItem className="text-red-600"><Trash2 className="w-4 h-4 mr-2" /> Delete</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    
                    <h3 className="font-semibold text-gray-900 mb-1">{template.name}</h3>
                    <Badge variant="secondary" className="mb-3">{template.category}</Badge>
                    
                    <div className="flex items-center justify-between text-sm text-gray-500 pt-3 border-t">
                      <span>Used {template.usageCount} times</span>
                      {template.lastUsed && <span>Last: {template.lastUsed}</span>}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
