import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Folder, FileText } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

type DuplicateItem = {
  id: string;
  path?: string;
  name?: string;
  createdAt?: string;
  uploadedAt?: string;
  size?: number;
};

type Duplicate = {
  type: 'folder' | 'document';
  name: string;
  folderPath?: string;
  count: number;
  items: DuplicateItem[];
};

type DuplicateReport = {
  folders: Duplicate[];
  documents: Duplicate[];
  totalFolderDuplicates: number;
  totalDocumentDuplicates: number;
};

type DuplicateDetectorProps = {
  projectId: string;
};

export function DuplicateDetector({ projectId }: DuplicateDetectorProps) {
  const { data: report, isLoading } = useQuery<DuplicateReport>({
    queryKey: [`/api/vdr/projects/${projectId}/duplicates`],
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    );
  }

  const hasDuplicates = report && (report.folders.length > 0 || report.documents.length > 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-orange-600" />
          Duplicate Detection
        </CardTitle>
        <CardDescription>
          {hasDuplicates
            ? `Found ${report.totalFolderDuplicates} folder and ${report.totalDocumentDuplicates} document conflicts`
            : "No duplicates detected"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!hasDuplicates ? (
          <div className="text-center py-8 text-gray-500 text-sm">
            ✓ No duplicate folder or document names found
          </div>
        ) : (
          <div className="space-y-6">
            {report.folders.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <Folder className="h-4 w-4 text-blue-600" />
                  Duplicate Folders ({report.folders.length})
                </h4>
                <div className="space-y-3">
                  {report.folders.map((dup, idx) => (
                    <Card key={idx} className="border-orange-200 bg-orange-50">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-2">
                          <span className="font-medium text-sm">{dup.name}</span>
                          <Badge variant="destructive" className="text-xs">
                            {dup.count} duplicates
                          </Badge>
                        </div>
                        <div className="space-y-1">
                          {dup.items.map((item) => (
                            <div
                              key={item.id}
                              className="text-xs font-mono text-gray-600 bg-white p-2 rounded"
                            >
                              {item.path}
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {report.documents.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <FileText className="h-4 w-4 text-green-600" />
                  Duplicate Documents ({report.documents.length})
                </h4>
                <div className="space-y-3">
                  {report.documents.map((dup, idx) => (
                    <Card key={idx} className="border-orange-200 bg-orange-50">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <span className="font-medium text-sm">{dup.name}</span>
                            <div className="text-xs text-gray-600 font-mono mt-1">
                              in: {dup.folderPath}
                            </div>
                          </div>
                          <Badge variant="destructive" className="text-xs">
                            {dup.count} duplicates
                          </Badge>
                        </div>
                        <div className="text-xs text-gray-500 mt-2">
                          {dup.items.length} identical file names in this folder
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
