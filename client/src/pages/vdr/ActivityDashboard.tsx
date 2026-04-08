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
  Filter,
  Calendar
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

interface ActivityItem {
  id: string;
  action: 'view' | 'download' | 'upload' | 'document_uploaded' | 'share' | 'create_folder' | 'delete' | 'edit' | 'permission_change' | 'user_added';
  userId: string;
  userName: string;
  userEmail: string;
  userType: 'internal' | 'external';
  resourceType: 'document' | 'folder';
  resourceName: string;
  projectId: string;
  projectName: string;
  ipAddress: string;
  timestamp: string;
  details?: string;
}

interface MetricsData {
  views: number;
  downloads: number;
  externalAccess: number;
  securityEvents: number;
}

interface ChartDataPoint {
  name: string;
  views: number;
  downloads: number;
  uploads: number;
}

interface UserSummaryItem {
  userId: string;
  userName: string;
  userEmail: string;
  userType: 'internal' | 'external';
  views: number;
  downloads: number;
  uploads: number;
  lastActive: string;
}

interface DocumentSummaryItem {
  documentId: string;
  documentName: string;
  projectName: string;
  views: number;
  downloads: number;
  uniqueUsers: number;
  lastAccessed: string;
}

const USER_TYPE_COLORS = {
  internal: '#3b82f6',
  external: '#10b981',
};

function getActionIcon(action: ActivityItem['action']) {
  const icons: Record<ActivityItem['action'], JSX.Element> = {
    view: <Eye className="h-4 w-4 text-blue-600" />,
    download: <Download className="h-4 w-4 text-green-600" />,
    upload: <Upload className="h-4 w-4 text-amber-600" />,
    document_uploaded: <Upload className="h-4 w-4 text-amber-600" />,
    share: <Share2 className="h-4 w-4 text-pink-600" />,
    create_folder: <FolderPlus className="h-4 w-4 text-indigo-600" />,
    delete: <Trash2 className="h-4 w-4 text-red-600" />,
    edit: <Edit className="h-4 w-4 text-orange-600" />,
    permission_change: <ShieldCheck className="h-4 w-4 text-purple-600" />,
    user_added: <UserPlus className="h-4 w-4 text-teal-600" />,
  };
  return icons[action] ?? <Activity className="h-4 w-4 text-muted-foreground" />;
}

function getActionLabel(action: ActivityItem['action']) {
  const labels: Record<ActivityItem['action'], string> = {
    view: 'Viewed',
    download: 'Downloaded',
    upload: 'Uploaded',
    document_uploaded: 'Uploaded',
    share: 'Shared',
    create_folder: 'Created folder',
    delete: 'Deleted',
    edit: 'Edited',
    permission_change: 'Changed permissions',
    user_added: 'Added user',
  };
  return labels[action] ?? action;
}

