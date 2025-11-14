import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { FileText, Download, Upload, Eye, Users, TrendingUp } from "lucide-react";
import { format } from "date-fns";

type AnalyticsData = {
  summary: {
    totalDocuments: number;
    totalViews: number;
    totalDownloads: number;
    totalUploads: number;
    uniqueUsers: number;
  };
  topDocuments: Array<{
    documentId: string;
    documentName: string;
    viewCount: number;
    downloadCount: number;
    lastAccessed: string;
  }>;
  activityByDay: Array<{
    date: string;
    views: number;
    downloads: number;
    uploads: number;
  }>;
  userEngagement: Array<{
    userId: string;
    externalUserId: string | null;
    viewCount: number;
    downloadCount: number;
    totalDuration: number;
    lastActivity: string;
  }>;
};

type AnalyticsDashboardProps = {
  projectId: string;
};

export function AnalyticsDashboard({ projectId }: AnalyticsDashboardProps) {
  const { data: analytics, isLoading } = useQuery<AnalyticsData>({
    queryKey: [`/api/vdr/projects/${projectId}/analytics`],
    enabled: !!projectId,
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-96" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">No analytics data available</p>
      </div>
    );
  }

  const activityChartData = [...analytics.activityByDay]
    .reverse()
    .slice(-30)
    .map(day => ({
      date: format(new Date(day.date), "MMM dd"),
      Views: Number(day.views),
      Downloads: Number(day.downloads),
      Uploads: Number(day.uploads),
    }));

  return (
    <div className="space-y-6" data-testid="analytics-dashboard">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card data-testid="card-total-documents">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Documents</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.summary.totalDocuments}</div>
          </CardContent>
        </Card>

        <Card data-testid="card-total-views">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Views</CardTitle>
            <Eye className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.summary.totalViews}</div>
          </CardContent>
        </Card>

        <Card data-testid="card-total-downloads">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Downloads</CardTitle>
            <Download className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.summary.totalDownloads}</div>
          </CardContent>
        </Card>

        <Card data-testid="card-total-uploads">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Uploads</CardTitle>
            <Upload className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.summary.totalUploads}</div>
          </CardContent>
        </Card>

        <Card data-testid="card-unique-users">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.summary.uniqueUsers}</div>
          </CardContent>
        </Card>
      </div>

      <Card data-testid="card-activity-chart">
        <CardHeader>
          <CardTitle>Activity Over Time (Last 30 Days)</CardTitle>
          <CardDescription>Document views, downloads, and uploads by day</CardDescription>
        </CardHeader>
        <CardContent>
          {activityChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={activityChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="Views" stroke="#3b82f6" strokeWidth={2} />
                <Line type="monotone" dataKey="Downloads" stroke="#10b981" strokeWidth={2} />
                <Line type="monotone" dataKey="Uploads" stroke="#f59e0b" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-gray-500">
              No activity data available
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card data-testid="card-top-documents">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Most Viewed Documents
            </CardTitle>
            <CardDescription>Top 10 documents by views and downloads</CardDescription>
          </CardHeader>
          <CardContent>
            {analytics.topDocuments.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Document</TableHead>
                    <TableHead className="text-right">Views</TableHead>
                    <TableHead className="text-right">Downloads</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {analytics.topDocuments.map((doc, index) => (
                    <TableRow key={doc.documentId} data-testid={`top-document-${index}`}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-gray-400" />
                          <span className="truncate max-w-[250px]" title={doc.documentName}>
                            {doc.documentName || 'Unnamed Document'}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">{doc.viewCount}</TableCell>
                      <TableCell className="text-right">{doc.downloadCount}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-8 text-gray-500">No document activity yet</div>
            )}
          </CardContent>
        </Card>

        <Card data-testid="card-user-engagement">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              User Engagement
            </CardTitle>
            <CardDescription>User activity and engagement metrics</CardDescription>
          </CardHeader>
          <CardContent>
            {analytics.userEngagement.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead className="text-right">Views</TableHead>
                    <TableHead className="text-right">Downloads</TableHead>
                    <TableHead className="text-right">Last Active</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {analytics.userEngagement.slice(0, 10).map((user, index) => (
                    <TableRow key={user.userId || user.externalUserId} data-testid={`user-engagement-${index}`}>
                      <TableCell className="font-medium">
                        {user.externalUserId ? "External User" : "Internal User"}
                      </TableCell>
                      <TableCell className="text-right">{user.viewCount}</TableCell>
                      <TableCell className="text-right">{user.downloadCount}</TableCell>
                      <TableCell className="text-right text-sm text-gray-600">
                        {format(new Date(user.lastActivity), "MMM dd, yyyy")}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-8 text-gray-500">No user activity yet</div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
