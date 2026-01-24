import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Eye,
  Download,
  Upload,
  Share2,
  FolderPlus,
  Trash2,
  Edit,
  UserPlus,
  ShieldCheck,
  Clock,
  FileText,
  Users,
  Activity,
  TrendingUp,
  AlertTriangle,
  Filter,
  Calendar
} from 'lucide-react';
import { formatDistanceToNow, format, subDays, subHours } from 'date-fns';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

interface ActivityItem {
  id: string;
  action: 'view' | 'download' | 'upload' | 'share' | 'create_folder' | 'delete' | 'edit' | 'permission_change' | 'user_added';
  userId: string;
  userName: string;
  userEmail: string;
  userType: 'internal' | 'external';
  resourceType: 'document' | 'folder';
  resourceName: string;
  projectId: string;
  projectName: string;
  ipAddress: string;
  timestamp: Date;
  details?: string;
}

const SAMPLE_ACTIVITIES: ActivityItem[] = [
  {
    id: '1',
    action: 'download',
    userId: 'u1',
    userName: 'John Smith',
    userEmail: 'john@investor.com',
    userType: 'external',
    resourceType: 'document',
    resourceName: 'Financial Statements 2025.pdf',
    projectId: 'p1',
    projectName: 'Marina Bay Acquisition',
    ipAddress: '192.168.1.100',
    timestamp: new Date(Date.now() - 300000),
    details: 'Downloaded via secure link',
  },
  {
    id: '2',
    action: 'view',
    userId: 'u2',
    userName: 'Sarah Johnson',
    userEmail: 'sarah@bank.com',
    userType: 'external',
    resourceType: 'document',
    resourceName: 'Rent Roll Summary.xlsx',
    projectId: 'p1',
    projectName: 'Marina Bay Acquisition',
    ipAddress: '10.0.0.45',
    timestamp: new Date(Date.now() - 900000),
  },
  {
    id: '3',
    action: 'upload',
    userId: 'u3',
    userName: 'Mike Wilson',
    userEmail: 'mike@company.com',
    userType: 'internal',
    resourceType: 'document',
    resourceName: 'Environmental Assessment.pdf',
    projectId: 'p2',
    projectName: 'Harbor Point DD',
    ipAddress: '172.16.0.22',
    timestamp: new Date(Date.now() - 1800000),
  },
  {
    id: '4',
    action: 'permission_change',
    userId: 'u3',
    userName: 'Mike Wilson',
    userEmail: 'mike@company.com',
    userType: 'internal',
    resourceType: 'folder',
    resourceName: 'Financial Documents',
    projectId: 'p1',
    projectName: 'Marina Bay Acquisition',
    ipAddress: '172.16.0.22',
    timestamp: new Date(Date.now() - 3600000),
    details: 'Changed access level from View to Download',
  },
  {
    id: '5',
    action: 'user_added',
    userId: 'u4',
    userName: 'Admin User',
    userEmail: 'admin@company.com',
    userType: 'internal',
    resourceType: 'folder',
    resourceName: 'Due Diligence',
    projectId: 'p2',
    projectName: 'Harbor Point DD',
    ipAddress: '172.16.0.1',
    timestamp: new Date(Date.now() - 7200000),
    details: 'Added external user: lender@bank.com',
  },
  {
    id: '6',
    action: 'share',
    userId: 'u3',
    userName: 'Mike Wilson',
    userEmail: 'mike@company.com',
    userType: 'internal',
    resourceType: 'document',
    resourceName: 'Appraisal Report.pdf',
    projectId: 'p1',
    projectName: 'Marina Bay Acquisition',
    ipAddress: '172.16.0.22',
    timestamp: subHours(new Date(), 5),
  },
  {
    id: '7',
    action: 'view',
    userId: 'u5',
    userName: 'External Viewer',
    userEmail: 'viewer@lender.com',
    userType: 'external',
    resourceType: 'document',
    resourceName: 'Insurance Certificates.pdf',
    projectId: 'p1',
    projectName: 'Marina Bay Acquisition',
    ipAddress: '203.0.113.50',
    timestamp: subHours(new Date(), 8),
  },
  {
    id: '8',
    action: 'download',
    userId: 'u2',
    userName: 'Sarah Johnson',
    userEmail: 'sarah@bank.com',
    userType: 'external',
    resourceType: 'document',
    resourceName: 'Tax Returns 2024.pdf',
    projectId: 'p1',
    projectName: 'Marina Bay Acquisition',
    ipAddress: '10.0.0.45',
    timestamp: subDays(new Date(), 1),
  },
];

const ACTIVITY_CHART_DATA = [
  { name: 'Mon', views: 45, downloads: 12, uploads: 5 },
  { name: 'Tue', views: 52, downloads: 18, uploads: 8 },
  { name: 'Wed', views: 38, downloads: 15, uploads: 3 },
  { name: 'Thu', views: 65, downloads: 22, uploads: 10 },
  { name: 'Fri', views: 48, downloads: 14, uploads: 6 },
  { name: 'Sat', views: 12, downloads: 3, uploads: 0 },
  { name: 'Sun', views: 8, downloads: 2, uploads: 1 },
];

