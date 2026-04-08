import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ExportPdfButton } from "@/components/ui/export-pdf-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { SkeletonTableRows } from "@/components/ui/skeleton-variants";
import { Plus, Search, MoreHorizontal, FileSpreadsheet, Calculator, Trash2, Eye, Pencil, Building, Anchor, Ship, Target } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import SubjectMarinaDialog from "./SubjectMarinaDialog";
import CompSetDialog from "./CompSetDialog";

interface MarinaSubject {
  id: string;
  name: string;
  address?: string;
  city?: string;
  state?: string;
  slipsTotal?: number;
  racksTotal?: number;
  capacityIndex?: string;
  qualityTier?: string;
  createdAt?: string;
}

interface CompSet {
  id: string;
  name: string;
  compType: 'RATE' | 'SALES';
  subjectId?: string;
  status?: string;
  lastComputedAt?: string;
  lastComputeResult?: {
    indicatedWetRate?: number;
    indicatedRackRate?: number;
    indicatedPricePerSlip?: number;
    indicatedTotalValue?: number;
    compsUsed?: number;
  };
  createdAt?: string;
}

export default function MarinaCompsIndex() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const reportRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState("subjects");
  const [searchQuery, setSearchQuery] = useState("");
  const [showSubjectDialog, setShowSubjectDialog] = useState(false);
  const [showCompSetDialog, setShowCompSetDialog] = useState(false);
  const [editingSubject, setEditingSubject] = useState<MarinaSubject | null>(null);
  const [editingCompSet, setEditingCompSet] = useState<CompSet | null>(null);

  const { data: subjects = [], isLoading: subjectsLoading } = useQuery<MarinaSubject[]>({
    queryKey: ['/api/marina-comps/subjects', searchQuery],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchQuery) params.set('search', searchQuery);
      const res = await fetch(`/api/marina-comps/subjects?${params}`);
      if (!res.ok) throw new Error('Failed to fetch subjects');
      return res.json();
    },
  });

  const { data: compSets = [], isLoading: compSetsLoading } = useQuery<CompSet[]>({
    queryKey: ['/api/marina-comps/sets'],
    queryFn: async () => {
      const res = await fetch('/api/marina-comps/sets');
      if (!res.ok) throw new Error('Failed to fetch comp sets');
      return res.json();
    },
  });

  const deleteSubjectMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/marina-comps/subjects/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete subject');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/marina-comps/subjects'] });
      toast({ title: "Subject marina deleted" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteCompSetMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/marina-comps/sets/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete comp set');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/marina-comps/sets'] });
      toast({ title: "Comp set deleted" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const computeCompSetMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/marina-comps/sets/${id}/compute`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed to compute comp set');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/marina-comps/sets'] });
      toast({ title: "Comp set computed successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const exportCompSetMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/marina-comps/sets/${id}/export/excel`, { 
        method: 'POST',
      });
      if (!res.ok) throw new Error('Failed to export comp set');
      
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `comp-pack-${id}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    },
    onSuccess: () => {
      toast({ title: "Comp pack exported" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleEditSubject = (subject: MarinaSubject) => {
    setEditingSubject(subject);
    setShowSubjectDialog(true);
  };

  const handleEditCompSet = (compSet: CompSet) => {
    setEditingCompSet(compSet);
    setShowCompSetDialog(true);
  };

  const handleCloseSubjectDialog = () => {
    setShowSubjectDialog(false);
    setEditingSubject(null);
  };

  const handleCloseCompSetDialog = () => {
    setShowCompSetDialog(false);
    setEditingCompSet(null);
  };

  return (
    <div className="flex flex-col h-full" ref={reportRef}>
      <div className="flex-none border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 items-center justify-between">
          <div className="flex items-center gap-4">
            <Anchor className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-semibold">Marina Comps Engine</h1>
          </div>
          <ExportPdfButton contentRef={reportRef} filename="marina-comps" title="Marina Comparables Analysis" />
        </div>
      </div>

      <div className="flex-1 container py-6 overflow-auto">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <div className="flex items-center justify-between">
            <TabsList>
              <TabsTrigger value="subjects" className="gap-2">
                <Target className="h-4 w-4" />
                Subject Marinas
              </TabsTrigger>
              <TabsTrigger value="compsets" className="gap-2">
                <Calculator className="h-4 w-4" />
                Comp Sets
              </TabsTrigger>
            </TabsList>

            {activeTab === "subjects" && (
              <Button onClick={() => setShowSubjectDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                New Subject
              </Button>
            )}
            {activeTab === "compsets" && (
              <Button onClick={() => setShowCompSetDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                New Comp Set
              </Button>
            )}
          </div>

          <TabsContent value="subjects" className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search subject marinas..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Subject Marinas</CardTitle>
                <CardDescription>Target marinas for comparable analysis</CardDescription>
              </CardHeader>
              <CardContent>
                {subjectsLoading ? (
                  <SkeletonTableRows rows={5} columns={7} />
                ) : subjects.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Building className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No subject marinas found</p>
                    <p className="text-sm mt-2">Create a subject marina to start building comp sets</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto w-full">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Location</TableHead>
                        <TableHead className="text-right">Wet Slips</TableHead>
                        <TableHead className="text-right">Dry Racks</TableHead>
                        <TableHead className="text-right">Cap Index</TableHead>
                        <TableHead>Quality</TableHead>
                        <TableHead className="w-[70px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {subjects.map((subject) => (
                        <TableRow key={subject.id}>
                          <TableCell className="font-medium">{subject.name}</TableCell>
                          <TableCell>
                            {subject.city && subject.state ? `${subject.city}, ${subject.state}` : subject.state || '-'}
                          </TableCell>
                          <TableCell className="text-right">{subject.slipsTotal ?? '-'}</TableCell>
                          <TableCell className="text-right">{subject.racksTotal ?? '-'}</TableCell>
                          <TableCell className="text-right">
                            {subject.capacityIndex ? parseFloat(subject.capacityIndex).toFixed(1) : '-'}
                          </TableCell>
                          <TableCell>
                            {subject.qualityTier && (
                              <Badge variant="outline">{subject.qualityTier}</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleEditSubject(subject)}>
                                  <Pencil className="h-4 w-4 mr-2" />
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  onClick={() => deleteSubjectMutation.mutate(subject.id)}
                                  className="text-destructive"
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
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

          <TabsContent value="compsets" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Comp Sets</CardTitle>
                <CardDescription>Saved comparable configurations with similarity scoring</CardDescription>
              </CardHeader>
              <CardContent>
                {compSetsLoading ? (
                  <SkeletonTableRows rows={5} columns={7} />
                ) : compSets.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Ship className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No comp sets found</p>
                    <p className="text-sm mt-2">Create a comp set to start analyzing comparables</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto w-full">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Comps Used</TableHead>
                        <TableHead>Indicated Value</TableHead>
                        <TableHead>Last Computed</TableHead>
                        <TableHead className="w-[70px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {compSets.map((compSet) => (
                        <TableRow key={compSet.id}>
                          <TableCell className="font-medium">{compSet.name}</TableCell>
                          <TableCell>
                            <Badge variant={compSet.compType === 'RATE' ? 'default' : 'secondary'}>
                              {compSet.compType}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={compSet.status === 'computed' ? 'default' : 'outline'}>
                              {compSet.status || 'draft'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            {compSet.lastComputeResult?.compsUsed ?? '-'}
                          </TableCell>
                          <TableCell>
                            {compSet.compType === 'RATE' ? (
                              compSet.lastComputeResult?.indicatedWetRate 
                                ? `$${compSet.lastComputeResult.indicatedWetRate.toLocaleString()}/ft`
                                : '-'
                            ) : (
                              compSet.lastComputeResult?.indicatedPricePerSlip
                                ? `$${compSet.lastComputeResult.indicatedPricePerSlip.toLocaleString()}/slip`
                                : '-'
                            )}
                          </TableCell>
                          <TableCell>
                            {compSet.lastComputedAt 
                              ? new Date(compSet.lastComputedAt).toLocaleDateString()
                              : '-'
                            }
                          </TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleEditCompSet(compSet)}>
                                  <Eye className="h-4 w-4 mr-2" />
                                  View Details
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => computeCompSetMutation.mutate(compSet.id)}>
                                  <Calculator className="h-4 w-4 mr-2" />
                                  Compute
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => exportCompSetMutation.mutate(compSet.id)}>
                                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                                  Export Excel
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  onClick={() => deleteCompSetMutation.mutate(compSet.id)}
                                  className="text-destructive"
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
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

      <SubjectMarinaDialog
        open={showSubjectDialog}
        onOpenChange={handleCloseSubjectDialog}
        subject={editingSubject}
      />

      <CompSetDialog
        open={showCompSetDialog}
        onOpenChange={handleCloseCompSetDialog}
        compSet={editingCompSet}
        subjects={subjects}
      />
    </div>
  );
}
