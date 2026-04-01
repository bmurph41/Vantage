/**
 * IC Deck Preview — full-screen HTML preview with section navigation
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, AlertCircle } from 'lucide-react';

interface ICDeckPreviewProps {
  dealId: string;
  projectId?: string;
  sections?: string[];
}

interface PreviewData {
  html: string;
  sections: Array<{
    key: string;
    title: string;
    enabled: boolean;
    html: string;
    unresolvedTokens: string[];
  }>;
  tokenSummary: {
    total: number;
    resolved: number;
    unresolved: number;
    unresolvedList: string[];
  };
}

export default function ICDeckPreview({ dealId, projectId, sections }: ICDeckPreviewProps) {
  const [activeSection, setActiveSection] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery<PreviewData>({
    queryKey: ['/api/document-builder/ic-deck/preview', dealId, projectId, sections],
    queryFn: () => {
      let url = `/api/document-builder/ic-deck/preview/${dealId}`;
      const params = new URLSearchParams();
      if (projectId) params.set('projectId', projectId);
      if (sections?.length) params.set('sections', sections.join(','));
      const qs = params.toString();
      return apiRequest('GET', qs ? `${url}?${qs}` : url);
    },
    enabled: !!dealId,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin mr-2" />
        <span>Loading preview...</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center py-12 text-red-600">
        <AlertCircle className="h-5 w-5 mr-2" />
        <span>Failed to load preview</span>
      </div>
    );
  }

  return (
    <div className="flex h-full gap-4">
      {/* Section sidebar */}
      <div className="w-48 flex-shrink-0">
        <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">Sections</p>
        <ScrollArea className="h-[60vh]">
          <div className="space-y-1">
            {data.sections.map((s) => (
              <Button
                key={s.key}
                variant={activeSection === s.key ? 'secondary' : 'ghost'}
                size="sm"
                className="w-full justify-start text-xs h-auto py-1.5"
                onClick={() => setActiveSection(s.key)}
              >
                <span className="truncate">{s.title}</span>
                {s.unresolvedTokens.length > 0 && (
                  <Badge variant="outline" className="ml-auto text-[9px] px-1">
                    {s.unresolvedTokens.length}
                  </Badge>
                )}
              </Button>
            ))}
          </div>
        </ScrollArea>
        <div className="mt-3 text-xs text-muted-foreground">
          <p>{data.tokenSummary.resolved}/{data.tokenSummary.total} tokens resolved</p>
          {data.tokenSummary.unresolved > 0 && (
            <p className="text-amber-600">{data.tokenSummary.unresolved} unresolved</p>
          )}
        </div>
      </div>

      {/* Preview content */}
      <div className="flex-1 bg-gray-100 rounded-md overflow-hidden">
        <iframe
          srcDoc={data.html}
          className="w-full h-[70vh] border-0"
          title="IC Deck Preview"
        />
      </div>
    </div>
  );
}