const USER_TYPE_DATA = [
  { name: 'Internal', value: 35, color: '#3b82f6' },
  { name: 'External', value: 65, color: '#10b981' },
];

const ACTION_DISTRIBUTION = [
  { name: 'Views', value: 156, color: '#6366f1' },
  { name: 'Downloads', value: 86, color: '#22c55e' },
  { name: 'Uploads', value: 33, color: '#f59e0b' },
  { name: 'Shares', value: 12, color: '#ec4899' },
];

function getActionIcon(action: ActivityItem['action']) {
  const icons: Record<ActivityItem['action'], JSX.Element> = {
    view: <Eye className="h-4 w-4 text-blue-600" />,
    download: <Download className="h-4 w-4 text-green-600" />,
    upload: <Upload className="h-4 w-4 text-amber-600" />,
    share: <Share2 className="h-4 w-4 text-pink-600" />,
    create_folder: <FolderPlus className="h-4 w-4 text-indigo-600" />,
    delete: <Trash2 className="h-4 w-4 text-red-600" />,
    edit: <Edit className="h-4 w-4 text-orange-600" />,
    permission_change: <ShieldCheck className="h-4 w-4 text-purple-600" />,
    user_added: <UserPlus className="h-4 w-4 text-teal-600" />,
  };
  return icons[action];
}

function getActionLabel(action: ActivityItem['action']) {
  const labels: Record<ActivityItem['action'], string> = {
    view: 'Viewed',
    download: 'Downloaded',
    upload: 'Uploaded',
    share: 'Shared',
    create_folder: 'Created folder',
    delete: 'Deleted',
    edit: 'Edited',
    permission_change: 'Changed permissions',
    user_added: 'Added user',
  };
  return labels[action];
}

