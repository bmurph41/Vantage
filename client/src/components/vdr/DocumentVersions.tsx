import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  GitBranch, FileText, Loader2, Eye, ArrowRightLeft, CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { format } from "date-fns";

interface DocumentVersionsProps {
  documentId: string;
}

interface VersionEntry {
  id: string;
  filename: string;
  originalFilename: string;
  version: number;
  isCurrentVersion: boolean;
  size: number;
  mimeType: string;
  checksum: string;
  uploadedBy: string;
  uploadedByName: string;
  description: string | null;
  aiSummary: string | null;
  aiCategory: string | null;
  createdAt: string;
}

interface VersionsData {
  documentId: string;
  currentVersion: VersionEntry;
  versions: VersionEntry[];
  totalVersions: number;
}

interface CompareData {
  version1: { id: string; version: number; filename: string; createdAt: string };
  version2: { id: string; version: number; filename: string; createdAt: string };
  diff: Record<string, { v1: any; v2: any; changed: boolean }>;
  contentChanged: boolean;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function DocumentVersions({ documentId }: DocumentVersionsProps) {
  const [selectedVersions, setSelectedVersions] = useState<string[]>([]);
  const [showCompare, setShowCompare] = useState(false);

  const { data, isLoading } = useQuery<VersionsData>({
    queryKey: [`/api/vdr/documents/${documentId}/versions`],
    enabled: !!documentId,
  });

  const compareIds = selectedVersions.length === 2 ? selectedVersions : null;
  const { data: compareData, isLoading: compareLoading } = useQuery<CompareData>({
    queryKey: [`/api/vdr/documents/${compareIds?.[0]}/compare/${compareIds?.[1]}`],
    enabled: !!compareIds && showCompare,
  });

  function toggleVersion(id: string) {
    setSelectedVersions(prev => {
      if (prev.includes(id)) return prev.filter(v => v !== id);
      if (prev.length >= 2) return [prev[1], id];
      return [...prev, id];
    });
  }

  function handleCompare() {
    if (selectedVersions.length === 2) {
      setShowCompare(true);
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <Loader2 className="h-5 w-5 animate-spin mx-auto text-gray-400" />
        </CardContent>
      </Card>
    );
  }

  if (!data || data.versions.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-gray-500">
          <FileText className="h-8 w-8 mx-auto mb-2 text-gray-300" />
          <p className="text-sm">No version history available</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <GitBranch className="h-4 w-4 text-violet-500" />
              Version History
              <Badge variant="secondary" className="text-xs">{data.totalVersions} version{data.totalVersions !== 1 ? "s" : ""}</Badge>
            </CardTitle>
            {selectedVersions.length === 2 && (
              <Button size="sm" variant="outline" onClick={handleCompare}>
                <ArrowRightLeft className="h-3.5 w-3.5 mr-1" />
                Compare Selected
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10"></TableHead>
                <TableHead>Version</TableHead>
                <TableHead>Uploaded By</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Size</TableHead>
                <TableHead>Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.versions.map((v) => (
                <TableRow key={v.id} className={v.isCurrentVersion ? "bg-blue-50/30" : ""}>
                  <TableCell>
                    <Checkbox
                      checked={selectedVersions.includes(v.id)}
                      onCheckedChange={() => toggleVersion(v.id)}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">v{v.version}</span>
                      {v.isCurrentVersion && (
                        <Badge className="bg-green-100 text-green-700 text-[10px]">Current</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-gray-600">{v.uploadedByName}</TableCell>
                  <TableCell className="text-sm text-gray-600">
                    {format(new Date(v.createdAt), "MM/dd/yyyy h:mm a")}
                  </TableCell>
                  <TableCell className="text-sm text-gray-600">{formatFileSize(v.size)}</TableCell>
                  <TableCell className="text-sm text-gray-500 max-w-[200px] truncate">
                    {v.description || v.aiSummary || <span className="text-gray-400">--</span>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {selectedVersions.length < 2 && data.versions.length > 1 && (
            <p className="text-xs text-gray-400 mt-2 text-center">
              Select two versions to compare
            </p>
          )}
        </CardContent>
      </Card>

      {/* Compare Dialog */}
      <Dialog open={showCompare} onOpenChange={setShowCompare}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowRightLeft className="h-4 w-4" />
              Version Comparison
            </DialogTitle>
          </DialogHeader>
          {compareLoading ? (
            <div className="py-8 text-center">
              <Loader2 className="h-6 w-6 animate-spin mx-auto text-gray-400" />
            </div>
          ) : compareData ? (
            <div className="space-y-4 py-2">
              {/* Version labels */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-blue-50 p-3 rounded-lg">
                  <p className="text-xs text-blue-600 font-medium">Version {compareData.version1.version}</p>
                  <p className="text-sm font-medium">{compareData.version1.filename}</p>
                  <p className="text-xs text-gray-500">{format(new Date(compareData.version1.createdAt), "MM/dd/yyyy")}</p>
                </div>
                <div className="bg-purple-50 p-3 rounded-lg">
                  <p className="text-xs text-purple-600 font-medium">Version {compareData.version2.version}</p>
                  <p className="text-sm font-medium">{compareData.version2.filename}</p>
                  <p className="text-xs text-gray-500">{format(new Date(compareData.version2.createdAt), "MM/dd/yyyy")}</p>
                </div>
              </div>

              {/* Content change indicator */}
              <div className={`flex items-center gap-2 p-3 rounded-lg ${
                compareData.contentChanged ? "bg-amber-50 border border-amber-200" : "bg-green-50 border border-green-200"
              }`}>
                {compareData.contentChanged ? (
                  <>
                    <AlertCircle className="h-4 w-4 text-amber-500" />
                    <span className="text-sm font-medium text-amber-700">File content has changed</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <span className="text-sm font-medium text-green-700">File content is identical</span>
                  </>
                )}
              </div>

              {/* Metadata diff */}
              <div>
                <h4 className="text-sm font-semibold text-gray-500 uppercase mb-2">Metadata Differences</h4>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Field</TableHead>
                      <TableHead>Version {compareData.version1.version}</TableHead>
                      <TableHead>Version {compareData.version2.version}</TableHead>
                      <TableHead className="w-20">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Object.entries(compareData.diff).map(([key, val]) => (
                      <TableRow key={key} className={val.changed ? "bg-amber-50/30" : ""}>
                        <TableCell className="font-medium text-sm capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</TableCell>
                        <TableCell className="text-sm text-gray-600 max-w-[180px] truncate">
                          {val.v1 != null ? String(val.v1) : "--"}
                        </TableCell>
                        <TableCell className="text-sm text-gray-600 max-w-[180px] truncate">
                          {val.v2 != null ? String(val.v2) : "--"}
                        </TableCell>
                        <TableCell>
                          {val.changed ? (
                            <Badge variant="outline" className="text-xs text-amber-600 border-amber-300">Changed</Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs text-green-600 border-green-300">Same</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          ) : (
            <div className="py-8 text-center text-gray-500">
              <p className="text-sm">Unable to compare versions</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