export default function VDRActivityDashboard() {
  const [timeRange, setTimeRange] = useState('7d');
  const [activeTab, setActiveTab] = useState('timeline');
  const [filterUserType, setFilterUserType] = useState('all');

  async function fetchJson(url: string) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Request failed: ${res.status} ${res.statusText}`);
    return res.json();
  }

  const { data: activities, isLoading: activitiesLoading } = useQuery<ActivityItem[]>({
    queryKey: ['/api/vdr/activity', timeRange, filterUserType],
    queryFn: () => fetchJson(`/api/vdr/activity?timeRange=${timeRange}&userType=${filterUserType}`),
  });

  const { data: metrics, isLoading: metricsLoading } = useQuery<MetricsData>({
    queryKey: ['/api/vdr/activity/metrics', timeRange],
    queryFn: () => fetchJson(`/api/vdr/activity/metrics?timeRange=${timeRange}`),
  });

  const { data: chartData, isLoading: chartLoading } = useQuery<ChartDataPoint[]>({
    queryKey: ['/api/vdr/activity/chart', timeRange],
    queryFn: () => fetchJson(`/api/vdr/activity/chart?timeRange=${timeRange}`),
  });

  const { data: userSummary, isLoading: userSummaryLoading } = useQuery<UserSummaryItem[]>({
    queryKey: ['/api/vdr/activity/user-summary', timeRange],
    queryFn: () => fetchJson(`/api/vdr/activity/user-summary?timeRange=${timeRange}`),
  });

  const { data: documentSummary, isLoading: documentSummaryLoading } = useQuery<DocumentSummaryItem[]>({
    queryKey: ['/api/vdr/activity/document-summary', timeRange],
    queryFn: () => fetchJson(`/api/vdr/activity/document-summary?timeRange=${timeRange}`),
  });

  const internalCount = activities?.filter(a => a.userType === 'internal').length ?? 0;
  const externalCount = activities?.filter(a => a.userType === 'external').length ?? 0;
  const total = internalCount + externalCount;

  const userTypePieData = total > 0
    ? [
        { name: 'Internal', value: Math.round((internalCount / total) * 100), color: USER_TYPE_COLORS.internal },
        { name: 'External', value: Math.round((externalCount / total) * 100), color: USER_TYPE_COLORS.external },
      ]
    : [];

  const isPageLoading = activitiesLoading || metricsLoading;

  if (isPageLoading) {
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
              {metricsLoading
                ? <Skeleton className="h-8 w-12" />
                : <span className="text-2xl font-bold">{metrics?.views ?? 0}</span>
              }
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              <TrendingUp className="h-3 w-3 inline text-green-600" /> Total in period
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
              {metricsLoading
                ? <Skeleton className="h-8 w-12" />
                : <span className="text-2xl font-bold">{metrics?.downloads ?? 0}</span>
              }
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              <TrendingUp className="h-3 w-3 inline text-green-600" /> Total in period
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
              {metricsLoading
                ? <Skeleton className="h-8 w-12" />
                : <span className="text-2xl font-bold">{metrics?.externalAccess ?? 0}</span>
              }
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              External user events in period
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
              {metricsLoading
                ? <Skeleton className="h-8 w-12" />
                : <span className="text-2xl font-bold">{metrics?.securityEvents ?? 0}</span>
              }
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Permission changes &amp; shares
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
            {chartLoading ? (
              <Skeleton className="h-[250px] w-full" />
            ) : chartData && chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="views" fill="#6366f1" name="Views" />
                  <Bar dataKey="downloads" fill="#22c55e" name="Downloads" />
                  <Bar dataKey="uploads" fill="#f59e0b" name="Uploads" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-muted-foreground text-sm">
                No chart data available for this period
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Access by User Type</CardTitle>
            <CardDescription>Internal vs External</CardDescription>
          </CardHeader>
          <CardContent>
            {activitiesLoading ? (
              <Skeleton className="h-[200px] w-full" />
            ) : userTypePieData.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={userTypePieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {userTypePieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex justify-center gap-6 mt-2">
                  {userTypePieData.map(item => (
                    <div key={item.name} className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="text-sm">{item.name}: {item.value}%</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">
                No activity data available
              </div>
            )}
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
              {activitiesLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-12 w-full" />)}
                </div>
              ) : !activities || activities.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <Activity className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-lg font-medium text-muted-foreground">No VDR activity recorded yet.</p>
                  <p className="text-sm text-muted-foreground mt-1">Share documents with counterparties to begin tracking access.</p>
                </div>
              ) : (
                <div className="overflow-x-auto w-full">
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
                    {activities.map((activity) => (
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
                            {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}
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
                </div>
              )}
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
              {userSummaryLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
                </div>
              ) : !userSummary || userSummary.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <Users className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-lg font-medium text-muted-foreground">No user activity recorded yet.</p>
                  <p className="text-sm text-muted-foreground mt-1">Invite counterparties and track their engagement here.</p>
                </div>
              ) : (
                <div className="overflow-x-auto w-full">
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
                    {userSummary.map((user) => (
                      <TableRow key={user.userId}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{user.userName}</div>
                            <div className="text-xs text-muted-foreground">{user.userEmail}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={user.userType === 'external' ? 'secondary' : 'outline'}>
                            {user.userType === 'external' ? 'External' : 'Internal'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">{user.views}</TableCell>
                        <TableCell className="text-center">{user.downloads}</TableCell>
                        <TableCell className="text-center">{user.uploads}</TableCell>
                        <TableCell>
                          {formatDistanceToNow(new Date(user.lastActive), { addSuffix: true })}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                </div>
              )}
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
              {documentSummaryLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-12 w-full" />)}
                </div>
              ) : !documentSummary || documentSummary.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-lg font-medium text-muted-foreground">No documents have been accessed yet.</p>
                  <p className="text-sm text-muted-foreground mt-1">Share documents with investors to start tracking access.</p>
                </div>
              ) : (
                <div className="overflow-x-auto w-full">
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
                    {documentSummary.map((doc) => (
                      <TableRow key={doc.documentId}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">{doc.documentName}</span>
                          </div>
                        </TableCell>
                        <TableCell>{doc.projectName}</TableCell>
                        <TableCell className="text-center">{doc.views}</TableCell>
                        <TableCell className="text-center">{doc.downloads}</TableCell>
                        <TableCell className="text-center">{doc.uniqueUsers}</TableCell>
                        <TableCell>
                          {formatDistanceToNow(new Date(doc.lastAccessed), { addSuffix: true })}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