export default function VDRActivityDashboard() {
  const [timeRange, setTimeRange] = useState('7d');
  const [activeTab, setActiveTab] = useState('timeline');
  const [filterProject, setFilterProject] = useState('all');
  const [filterUserType, setFilterUserType] = useState('all');

  const { data: activities, isLoading } = useQuery<ActivityItem[]>({
    queryKey: ['/api/vdr/activity', timeRange],
    queryFn: async () => {
      await new Promise(resolve => setTimeout(resolve, 500));
      return SAMPLE_ACTIVITIES;
    },
  });

  const filteredActivities = activities?.filter(a => {
    if (filterProject !== 'all' && a.projectId !== filterProject) return false;
    if (filterUserType !== 'all' && a.userType !== filterUserType) return false;
    return true;
  });

  const viewCount = activities?.filter(a => a.action === 'view').length || 0;
  const downloadCount = activities?.filter(a => a.action === 'download').length || 0;
  const externalAccessCount = activities?.filter(a => a.userType === 'external').length || 0;
  const securityEventCount = activities?.filter(a => ['permission_change', 'user_added', 'share'].includes(a.action)).length || 0;

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Activity className="h-6 w-6 text-primary" />
            VDR Activity Dashboard
          </h1>
          <p className="text-muted-foreground">
            Monitor document access, downloads, and security events
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-[150px]">
              <Calendar className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="24h">Last 24 Hours</SelectItem>
              <SelectItem value="7d">Last 7 Days</SelectItem>
              <SelectItem value="30d">Last 30 Days</SelectItem>
              <SelectItem value="90d">Last 90 Days</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export Log
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Document Views</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Eye className="h-5 w-5 text-blue-600" />
              <span className="text-2xl font-bold">{viewCount}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              <TrendingUp className="h-3 w-3 inline text-green-600" /> +12% from last period
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Downloads</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Download className="h-5 w-5 text-green-600" />
              <span className="text-2xl font-bold">{downloadCount}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              <TrendingUp className="h-3 w-3 inline text-green-600" /> +8% from last period
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">External Access</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-amber-600" />
              <span className="text-2xl font-bold">{externalAccessCount}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              By {new Set(activities?.filter(a => a.userType === 'external').map(a => a.userId)).size} unique users
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Security Events</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-purple-600" />
              <span className="text-2xl font-bold">{securityEventCount}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Permission changes & shares
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Activity Over Time</CardTitle>
            <CardDescription>Document interactions by type</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={ACTIVITY_CHART_DATA}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="views" fill="#6366f1" name="Views" />
                <Bar dataKey="downloads" fill="#22c55e" name="Downloads" />
                <Bar dataKey="uploads" fill="#f59e0b" name="Uploads" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Access by User Type</CardTitle>
            <CardDescription>Internal vs External</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={USER_TYPE_DATA}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {USER_TYPE_DATA.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex justify-center gap-6 mt-2">
              {USER_TYPE_DATA.map(item => (
                <div key={item.name} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-sm">{item.name}: {item.value}%</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="timeline">Activity Timeline</TabsTrigger>
            <TabsTrigger value="users">User Activity</TabsTrigger>
            <TabsTrigger value="documents">Top Documents</TabsTrigger>
          </TabsList>
          <div className="flex items-center gap-2">
            <Select value={filterUserType} onValueChange={setFilterUserType}>
              <SelectTrigger className="w-[130px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="User Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Users</SelectItem>
                <SelectItem value="internal">Internal</SelectItem>
                <SelectItem value="external">External</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <TabsContent value="timeline" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>Complete audit trail of document interactions</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Action</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Resource</TableHead>
                    <TableHead>Project</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead>IP Address</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredActivities?.map((activity) => (
                    <TableRow key={activity.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getActionIcon(activity.action)}
                          <span className="font-medium">{getActionLabel(activity.action)}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{activity.userName}</div>
                          <div className="text-xs text-muted-foreground flex items-center gap-1">
                            {activity.userEmail}
                            <Badge variant={activity.userType === 'external' ? 'secondary' : 'outline'} className="ml-1 text-xs">
                              {activity.userType}
                            </Badge>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <span>{activity.resourceName}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">{activity.projectName}</span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm">
                          <Clock className="h-3 w-3 text-muted-foreground" />
                          {formatDistanceToNow(activity.timestamp, { addSuffix: true })}
                        </div>
                      </TableCell>
                      <TableCell>
                        <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                          {activity.ipAddress}
                        </code>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="users" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>User Activity Summary</CardTitle>
              <CardDescription>Activity breakdown by user</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-center">Views</TableHead>
                    <TableHead className="text-center">Downloads</TableHead>
                    <TableHead className="text-center">Uploads</TableHead>
                    <TableHead>Last Active</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell>
                      <div>
                        <div className="font-medium">John Smith</div>
                        <div className="text-xs text-muted-foreground">john@investor.com</div>
                      </div>
                    </TableCell>
                    <TableCell><Badge variant="secondary">External</Badge></TableCell>
                    <TableCell className="text-center">24</TableCell>
                    <TableCell className="text-center">8</TableCell>
                    <TableCell className="text-center">0</TableCell>
                    <TableCell>5 minutes ago</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>
                      <div>
                        <div className="font-medium">Sarah Johnson</div>
                        <div className="text-xs text-muted-foreground">sarah@bank.com</div>
                      </div>
                    </TableCell>
                    <TableCell><Badge variant="secondary">External</Badge></TableCell>
                    <TableCell className="text-center">45</TableCell>
                    <TableCell className="text-center">12</TableCell>
                    <TableCell className="text-center">0</TableCell>
                    <TableCell>15 minutes ago</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>
                      <div>
                        <div className="font-medium">Mike Wilson</div>
                        <div className="text-xs text-muted-foreground">mike@company.com</div>
                      </div>
                    </TableCell>
                    <TableCell><Badge variant="outline">Internal</Badge></TableCell>
                    <TableCell className="text-center">12</TableCell>
                    <TableCell className="text-center">5</TableCell>
                    <TableCell className="text-center">15</TableCell>
                    <TableCell>30 minutes ago</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documents" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Most Accessed Documents</CardTitle>
              <CardDescription>Documents with highest engagement</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Document</TableHead>
                    <TableHead>Project</TableHead>
                    <TableHead className="text-center">Views</TableHead>
                    <TableHead className="text-center">Downloads</TableHead>
                    <TableHead className="text-center">Unique Users</TableHead>
                    <TableHead>Last Accessed</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-red-600" />
                        <span className="font-medium">Financial Statements 2025.pdf</span>
                      </div>
                    </TableCell>
                    <TableCell>Marina Bay Acquisition</TableCell>
                    <TableCell className="text-center">89</TableCell>
                    <TableCell className="text-center">34</TableCell>
                    <TableCell className="text-center">12</TableCell>
                    <TableCell>5 minutes ago</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-green-600" />
                        <span className="font-medium">Rent Roll Summary.xlsx</span>
                      </div>
                    </TableCell>
                    <TableCell>Marina Bay Acquisition</TableCell>
                    <TableCell className="text-center">67</TableCell>
                    <TableCell className="text-center">28</TableCell>
                    <TableCell className="text-center">9</TableCell>
                    <TableCell>15 minutes ago</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-blue-600" />
                        <span className="font-medium">Environmental Assessment.pdf</span>
                      </div>
                    </TableCell>
                    <TableCell>Harbor Point DD</TableCell>
                    <TableCell className="text-center">45</TableCell>
                    <TableCell className="text-center">15</TableCell>
                    <TableCell className="text-center">6</TableCell>
                    <TableCell>30 minutes ago</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-amber-600" />
                        <span className="font-medium">Appraisal Report.pdf</span>
                      </div>
                    </TableCell>
                    <TableCell>Marina Bay Acquisition</TableCell>
                    <TableCell className="text-center">38</TableCell>
                    <TableCell className="text-center">22</TableCell>
                    <TableCell className="text-center">8</TableCell>
                    <TableCell>5 hours ago</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
