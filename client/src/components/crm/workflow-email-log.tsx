import { useState } from "react";
import DOMPurify from "dompurify";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Mail, Search, ChevronDown, ChevronUp, AlertCircle } from "lucide-react";

interface EmailLogEntry {
  id: string;
  orgId: string;
  ruleId: string | null;
  executionId: string | null;
  templateId: string | null;
  recipientEmail: string;
  recipientName: string | null;
  recipientType: string;
  subject: string;
  bodyPreview: string | null;
  status: string;
  provider: string | null;
  providerId: string | null;
  errorMessage: string | null;
  sentAt: string | null;
  createdAt: string;
}

export default function WorkflowEmailLog() {
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const pageSize = 20;

  const { data, isLoading } = useQuery<{ logs: EmailLogEntry[]; total: number }>({
    queryKey: ['/api/workflow-email/logs', statusFilter, search, page],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (search) params.set('recipientEmail', search);
      params.set('limit', String(pageSize));
      params.set('offset', String(page * pageSize));
      const res = await fetch(`/api/workflow-email/logs?${params}`);
      if (!res.ok) throw new Error('Failed to fetch logs');
      return res.json();
    },
  });

  const logs = data?.logs || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / pageSize);

  const statusBadge = (status: string) => {
    switch (status) {
      case 'sent': return <Badge className="bg-green-100 text-green-800 text-xs">Sent</Badge>;
      case 'failed': return <Badge className="bg-red-100 text-red-800 text-xs">Failed</Badge>;
      case 'pending': return <Badge className="bg-yellow-100 text-yellow-800 text-xs">Pending</Badge>;
      case 'bounced': return <Badge className="bg-orange-100 text-orange-800 text-xs">Bounced</Badge>;
      default: return <Badge variant="secondary" className="text-xs">{status}</Badge>;
    }
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Mail className="w-5 h-5" />
          Email Log
          {total > 0 && <Badge variant="secondary" className="text-xs">{total}</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search by recipient..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(0); }}>
            <SelectTrigger className="w-[130px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="sent">Sent</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1,2,3].map(i => <div key={i} className="h-14 bg-gray-50 rounded animate-pulse" />)}
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Mail className="w-10 h-10 mx-auto mb-3 text-gray-300" />
            <p>No email logs found</p>
          </div>
        ) : (
          <div className="divide-y">
            {logs.map((log) => (
              <div key={log.id} className="py-2">
                <div
                  className="flex items-center justify-between cursor-pointer hover:bg-gray-50 rounded px-2 py-1"
                  onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate">{log.recipientEmail}</span>
                      {statusBadge(log.status)}
                      <span className="text-xs text-gray-400">{log.recipientType}</span>
                    </div>
                    <p className="text-xs text-gray-500 truncate">{log.subject}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400">{formatDate(log.createdAt)}</span>
                    {expandedId === log.id ? (
                      <ChevronUp className="w-4 h-4 text-gray-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-gray-400" />
                    )}
                  </div>
                </div>
                {expandedId === log.id && (
                  <div className="mt-2 mx-2 p-3 bg-gray-50 rounded-lg text-sm space-y-2">
                    {log.bodyPreview && (
                      <div>
                        <span className="text-xs font-medium text-gray-600">Body Preview:</span>
                        <div className="text-xs text-gray-500 mt-1 line-clamp-3" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(log.bodyPreview) }} />
                      </div>
                    )}
                    {log.errorMessage && (
                      <div className="flex items-start gap-2 text-red-600">
                        <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                        <span className="text-xs">{log.errorMessage}</span>
                      </div>
                    )}
                    <div className="flex gap-4 text-xs text-gray-400">
                      {log.provider && <span>Provider: {log.provider}</span>}
                      {log.sentAt && <span>Sent: {new Date(log.sentAt).toLocaleString()}</span>}
                      {log.ruleId && <span>Rule: {log.ruleId.slice(0, 8)}...</span>}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4 pt-3 border-t">
            <span className="text-xs text-gray-500">
              Showing {page * pageSize + 1}-{Math.min((page + 1) * pageSize, total)} of {total}
            </span>
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 0}
                onClick={() => setPage(p => p - 1)}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages - 1}
                onClick={() => setPage(p => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
